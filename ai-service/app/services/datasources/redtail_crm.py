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
    "owner_first_name", "owner_last_name", "owner_middle_initial",
    "owner_date_of_birth", "owner_dob", "owner_ssn", "owner_ssn_tin",
    "owner_gender", "owner_email", "owner_phone",
    "owner_street_address", "owner_city", "owner_state", "owner_zip",
    "owner_type", "owner_same_as_annuitant", "owner_marital_status",
    "owner_occupation", "owner_employer_name",
    "owner_citizenship_status", "owner_country_of_citizenship",
    "annuitant_first_name", "annuitant_last_name", "annuitant_middle_initial",
    "annuitant_dob", "annuitant_ssn", "annuitant_gender",
    "annuitant_street_address", "annuitant_city", "annuitant_state", "annuitant_zip",
    "annuitant_phone", "annuitant_us_citizen",
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
        if contact.get("middle_name"):
            mi = contact["middle_name"].strip()
            if mi:
                fields["owner_middle_initial"] = mi[0]
        if contact.get("dob"):
            # Redtail returns ISO date string or "YYYY-MM-DDT00:00:00"
            dob = str(contact["dob"]).split("T")[0]
            if dob and dob != "None":
                fields["owner_date_of_birth"] = dob
                fields["owner_dob"] = dob
        if contact.get("tax_id"):
            fields["owner_ssn"] = contact["tax_id"]
            fields["owner_ssn_tin"] = contact["tax_id"]
        gender = _normalize_gender(contact.get("gender"))
        if gender:
            fields["owner_gender"] = gender
        if contact.get("marital_status"):
            fields["owner_marital_status"] = contact["marital_status"].lower()

        # Employment / occupation
        if contact.get("job_title") or contact.get("occupation"):
            fields["owner_occupation"] = contact.get("job_title") or contact.get("occupation", "")
        if contact.get("company_name") or contact.get("employer"):
            fields["owner_employer_name"] = contact.get("company_name") or contact.get("employer", "")

        # Citizenship
        fields["owner_citizenship_status"] = "us_citizen"
        fields["owner_country_of_citizenship"] = "US"
        fields["annuitant_us_citizen"] = True

        # ── Address ──────────────────────────────────────────────────────
        if not isinstance(addr_data, Exception):
            addresses = addr_data.get("addresses", [])
            if addresses:
                addr = addresses[0]
                if addr.get("street_address"):
                    fields["owner_street_address"] = addr["street_address"]
                    fields["owner_address_street"] = addr["street_address"]  # legacy alias
                if addr.get("city"):
                    fields["owner_city"] = addr["city"]
                    fields["owner_address_city"] = addr["city"]
                if addr.get("state"):
                    fields["owner_state"] = addr["state"]
                    fields["owner_address_state"] = addr["state"]
                    fields["signed_at_state"] = addr["state"]
                if addr.get("zip"):
                    fields["owner_zip"] = addr["zip"]
                    fields["owner_address_zip"] = addr["zip"]

        # ── Phone ────────────────────────────────────────────────────────
        if not isinstance(phone_data, Exception):
            phones = phone_data.get("phones", [])
            if phones:
                fields["owner_phone"] = phones[0].get("number", "")
                fields["annuitant_phone"] = phones[0].get("number", "")

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
            "owner_middle_initial": "annuitant_middle_initial",
            "owner_dob": "annuitant_dob",
            "owner_ssn": "annuitant_ssn",
            "owner_gender": "annuitant_gender",
            "owner_street_address": "annuitant_street_address",
            "owner_city": "annuitant_city",
            "owner_state": "annuitant_state",
            "owner_zip": "annuitant_zip",
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

    async def get_family_members(self, contact_id: int) -> list[dict[str, Any]]:
        """Fetch family members for a contact, enriching with full contact data for each."""
        try:
            data = await self.client.get_family(contact_id)
        except Exception as exc:
            logger.error("Redtail: failed to fetch family for %d: %s", contact_id, exc)
            return []

        # Redtail API returns: {"contact_family": {"members": [...]}}
        family = data.get("contact_family", {})
        members_raw = family.get("members", [])
        if not members_raw:
            return []

        members: list[dict[str, Any]] = []
        for m in members_raw:
            # Skip the contact themselves (they appear in their own family list)
            member_cid = m.get("contact_id")
            if member_cid == contact_id:
                continue

            rel_name = m.get("relationship_name")
            # If HOH member has no explicit relationship, infer "spouse" (HOH is typically the spouse)
            if not rel_name and m.get("hoh"):
                rel_name = "Spouse"
            rel_name = rel_name or "Other"

            member: dict[str, Any] = {
                "relationship": rel_name.lower(),
                "first_name": m.get("first_name", ""),
                "last_name": m.get("last_name", ""),
            }

            # Fetch full contact record for this family member
            if member_cid:
                try:
                    member_cid = int(member_cid)
                    contact_data, addr_data, phone_data, email_data = await asyncio.gather(
                        self.client.get_contact(member_cid),
                        self.client.get_addresses(member_cid),
                        self.client.get_phones(member_cid),
                        self.client.get_emails(member_cid),
                        return_exceptions=True,
                    )

                    if not isinstance(contact_data, Exception):
                        c = contact_data.get("contact", contact_data)
                        member["first_name"] = c.get("first_name", member["first_name"])
                        member["last_name"] = c.get("last_name", member["last_name"])
                        if c.get("middle_name"):
                            member["middle_initial"] = c["middle_name"].strip()[0] if c["middle_name"].strip() else ""
                        if c.get("dob"):
                            dob = str(c["dob"]).split("T")[0]
                            if dob and dob != "None":
                                member["dob"] = dob
                        if c.get("tax_id"):
                            member["ssn"] = c["tax_id"]
                        gender = _normalize_gender(c.get("gender"))
                        if gender:
                            member["gender"] = gender

                    if not isinstance(addr_data, Exception):
                        addrs = addr_data.get("addresses", [])
                        if addrs:
                            a = addrs[0]
                            member["street_address"] = a.get("street_address", "")
                            member["city"] = a.get("city", "")
                            member["state"] = a.get("state", "")
                            member["zip"] = a.get("zip", "")

                    if not isinstance(phone_data, Exception):
                        phones = phone_data.get("phones", [])
                        if phones:
                            member["phone"] = phones[0].get("number", "")

                    if not isinstance(email_data, Exception):
                        emails = email_data.get("emails", [])
                        if emails:
                            member["email"] = emails[0].get("address", "")

                except (ValueError, TypeError):
                    pass

            members.append(member)

        logger.info("Redtail: fetched %d family members for contact %d", len(members), contact_id)
        return members

    def available_fields(self) -> list[str]:
        return list(CRM_FIELDS)
