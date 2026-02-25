"""Mock Redtail CRM data source."""

from __future__ import annotations

from typing import Any

from app.services.datasources.base import DataSource

MOCK_CLIENTS: dict[str, dict[str, Any]] = {
    "client_001": {
        "display_name": "James Whitfield",
        "fields": {
            "owner_first_name": "James",
            "owner_last_name": "Whitfield",
            "owner_date_of_birth": "1958-03-15",
            "owner_ssn": "478-62-1935",
            "owner_gender": "male",
            "owner_email": "james.whitfield@gmail.com",
            "owner_phone": "704-555-2847",
            "owner_address_street": "2841 Sedgefield Road",
            "owner_address_city": "Charlotte",
            "owner_address_state": "NC",
            "owner_address_zip": "28209",
            "owner_type": "individual",
            "owner_same_as_annuitant": True,
            "annuitant_first_name": "James",
            "annuitant_last_name": "Whitfield",
            "annuitant_date_of_birth": "1958-03-15",
            "annuitant_ssn": "478-62-1935",
            "annuitant_gender": "male",
        },
    },
    "client_002": {
        "display_name": "Catherine Morales",
        "fields": {
            "owner_first_name": "Catherine",
            "owner_last_name": "Morales",
            "owner_date_of_birth": "1965-07-22",
            "owner_ssn": "531-84-7290",
            "owner_gender": "female",
            "owner_email": "c.morales@outlook.com",
            "owner_phone": "617-555-3916",
            "owner_address_street": "87 Commonwealth Avenue",
            "owner_address_city": "Boston",
            "owner_address_state": "MA",
            "owner_address_zip": "02116",
            "owner_type": "individual",
            "owner_same_as_annuitant": True,
            "annuitant_first_name": "Catherine",
            "annuitant_last_name": "Morales",
            "annuitant_date_of_birth": "1965-07-22",
            "annuitant_ssn": "531-84-7290",
            "annuitant_gender": "female",
        },
    },
    "client_003": {
        "display_name": "Richard & Diane Hargrove",
        "fields": {
            "owner_first_name": "Richard",
            "owner_last_name": "Hargrove",
            "owner_date_of_birth": "1970-11-08",
            "owner_ssn": "293-51-6048",
            "owner_gender": "male",
            "owner_email": "rhargrove@gmail.com",
            "owner_phone": "212-555-7843",
            "owner_address_street": "445 Park Avenue South",
            "owner_address_city": "New York",
            "owner_address_state": "NY",
            "owner_address_zip": "10016",
            "owner_type": "individual",
            "owner_same_as_annuitant": False,
            "annuitant_first_name": "Diane",
            "annuitant_last_name": "Hargrove",
            "annuitant_date_of_birth": "1972-04-19",
            "annuitant_ssn": "293-51-6049",
            "annuitant_gender": "female",
        },
    },
    "client_004": {
        "display_name": "Susan Pemberton",
        "fields": {
            "owner_first_name": "Susan",
            "owner_last_name": "Pemberton",
            "owner_date_of_birth": "1955-01-30",
            "owner_ssn": "642-39-8175",
            "owner_gender": "female",
            "owner_email": "spemberton@yahoo.com",
            "owner_phone": "312-555-4291",
            "owner_address_street": "1820 North Damen Avenue",
            "owner_address_city": "Chicago",
            "owner_address_state": "IL",
            "owner_address_zip": "60647",
            "owner_type": "individual",
            "owner_same_as_annuitant": True,
            "annuitant_first_name": "Susan",
            "annuitant_last_name": "Pemberton",
            "annuitant_date_of_birth": "1955-01-30",
            "annuitant_ssn": "642-39-8175",
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
