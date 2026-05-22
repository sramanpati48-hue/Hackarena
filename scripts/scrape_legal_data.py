import os
import sys
import time
import requests
from bs4 import BeautifulSoup
from ddgs import DDGS
from pinecone import Pinecone
from dotenv import load_dotenv
import datetime

# Load environment variables
load_dotenv()

def log_to_readme(topic, namespace, urls, chunk_count):
    """Logs the scraping run to the root README.md"""
    readme_path = "README.md"
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    log_entry = f"""
### 📜 Scrape Log: {timestamp}
- **Topic**: {topic}
- **Namespace**: {namespace}
- **Chunks**: {chunk_count}
- **Sources**:
"""
    for url in urls:
        log_entry += f"  - <{url}>\n"
    
    try:
        with open(readme_path, "a", encoding="utf-8") as f:
            f.write(log_entry)
        print(f"✅ Logged run to {readme_path}")
    except Exception as e:
        print(f"⚠️ Failed to log to README: {e}")

def search_topic(topic, max_results=5):
    """Searches DuckDuckGo for the topic."""
    print(f"🔍 Searching for: '{topic}'...")
    results = []
    try:
        with DDGS() as ddgs:
            # simple search
            search_results = list(ddgs.text(topic, max_results=max_results))
            for r in search_results:
                results.append(r['href'])
    except Exception as e:
        print(f"❌ Search failed: {e}")
    
    return results

def scrape_url(url):
    """Scrapes text content from a URL."""
    print(f"🌐 Scraping: {url}...")
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.extract()
            
        # Get text
        text = soup.get_text(separator="\n")
        
        # Break into lines and remove leading/trailing space on each
        lines = (line.strip() for line in text.splitlines())
        # Break multi-headlines into a line each
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        # Drop blank lines
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return text
    except Exception as e:
        print(f"⚠️ Failed to scrape {url}: {e}")
        return None

def chunk_text(text, chunk_size=1000, overlap=100):
    """Splits text into chunks."""
    if not text:
        return []
    
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start += (chunk_size - overlap)
    return chunks

def main():
    print("="*50)
    print("⚖️  Nyaysahayak Legal Data Scraper ⚖️")
    print("="*50)
    
    # 1. Setup Pinecone
    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        print("❌ Error: PINECONE_API_KEY not found in .env")
        return

    pc = Pinecone(api_key=api_key)
    index_name = "nyaysahayak"
    
    try:
        index = pc.Index(index_name)
    except Exception as e:
        print(f"❌ Error accessing index '{index_name}': {e}")
        print("💡 Did you run 'scripts/setup_pinecone.py'?")
        return

    # 2. Input
    topic = input("Enter Topic (e.g., 'IPC Section 302', 'Privacy Judgment'): ").strip()
    if not topic:
        print("Topic is required.")
        return
        
    namespace = input("Enter Namespace (e.g., 'ipc', 'judgments', 'constitution'): ").strip().lower()
    if not namespace:
        namespace = "general"

    # 3. Process
    urls = search_topic(topic)
    if not urls:
        print("No URLs found.")
        return
        
    print(f"Found {len(urls)} URLs. Processing...")
    
    total_chunks = 0
    processed_urls = []
    
    for url in urls:
        content = scrape_url(url)
        if not content:
            continue
            
        chunks = chunk_text(content)
        if not chunks:
            continue
            
        print(f"   📄 Extracted {len(chunks)} chunks from {url}")
        
        # Prepare records for Integrated Inference Upsert
        # We assume the index was created with field_map={"text": "chunk_text"}
        # So we expect a field named 'text' in the input record.
        
        records = []
        for i, chunk in enumerate(chunks):
            # ID format: url_hash-chunk_index
            # Simple ID:
            chunk_id = f"{abs(hash(url))}-{i}"
            
            # Record format for upsert_records (Integrated Inference)
            record = {
                "_id": chunk_id,
                "chunk_text": chunk, # This field is embedded by Pinecone
                "url": url,
                "topic": topic,
                "scraped_at": datetime.datetime.now().isoformat()
            }
            records.append(record)
            
        # Upsert
        try:
            # Using specific namespace
            # Helper to batch upserts if needed, but for simple script we do one batch per URL
            # Note: The Python SDK for integrated inference might use 'upsert_records' 
            # or we might need to use the standard upsert with a specific format.
            # Based on recent docs, let's try 'upsert_records' first, if not available, fallback to standard.
            
            if hasattr(index, 'upsert_records'):
                index.upsert_records(namespace=namespace, records=records)
                # Fallback: Use REST API for Integrated Inference
                print("   ⚠️  SDK method 'upsert_records' not found. Using REST API fallback...")
                host = pc.describe_index(index_name).host
                url = f"https://{host}/records/namespaces/{namespace}/upsert"
                headers = {
                    "Api-Key": api_key,
                    "Content-Type": "application/json"
                }
                payload = {"data": records}
                
                response = requests.post(url, headers=headers, json=payload)
                response.raise_for_status()
                # print(f"   REST Response: {response.json()}")
                
            print(f"   ✅ Upserted {len(records)} records to namespace '{namespace}'")
            total_chunks += len(records)
            processed_urls.append(url)
            
        except Exception as e:
            print(f"   ❌ Upsert failed: {e}")
            if "404" in str(e):
                print("   ⚠️  404 Error: The 'records' endpoint might not be available for this index type.")
                print("       Ensure you created the index with 'setup_pinecone.py' using the Integrated Inference option.")

    # 4. Finish
    print("\n" + "="*50)
    print(f"🎉 Done! Total Chunks Upserted: {total_chunks}")
    print("="*50)
    
    if total_chunks > 0:
        log_to_readme(topic, namespace, processed_urls, total_chunks)

if __name__ == "__main__":
    main()
