import os
import time
import math
import json
import requests
from pinecone import Pinecone
from dotenv import load_dotenv
from typing import Any
from supabase import create_client, ClientOptions

load_dotenv()
load_dotenv(dotenv_path="agents/.env")

class VectorDB:
    def __init__(self):
        self.hf_embed_texts_url = os.getenv(
            "HF_EMBED_TEXTS_URL",
            "https://nyaysahayak1-nyaysahayak-embeddings.hf.space/embed-texts"
        )

        self.supabase: Any = None
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        if supabase_url and supabase_key:
            try:
                options = ClientOptions(headers={"Accept-Charset": "utf-8", "Content-Type": "application/json; charset=utf-8"})
                self.supabase = create_client(supabase_url, supabase_key, options=options)
            except Exception as e:
                print(f"⚠️ Supabase init failed in VectorDB: {e}")

        api_key = os.getenv("PINECONE_API_KEY")
        self.pc: Any = None
        self.index: Any = None
        
        if not api_key:
            print("❌ Error: PINECONE_API_KEY not found.")
            return

        try:
            pc_client = Pinecone(api_key=api_key)
            self.pc = pc_client
            self.index_name = "nyaysahayak"
            self.index = pc_client.Index(self.index_name)
        except Exception as e:
            print(f"❌ Error initializing Pinecone: {e}")
            self.pc = None
            self.index = None

    def _format_pgvector(self, values: list[float]) -> str:
        return "[" + ",".join(f"{float(v):.8f}" for v in values) + "]"

    def _parse_embedding(self, raw_embedding: Any) -> list[float]:
        if raw_embedding is None:
            return []
        if isinstance(raw_embedding, list):
            try:
                return [float(v) for v in raw_embedding]
            except Exception:
                return []
        if isinstance(raw_embedding, str):
            text = raw_embedding.strip()
            if text.startswith("[") and text.endswith("]"):
                text = text[1:-1]
            parts = [p.strip() for p in text.split(",") if p.strip()]
            try:
                return [float(v) for v in parts]
            except Exception:
                return []
        return []

    def _cosine_similarity(self, v1: list[float], v2: list[float]) -> float:
        if not v1 or not v2:
            return -1.0
        n = min(len(v1), len(v2))
        if n <= 0:
            return -1.0
        a = v1[:n]
        b = v2[:n]
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(y * y for y in b))
        if norm_a == 0 or norm_b == 0:
            return -1.0
        return dot / (norm_a * norm_b)

    def _embed_query_text(self, query: str) -> list[float]:
        payload = {"texts": [query], "normalize": True}
        try:
            response = requests.post(
                self.hf_embed_texts_url,
                headers={"Content-Type": "application/json; charset=utf-8"},
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                timeout=20,
            )
            response.raise_for_status()
            body = response.json() or {}
            embeddings = body.get("embeddings") or []
            if embeddings and isinstance(embeddings[0], list):
                return [float(v) for v in embeddings[0]]
        except Exception as e:
            print(f"❌ Error embedding query via HF embed-texts: {e}")
        return []

    def search_legal_documents(self, query: str, top_k: int = 5, filter_category: str | None = None):
        """
        Semantic search over public.legal_documents using HF embed-texts + Supabase.
        Returns full rows with similarity metadata.
        """
        if not query or not self.supabase:
            return []

        query_embedding = self._embed_query_text(query)
        if not query_embedding:
            return []

        try:
            rpc_payload = {
                "query_embedding": self._format_pgvector(query_embedding),
                "match_count": int(top_k),
                "filter_category": filter_category,
            }
            response = self.supabase.rpc("match_legal_documents", rpc_payload).execute()
            rows = response.data or []
            output = []
            for row in rows:
                if isinstance(row, dict) and "document_row" in row:
                    document_row = row.get("document_row") or {}
                    similarity = row.get("similarity")
                    if isinstance(document_row, dict):
                        output.append({"similarity": similarity, **document_row})
                elif isinstance(row, dict):
                    output.append(row)
            if output:
                return output
        except Exception as e:
            print(f"⚠️ RPC match_legal_documents unavailable, falling back to client-side ranking: {e}")

        # Fallback: fetch candidate rows and rank in Python (works without DB RPC function)
        try:
            query = self.supabase.table("legal_documents").select("*").not_.is_("embedding", "null")
            if filter_category:
                query = query.eq("category", filter_category)
            candidates = query.limit(max(300, top_k * 20)).execute().data or []

            scored = []
            for row in candidates:
                emb = self._parse_embedding(row.get("embedding"))
                score = self._cosine_similarity(query_embedding, emb)
                if score > -1:
                    scored.append((score, row))

            scored.sort(key=lambda x: x[0], reverse=True)
            ranked = []
            for score, row in scored[:top_k]:
                ranked.append({"similarity": round(float(score), 6), **row})
            return ranked
        except Exception as e:
            print(f"❌ Error searching legal_documents fallback: {e}")
            return []

    def search(self, query: str, top_k: int = 3, namespaces: list | None = None, filter: dict | None = None):
        """
        Search for relevant legal documents or scam reports using Pinecone.
        """
        if not self.pc or not self.index:
            print("⚠️ VectorDB not initialized.")
            return []

        if namespaces is None:
            namespaces = ["laws"]
        elif isinstance(namespaces, str):
            namespaces = [namespaces]

        # Route legal retrieval to Supabase legal_documents (not Pinecone)
        if any(ns in {"laws", "mlats", "legal_documents"} for ns in namespaces):
            legal_rows = self.search_legal_documents(query=query, top_k=top_k)
            return [str(row.get("content") or row.get("summary") or "") for row in legal_rows if isinstance(row, dict)]

        print(f"🔍 Searching VectorDB for: '{query}' in {namespaces} with filter {filter}")
        try:
            pc_client = self.pc
            idx = self.index
            if pc_client is None or idx is None:
                return []
            # Generate embedding using Pinecone Inference API
            embedding_response = pc_client.inference.embed(
                model="multilingual-e5-large",
                inputs=[query],
                parameters={"input_type": "query"}
            )
            embedding = embedding_response[0]['values']

            matches = []
            for ns in namespaces:
                try:
                    results = idx.query(
                        vector=embedding,
                        top_k=top_k,
                        include_metadata=True,
                        namespace=ns,
                        filter=filter
                    )
                    
                    for match in results['matches']:
                        if 'metadata' in match:
                            if 'text' in match['metadata']:
                                 matches.append(match['metadata']['text'])
                            elif 'description' in match['metadata']: # For scams
                                 matches.append(match['metadata']['description'])
                except Exception as ns_e:
                    print(f"⚠️ Error searching namespace {ns}: {ns_e}")
            
            return matches

        except Exception as e:
            print(f"❌ Error searching Pinecone: {e}")
            return []

    def add_lawyer(self, lawyer_id: str, bio: str, metadata: dict):
        """
        Add a lawyer profile to the vector database.
        """
        if not self.pc or not self.index:
            print("⚠️ VectorDB not initialized.")
            return

        print(f"⚖️ Adding Lawyer Profile: {lawyer_id} | Metadata: {metadata}")
        try:
            pc_client = self.pc
            idx = self.index
            if pc_client is None or idx is None:
                return
            # Generate embedding
            embedding_response = pc_client.inference.embed(
                model="multilingual-e5-large",
                inputs=[bio],
                parameters={"input_type": "passage"}
            )
            embedding = embedding_response[0]['values']
            
            # Upsert to Pinecone
            idx.upsert(
                vectors=[{
                    "id": f"lawyer_{lawyer_id}",
                    "values": embedding,
                    "metadata": {
                        "text": bio,
                        "type": "lawyer_profile",
                        **metadata
                    }
                }],
                namespace="lawyers"
            )
            print("✅ Lawyer profile stored successfully.")
            
        except Exception as e:
            print(f"❌ Error adding lawyer to Pinecone: {e}")

    def add_scam(self, description: str, metadata: dict):
        """
        Add a new scam report to the vector database.
        """
        if not self.pc or not self.index:
            print("⚠️ VectorDB not initialized.")
            return

        print(f"🚫 Adding Scam Report: {metadata.get('city', 'Unknown')} | Metadata: {metadata}")
        try:
            pc_client = self.pc
            idx = self.index
            if pc_client is None or idx is None:
                return
            # Generate embedding
            embedding_response = pc_client.inference.embed(
                model="multilingual-e5-large",
                inputs=[description],
                parameters={"input_type": "passage"}
            )
            embedding = embedding_response[0]['values']
            
            # Upsert to Pinecone
            scam_id = f"scam_{int(time.time() * 1000)}"
            idx.upsert(
                vectors=[{
                    "id": scam_id,
                    "values": embedding,
                    "metadata": {
                        "description": description,
                        "type": "scam_report",
                        **metadata
                    }
                }],
                namespace="scams"
            )
            print("✅ Scam report stored successfully.")
            
        except Exception as e:
            print(f"❌ Error adding scam report to Pinecone: {e}")

    def search_lawyers(self, query: str, top_k: int = 5, filter: dict | None = None):
        """
        Semantic search for lawyers based on query.
        """
        if not self.pc or not self.index:
            return []

        try:
            pc_client = self.pc
            idx = self.index
            if pc_client is None or idx is None:
                return []
            embedding_response = pc_client.inference.embed(
                model="multilingual-e5-large",
                inputs=[query],
                parameters={"input_type": "query"}
            )
            embedding = embedding_response[0]['values']

            results = idx.query(
                vector=embedding,
                top_k=top_k,
                include_metadata=True,
                namespace="lawyers",
                filter=filter
            )
            
            # Return lawyer IDs from the matches
            return [match['id'].replace("lawyer_", "") for match in results['matches']]
        except Exception as e:
            print(f"❌ Error searching lawyers: {e}")
            return []
