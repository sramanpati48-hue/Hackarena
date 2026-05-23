from langchain_core.messages import SystemMessage
from langgraph.graph import END
from utils import llm
from database.vector_db import VectorDB

vector_db = VectorDB()


def civil_agent(state):
    print(f"\n⚖️ CIVIL AGENT ACTIVATED")
    print(f"   Generating legal advice for civil dispute...")
    messages = state["messages"]
    last_user_message = messages[-1].content if messages else ""

    search_query = last_user_message
    if isinstance(last_user_message, list):
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
        header = " | ".join(
            [
                str(row.get("act_name") or "Unknown Act"),
                str(row.get("section_number") or "No Section"),
                str(row.get("title") or "Untitled"),
            ]
        )
        snippet = row.get("content") or row.get("summary") or ""
        metadata = {
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
        context_docs.append(f"{header}\n{snippet}\nMetadata: {metadata}")

    context_text = "\n\n".join(context_docs)
    print(f"   Context Retrieved: {len(context_rows)} legal chunks")

    system_prompt = f"""You are the Civil/Juridical Agent. Suggest next steps, FIR procedures, relevant IPC sections, and recommend finding a lawyer if needed.

    RELEVANT LEGAL CONTEXT (from public.legal_documents):
    {context_text}
    
    INSTRUCTIONS:
    - **STRICT LANGUAGE MATCHING (CRITICAL)**: 
      - If the user's input is in English, you MUST respond ENTIRELY in English.
      - ONLY respond in another language (like Bengali or Hindi) if the user's input is EXPLICITLY written in that language's script.
    """
    response = llm.invoke([SystemMessage(content=system_prompt)] + messages)
    return {
        "messages": [response],
        "final_response": response.content,
        "next_step": END,
        "retrieved_legal_chunks": context_rows,
    }
