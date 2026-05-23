import os
from typing import TypedDict, Annotated, List, Union, Dict, Any
import operator
import uuid
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, BaseMessage
from utils import llm
import logging

# Configure logging — output to console (captured by journalctl on VPS)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import Agents
from agents.cyber_agent import cyber_agent
from agents.civil_agent import civil_agent
from agents.domestic_agent import domestic_agent
from agents.scam_agent import scam_agent
from agents.document_agent import document_agent
from agents.sahayak_agent import sahayak_agent
from agents.report_agent import report_generator_agent
from agents.legal_moderator import legal_moderator_agent
from agents.lawyer_forwarder_agent import lawyer_forwarder_agent
from agents.question_processor import question_processor_agent, generate_sexual_offense_intake_questions, detect_language
from agents.nodal_guide_agent import nodal_guide_agent
from agents.sexual_offense_agent import sexual_offense_agent
from agents.sexual_offense_keywords import has_sexual_offense_signal

class AgentState(TypedDict, total=False):
    """
    State definition for the agent graph.
    Includes fields for comprehensive case management with situation summary and Q&A.
    total=False makes all fields optional to allow flexible state updates.
    """
    # Core fields
    messages: List[BaseMessage]
    next_step: str
    user_details: Dict[str, Any]
    final_response: str
    suggested_actions: List[Dict[str, str]]
    structured_report: Dict[str, Any]
    case_id: str
    intervention_required: bool
    
    # User context
    user_statement: str
    location: Dict[str, Any]
    user_id: str
    user_name: str
    session_id: str
    
    # Question processor fields
    pending_questions: List[Dict[str, str]]
    current_question_idx: int
    collected_answers: Dict[str, str]
    question_collection_started: bool
    
    # Situation context
    situation_summary: Dict[str, Any]
    user_language: str
    
    # PDF generation
    pdf_ready: bool
    pdf_url: str

    # Retrieval context
    retrieved_legal_chunks: List[Dict[str, Any]]

    # Nodal Guide fields
    nodal_guide_consent_asked: bool
    nodal_guide_profiles: List[Dict[str, Any]]
    show_nodal_guide_panel: bool
    waiting_for_nodal_guide_consent: bool
    
    # Sexual Offense / Female Lawyer & Counsellor fields
    female_lawyer_profiles: List[Dict[str, Any]]
    female_nyayguide_profiles: List[Dict[str, Any]]
    show_female_lawyer_panel: bool
    show_female_nyayguide_panel: bool
    high_sensitivity: bool
    case_category: str
    show_sexual_offense_screening: bool
    sexual_offense_screening_answers: Dict[str, Any]
    screening_data: Dict[str, Any]
    sexual_offense_intake_flow: bool
    waiting_for_sexual_offense_choice: bool

