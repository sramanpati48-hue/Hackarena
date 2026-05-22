import os
import sys
import datetime
import hashlib
import requests
import tempfile
import urllib.parse
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from pinecone import Pinecone

# Try importing PDF libraries
try:
    import PyPDF2
except ImportError:
    import subprocess
    print("Installing PyPDF2...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "PyPDF2"])
    import PyPDF2

try:
    import bs4
except ImportError:
    import subprocess
    print("Installing beautifulsoup4...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "beautifulsoup4"])
    from bs4 import BeautifulSoup

load_dotenv()
load_dotenv(dotenv_path="agents/.env")

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = "nyaysahayak"
NAMESPACE = "mlats"

if not PINECONE_API_KEY:
    print("❌ Error: PINECONE_API_KEY not found in .env")
    sys.exit(1)

PAGE_URL = "https://legalaffairs.gov.in/documents/mlat"

def get_pdf_links(url):
    print(f"Fetching page {url}...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
    # ignore SSL verification for government websites sometimes needed
    response = requests.get(url, headers=headers, verify=False)
    response.raise_for_status()
    
    soup = BeautifulSoup(response.content, 'html.parser')
    links = []
    
    for a_tag in soup.find_all('a', href=True):
        href = a_tag['href']
        if href.lower().endswith('.pdf'):
            # Convert relative URL to absolute
            full_url = urllib.parse.urljoin(url, href)
            links.append(full_url)
    
    print(f"✅ Found {len(links)} PDF links.")
    return list(set(links))

def download_pdf(url):
    print(f"Downloading PDF from {url}...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
    response = requests.get(url, headers=headers, verify=False)
    response.raise_for_status()
    
    fd, temp_path = tempfile.mkstemp(suffix=".pdf")
    with os.fdopen(fd, 'wb') as f:
        f.write(response.content)
    
    print(f"✅ Downloaded to {temp_path}")
    return temp_path

def parse_pdf(file_path):
    print(f"Parsing PDF {file_path}...")
    text = ""
    try:
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        print(f"✅ Extracted {len(text)} characters.")
    except Exception as e:
        print(f"⚠️ Failed to parse PDF {file_path}: {e}")
    return text

def chunk_text(text, chunk_size=1500, overlap=200):
    chunks = []
    for i in range(0, len(text), chunk_size - overlap):
        chunk = text[i:i + chunk_size]
        if len(chunk) > 100:
            chunks.append(chunk)
    print(f"✅ Created {len(chunks)} chunks.")
    return chunks

def ingest_rest_fallback(records, namespace):
    print("   ℹ️  Attempting REST API fallback for upsert...")
    host = Pinecone(api_key=PINECONE_API_KEY).describe_index(INDEX_NAME).host
    url = f"https://{host}/records/namespaces/{namespace}/upsert"
    
    headers = {
        "Api-Key": PINECONE_API_KEY,
        "Content-Type": "application/json",
        "X-Pinecone-API-Version": "2025-01"
    }
    
    payload = {"records": records}
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code == 200:
             print("   ✅ REST Upsert successful.")
        else:
             print(f"   ❌ REST Upsert failed ({response.status_code}): {response.text}")
    except Exception as e:
        print(f"   ❌ REST Request failed: {e}")

def upsert_to_pinecone(chunks, url, index):
    print(f"\n🌲 Upserting {len(chunks)} document chunks to Pinecone (Namespace: {NAMESPACE})...")
    
    total_chunks = 0
    batch_size = 50
    records_batch = []
    
    for i, chunk in enumerate(chunks):
        chunk_id = hashlib.md5(f"{url}_{i}".encode()).hexdigest()
        
        record = {
            "_id": chunk_id,
            "chunk_text": chunk,
            "url": url,
            "title": "Mutual Legal Assistance Treaty",
            "topic": "Mutual Legal Assistance Treaty",
            "scraped_at": datetime.datetime.now().isoformat()
        }
        records_batch.append(record)
        
        if len(records_batch) >= batch_size:
            try:
                index.upsert_records(namespace=NAMESPACE, records=records_batch)
                total_chunks += len(records_batch)
                print(f"   Upserted batch of {len(records_batch)} chunks...")
                records_batch = []
            except Exception as e:
                print(f"   ❌ Batch upsert failed: {e}")
                ingest_rest_fallback(records_batch, NAMESPACE)
                records_batch = []

    if records_batch:
        try:
            index.upsert_records(namespace=NAMESPACE, records=records_batch)
            total_chunks += len(records_batch)
            print(f"   Upserted final batch of {len(records_batch)} chunks.")
        except Exception as e:
             print(f"   ❌ Final batch upsert failed: {e}")
             ingest_rest_fallback(records_batch, NAMESPACE)
             
    print(f"\n🎉 Finished upserting for {url}! Total Chunks Upserted: {total_chunks}")
    return total_chunks

def main():
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index = pc.Index(INDEX_NAME)
        
        pdf_urls = get_pdf_links(PAGE_URL)
        if not pdf_urls:
            print("❌ No PDF links found on the page.")
            return

        total_upserted_overall = 0

        for url in pdf_urls:
            try:
                pdf_path = download_pdf(url)
                text = parse_pdf(pdf_path)
                if text:
                    chunks = chunk_text(text)
                    if chunks:
                        upserted = upsert_to_pinecone(chunks, url, index)
                        total_upserted_overall += upserted
                    else:
                        print(f"⚠️ No chunks created for {url}")
                else:
                    print(f"⚠️ No textual content extracted from {url}")
                os.remove(pdf_path)
            except Exception as e:
                 print(f"❌ Failed processing {url}: {e}")
                 
        print(f"\n✅✅✅ All done! Upserted {total_upserted_overall} chunks in total across {len(pdf_urls)} PDFs.")
        
    except Exception as e:
        print(f"❌ Script failed: {e}")

if __name__ == "__main__":
    main()
