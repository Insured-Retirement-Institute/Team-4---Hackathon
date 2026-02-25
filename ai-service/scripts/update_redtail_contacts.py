#!/usr/bin/env python3
"""Update Redtail demo contacts with realistic names and data.

Usage:
    cd ai-service
    source venv/Scripts/activate
    python scripts/update_redtail_contacts.py
"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.datasources.redtail_client import RedtailClient

# Map existing contact IDs to updated profiles
UPDATES = {
    # The "Investor" couple → Whitfield couple
    1: {
        "first_name": "Margaret",
        "last_name": "Whitfield",
        "job_title": "Attorney",
    },
    3: {
        "first_name": "James",
        "last_name": "Whitfield",
        "job_title": "Regional Sales Director",
        "company_name": "Consolidated Industries",
    },
    # The "Parr" family → Hargrove family
    5: {
        "first_name": "Robert",
        "last_name": "Hargrove",
        "job_title": "Senior VP, Operations",
        "company_name": "Meridian Healthcare",
    },
    9: {
        "first_name": "Helen",
        "last_name": "Hargrove",
        "job_title": "Physical Therapist",
        "company_name": "Carolina Rehabilitation Center",
    },
    6: {
        "first_name": "Violet",
        "last_name": "Hargrove",
    },
    7: {
        "first_name": "Daniel",
        "last_name": "Hargrove",
    },
    8: {
        "first_name": "Jack",
        "last_name": "Hargrove",
    },
}


async def main():
    rt = RedtailClient()

    for contact_id, updates in UPDATES.items():
        name = f"{updates.get('first_name', '')} {updates.get('last_name', '')}".strip()
        print(f"Updating contact {contact_id} -> {name}...")
        try:
            result = await rt.update_contact(contact_id, updates)
            print(f"  OK")
        except Exception as e:
            print(f"  ERROR: {e}")

    print("\nDone! Verifying updates...")
    for contact_id in UPDATES:
        c = await rt.get_contact(contact_id)
        contact = c.get("contact", c)
        name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
        print(f"  Contact {contact_id}: {name}")


if __name__ == "__main__":
    asyncio.run(main())
