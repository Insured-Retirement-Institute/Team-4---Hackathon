"""Mock Redtail CRM data source."""

from __future__ import annotations

from typing import Any

from app.services.datasources.base import DataSource

MOCK_CLIENTS: dict[str, dict[str, Any]] = {
    "client_001": {
        "display_name": "John Smith",
        "fields": {
            "owner_first_name": "John",
            "owner_last_name": "Smith",
            "owner_date_of_birth": "1958-03-15",
            "owner_ssn": "123-45-6789",
            "owner_gender": "male",
            "owner_email": "john.smith@email.com",
            "owner_phone": "555-123-4567",
            "owner_address_street": "123 Oak Lane",
            "owner_address_city": "Hartford",
            "owner_address_state": "CT",
            "owner_address_zip": "06103",
            "owner_type": "individual",
            "owner_same_as_annuitant": True,
            "annuitant_first_name": "John",
            "annuitant_last_name": "Smith",
            "annuitant_date_of_birth": "1958-03-15",
            "annuitant_ssn": "123-45-6789",
            "annuitant_gender": "male",
        },
    },
    "client_002": {
        "display_name": "Maria Garcia",
        "fields": {
            "owner_first_name": "Maria",
            "owner_last_name": "Garcia",
            "owner_date_of_birth": "1965-07-22",
            "owner_ssn": "987-65-4321",
            "owner_gender": "female",
            "owner_email": "maria.garcia@email.com",
            "owner_phone": "555-987-6543",
            "owner_address_street": "456 Maple Drive",
            "owner_address_city": "Boston",
            "owner_address_state": "MA",
            "owner_address_zip": "02101",
            "owner_type": "individual",
            "owner_same_as_annuitant": True,
            "annuitant_first_name": "Maria",
            "annuitant_last_name": "Garcia",
            "annuitant_date_of_birth": "1965-07-22",
            "annuitant_ssn": "987-65-4321",
            "annuitant_gender": "female",
        },
    },
    "client_003": {
        "display_name": "Robert & Linda Chen",
        "fields": {
            "owner_first_name": "Robert",
            "owner_last_name": "Chen",
            "owner_date_of_birth": "1970-11-08",
            "owner_ssn": "456-78-9012",
            "owner_gender": "male",
            "owner_email": "robert.chen@email.com",
            "owner_phone": "555-456-7890",
            "owner_address_street": "789 Elm Street",
            "owner_address_city": "New York",
            "owner_address_state": "NY",
            "owner_address_zip": "10001",
            "owner_type": "individual",
            "owner_same_as_annuitant": False,
            "annuitant_first_name": "Linda",
            "annuitant_last_name": "Chen",
            "annuitant_date_of_birth": "1972-04-19",
            "annuitant_ssn": "456-78-9013",
            "annuitant_gender": "female",
        },
    },
    "client_004": {
        "display_name": "Patricia Williams",
        "fields": {
            "owner_first_name": "Patricia",
            "owner_last_name": "Williams",
            "owner_date_of_birth": "1955-01-30",
            "owner_ssn": "321-54-9876",
            "owner_gender": "female",
            "owner_email": "pat.williams@email.com",
            "owner_phone": "555-321-5498",
            "owner_address_street": "1010 Pine Avenue",
            "owner_address_city": "Chicago",
            "owner_address_state": "IL",
            "owner_address_zip": "60601",
            "owner_type": "individual",
            "owner_same_as_annuitant": True,
            "annuitant_first_name": "Patricia",
            "annuitant_last_name": "Williams",
            "annuitant_date_of_birth": "1955-01-30",
            "annuitant_ssn": "321-54-9876",
            "annuitant_gender": "female",
        },
    },
}

CRM_FIELDS = [
    "owner_first_name", "owner_last_name", "owner_date_of_birth", "owner_ssn",
    "owner_gender", "owner_email", "owner_phone",
    "owner_address_street", "owner_address_city", "owner_address_state", "owner_address_zip",
    "owner_type", "owner_same_as_annuitant",
    "annuitant_first_name", "annuitant_last_name", "annuitant_date_of_birth",
    "annuitant_ssn", "annuitant_gender",
]


class MockRedtailCRM(DataSource):
    """Mock Redtail CRM — returns client profile data."""

    @staticmethod
    def list_clients() -> list[dict[str, str]]:
        """Return list of clients for dropdown selection."""
        return [
            {"client_id": cid, "display_name": data["display_name"]}
            for cid, data in MOCK_CLIENTS.items()
        ]

    async def query(self, params: dict[str, Any]) -> dict[str, Any]:
        client_id = params.get("client_id", "")
        client = MOCK_CLIENTS.get(client_id)
        if not client:
            return {}
        return dict(client["fields"])

    def available_fields(self) -> list[str]:
        return list(CRM_FIELDS)
