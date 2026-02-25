"""Retell AI service wrapper for outbound phone calls."""
from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

RETELL_BASE_URL = "https://api.retellai.com"


class RetellService:
    """Wrapper around the Retell AI REST API."""

    def __init__(self) -> None:
        self._api_key = settings.retell_api_key
        self._agent_id = settings.retell_agent_id
        self._from_number = settings.retell_phone_number

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    async def create_outbound_call(
        self,
        to_number: str,
        missing_fields: list[dict],
        client_name: str,
        advisor_name: str,
    ) -> dict:
        """Initiate an outbound phone call to the client via Retell AI.

        Returns the call object with call_id and status.
        """
        missing_fields_prompt = "\n".join(
            f"- {f['label']}" for f in missing_fields
        )

        payload = {
            "from_number": self._from_number,
            "to_number": to_number,
            "override_agent_id": self._agent_id,
            "metadata": {
                "missing_field_ids": [f["id"] for f in missing_fields],
            },
            "retell_llm_dynamic_variables": {
                "missing_fields_prompt": missing_fields_prompt,
                "advisor_name": advisor_name,
                "client_name": client_name,
            },
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{RETELL_BASE_URL}/v2/create-phone-call",
                headers=self._headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("Retell call created: call_id=%s", data.get("call_id"))
            return data

    async def get_call(self, call_id: str) -> dict:
        """Get the current status and details of a Retell call."""
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{RETELL_BASE_URL}/v2/get-call/{call_id}",
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json()


retell_service = RetellService()
