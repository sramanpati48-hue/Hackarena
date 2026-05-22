import os
import sys
# Add parent directory to path to import database modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.firebase_db import db
from database.vector_db import VectorDB

def sync_lawyers():
    vdb = VectorDB()
    if not vdb.pc:
        print("❌ Pinecone not initialized. Check PINECONE_API_KEY.")
        return

    print("🔄 Fetching lawyers from Firestore...")
    lawyers_ref = db.collection("lawyers").stream()
    
    count = 0
    for doc in lawyers_ref:
        lawyer_data = doc.to_dict()
        lawyer_id = doc.id
        
        # Construct a rich bio for semantic search
        name = lawyer_data.get('name', 'Unknown')
        specialization = lawyer_data.get('specialization', 'General')
        bio = lawyer_data.get('bio', '')
        
        rich_text = f"Lawyer: {name}. Specialization: {specialization}. Bio: {bio}"
        
        # Prepare metadata for filtering
        metadata = {
            "name": name,
            "specialization": specialization,
            "experience": lawyer_data.get('experience', 0),
            "hourlyRate": lawyer_data.get('hourlyRate', 0),
            "location": lawyer_data.get('location', 'India'),
            "verified": lawyer_data.get('verified', False)
        }
        
        print(f"Index -> [{lawyer_id}] {name}")
        vdb.add_lawyer(lawyer_id, rich_text, metadata)
        count += 1

    print(f"✅ Successfully synced {count} lawyers to Vector DB.")

if __name__ == "__main__":
    sync_lawyers()
