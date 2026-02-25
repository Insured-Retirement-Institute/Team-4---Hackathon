"""Mock prior policy / suitability data source."""

from __future__ import annotations

from typing import Any

from app.services.datasources.base import DataSource

MOCK_POLICIES: dict[str, dict[str, Any]] = {
    "client_001": {
        "annual_income": "85000",
        "net_worth": "450000",
        "tax_bracket": "22",
        "risk_tolerance": "moderate",
        "investment_experience": "moderate",
        "investment_objective": "accumulation",
        "time_horizon": "10_plus_years",
        "source_of_funds": "savings",
        "existing_annuity_count": "1",
        "existing_life_insurance": "yes",
    },
    "client_002": {
        "annual_income": "120000",
        "net_worth": "780000",
        "tax_bracket": "24",
        "risk_tolerance": "conservative",
        "investment_experience": "extensive",
        "investment_objective": "income",
        "time_horizon": "5_to_10_years",
        "source_of_funds": "retirement_rollover",
        "existing_annuity_count": "2",
        "existing_life_insurance": "yes",
    },
    "client_003": {
        "annual_income": "200000",
        "net_worth": "1200000",
        "tax_bracket": "32",
        "risk_tolerance": "moderate",
        "investment_experience": "extensive",
        "investment_objective": "accumulation",
        "time_horizon": "10_plus_years",
        "source_of_funds": "investment_portfolio",
        "existing_annuity_count": "0",
        "existing_life_insurance": "no",
    },
    "client_004": {
        "annual_income": "65000",
        "net_worth": "320000",
        "tax_bracket": "12",
        "risk_tolerance": "conservative",
        "investment_experience": "limited",
        "investment_objective": "preservation",
        "time_horizon": "3_to_5_years",
        "source_of_funds": "savings",
        "existing_annuity_count": "1",
        "existing_life_insurance": "no",
    },
}

POLICY_FIELDS = [
    "annual_income", "net_worth", "tax_bracket", "risk_tolerance",
    "investment_experience", "investment_objective", "time_horizon",
    "source_of_funds", "existing_annuity_count", "existing_life_insurance",
]


class MockPolicySystem(DataSource):
    """Mock prior policy system — returns suitability and financial data."""

    async def query(self, params: dict[str, Any]) -> dict[str, Any]:
        client_id = params.get("client_id", "")
        policy = MOCK_POLICIES.get(client_id)
        if not policy:
            return {}
        return dict(policy)

    def available_fields(self) -> list[str]:
        return list(POLICY_FIELDS)
