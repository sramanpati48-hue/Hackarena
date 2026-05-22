
import os
import sys
from pinecone import Pinecone
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
load_dotenv(dotenv_path="agents/.env")

def fetch_records():
    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        print("❌ Error: PINECONE_API_KEY not found.")
        return

    pc = Pinecone(api_key=api_key)
    index_name = "nyaysahayak"
    
    print(f"🌲 Connecting to Pinecone index '{index_name}'...")
    try:
        index = pc.Index(index_name)
    except Exception as e:
        print(f"❌ Failed to connect to index: {e}")
        return

    namespace = input("Enter Namespace to fetch from (default: 'laws'): ").strip() or "laws"
    query_text = input("Enter a search query to find records (default: 'legal'): ").strip() or "legal"

    print(f"\n🔍 Querying namespace '{namespace}' for '{query_text}'...")

    try:
        # For Integrated Inference, we query with 'data' (text) instead of 'vector'
        # Check if the SDK supports this directly or if we need to use REST
        # The latest SDK should support query(vector=..., inputs=...) or similar.
        # But for 'multilingual-e5-large', it creates dense vectors.
        # Let's try the standard query method which might accept 'data' or 'inputs' if the client is updated.
        # If not, we fall back to REST.
        
        # REST API is often safer for these new features if SDK is lagging
        import requests
        host = pc.describe_index(index_name).host
        # Correct endpoint for Integrated Inference text search
        # POST https://<index-host>/records/namespaces/<namespace>/search
        url = f"https://{host}/records/namespaces/{namespace}/search"
        
        headers = {
            "Api-Key": api_key,
            "Content-Type": "application/json",
            "X-Pinecone-API-Version": "2024-10"
        }
        
        payload = {
            "query": {
                "inputs": {"text": query_text},
                "top_k": 10
            },
            "fields": ["chunk_text", "url", "topic", "scraped_at"]
        }
        
        print(f"   Endpoint: {url}")
        
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            result = response.json()
            # The structure for search results might be different from standard query
            # Usually it returns 'result' key
            items = result.get('result', {}).get('hits', []) # Adjust based on actual response structure
            # If standard response structure:
            if not items and 'matches' in result:
                items = result['matches']
            
            print(f"\n✅ Found {len(items)} records:")
            for i, item in enumerate(items, 1):
                print(f"\n--- Record {i} ---")
                # Handle different potential structures
                _id = item.get('id') or item.get('_id')
                score = item.get('score')
                fields = item.get('fields', {})
                
                print(f"ID: {_id}")
                print(f"Score: {score:.4f}")
                print(f"Text: {fields.get('chunk_text', 'N/A')[:200]}...")
                print(f"Source: {fields.get('url', 'N/A')}")
        else:
            print(f"❌ Query failed: {response.status_code}")
            print(response.text)

    except Exception as e:
        print(f"❌ An error occurred: {e}")

if __name__ == "__main__":
    fetch_records()