def supervisor_agent(state: AgentState):
    """
    Core agent that routes the query to the appropriate specialist agent.
    Enhanced with:
    - Skip redundant agents if user is answering questions
    - Detect new cases mid-conversation
    - Smart routing based on conversation context
    """
    print(f"\n🔍 SUPERVISOR AGENT")
    print(f"   Analyzing query intent...")
    logger.info("Supervisor analyzing query...")
    messages = state["messages"]
    
    # Check if there are pending questions from a previous turn
    pending_questions = state.get("pending_questions", [])
    current_question_idx = state.get("current_question_idx", None)
    
    # If we have pending questions and user just provided input, this is likely an answer
    # Check for markers that indicate they're answering a question vs starting new case
    latest_user_msg = None
    if len(messages) > 0 and hasattr(messages[-1], "type") and messages[-1].type == "human":
        latest_user_msg = messages[-1].content.lower()

    # --- SMART ROUTE -1: Detect Sexual Offense Cases ---
    # Flow order: question_processor intake -> report_generator -> sexual_offense choices.
    case_category = state.get("case_category", "")
    high_sensitivity = state.get("high_sensitivity", False)
    sexual_offense_intake_flow = bool(state.get("sexual_offense_intake_flow", False))
    waiting_for_sexual_offense_choice = bool(state.get("waiting_for_sexual_offense_choice", False))

    if waiting_for_sexual_offense_choice:
        print("   ✓ Waiting for user sexual-offense support choice")
        logger.info("Routing back to sexual_offense for user choice")
        return {"next_step": "sexual_offense"}

    if sexual_offense_intake_flow and pending_questions:
        print("   ✓ Sexual-offense intake in progress")
        logger.info("Routing to question_processor for intake")
        return {"next_step": "question_processor"}
    
    if latest_user_msg and has_sexual_offense_signal(latest_user_msg):
        print("   🚨 SEXUAL OFFENSE KEYWORDS DETECTED")
        logger.info("Starting sexual-offense intake via question_processor")
        intake_questions = generate_sexual_offense_intake_questions(detect_language(messages[-1].content if messages else ""))
        return {
            "next_step": "question_processor",
            "case_id": str(uuid.uuid4()),
            "user_statement": messages[-1].content if messages else "",
            "high_sensitivity": True,
            "case_category": "sexual_offence",
            "human_takeover_required": True,
            "manual_review_required": True,
            "ai_detail_mode": "minimal",
            "priority_escalation": "immediate",
            "nyay_guide_flow": False,
            "connect_lawyer_enabled": True,
            "female_nyayguide_support_enabled": True,
            "sexual_offense_intake_flow": True,
            "pending_questions": intake_questions,
            "current_question_idx": 0,
            "collected_answers": {},
            "question_collection_started": False,
        }

    if case_category == "sexual_offence" or high_sensitivity:
        print("   🚨 SEXUAL OFFENSE CASE CONTEXT DETECTED")
        logger.info("Continuing sexual-offense flow")
        if pending_questions:
            return {"next_step": "question_processor"}
        return {"next_step": "sexual_offense"}

    # --- SMART ROUTE 0.5: User answering Nodal Guide consent ---
    waiting_for_nodal_guide_consent = state.get("waiting_for_nodal_guide_consent", False)
    if waiting_for_nodal_guide_consent:
        print("   ✓ Detected user answering Nodal Guide consent")
        logger.info("Routing back to nodal_guide for consent reply")
        return {"next_step": "nodal_guide"}

    # --- SMART ROUTE 0: Deterministic action intents in active case sessions ---
    # If the user explicitly asks for human guide/lawyer, skip report/question/moderator loop
    # and route directly to the requested handoff agent.
    if latest_user_msg:
        # Lawyer intent keywords — all 22 scheduled Indian languages
        lawyer_intents = [
            # English
            "connect lawyer", "connect to lawyer", "recommend lawyer", "lawyer",
            "advocate", "legal counsel", "forward to lawyer", "need a lawyer",
            # Hindi
            "वकील", "वकील चाहिए", "वकील से बात", "vakil", "advocate chahiye",
            # Bengali
            "আইনজীবী", "উকিল", "আইনজীবী দরকার",
            # Telugu
            "న్యాయవాది", "లాయర్", "న్యాయవాది కావాలి",
            # Marathi
            "वकील", "वकील हवा", "वकील लागतो",
            # Tamil
            "வக்கீல்", "வழக்கறிஞர்", "வக்கீல் வேண்டும்",
            # Urdu
            "وکیل", "وکیل چاہیے", "قانونی مدد",
            # Gujarati
            "વકીલ", "વકીલ જોઈએ", "વકીલ સાથે વાત",
            # Kannada
            "ವಕೀಲ", "ವಕೀಲರು ಬೇಕು", "ಲಾಯರ್",
            # Odia
            "ଓକିଲ", "ଉକିଲ ଦରକାର",
            # Malayalam
            "അഭിഭാഷകൻ", "വക്കീൽ", "ലോയർ വേണം",
            # Punjabi
            "ਵਕੀਲ", "ਵਕੀਲ ਚਾਹੀਦਾ", "ਵਕੀਲ ਨਾਲ ਗੱਲ",
            # Assamese
            "উকীল", "আইনজীৱী",
            # Maithili
            "वकील चाही",
            # Nepali
            "वकील", "कानुनी सहायता",
            # Kashmiri
            "وکیل",
            # Sindhi
            "وکيل",
            # Konkani
            "वकील हाय",
            # Dogri
            "वकील चाहिदा",
            # Manipuri
            "ওকিল",
            # Santali
            "lawyer darka",
        ]
        # Sahayak / human help keywords — all 22 scheduled Indian languages
        sahayak_intents = [
            # English
            "sahayak", "nyaysahayak", "nyay guide", "human help", "talk to human",
            "connect to nyay guide", "connect to sahayak", "human support",
            # Hindi
            "इंसान से बात", "सहायक", "न्यायसहायक", "मदद चाहिए", "इंसानी मदद",
            # Bengali
            "মানুষের সাহায্য", "সাহায্য দরকার", "মানুষের সাথে কথা",
            # Telugu
            "మానవ సహాయం", "సహాయకుడు", "మనిషితో మాట్లాడు",
            # Marathi
            "माणसाची मदत", "सहायक हवा", "माणसाशी बोलायचे",
            # Tamil
            "மனித உதவி", "உதவி வேண்டும்", "மனிதனிடம் பேசணும்",
            # Urdu
            "انسانی مدد", "مدد چاہیے", "انسان سے بات",
            # Gujarati
            "મદદ જોઈએ", "માણસ સાથે વાત", "સહાય",
            # Kannada
            "ಸಹಾಯ ಬೇಕು", "ಮಾನವ ಸಹಾಯ", "ಮನುಷ್ಯನೊಂದಿಗೆ ಮಾತನಾಡಿ",
            # Odia
            "ସାହାଯ୍ୟ ଦରକାର", "ମଣିଷ ସହ କଥା",
            # Malayalam
            "മനുഷ്യ സഹായം", "സഹായം വേണം", "മനുഷ്യനോട് സംസാരിക്കണം",
            # Punjabi
            "ਮਦਦ ਚਾਹੀਦੀ", "ਇਨਸਾਨੀ ਮਦਦ", "ਬੰਦੇ ਨਾਲ ਗੱਲ",
            # Assamese
            "সহায় লাগে", "মানুহৰ সৈতে কথা",
            # Maithili
            "मदति चाही",
            # Nepali
            "मद्दत चाहियो", "मानिससँग कुरा गर्नु",
            # Kashmiri
            "مدد چھُ ضرور",
            # Sindhi
            "مدد گهرجي",
            # Konkani
            "मदत जाय",
            # Dogri
            "मदद चाहिदी",
            # Manipuri
            "সাহায্য দরকার",
            # Santali
            "help darka",
        ]

        has_existing_case_context = bool(state.get("structured_report") or state.get("case_id"))
        if has_existing_case_context and any(term in latest_user_msg for term in lawyer_intents):
            print("   ✓ Explicit lawyer intent detected in active case -> routing directly to lawyer_forwarder")
            logger.info("Direct intent route: lawyer_forwarder")
            return {"next_step": "lawyer_forwarder"}

        if has_existing_case_context and any(term in latest_user_msg for term in sahayak_intents):
            print("   ✓ Explicit sahayak intent detected in active case -> routing directly to sahayak")
            logger.info("Direct intent route: sahayak")
            return {"next_step": "sahayak"}
    
    # --- SMART ROUTE 1: User answering questions ---
    if pending_questions and current_question_idx is not None:
        # Check if user is asking to start a NEW case (keywords indicating topic change)
        new_case_keywords = [
            # English
            "new case", "different issue", "something else", "another problem",
            "different problem", "new issue", "unrelated", "change topic",
            # Hindi
            "नया मामला", "अलग समस्या", "दूसरी बात",
            # Bengali
            "নতুন মামলা", "আলাদা সমস্যা",
            # Telugu
            "కొత్త కేసు", "వేరే సమస్య",
            # Marathi
            "नवीन केस", "वेगळी समस्या",
            # Tamil
            "புதிய வழக்கு", "வேறு பிரச்சனை",
            # Gujarati
            "નવો કેસ", "અલગ સમસ્યા",
            # Kannada
            "ಹೊಸ ಪ್ರಕರಣ", "ಬೇರೆ ಸಮಸ್ಯೆ",
            # Punjabi
            "ਨਵਾਂ ਕੇਸ", "ਵੱਖਰੀ ਸਮੱਸਿਆ",
            # Malayalam
            "പുതിയ കേസ്", "വേറൊരു പ്രശ്നം",
        ]
        
        if latest_user_msg and any(kw in latest_user_msg for kw in new_case_keywords):
            # User wants to start a new case - ask for confirmation
            print(f"   ⚠️  User requesting new case")
            confirmation_msg = (
                "I notice you'd like to discuss a different issue. "
                "\n\n**Would you like to:**\n"
                "1. Finish with the current case first?\n"
                "2. Start a new case about the new issue?\n\n"
                "Please let me know your preference."
            )
            return {
                "next_step": "civil",  # Default routing after clarification
                "final_response": confirmation_msg
            }
        
        # Otherwise, user is answering the pending question → route back to question_processor
        print(f"   ✓ Detected user answering question #{current_question_idx + 1}")
        logger.info("Routing to question_processor for answer collection")
        return {"next_step": "question_processor"}
    
    # --- SMART ROUTE 2: Detect new cases mid-conversation ---
    if len(messages) > 4:  # Only after initial back-and-forth
        # Check for case change indicators
        new_case_markers = {
            "different_issue": [
                "now ", "also ", "other ", "separate ", "another ",
                "doesn't involve", "not related", "completely different"
            ],
            "multiple_cases": [
                "i also have", "i'm also dealing with", "also experiencing",
                "in addition", "furthermore",
            ]
        }
        
        if latest_user_msg:
            for marker_type, keywords in new_case_markers.items():
                if any(kw in latest_user_msg for kw in keywords):
                    # Potential new case detected - ask user for clarification
                    print(f"   ⚠️  Potential new case detected (marker: {marker_type})")
                    confirmation_msg = (
                        "I notice you might be referring to a different situation. "
                        "\n\n**Would you like to:**\n"
                        "1. Continue discussing the original issue?\n"
                        "2. Start a new case about this new issue?\n\n"
                        "Please clarify so I can help you better."
                    )
                    return {
                        "next_step": "civil",  # Route to civil to handle this clarification
                        "final_response": confirmation_msg
                    }
    
    # --- Default routing (normal case) ---
    system_prompt = """You are a routing agent for NyayaSahayak, an Indian legal AI. Route the user's query to one agent.
    The user may write in any Indian language (Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Odia,
    Malayalam, Punjabi, Urdu, Assamese, Maithili, Santali, Kashmiri, Nepali, Sindhi, Konkani, Dogri, Bodo, Manipuri, Sanskrit) or English.
    Understand intent regardless of language.

    Agents:
    - cyber: money lost via UPI/bank/OTP/online fraud/phone scam (Digital financial loss)
    - civil: property/land dispute, divorce, tenant issue, consumer complaint (Non-digital financial loss)
    - domestic: physical/emotional abuse by family (dowry, violence) — NOT money issues
    - scam: suspicious call/message but NO money lost yet
    - document: analyze RTI, FIR, court notice, contract
    - sahayak: user wants human/Nyay Guide help
    - legal_moderator: user wants legal moderator review
    - lawyer_forwarder: user wants a lawyer

    Rules: money lost → always cyber | abuse only → domestic | unclear → civil
    Reply with ONE word only."""
    
    response = llm.invoke([SystemMessage(content=system_prompt)] + messages)
    
    # Extract string from response.content in case it's a multimodal list block
    content = response.content
    if isinstance(content, list):
        content = "".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
    elif not isinstance(content, str):
        content = str(content)
        
    route = content.strip().lower()
    
    # Normalize route
    valid_routes = ["cyber", "civil", "domestic", "scam", "document", "sahayak", "legal_moderator", "lawyer_forwarder", "question_processor"]
    if route not in valid_routes:
        # Fallback
        route = "civil" 
        
    print(f"   👉 ROUTING TO: {route.upper()}")
    logger.info(f"Supervisor decided routing to: {route}")
    return {"next_step": route}

