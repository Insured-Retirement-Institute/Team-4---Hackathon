"""S3-backed carrier suitability guidelines store with LLM-based decision engine."""

from __future__ import annotations

import json
import logging
from typing import Any

import boto3
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger(__name__)


class S3SuitabilityStore:
    """Fetches carrier suitability guidelines from S3 and evaluates client fit via LLM."""

    def __init__(self) -> None:
        kwargs: dict[str, Any] = {"region_name": settings.aws_region}
        if settings.aws_access_key_id:
            kwargs["aws_access_key_id"] = settings.aws_access_key_id
        if settings.aws_secret_access_key:
            kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
        if settings.aws_session_token:
            kwargs["aws_session_token"] = settings.aws_session_token
        self._s3 = boto3.client("s3", **kwargs)
        self._bucket = settings.s3_statements_bucket

    def fetch_guidelines(self, carrier_id: str) -> dict[str, Any] | None:
        """Download a carrier's suitability guidelines from S3.

        Returns parsed JSON dict or None on failure.
        """
        key = f"suitability/{carrier_id}/guidelines.json"
        try:
            resp = self._s3.get_object(Bucket=self._bucket, Key=key)
            body = resp["Body"].read().decode("utf-8")
            return json.loads(body)
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code", "")
            if error_code == "NoSuchKey":
                logger.info("No suitability guidelines found for carrier %s", carrier_id)
            else:
                logger.error("S3 get_object failed for %s: %s", key, exc)
            return None

    async def evaluate_suitability(
        self,
        guidelines: dict[str, Any],
        client_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Run LLM-based suitability evaluation using the carrier's decision prompt.

        1. Build product parameters from guidelines
        2. Build submission payload from client_data
        3. Call LLM with the suitability decision prompt + product params + payload
        4. Parse structured JSON response
        5. Return: {decision, ruleEvaluations, declinedReasons, ...}
        """
        from app.services.llm_service import LLMService

        decision_prompt = guidelines.get("suitability_decision_prompt", "")
        if not decision_prompt:
            return {
                "decision": "pending_manual_review",
                "error": "No suitability decision prompt configured for this carrier.",
                "carrier": guidelines.get("carrier_name", ""),
                "product": guidelines.get("product_name", ""),
            }

        product_params = guidelines.get("product_parameters", {})

        # Map client_data to the submission payload format expected by the decision prompt
        payload = _build_submission_payload(client_data, product_params)

        user_message = json.dumps({
            "productParameters": product_params,
            "submissionPayload": payload,
        }, indent=2)

        try:
            llm = LLMService()
            response = llm.chat(
                system_prompt=decision_prompt,
                messages=[{"role": "user", "content": user_message}],
                tools=None,
                max_tokens=4096,
                force_tool=False,
            )

            response_text = LLMService.extract_text(response)

            # Parse the JSON response — strip any markdown fences if present
            clean_text = response_text.strip()
            if clean_text.startswith("```"):
                # Remove opening fence
                first_newline = clean_text.index("\n")
                clean_text = clean_text[first_newline + 1:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]
            clean_text = clean_text.strip()

            result = json.loads(clean_text)

            # Add carrier/product metadata
            result["carrier"] = guidelines.get("carrier_name", "")
            result["product"] = guidelines.get("product_name", "")
            result["carrier_id"] = guidelines.get("carrier_id", "")
            result["product_id"] = guidelines.get("product_id", "")

            return result

        except (json.JSONDecodeError, ValueError) as exc:
            logger.error("Failed to parse LLM suitability response: %s", exc)
            return {
                "decision": "pending_manual_review",
                "error": f"Failed to parse suitability evaluation: {exc}",
                "carrier": guidelines.get("carrier_name", ""),
                "product": guidelines.get("product_name", ""),
                "carrier_id": guidelines.get("carrier_id", ""),
                "product_id": guidelines.get("product_id", ""),
            }
        except Exception as exc:
            logger.error("LLM suitability evaluation failed: %s", exc)
            return {
                "decision": "pending_manual_review",
                "error": f"Suitability evaluation failed: {exc}",
                "carrier": guidelines.get("carrier_name", ""),
                "product": guidelines.get("product_name", ""),
                "carrier_id": guidelines.get("carrier_id", ""),
                "product_id": guidelines.get("product_id", ""),
            }


def _build_submission_payload(
    client_data: dict[str, Any],
    product_params: dict[str, Any],
) -> dict[str, Any]:
    """Map client_data fields to the submission payload structure expected by the decision prompt."""

    def _get(*keys: str) -> Any:
        """Return first non-None value from client_data matching any of the given keys."""
        for k in keys:
            v = client_data.get(k)
            if v is not None:
                return v
        return None

    def _parse_num(val: Any) -> float | None:
        if val is None:
            return None
        try:
            return float(str(val).replace("$", "").replace(",", ""))
        except (ValueError, TypeError):
            return None

    age = _get("age", "owner_age")
    if age is not None:
        try:
            age = int(age)
        except (ValueError, TypeError):
            age = None

    return {
        "annuitant": {
            "dateOfBirth": _get("owner_dob", "date_of_birth", "dob"),
            "age": age,
        },
        "owner": {
            "isSameAsAnnuitant": True,
            "type": "individual",
        },
        "funding": {
            "totalPremium": _parse_num(_get("total_premium", "premium_amount", "initial_premium")),
            "sourceOfFunds": _get("source_of_funds", "funding_source"),
        },
        "applicationSignatures": {
            "signedAtState": _get("signed_at_state", "state", "owner_state"),
        },
        "suitabilityProfile": {
            "annualHouseholdIncome": _parse_num(_get(
                "annual_household_income", "annual_income", "income"
            )),
            "annualHouseholdExpenses": _parse_num(_get(
                "annual_household_expenses", "annual_expenses"
            )),
            "totalNetWorth": _parse_num(_get("total_net_worth", "net_worth")),
            "liquidNetWorth": _parse_num(_get(
                "liquid_net_worth", "liquid_assets"
            )),
            "hasEmergencyFunds": _get("has_emergency_funds"),
            "expectedHoldYears": _parse_num(_get(
                "expected_hold_years", "time_horizon", "holding_period"
            )),
            "nursingHomeStatus": _get("nursing_home_status"),
            "riskTolerance": _get("risk_tolerance"),
            "investmentObjective": _get("investment_objective"),
            "existingAnnuityValue": _parse_num(_get("existing_annuity_value")),
        },
        "replacement": {
            "isReplacement": _get("is_replacement"),
            "replacementPenaltyPct": _parse_num(_get("replacement_penalty_pct")),
            "replacedCarrier": _get("replaced_carrier"),
            "replacedIssueDate": _get("replaced_issue_date"),
        },
    }
