from langchain_core.messages import SystemMessage, AIMessage
from langgraph.graph import END
import database.supabase_db as supabase_db

def sahayak_agent(state):
    print(f"\n🤝 SAHAYAK AGENT (HUMAN HANDOFF) ACTIVATED")
    print(f"   Routing case to a Physical Nyay Guide...")

    user_details = state.get("user_details", {})
    user_id      = state.get("user_id", "") or user_details.get("user_id", "")
    user_name    = state.get("user_name", "") or "User"
    session_id   = state.get("session_id", "") or user_details.get("session_id", "")
    structured_report = state.get("structured_report", {})

    if not user_id:
        response_text = "Please log in to request a Nyay Guide."
        return {
            "messages": [SystemMessage(content=response_text)],
            "final_response": response_text,
            "suggested_actions": [],
            "next_step": END
        }

    # 1. Store the case in sahayak_cases Supabase table
    sahayak_case_id = supabase_db.forward_case_to_sahayak(
        user_id=user_id,
        user_name=user_name,
        structured_report=structured_report,
        session_id=session_id
    )

    # 2. Fetch available Nyay Guide profiles for the victim to browse
    sahayak_profiles = supabase_db.get_all_sahayak_profiles()
    # If no profiles registered yet, we still proceed gracefully
    recommended_sahayaks = [
        {
            "uid":            p.get("uid", ""),
            "name":           p.get("name", "Nyay Guide"),
            "location":       p.get("location", "Nearby"),
            "occupation":     p.get("occupation", "Community Legal Aid"),
            "bio":            p.get("bio", ""),
            "avatar":         p.get("avatar", ""),
            "contact_number": p.get("contact_number", ""),
            "email":          p.get("email", ""),
            "availability":   p.get("availability", "Available"),
            "rating":         p.get("rating", 4.5),
            "cases_resolved": p.get("cases_resolved", 0),
            "languages":      p.get("languages", ["Hindi", "English"]),
        }
        for p in sahayak_profiles
    ]

    response_text = (
        "I have registered your case and alerted nearby Nyay Guides (community legal helpers). "
        "Here are Sahayaks available in your area. You can view their profile, "
        "contact them directly, and accept one to get hands-on assistance."
    )

    print(f"   ✅ Sahayak case created: {sahayak_case_id}")
    print(f"   👥 Returning {len(recommended_sahayaks)} sahayak profiles to frontend")

    return {
        "messages":               [AIMessage(content=response_text)],
        "final_response":         response_text,
        "suggested_actions":      [],
        "next_step":              END,
        "recommended_sahayaks":   recommended_sahayaks,
        "sahayak_case_id":        sahayak_case_id,
        "show_sahayak_panel":     True,
    }
