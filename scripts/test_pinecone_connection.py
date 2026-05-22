import os
from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv()
load_dotenv(dotenv_path="agents/.env")

api_key = os.getenv("PINECONE_API_KEY")
if not api_key:
    print("❌ PINECONE_API_KEY not found.")
    exit(1)

try:
    pc = Pinecone(api_key=api_key)
    indexes = pc.list_indexes()
    print(f"Indexes: {indexes.names()}")
    
    index_name = "nyaysahayak"
    if index_name in indexes.names():
        print(f"✅ Index '{index_name}' found.")
        index = pc.Index(index_name)
        stats = index.describe_index_stats()
        print(f"Stats: {stats}")
        
        # Try a dummy query with zero vector to check dimensions
        # Assuming 1024 dim from multilingual-e5-large
        # But if it is integrated inference, we might need to query differently?
        # Let's just check stats first.
    else:
        print(f"❌ Index '{index_name}' not found.")

except Exception as e:
    print(f"❌ Error: {e}")
