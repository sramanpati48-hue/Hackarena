import os
import sys
from dotenv import load_dotenv
import time

try:
    from pinecone import Pinecone, ServerlessSpec, PodSpec
except ImportError:
    print("Error: 'pinecone' library not installed. Please run 'pip install pinecone'")
    sys.exit(1)

# Load environment variables
load_dotenv()

def setup_pinecone():
    print("="*50)
    print("🌲 Pinecone Index Setup Wizard 🌲")
    print("="*50)

    # 1. API Key
    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        api_key = input("Enter your Pinecone API Key: ").strip()
        if not api_key:
            print("Error: API Key is required.")
            return
    else:
        print(f"✅ Found PINECONE_API_KEY in environment.")

    try:
        pc = Pinecone(api_key=api_key)
    except Exception as e:
        print(f"Error initializing Pinecone client: {e}")
        return

    # 2. Index Name
    index_name = input("Enter Index Name (default: 'nyaysahayak'): ").strip() or "nyaysahayak"

    # Check if index exists
    existing_indexes = pc.list_indexes().names()
    if index_name in existing_indexes:
        print(f"⚠️  Index '{index_name}' already exists.")
        choice = input("Do you want to delete and recreate it? (y/n): ").lower()
        if choice == 'y':
            print(f"Deleting index '{index_name}'...")
            pc.delete_index(index_name)
            time.sleep(2) # Wait for deletion
        else:
            print("Exiting setup.")
            return

    # 4. Integrated Inference
    # For integrated inference (embedding generation), we use 'multilingual-e5-large'
    # This automatically sets dimension to 1024 and metric to cosine
    print("\nℹ️  Using Integrated Inference Model: multilingual-e5-large")
    print("   This allows you to upsert text directly to Pinecone.")
    
    # 5. Cloud Spec (Serverless Only for Inference)
    print("\nSelect Cloud Provider (Serverless Required for Inference):")
    cloud = input("Enter Cloud Provider (aws/gcp/azure, default: aws): ").strip() or "aws"
    region = input("Enter Region (default: us-east-1): ").strip() or "us-east-1"
    
    spec = ServerlessSpec(cloud=cloud, region=region)
    print(f"\nConfiguration: Serverless ({cloud} / {region})")

    # Confirmation
    print(f"\nCreating index '{index_name}' with model 'multilingual-e5-large'...")
    confirm = input("Proceed? (y/n): ").lower()
    if confirm != 'y':
        print("Operation cancelled.")
        return

    import requests
    import json

    # Try SDK method first (create_index_for_model)
    if hasattr(pc, 'create_index_for_model'):
        print(f"✅ Found SDK method 'create_index_for_model'. Creating index...")
        try:
            pc.create_index_for_model(
                name=index_name,
                cloud=cloud,
                region=region,
                embed={
                    "model": "multilingual-e5-large",
                    "metric": "cosine",
                    "field_map": {"text": "chunk_text"}
                },
                tags={"project": "nyaysahayak"}
            )
            print(f"✅ Successfully created index '{index_name}' with Integrated Inference (SDK)!")
            print("Status: Creating (this may take a moment)")
            return
        except Exception as e:
            print(f"⚠️  SDK creation failed: {e}")
            print("   Falling back to REST API...")

    # REST API Fallback
    import requests
    import json

    print(f"ℹ️  Using REST API (create-for-model) fallback...")
    
    # Endpoint for Integrated Inference
    url = "https://api.pinecone.io/indexes/create-for-model"
    headers = {
        "Api-Key": api_key,
        "Content-Type": "application/json",
        "X-Pinecone-API-Version": "2025-01" 
    }
    
    # Payload for create-for-model
    payload = {
        "name": index_name,
        "cloud": cloud,
        "region": region,
        "embed": {
            "model": "multilingual-e5-large",
            "metric": "cosine",
            "field_map": {"text": "chunk_text"}
        },
        "tags": {"project": "nyaysahayak"} 
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code == 201:
            print(f"✅ Successfully created index '{index_name}' with Integrated Inference (REST)!")
            print("Status: Creating (this may take a moment)")
        elif response.status_code == 409:
             print(f"⚠️  Index '{index_name}' already exists (409 Conflict).")
        else:
            print(f"❌ Failed to create index. Status: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Failed to request index creation: {e}")

if __name__ == "__main__":
    setup_pinecone()
