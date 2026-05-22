
import os
import sys
import datetime
import hashlib
import io
from typing import List
from dotenv import load_dotenv
import requests

# PDF extraction
from PyPDF2 import PdfReader

# Newspaper for HTML scraping
import lxml.html.clean
try:
    import lxml.html.clean
except ImportError:
    import lxml_html_clean
    lxml.html.clean = lxml_html_clean

from newspaper import Article

# Pinecone
from pinecone import Pinecone

# Load env
load_dotenv()
load_dotenv(dotenv_path="agents/.env")

# --- Configuration ---
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = "nyaysahayak"

if not PINECONE_API_KEY:
    print("❌ Error: PINECONE_API_KEY not found in .env")
    sys.exit(1)

def extract_text_from_pdf(url: str) -> tuple:
    """Download and extract text from PDF URL."""
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        pdf_file = io.BytesIO(response.content)
        reader = PdfReader(pdf_file)
        
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        
        # Get title from PDF metadata or URL
        title = reader.metadata.get('/Title', url.split('/')[-1]) if reader.metadata else url.split('/')[-1]
        
        return text.strip(), str(title)
    except Exception as e:
        raise Exception(f"PDF extraction failed: {e}")

def extract_text_from_html(url: str) -> tuple:
    """Extract text from HTML page using Newspaper3k."""
    article = Article(url)
    article.download()
    article.parse()
    return article.text, article.title or "Untitled"

def scrape_and_upsert(urls: List[str], topic: str, namespace: str = "laws"):
    """Scrapes URLs (HTML or PDF) and upserts to Pinecone with quality checks."""
    
    print(f"\n📰 [Scraper] Processing {len(urls)} URLs...")
    print(f"Topic: {topic}")
    print(f"Namespace: {namespace}\n")
    
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(INDEX_NAME)
    
    total_chunks = 0
    successful_scrapes = 0
    
    for url in urls:
        print(f"\n🌐 Processing: {url}")
        
        # Detect if URL is PDF
        is_pdf = url.lower().endswith('.pdf') or '.pdf' in url.lower()
        
        try:
            # Extract text based on URL type
            if is_pdf:
                print(f"   📕 Type: PDF Document")
                text, title = extract_text_from_pdf(url)
            else:
                print(f"   🌐 Type: HTML Page")
                text, title = extract_text_from_html(url)
            
            # Validation
            if len(text) < 1000:
                print(f"   ⚠️ Skipped - Too short ({len(text)} chars)")
                continue
            
            # Clean text
            text = ' '.join(text.split())
            
            print(f"   📄 Title: {title}")
            print(f"   📏 Length: {len(text)} chars")
            
            # Smart sentence-based chunking
            chunks = []
            chunk_size = 2000
            overlap = 300
            
            sentences = text.split('. ')
            current_chunk = ""
            
            for sentence in sentences:
                if len(current_chunk) + len(sentence) < chunk_size:
                    current_chunk += sentence + ". "
                else:
                    if len(current_chunk) > 500:
                        chunks.append(current_chunk.strip())
                    # Overlap from last 50 words
                    words = current_chunk.split()
                    overlap_text = ' '.join(words[-50:]) if len(words) > 50 else ''
                    current_chunk = overlap_text + " " + sentence + ". "
            
            # Final chunk
            if len(current_chunk) > 500:
                chunks.append(current_chunk.strip())
            
            if not chunks:
                print(f"   ⚠️ No valid chunks generated")
                continue
            
            print(f"   ✂️ Generated {len(chunks)} quality chunks")
            
            # Prepare records for Pinecone
            records = []
            for i, chunk in enumerate(chunks):
                chunk_id = hashlib.md5(f"{url}_{i}".encode()).hexdigest()
                record = {
                    "_id": chunk_id,
                    "chunk_text": chunk,
                    "url": url,
                    "title": title,
                    "topic": topic,
                    "scraped_at": datetime.datetime.now().isoformat()
                }
                records.append(record)
            
            # Upsert to Pinecone
            try:
                index.upsert_records(namespace=namespace, records=records)
                total_chunks += len(records)
                successful_scrapes += 1
                print(f"   ✅ Upserted {len(records)} chunks to Pinecone")
            except Exception as e:
                print(f"   ❌ Upsert failed: {e}")
                
        except Exception as e:
            print(f"   ❌ Scraping failed: {e}")
    
    print(f"\n{'='*50}")
    print(f"🎉 Scraping Complete!")
    print(f"   Successfully scraped: {successful_scrapes}/{len(urls)} URLs")
    print(f"   Total chunks upserted: {total_chunks}")
    print(f"   Namespace: {namespace}")
    print(f"{'='*50}\n")

if __name__ == "__main__":
    print("="*50)
    print("🤖 Nyaysahayak Manual URL Scraper")
    print("="*50)
    
    # Recommended URLs for testing
    print("\n💡 Recommended Legal URLs:")
    print("   1. https://indiankanoon.org/doc/1569253/")
    print("   2. https://indiankanoon.org/doc/1560742/")
    print("   3. https://indiankanoon.org/doc/1965344/")
    
    topic = input("\nEnter Topic: ").strip()
    namespace = input("Enter Namespace (default: laws): ").strip().lower() or "laws"
    
    print("\nEnter URLs (one per line, press Enter twice when done):")
    urls = []
    while True:
        url = input().strip()
        if not url:
            break
        urls.append(url)
    
    if not urls:
        print("❌ No URLs provided. Exiting.")
        sys.exit(1)
    
    scrape_and_upsert(urls, topic, namespace)
