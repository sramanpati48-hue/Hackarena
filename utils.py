import os
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import BaseMessage
from dotenv import load_dotenv

# Load environment variables from the agents .env file
# Load environment variables
load_dotenv()
load_dotenv(dotenv_path="agents/.env")

class LLMFallbackWrapper:
    """
    Wrapper class to handle LLM fallbacks.
    Prioritizes Groq (Llama 3), falls back to Gemini (Flash/Pro).
    """
    def __init__(self):
        self.groq_llm = ChatGroq(
            temperature=0,
            model_name="llama-3.3-70b-versatile",
            groq_api_key=os.getenv("GROQ_API_KEY")
        )
        # Fallback 1: Gemini 2.5 Flash (Latest)
        self.gemini_flash = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash", 
            google_api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0
        )
        # Fallback 2: Gemini 3 Flash
        self.gemini_3 = ChatGoogleGenerativeAI(
            model="gemini-3-flash-preview",
            google_api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0
        )
         # Fallback 3: Gemini 2.5 Flash Lite (High Rate Limit)
        self.gemini_lite = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash-lite",
            google_api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0
        )
        self.models = [self.groq_llm, self.gemini_flash, self.gemini_3, self.gemini_lite]
        self.model_names = ["Groq Llama-3.3", "Gemini 2.5 Flash", "Gemini 3 Flash", "Gemini 2.5 Flash Lite"]

    def invoke(self, messages: list[BaseMessage]):
        errors = []
        for i, model in enumerate(self.models):
            try:
                # Check for multimodal content (list of dicts) which Groq Llama 3 doesn't support
                is_multimodal = False
                for m in messages:
                    if isinstance(m.content, list):
                        is_multimodal = True
                        break
                
                if is_multimodal and "Groq" in self.model_names[i]:
                    # print(f"⏩ Skipping {self.model_names[i]} due to multimodal content")
                    continue

                # print(f"👉 Trying LLM: {self.model_names[i]}")
                return model.invoke(messages)
            except Exception as e:
                print(f"⚠️ LLM Failed ({self.model_names[i]}): {e}")
                errors.append(f"{self.model_names[i]}: {str(e)}")
                continue
        
        raise Exception(f"All LLMs failed: {'; '.join(errors)}")

def get_llm():
    return LLMFallbackWrapper()

llm = get_llm()