# --- Graph Construction ---

workflow = StateGraph(AgentState)

workflow.add_node("supervisor", supervisor_agent)
workflow.add_node("cyber", cyber_agent)
workflow.add_node("civil", civil_agent)
workflow.add_node("domestic", domestic_agent)
workflow.add_node("scam", scam_agent)
workflow.add_node("document", document_agent)
workflow.add_node("sahayak", sahayak_agent)
workflow.add_node("legal_moderator", legal_moderator_agent)
workflow.add_node("lawyer_forwarder", lawyer_forwarder_agent)
workflow.add_node("question_processor", question_processor_agent)
workflow.add_node("report_generator", report_generator_agent)
workflow.add_node("nodal_guide", nodal_guide_agent)
workflow.add_node("sexual_offense", sexual_offense_agent)

workflow.set_entry_point("supervisor")

# Conditional Edges
def router(state: AgentState):
    return state.get("next_step", "civil")

workflow.add_conditional_edges(
    "supervisor",
    router,
    {
        "cyber": "cyber",
        "civil": "civil",
        "domestic": "domestic",
        "scam": "scam",
        "document": "document",
        "sahayak": "sahayak",
        "legal_moderator": "legal_moderator",
        "lawyer_forwarder": "lawyer_forwarder",
        "question_processor": "question_processor",
        "nodal_guide": "nodal_guide",
        "sexual_offense": "sexual_offense"
    }
)

