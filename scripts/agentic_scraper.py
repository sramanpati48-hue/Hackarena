
import os
import sys
import datetime
import traceback
import hashlib
from typing import TypedDict, List
from dotenv import load_dotenv

# LangGraph & langchain imports
from langgraph.graph import StateGraph, END
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

# Scraping tools
from ddgs import DDGS

# Monkey patch for lxml >= 5.0 (lxml_html_clean required for newspaper3k)
import lxml.html.clean
# If lxml_html_clean installed, ensure it's available as lxml.html.clean if needed (though new versions usually handle it)
# Specifically, newspaper3k might try: from lxml.html.clean import Cleaner
# Which works if lxml_html_clean is installed as a drop-in replacement or if lxml < 5.
# If lxml > 5 and lxml_html_clean is installed, it should work fine if imports are correct.
# However, `newspaper` often does `from lxml.html import clean` which fails.
# Let's try to be safe:
try:
    import lxml.html.clean
except ImportError:
    import lxml_html_clean
    lxml.html.clean = lxml_html_clean

import newspaper
from newspaper import Article

# Pinecone
from pinecone import Pinecone

# Load env
load_dotenv()
load_dotenv(dotenv_path="agents/.env")

# --- Configuration ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = "nyaysahayak"
EMBED_MODEL = "multilingual-e5-large" # Integrated Inference model

if not GROQ_API_KEY:
    print("❌ Error: GROQ_API_KEY not found in .env")
    sys.exit(1)
if not PINECONE_API_KEY:
    print("❌ Error: PINECONE_API_KEY not found in .env")
    sys.exit(1)

# Initialize Groq LLM
llm = ChatGroq(temperature=0, model_name="llama-3.1-8b-instant", api_key=GROQ_API_KEY)

# --- State Definition ---
class AgentState(TypedDict):
    topic: str
    namespace: str
    urls: List[str]
    valid_urls: List[str]
    scraped_content: List[dict] # {url, title, text, chunks}
    logs: List[str]

# --- Nodes ---

def search_node(state: AgentState):
    """Searches for trusted legal sources."""
    topic = state["topic"]
    print(f"\n🔎 [Search Agent] Searching for: '{topic}'...")
    
    print(f"\n🔎 [Search Agent] Searching for: '{topic}'...")
    
    # 1. Try very specific trusted query
    query_1 = f"{topic} site:indiankanoon.org" 
    # 2. Try slightly broader trusted query
    query_2 = f"{topic} (site:gov.in OR site:wikipedia.org)"
    # 3. Last resort general search
    query_3 = f"{topic} legal india"

    urls = []
    
    try:
        ddgs = DDGS()
        
        # Attempt 1
        print(f"   Attempt 1: {query_1}")
        results = list(ddgs.text(query_1, max_results=5))
        
        # Attempt 2 if needed
        if len(results) < 3:
             print(f"   Attempt 2: {query_2}")
             results += list(ddgs.text(query_2, max_results=5))
             
        # Attempt 3 if still low
        if len(results) < 2:
             print(f"   Attempt 3: {query_3}")
             results += list(ddgs.text(query_3, max_results=5))
        
        seen = set()
        for r in results:
            if r['href'] not in seen:
                urls.append(r['href'])
                seen.add(r['href'])
                
    except Exception as e:
        print(f"❌ Search failed: {e}")
        state["logs"].append(f"Search failed: {e}")
        
    print(f"   Found {len(urls)} potential URLs.")
    if not urls:
        print("   ⚠️ No URLs found. Please try a different topic or check internet connection.")
    else:
        print(f"   Samples: {urls[:3]}")

    return {"urls": urls}

def filter_node(state: AgentState):
    """Filters URLs for relevance using LLM (optional, but good for quality)."""
    urls = state["urls"]
    topic = state["topic"]
    print(f"\n⚖️  [Filter Agent] Evaluating {len(urls)} URLs for relevance...")
    
    # For now, we'll just do a basic domain check to be fast, 
    # but we could ask LLM to rate the URL if we had snippets. 
    # Let's keep it simple: trusted domains are already in query, so we trust them mostly.
    # We'll just remove duplicates.
    valid_urls = list(set(urls))
    
    print(f"   {len(valid_urls)} URLs passed filtering.")
    return {"valid_urls": valid_urls}

