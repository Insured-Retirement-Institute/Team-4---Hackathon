"""Anthropic Bedrock SDK wrapper with tool use and streaming support."""
from __future__ import annotations

import logging
from typing import Any

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)


class LLMService:
    """Handles all interactions with Claude via AWS Bedrock."""

    def __init__(self, model: str | None = None) -> None:
        self.model = model or settings.bedrock_model
        self._client: anthropic.AnthropicBedrock | None = None

    @property
    def client(self) -> anthropic.AnthropicBedrock:
        if self._client is None:
            kwargs: dict[str, Any] = {
                "aws_region": settings.aws_region,
            }
            # Explicitly pass credentials from .env so we don't fall back
            # to the system AWS credential chain (which may be a different account)
            if settings.aws_access_key_id:
                kwargs["aws_access_key"] = settings.aws_access_key_id
            if settings.aws_secret_access_key:
                kwargs["aws_secret_key"] = settings.aws_secret_access_key
            if settings.aws_session_token:
                kwargs["aws_session_token"] = settings.aws_session_token

            self._client = anthropic.AnthropicBedrock(**kwargs)
        return self._client

    def chat(
        self,
        system_prompt: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        max_tokens: int = 4096,
    ) -> anthropic.types.Message:
        """Send a chat completion request with optional tools."""
        kwargs: dict[str, Any] = {
            "model": self.model,
            "max_tokens": max_tokens,
            "system": system_prompt,
            "messages": messages,
        }
        if tools:
            kwargs["tools"] = tools

        logger.debug("LLM request: model=%s, messages=%d, tools=%d",
                      self.model, len(messages), len(tools or []))

        response = self.client.messages.create(**kwargs)

        logger.debug("LLM response: stop_reason=%s, content_blocks=%d",
                      response.stop_reason, len(response.content))
        return response

    def chat_stream(
        self,
        system_prompt: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        max_tokens: int = 4096,
    ):
        """Stream a chat completion. Yields events from the Anthropic SDK."""
        kwargs: dict[str, Any] = {
            "model": self.model,
            "max_tokens": max_tokens,
            "system": system_prompt,
            "messages": messages,
        }
        if tools:
            kwargs["tools"] = tools

        with self.client.messages.stream(**kwargs) as stream:
            yield from stream

    @staticmethod
    def extract_text(response: anthropic.types.Message) -> str:
        """Extract text content from a response."""
        parts = []
        for block in response.content:
            if block.type == "text":
                parts.append(block.text)
        return "\n".join(parts)

    @staticmethod
    def extract_tool_calls(response: anthropic.types.Message) -> list[dict[str, Any]]:
        """Extract tool use blocks from a response."""
        calls = []
        for block in response.content:
            if block.type == "tool_use":
                calls.append({
                    "id": block.id,
                    "name": block.name,
                    "input": block.input,
                })
        return calls
