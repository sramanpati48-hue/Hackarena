from langchain_core.messages import SystemMessage
from langgraph.graph import END
from utils import llm
from database.vector_db import VectorDB
from agents.common_utils import get_user_location_context, get_local_scam_summary

# Initialize VectorDB once
vector_db = VectorDB()

def cyber_agent(state):
    print(f"\n🔐 CYBER AGENT ACTIVATED")
    print(f"   Generating legal advice for cyber crime...")
    
    messages = state["messages"]
    last_user_message = messages[-1].content if messages else ""
    
    # 1. Retrieve relevant context from Supabase legal_documents
    search_query = last_user_message
    if isinstance(last_user_message, list):
        # Extract text from multimodal content
        search_query = ""
        for item in last_user_message:
            if isinstance(item, dict) and item.get("type") == "text":
                search_query = item.get("text", "")
                break
    
    context_rows = []
    if search_query and isinstance(search_query, str):
      context_rows = vector_db.search_legal_documents(search_query, top_k=5)

    context_docs = []
    for row in context_rows:
      if not isinstance(row, dict):
        continue
      header_parts = [
        row.get("act_name") or "Unknown Act",
        row.get("section_number") or "No Section",
        row.get("title") or "Untitled",
      ]
      header = " | ".join(str(part) for part in header_parts)
      snippet = row.get("content") or row.get("summary") or ""
      row_json = {
        "id": row.get("id"),
        "category": row.get("category"),
        "authority": row.get("authority"),
        "legal_status": row.get("legal_status"),
        "source_url": row.get("source_url"),
        "pdf_page_reference": row.get("pdf_page_reference"),
        "similarity": row.get("similarity"),
        "keywords": row.get("keywords"),
        "related_acts": row.get("related_acts"),
      }
      context_docs.append(f"{header}\n{snippet}\nMetadata: {row_json}")

    context_text = "\n\n".join(context_docs)

    print(f"   Context Retrieved: {len(context_rows)} legal chunks")

    # 2. Geolocation & Local Context
    user_details = state.get("user_details", {})
    location_data = user_details.get("location")
    city, state_name, loc_str = get_user_location_context(location_data)
    
    # Retrieve local scam trends to warn user if relevant
    local_scam_context = get_local_scam_summary(city)

    # 3. Construct System Prompt with Context
    system_prompt = f"""You are the Cyber Crime Agent (Legal Assistant). 
    Provide advice on lodging complaints, freezing accounts, and relevant IT/Cyber laws.
    
    USER LOCATION: {loc_str}
    LOCAL SCAM ALERTS:
    {local_scam_context}
    
    RELEVANT LEGAL CONTEXT (from Indian Laws/Previous Cases):
    {context_text}
    
    INSTRUCTIONS:
    - **STRICT LANGUAGE MATCHING (CRITICAL)**: 
      - If the user's input is in English, you MUST respond ENTIRELY in English.
      - Do NOT let the USER LOCATION or LOCAL SCAM ALERTS influence your response language. (e.g., if the user asks in English but the location is West Bengal, RESPOND IN ENGLISH).
      - ONLY respond in another language (like Bengali or Hindi) if the user's input is EXPLICITLY written in that language's script.
    - DO NOT start with greetings. Start directly with the STEP-BY-STEP ADVICE.
    - **CRITICAL**: You MUST include the following classification tags at the bottom of your response for the system to process:
      - `[Cognizable: Yes/No]` (Determine if the offense is cognizable)
      - `[Complex_MLAT: Yes/No]` (Determine if the offense involves international treaties, MLATs, or is highly complex)
      - `[Fraud_Under_10k: Yes/No/NA]` (Determine if the user explicitly mentioned a financial fraud amount below 10,000 INR. Choose NA if no fraud or amount not specified)
    - USE HEAVY MARKDOWN FORMATTING:
      - Use `## Heading 2` for main sections.
      - Use `**Bold**` for critical terms/numbers.
      - Use `> Blockquotes` for improved emphasis.
      - Use `- Bullet points` for lists.
      - Use `1. Numbered lists` for sequential steps.
    
    STRUCTURE YOUR RESPONSE AS FOLLOWS (Adapt to Language):
    
    ## 🚨 Immediate Action Required
    > **Critical**: If financial loss occurred, call **1930** immediately.
    - If location is known ({city}), visit **Cyber Crime Cell in {city}**.
    
    ## 📝 Step-by-Step Complaint Process
    1. **Call 1930**: Report the transaction ID.
    2. **File Online**: Go to [www.cybercrime.gov.in](https://www.cybercrime.gov.in).
    3. **Visit Police Station**: File a formal FIR.
    
    ## ⚖️ Legal Analysis & Sections
    - **IT Act Section 66C**: Identity Theft.
    - **IPC Section 420**: Cheating/Dishonesty.
    *(Cite relevant laws from context)*
    
    ## 🛡️ Prevention Tips
    - **Do not share OTPs**.
    - **Verify caller identity**.
    
    ## Classification Data (Internal)
    [Cognizable: ...]
    [Complex_MLAT: ...]
    [Fraud_Under_10k: ...]
    """
    
    response = llm.invoke([SystemMessage(content=system_prompt)] + messages)
    return {
      "messages": [response],
      "final_response": response.content,
      "next_step": "report_generator",
      "retrieved_legal_chunks": context_rows,
    }
