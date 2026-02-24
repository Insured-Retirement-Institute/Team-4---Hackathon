"""HTTP client for submitting application data to eApp callback URL."""
from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


async def submit_to_eapp(
    callback_url: str,
    application_data: dict[str, Any],
    timeout: float = 30.0,
) -> dict[str, Any]:
    """POST application data to the eApp callback URL.

    Returns a dict with 'status' and optionally 'detail'.
    Raises on network/HTTP errors.
    """
    logger.info("Submitting %d fields to %s", len(application_data), callback_url)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(callback_url, json=application_data)
        response.raise_for_status()

    logger.info("eApp submission succeeded: %d", response.status_code)
    return {
        "status": "submitted",
        "status_code": response.status_code,
    }