# Route Specialist Agents to Report Generator for Standardization
workflow.add_edge("cyber", "report_generator")
workflow.add_edge("scam", "report_generator")
workflow.add_edge("civil", "report_generator")
workflow.add_edge("domestic", "report_generator")
workflow.add_edge("document", "report_generator")

# Report Generator determines next step: legal_moderator, question_processor, nodal_guide, or END
def report_router(state: AgentState):
    next_s = state.get("next_step", END)
    if next_s == "legal_moderator":
        return "legal_moderator"
    elif next_s == "question_processor":
        return "question_processor"
    elif next_s == "nodal_guide":
        return "nodal_guide"
    elif next_s == "sexual_offense":
        return "sexual_offense"
    return END

workflow.add_conditional_edges(
    "report_generator", 
    report_router, 
    {
        "legal_moderator": "legal_moderator", 
        "question_processor": "question_processor",
        "nodal_guide": "nodal_guide",
        "sexual_offense": "sexual_offense",
        END: END
    }
)

# Question Processor determines next step after Q&A completion.
def question_router(state: AgentState):
    next_s = state.get("next_step", END)
    if next_s == "report_generator":
        return "report_generator"
    if next_s == "legal_moderator":
        return "legal_moderator"
    if next_s == "nodal_guide":
        return "nodal_guide"
    if next_s == "sexual_offense":
        return "sexual_offense"
    return END

workflow.add_conditional_edges(
    "question_processor",
    question_router,
    {
        "report_generator": "report_generator",
        "legal_moderator": "legal_moderator",
        "nodal_guide": "nodal_guide",
        "sexual_offense": "sexual_offense",
        END: END
    }
)

# Others
workflow.add_edge("legal_moderator", END)
workflow.add_edge("lawyer_forwarder", END)
workflow.add_edge("sahayak", END)
workflow.add_edge("nodal_guide", END)
workflow.add_edge("sexual_offense", END)

from langgraph.checkpoint.memory import MemorySaver

# Compile with Memory Checkpointer for state persistence
checkpointer = MemorySaver()
agent_graph = workflow.compile(checkpointer=checkpointer)
