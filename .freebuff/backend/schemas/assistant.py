"""Pydantic models for the AI assistant chat."""

from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    role: str = "user"
    content: str = Field(default="", max_length=1000)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)


class ChatOut(BaseModel):
    reply: str
    provider: str
    used_llm: bool
    topic: str
    context_keys: list[str] = []
    suggestions: list[str] = []
