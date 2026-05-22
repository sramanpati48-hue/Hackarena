import os
import sys
import datetime
import hashlib
import requests
import tempfile
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

load_dotenv()
load_dotenv(dotenv_path="agents/.env")

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = "nyaysahayak"
NAMESPACE = "laws"

if not PINECONE_API_KEY:
    print("❌ Error: PINECONE_API_KEY not found in .env")
    sys.exit(1)

PDF_URL = "https://digitalscr.in/bzadiv/circulars/misc_circulars/uploads/Cognizable_Noncognizableoffences_sections.pdf"

def download_pdf(url):
    print(f"Downloading PDF from {url}...")
    response = requests.get(url)
    response.raise_for_status()
    
    fd, temp_path = tempfile.mkstemp(suffix=".pdf")
    with os.fdopen(fd, 'wb') as f:
        f.write(response.content)
    
    print(f"✅ Downloaded to {temp_path}")
    return temp_path

def parse_pdf(file_path):
    print(f"Parsing PDF {file_path}...")
    text = ""
    with open(file_path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    print(f"✅ Extracted {len(text)} characters.")
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

def upsert_to_pinecone(chunks, url):
    print(f"\n🌲 Upserting {len(chunks)} document chunks to Pinecone (Namespace: {NAMESPACE})...")
    
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(INDEX_NAME)
    
    total_chunks = 0
    batch_size = 50
    records_batch = []
    
    for i, chunk in enumerate(chunks):
        chunk_id = hashlib.md5(f"{url}_{i}".encode()).hexdigest()
        
        record = {
            "_id": chunk_id,
            "chunk_text": chunk,
            "url": url,
            "title": "Cognizable and Non-Cognizable Offences",
            "topic": "cognizable and non-cognizable offences",
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
             
    print(f"\n🎉 Finished! Total Chunks Upserted: {total_chunks}")

def main():
    try:
        pdf_path = download_pdf(PDF_URL)
        text = parse_pdf(pdf_path)
        chunks = chunk_text(text)
        if chunks:
            upsert_to_pinecone(chunks, PDF_URL)
        else:
            print("❌ No valid text could be extracted to chunk.")
            
        # Cleanup
        os.remove(pdf_path)
    except Exception as e:
        print(f"❌ Script failed: {e}")

if __name__ == "__main__":
    main()
