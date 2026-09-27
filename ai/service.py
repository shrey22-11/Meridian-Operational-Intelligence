"""Provider dispatch; legacy providers keep their original implementation."""
from backend.app.config import settings
from ai import analyst


def chat(question, history=None):
    if settings.ai_provider == "groq":
        from ai.groq_provider import chat as groq_chat
        return groq_chat(question, history)
    return analyst.chat(question, history)
