"""Live Redtail CRM data source — replaces MockRedtailCRM."""

from __future__ import annotations

import asyncio
import html
import logging
import re
from typing import Any

from app.services.datasources.base import DataSource
from app.services.datasources.redtail_client import RedtailClient

logger = logging.getLogger(__name__)

CRM_FIELDS = [
    "owner_first_name", "owner_last_name", "owner_date_of_birth", "owner_ssn",
    "owner_gender", "owner_email", "owner_phone",
    "owner_address_street", "owner_address_city", "owner_address_state", "owner_address_zip",
    "owner_type", "owner_same_as_annuitant", "owner_marital_status",
    "annuitant_first_name", "annuitant_last_name", "annuitant_date_of_birth",
    "annuitant_ssn", "annuitant_gender",
]


def _strip_html(text: str | None) -> str:
    """Strip HTML tags and decode entities from a string."""
    if not text:
        return ""
    clean = re.sub(r"<[^>]+>", " ", text)
    clean = html.unescape(clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def _normalize_gender(value: str | None) -> str:
    """Normalize Redtail gender values to app format."""
    if not value:
        return ""
    v = value.strip().lower()
    if v in ("male", "m"):
        return "male"
    if v in ("female", "f"):
        return "female"
    return v


class RedtailCRM(DataSource):
    """Live Redtail CRM — fetches real client data via API."""

    def __init__(self, client: RedtailClient | None = None) -> None:
        self.client = client or RedtailClient()

    @staticmethod
    async def list_clients(client: RedtailClient | None = None) -> list[dict[str, str]]:
        """Fetch all Individual contacts from Redtail for dropdown selection."""
        rt = client or RedtailClient()
        clients: list[dict[str, str]] = []
        page = 1
        max_pages = 10  # safety limit

        while page <= max_pages:
            data = await rt.list_contacts(page=page)
            contacts = data.get("contacts", [])
            if not contacts:
                break

            for c in contacts:
                # Filter to Individual contacts (type "Individual" or type_id 1)
                contact_type = c.get("type", "") or ""
                if contact_type.lower() not in ("individual", ""):
                    continue
                first = c.get("first_name", "") or ""
                last = c.get("last_name", "") or ""
                display = f"{first} {last}".strip()
                if display:
                    clients.append({
                        "client_id": str(c.get("id", "")),
                        "display_name": display,
                    })

            # Check if there are more pages
            meta = data.get("meta", {})
            total_pages = meta.get("total_pages", 1)
            if page >= total_pages:
                break
            page += 1

        logger.info("Redtail: listed %d clients", len(clients))
        return clients

    async def query(self, params: dict[str, Any]) -> dict[str, Any]:
        """Fetch contact + addresses + phones + emails and map to app fields."""
        client_id = params.get("client_id", "")
        if not client_id:
            return {}

        cid = int(client_id)

        # Fetch all data concurrently
        contact_data, addr_data, phone_data, email_data = await asyncio.gather(
            self.client.get_contact(cid),
            self.client.get_addresses(cid),
            self.client.get_phones(cid),
            self.client.get_emails(cid),
            return_exceptions=True,
        )

        # Handle errors gracefully
        if isinstance(contact_data, Exception):
            logger.error("Redtail: failed to fetch contact %s: %s", client_id, contact_data)
            return {}

        fields: dict[str, Any] = {}

        # ── Contact fields ───────────────────────────────────────────────
        contact = contact_data.get("contact", contact_data)

        if contact.get("first_name"):
            fields["owner_first_name"] = contact["first_name"]
        if contact.get("last_name"):
            fields["owner_last_name"] = contact["last_name"]
        if contact.get("dob"):
            # Redtail returns ISO date string or "YYYY-MM-DDT00:00:00"
            dob = str(contact["dob"]).split("T")[0]
            if dob and dob != "None":
                fields["owner_date_of_birth"] = dob
        if contact.get("tax_id"):
            fields["owner_ssn"] = contact["tax_id"]
        gender = _normalize_gender(contact.get("gender"))
        if gender:
            fields["owner_gender"] = gender
        if contact.get("marital_status"):
            fields["owner_marital_status"] = contact["marital_status"].lower()

        # ── Address ──────────────────────────────────────────────────────
        if not isinstance(addr_data, Exception):
            addresses = addr_data.get("addresses", [])
            if addresses:
                addr = addresses[0]
                if addr.get("street_address"):
                    fields["owner_address_street"] = addr["street_address"]
                if addr.get("city"):
                    fields["owner_address_city"] = addr["city"]
                if addr.get("state"):
                    fields["owner_address_state"] = addr["state"]
                if addr.get("zip"):
                    fields["owner_address_zip"] = addr["zip"]

        # ── Phone ────────────────────────────────────────────────────────
        if not isinstance(phone_data, Exception):
            phones = phone_data.get("phones", [])
            if phones:
                fields["owner_phone"] = phones[0].get("number", "")

        # ── Email ────────────────────────────────────────────────────────
        if not isinstance(email_data, Exception):
            emails = email_data.get("emails", [])
            if emails:
                fields["owner_email"] = emails[0].get("address", "")

        # ── Defaults ─────────────────────────────────────────────────────
        fields["owner_type"] = "individual"
        fields["owner_same_as_annuitant"] = True

        # Copy owner → annuitant (same person default)
        annuitant_map = {
            "owner_first_name": "annuitant_first_name",
            "owner_last_name": "annuitant_last_name",
            "owner_date_of_birth": "annuitant_date_of_birth",
            "owner_ssn": "annuitant_ssn",
            "owner_gender": "annuitant_gender",
        }
        for owner_key, annuitant_key in annuitant_map.items():
            if owner_key in fields:
                fields[annuitant_key] = fields[owner_key]

        # Remove empty string values
        fields = {k: v for k, v in fields.items() if v not in ("", None)}

        logger.info("Redtail: mapped %d fields for contact %s", len(fields), client_id)
        return fields

    async def get_notes(self, contact_id: int) -> list[dict[str, str]]:
        """Fetch notes for a contact, strip HTML, return cleaned text."""
        try:
            data = await self.client.get_notes(contact_id)
        except Exception as exc:
            logger.error("Redtail: failed to fetch notes for %d: %s", contact_id, exc)
            return []

        notes = data.get("notes", [])
        result: list[dict[str, str]] = []
        for note in notes:
            body = _strip_html(note.get("body", ""))
            if not body:
                continue
            result.append({
                "body": body,
                "created_at": str(note.get("created_at", "")),
                "category": str(note.get("category", "")),
            })

        logger.info("Redtail: fetched %d notes for contact %d", len(result), contact_id)
        return result

    def available_fields(self) -> list[str]:
        return list(CRM_FIELDS)
