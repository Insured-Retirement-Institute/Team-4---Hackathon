"""Mock data sources for pre-fill agent."""

from app.services.datasources.mock_redtail import MockRedtailCRM
from app.services.datasources.mock_policy import MockPolicySystem

__all__ = ["MockRedtailCRM", "MockPolicySystem"]
