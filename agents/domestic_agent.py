from langchain_core.messages import SystemMessage
from langgraph.graph import END
from utils import llm

def domestic_agent(state):
    print(f"\n🏠 DOMESTIC AGENT ACTIVATED")
    print(f"   Generating guidance for domestic/financial issue...")
    messages = state["messages"]
    system_prompt = """You are the Domestic/Financial Fraud Agent. Provide guidance on domestic violence, workplace harassment, or financial fraud cases.

    INSTRUCTIONS:
    - **STRICT LANGUAGE MATCHING (CRITICAL)**: 
      - If the user's input is in English, you MUST respond ENTIRELY in English.
      - ONLY respond in another language (like Bengali or Hindi) if the user's input is EXPLICITLY written in that language's script.
    """
    response = llm.invoke([SystemMessage(content=system_prompt)] + messages)
    return {"messages": [response], "final_response": response.content, "next_step": END}
