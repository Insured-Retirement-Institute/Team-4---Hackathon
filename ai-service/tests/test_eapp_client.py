"""Tests for eapp_client — HTTP submission to callback URL."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.services.eapp_client import submit_to_eapp


@pytest.mark.asyncio
async def test_submit_success():
    mock_response = httpx.Response(200, json={"ok": True})
    mock_response._request = httpx.Request("POST", "https://example.com/callback")

    with patch("app.services.eapp_client.httpx.AsyncClient") as MockClient:
        instance = AsyncMock()
        instance.post.return_value = mock_response
        instance.__aenter__ = AsyncMock(return_value=instance)
        instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = instance

        result = await submit_to_eapp(
            "https://example.com/callback",
            {"owner_first_name": "John"},
        )

    assert result["status"] == "submitted"
    assert result["status_code"] == 200
    instance.post.assert_called_once_with(
        "https://example.com/callback",
        json={"owner_first_name": "John"},
    )


@pytest.mark.asyncio
async def test_submit_http_error():
    mock_response = httpx.Response(500, json={"error": "fail"})
    mock_response.request = httpx.Request("POST", "https://example.com/callback")

    with patch("app.services.eapp_client.httpx.AsyncClient") as MockClient:
        instance = AsyncMock()
        instance.post.return_value = mock_response
        instance.__aenter__ = AsyncMock(return_value=instance)
        instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = instance

        with pytest.raises(httpx.HTTPStatusError):
            await submit_to_eapp("https://example.com/callback", {})
