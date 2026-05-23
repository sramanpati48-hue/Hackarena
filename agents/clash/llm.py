"""OpenRouter LLM for Clash Mode agents."""
import os

from dotenv import load_dotenv
from langchain_core.messages import BaseMessage
from langchain_openai import ChatOpenAI

load_dotenv()
load_dotenv(dotenv_path="agents/.env")

CLASH_MODEL = os.getenv("CLASH_MODEL", "openrouter/owl-alpha")


class ClashLLMWrapper:
    """Clash-specific LLM using OpenRouter owl-alpha with Groq fallback."""

    def __init__(self):
        api_key = os.getenv("OPEN_ROUTER_API_KEY")
        use_groq_only = os.getenv("CLASH_USE_GROQ", "").lower() in ("1", "true", "yes")
        self.primary = None
        if api_key and not use_groq_only:
            self.primary = ChatOpenAI(
                model=CLASH_MODEL,
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1",
                temperature=0.35,
                timeout=20,
                max_retries=1,
                max_tokens=280,
                default_headers={
                    "HTTP-Referer": os.getenv("OPENROUTER_REFERER", "https://nyaysahayak.app"),
                    "X-Title": "NyaySahayak Clash Mode",
                },
            )
        self._primary_disabled = False
        from utils import llm as fallback_llm

        self.fallback = fallback_llm

    def invoke(
        self,
        messages: list[BaseMessage],
        *,
        max_tokens: int = 400,
        temperature: float | None = None,
    ):
        if self.primary and not self._primary_disabled:
            try:
                kwargs: dict = {"max_tokens": max_tokens}
                if temperature is not None:
                    kwargs["temperature"] = temperature
                bound = self.primary.bind(**kwargs)
                return bound.invoke(messages)
            except Exception as e:
                print(f"⚠️ Clash OpenRouter failed, using fallback: {e}")
                self._primary_disabled = True
        try:
            return self.fallback.groq_llm.invoke(messages, max_tokens=max_tokens)
        except Exception:
            return self.fallback.invoke(messages)


from typing import Optional

_clash_llm: Optional[ClashLLMWrapper] = None


def get_clash_llm() -> ClashLLMWrapper:
    global _clash_llm
    if _clash_llm is None:
        _clash_llm = ClashLLMWrapper()
    return _clash_llm
