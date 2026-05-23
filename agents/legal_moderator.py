from langchain_core.messages import SystemMessage
from langgraph.graph import END
import os
import sys
import database.supabase_db as supabase_db

# Ensure the parent directory is in sys.path so we can import modules
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

def legal_moderator_agent(state):
    print(f"\n⚖️ LEGAL MODERATOR AGENT ACTIVATED")
    print(f"   Reviewing case and creating intervention in Supabase...")
    
    # Extract everything from state (report_agent prepared all of this)
    structured_report = state.get("structured_report", {})
    user_details = state.get("user_details", {})
    user_id = user_details.get("user_id", "anonymous")
    session_id = user_details.get("session_id")
    case_id = state.get("case_id")

    # Verbatim user messages and location — passed from report_agent via state
    user_statement = state.get("user_statement", "")
    location = state.get("location", {})
    pdf_url = state.get("pdf_url") or (structured_report.get("pdf_url") if isinstance(structured_report, dict) else None)

    # Write the case to Supabase moderator queue (single source of truth)
    intervention_case_id = case_id or "Unknown"
    try:
        intervention_case_id = supabase_db.create_intervention_case(
            user_id,
            structured_report,
            collection_name="moderator",
            session_id=session_id,
            user_statement=user_statement,
            location=location,
            case_id=case_id,
            pdf_url=pdf_url
        )
        print(f"   ✅ Case written to Supabase queue 'moderator' with ID: {intervention_case_id}")
    except Exception as e:
        print(f"   ❌ Failed to write case to Supabase: {e}")

    # Send a confirmation response back to the user
    response_text = "🚨 **MODERATOR REVIEW INITIATED**\n\nYour case needs a human legal moderator review due to risk and complexity signals detected in the report.\n\n_Your case is now marked as pending review. You can continue chatting while the moderator reviews your details and PDF report._"
    
    return {
        "messages": [SystemMessage(content=response_text)], 
        "final_response": response_text,
        "intervention_required": True,
        "intervention_collection": "moderator",
        "case_id": intervention_case_id,
        "suggested_actions": [],
        "next_step": END
    }