def scrape_node(state: AgentState):
    """Scrapes content using Newspaper3k for robust extraction."""
    urls = state["valid_urls"]
    scraped_data = []
    
    print(f"\n📰 [Scraper Agent] Extracting content from {len(urls)} pages...")
    
    for url in urls:
        print(f"   Processing: {url}...", end="", flush=True)
        try:
            article = Article(url)
            article.download()
            article.parse()
            
            text = article.text
            title = article.title
            
            # basic validation
            if len(text) < 500:
                print(" ❌ Skipped (Too short/No content)")
                continue
                
            # Chunking logic
            chunks = []
            chunk_size = 1500
            overlap = 200
            
            for i in range(0, len(text), chunk_size - overlap):
                chunk = text[i:i + chunk_size]
                if len(chunk) > 100: # Skip tiny chunks
                    chunks.append(chunk)

            if chunks:
                scraped_data.append({
                    "url": url,
                    "title": title,
                    "text": text,
                    "chunks": chunks
                })
                print(f" ✅ Processed ({len(chunks)} chunks)")
            else:
                print(" ⚠️ No valid chunks")
                
        except Exception as e:
            print(f" ❌ Error: {e}")
            
    return {"scraped_content": scraped_data}

def ingest_node(state: AgentState):
    """Upserts data to Pinecone using Integrated Inference."""
    data = state["scraped_content"]
    namespace = state["namespace"]
    
    print(f"\n🌲 [Ingest Agent] Upserting {len(data)} documents to Pinecone (Namespace: {namespace})...")
    
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(INDEX_NAME)
    
    total_chunks = 0
    
    # Batch upserts
    batch_size = 50
    records_batch = []
    
    for doc in data:
        url = doc['url']
        for i, chunk in enumerate(doc['chunks']):
            chunk_id = hashlib.md5(f"{url}_{i}".encode()).hexdigest()
            
            record = {
                "_id": chunk_id,
                "chunk_text": chunk, # Correct field for Integrated Inference
                "url": url,
                "title": doc['title'],
                "topic": state['topic'],
                "scraped_at": datetime.datetime.now().isoformat()
            }
            records_batch.append(record)
            
            if len(records_batch) >= batch_size:
                try:
                    index.upsert_records(namespace=namespace, records=records_batch)
                    total_chunks += len(records_batch)
                    print(f"   Upserted batch of {len(records_batch)} chunks...")
                    records_batch = []
                except Exception as e:
                    print(f"   ❌ Batch upsert failed: {e}")
                    # Try REST fallback if SDK method missing/fails
                    ingest_rest_fallback(records_batch, namespace)
                    records_batch = []

    # Final batch
    if records_batch:
        try:
            index.upsert_records(namespace=namespace, records=records_batch)
            total_chunks += len(records_batch)
            print(f"   Upserted final batch of {len(records_batch)} chunks.")
        except Exception as e:
             print(f"   ❌ Final batch upsert failed: {e}")
             ingest_rest_fallback(records_batch, namespace)
             
    print(f"\n🎉 Finished! Total Chunks Upserted: {total_chunks}")
    return {"logs": state["logs"] + [f"Upserted {total_chunks} chunks"]}

def ingest_rest_fallback(records, namespace):
    """Fallback to REST API for upserts."""
    import requests
    import json
    
    print("   ℹ️  Attempting REST API fallback for upsert...")
    host = Pinecone(api_key=PINECONE_API_KEY).describe_index(INDEX_NAME).host
    url = f"https://{host}/records/namespaces/{namespace}/upsert"
    
    headers = {
        "Api-Key": PINECONE_API_KEY,
        "Content-Type": "application/json",
        "X-Pinecone-API-Version": "2025-01"
    }
    
    # REST payload is slightly different
    payload = {"records": records}
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code == 200:
             print("   ✅ REST Upsert successful.")
        else:
             print(f"   ❌ REST Upsert failed ({response.status_code}): {response.text}")
    except Exception as e:
        print(f"   ❌ REST Request failed: {e}")


# --- Graph Construction ---
workflow = StateGraph(AgentState)

workflow.add_node("search", search_node)
workflow.add_node("filter", filter_node)
workflow.add_node("scrape", scrape_node)
workflow.add_node("ingest", ingest_node)

workflow.set_entry_point("search")
workflow.add_edge("search", "filter")
workflow.add_edge("filter", "scrape")
workflow.add_edge("scrape", "ingest")
workflow.add_edge("ingest", END)

app = workflow.compile()

# --- Main Execution ---
if __name__ == "__main__":
    print("==================================================")
    print("🤖 Nyaysahayak Agentic Scraper (LangGraph)")
    print("==================================================")
    
    topic = input("Enter Topic (e.g., 'IPC Section 302'): ").strip()
    namespace = input("Enter Namespace (e.g., 'laws'): ").strip().lower() or "laws"
    
    if not topic:
        print("❌ Topic is required.")
        sys.exit(1)
        
    initial_state = {
        "topic": topic,
        "namespace": namespace,
        "urls": [],
        "valid_urls": [],
        "scraped_content": [],
        "logs": []
    }
    
    # Run the graph
    app.invoke(initial_state)
