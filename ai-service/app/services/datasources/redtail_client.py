"""Async HTTP client for Redtail CRM API with two-step authentication."""

from __future__ import annotations

import base64
import logging
import time
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Cache UserKey for 1 hour
_USER_KEY_CACHE: dict[str, tuple[str, float]] = {}
_CACHE_TTL = 3600  # seconds


class RedtailClient:
    """Async client for the Redtail CRM REST API.

    Auth flow:
      1. GET /authentication with Basic base64(apikey:username:password) → user_key
      2. Subsequent calls use UserKeyAuth base64(apikey:user_key)
    """

    def __init__(self) -> None:
        self.base_url = settings.redtail_base_url.rstrip("/")
        self.api_key = settings.redtail_api_key
        self.username = settings.redtail_username
        self.password = settings.redtail_password

    # ── Authentication ───────────────────────────────────────────────────

    async def authenticate(self) -> str:
        """Authenticate and return a UserKey (cached for 1 hour)."""
        cache_key = f"{self.api_key}:{self.username}"
        cached = _USER_KEY_CACHE.get(cache_key)
        if cached:
            user_key, ts = cached
            if time.time() - ts < _CACHE_TTL:
                return user_key

        basic_raw = f"{self.api_key}:{self.username}:{self.password}"
        basic_b64 = base64.b64encode(basic_raw.encode()).decode()

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}/authentication",
                headers={
                    "Authorization": f"Basic {basic_b64}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()

        data = resp.json()
        # Response shape: {"authenticated_user": {..., "user_key": "..."}}
        # or could be {"UserKey": "..."} depending on API version
        user_key = (
            data.get("authenticated_user", {}).get("user_key")
            or data.get("UserKey")
            or data.get("user_key")
        )
        if not user_key:
            raise ValueError(f"No user_key in authentication response: {list(data.keys())}")

        _USER_KEY_CACHE[cache_key] = (user_key, time.time())
        logger.info("Redtail: authenticated successfully, user_key cached")
        return user_key

    def _auth_header(self, user_key: str) -> str:
        raw = f"{self.api_key}:{user_key}"
        return f"Userkeyauth {base64.b64encode(raw.encode()).decode()}"

    # ── Generic GET with 401 retry ───────────────────────────────────────

    async def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        """GET a Redtail API endpoint. Retries once on 401 (expired UserKey)."""
        user_key = await self.authenticate()

        for attempt in range(2):
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(
                    f"{self.base_url}{path}",
                    headers={
                        "Authorization": self._auth_header(user_key),
                        "Content-Type": "application/json",
                    },
                    params=params,
                )

            if resp.status_code == 401 and attempt == 0:
                logger.warning("Redtail: 401 on %s, re-authenticating", path)
                cache_key = f"{self.api_key}:{self.username}"
                _USER_KEY_CACHE.pop(cache_key, None)
                user_key = await self.authenticate()
                continue

            resp.raise_for_status()
            return resp.json()

    # ── Typed API methods ────────────────────────────────────────────────

    async def list_contacts(self, page: int = 1) -> dict[str, Any]:
        """GET /contacts — paginated contact list."""
        return await self.get("/contacts", params={"page": page})

    async def get_contact(self, contact_id: int) -> dict[str, Any]:
        """GET /contacts/{id} — single contact record."""
        return await self.get(f"/contacts/{contact_id}")

    async def get_addresses(self, contact_id: int) -> dict[str, Any]:
        """GET /contacts/{id}/addresses — contact addresses."""
        return await self.get(f"/contacts/{contact_id}/addresses")

    async def get_phones(self, contact_id: int) -> dict[str, Any]:
        """GET /contacts/{id}/phones — contact phone numbers."""
        return await self.get(f"/contacts/{contact_id}/phones")

    async def get_emails(self, contact_id: int) -> dict[str, Any]:
        """GET /contacts/{id}/emails — contact email addresses."""
        return await self.get(f"/contacts/{contact_id}/emails")

    async def get_notes(self, contact_id: int) -> dict[str, Any]:
        """GET /contacts/{id}/notes — contact notes/activities."""
        return await self.get(f"/contacts/{contact_id}/notes")

    async def get_family(self, contact_id: int) -> dict[str, Any]:
        """GET /contacts/{id}/family — family members."""
        return await self.get(f"/contacts/{contact_id}/family")
