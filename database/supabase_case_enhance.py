"""
Enhanced Case Management Functions for Supabase
- Handles situation_summary and collected_answers
- Manages PDF uploads and downloads
- Tracks case lifecycle with complete information
"""
import os
from typing import Optional, Dict, Any
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Warning: SUPABASE_URL or SUPABASE_ANON_KEY not found in environment.")
    supabase: Any = None
else:
    try:
        supabase: Any = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Error initializing Supabase client: {e}")
        supabase: Any = None


def save_case_with_situation_summary(
    uid: str,
    case_id: str,
    session_id: str,
    structured_report: dict,
    situation_summary: dict,
    collected_answers: dict,
    session_data: list,
    pdf_url: Optional[str] = None,
    user_language: str = "english"
) -> bool:
    """
    Saves a complete case record with situation summary and collected answers.
    
    Args:
        uid: User ID
        case_id: Case ID
        session_id: Chat session ID
        structured_report: Structured analysis of the case
        situation_summary: Complete situation context from report generator
        collected_answers: Q&A pairs collected during question processor phase
        session_data: Chat history for this session
        pdf_url: Optional URL to the generated PDF
        user_language: Language detected from user input
    
    Returns: True if successful, False otherwise
    """
    if not supabase:
        return False
    
    try:
        from datetime import datetime

        enriched_report = dict(structured_report or {})
        enriched_report["completion_context"] = {
            "session_id": session_id,
            "situation_summary": situation_summary or {},
            "collected_answers": collected_answers or {},
            "user_language": user_language,
            "has_answers": len(collected_answers or {}) > 0,
            "completed_at": datetime.now().isoformat()
        }

        # Primary fields now use first-class completion columns in public.cases.
        case_data = {
            "id": case_id,
            "session_id": session_id,
            "structured_report": enriched_report,
            "situation_summary": situation_summary or {},
            "collected_answers": collected_answers or {},
            "session_data": session_data,
            "pdf_url": pdf_url,
            "pdf_updated_at": datetime.now().isoformat() if pdf_url else None,
            "pdf_generated_at": datetime.now().isoformat() if pdf_url else None,
            "user_language": user_language,
            "status": "completed",
            "has_answers": len(collected_answers or {}) > 0
        }
        
        # Only attach user_id if it's a valid string (not empty for anonymous)
        if uid and str(uid).strip():
            case_data["user_id"] = str(uid).strip()
        else:
            case_data["user_id"] = None

        response = supabase.table("cases").upsert(case_data, on_conflict="id").execute()
        
        if response.data:
            print(f"✅ Case saved successfully (ID: {case_id})")
            return True
        else:
            print(f"❌ Failed to save case (ID: {case_id})")
            return False
            
    except Exception as e:
        print(f"❌ Error saving case with situation summary: {e}")
        return False


def update_case_with_pdf(case_id: str, pdf_url: str, cloudinary_folder: Optional[str] = None) -> bool:
    """
    Updates a case record with PDF URL after generation and Cloudinary upload.
    
    Args:
        case_id: Case ID
        pdf_url: URL of the uploaded PDF
        cloudinary_folder: Optional Cloudinary folder path used for storage
    
    Returns: True if successful, False otherwise
    """
    if not supabase:
        return False
    
    try:
        from datetime import datetime

        # Keep update fields aligned with existing table schema.
        update_data = {
            "pdf_url": pdf_url,
            "pdf_updated_at": datetime.now().isoformat(),
            "pdf_generated_at": datetime.now().isoformat(),
            "cloudinary_path": cloudinary_folder
        }
        
        response = supabase.table("cases").update(update_data).eq("id", case_id).execute()
        
        if response.data:
            print(f"✅ Case PDF URL updated (ID: {case_id})")
            return True
        return False
        
    except Exception as e:
        print(f"❌ Error updating case PDF: {e}")
        return False


def get_case_complete(case_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves complete case information including structured report, 
    situation summary, collected answers, and PDF URL.
    
    Args:
        case_id: Case ID to retrieve
    
    Returns: Complete case dict or None if not found
    """
    if not supabase:
        return None
    
    try:
        response = supabase.table("cases").select("*").eq("id", case_id).single().execute()
        
        if response.data:
            return response.data
        return None
        
    except Exception as e:
        print(f"❌ Error retrieving complete case: {e}")
        return None


def get_user_cases_complete(uid: str):
    """
    Retrieves all cases for a user with complete information including
    situation summaries and collected answers.
    
    Args:
        uid: User ID
    
    Returns: List of complete case records
    """
    if not supabase:
        return []
    
    try:
        response = supabase.table("cases").select("*").eq("user_id", uid).order("timestamp", desc=True).execute()
        
        if response.data:
            return response.data
        return []
        
    except Exception as e:
        print(f"❌ Error retrieving user cases: {e}")
        return []


def get_case_pdf_download_info(case_id: str) -> Optional[Dict[str, str]]:
    """
    Gets PDF download information for a case (URL and metadata).
    
    Args:
        case_id: Case ID
    
    Returns: Dict with pdf_url and metadata, or None if not found
    """
    if not supabase:
        return None
    
    try:
        response = supabase.table("cases").select(
            "pdf_url, structured_report, situation_summary, timestamp"
        ).eq("id", case_id).single().execute()
        
        if response.data and response.data.get("pdf_url"):
            return {
                "download_url": response.data.get("pdf_url"),
                "case_type": response.data.get("structured_report", {}).get("incident_type", "Unknown"),
                "created_at": response.data.get("timestamp"),
                "case_id": case_id
            }
        return None
        
    except Exception as e:
        print(f"❌ Error retrieving case PDF info: {e}")
        return None


def search_cases_by_status(uid: str, status: str = "completed"):
    """
    Retrieves cases for a user filtered by status.
    
    Args:
        uid: User ID
        status: Case status to filter by (e.g., 'completed', 'pending')
    
    Returns: List of matching case records
    """
    if not supabase:
        return []
    
    try:
        response = (
            supabase.table("cases")
            .select("*")
            .eq("user_id", uid)
            .eq("status", status)
            .order("timestamp", desc=True)
            .execute()
        )
        
        return response.data if response.data else []
        
    except Exception as e:
        print(f"❌ Error searching cases by status: {e}")
        return []
