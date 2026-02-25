"""S3-backed carrier suitability guidelines store with scoring engine."""

from __future__ import annotations

import json
import logging
from typing import Any

import boto3
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger(__name__)


class S3SuitabilityStore:
    """Fetches carrier suitability guidelines from S3 and evaluates client fit."""

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

    @staticmethod
    def evaluate_suitability(
        guidelines: dict[str, Any],
        client_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Evaluate a client against carrier suitability criteria.

        Returns {score, rating, carrier, product, criteria_results, reasoning}.
        """
        criteria = guidelines.get("suitability_criteria", {})
        scoring = guidelines.get("scoring", {})

        total_weight = 0
        earned_weight = 0
        criteria_results: list[dict[str, Any]] = []

        for criterion_name, criterion in criteria.items():
            weight = criterion.get("weight", 0)
            total_weight += weight
            passed = _check_criterion(criterion_name, criterion, client_data)

            earned_weight += weight if passed else 0
            criteria_results.append({
                "criterion": criterion_name,
                "weight": weight,
                "passed": passed,
                "description": criterion.get("description", ""),
            })

        score = round(earned_weight / total_weight * 100) if total_weight > 0 else 0

        # Determine rating from scoring thresholds
        rating = "Poor Fit — Not Recommended"
        for level in ["excellent", "good", "fair", "poor"]:
            threshold = scoring.get(level, {})
            if score >= threshold.get("min", 0):
                rating = threshold.get("label", level.title())
                break

        passed_list = [r["criterion"] for r in criteria_results if r["passed"]]
        failed_list = [r["criterion"] for r in criteria_results if not r["passed"]]

        reasoning_parts = []
        if passed_list:
            reasoning_parts.append(f"Met criteria: {', '.join(passed_list)}.")
        if failed_list:
            reasoning_parts.append(f"Did not meet criteria: {', '.join(failed_list)}.")

        return {
            "score": score,
            "rating": rating,
            "carrier": guidelines.get("carrier_name", ""),
            "product": guidelines.get("product_name", ""),
            "carrier_id": guidelines.get("carrier_id", ""),
            "product_id": guidelines.get("product_id", ""),
            "criteria_results": criteria_results,
            "reasoning": " ".join(reasoning_parts),
        }


def _check_criterion(
    name: str,
    criterion: dict[str, Any],
    client_data: dict[str, Any],
) -> bool:
    """Check if a client meets a single suitability criterion.

    Returns True if the criterion is met or if the relevant client data is missing
    (we don't penalize for unknown data — the LLM will note the gap).
    """
    # Age check
    if name == "age":
        age = client_data.get("age")
        if age is None:
            return True  # Unknown — don't penalize
        try:
            age = int(age)
        except (ValueError, TypeError):
            return True
        min_age = criterion.get("min", 0)
        max_age = criterion.get("max", 999)
        return min_age <= age <= max_age

    # Numeric minimum checks (annual_income, net_worth)
    if name in ("annual_income", "net_worth"):
        value = client_data.get(name)
        if value is None:
            return True
        try:
            value = float(str(value).replace("$", "").replace(",", ""))
        except (ValueError, TypeError):
            return True
        return value >= criterion.get("min", 0)

    # Acceptable value checks (risk_tolerance, investment_objective, time_horizon, source_of_funds)
    if "acceptable" in criterion:
        value = client_data.get(name)
        if value is None:
            return True
        return str(value).lower().strip() in [v.lower() for v in criterion["acceptable"]]

    # Liquidity check
    if name == "liquidity":
        liquid = client_data.get("liquid_net_worth") or client_data.get("liquidity")
        premium = client_data.get("premium_amount") or client_data.get("initial_premium")
        if liquid is None or premium is None:
            return True
        try:
            liquid = float(str(liquid).replace("$", "").replace(",", ""))
            premium = float(str(premium).replace("$", "").replace(",", ""))
        except (ValueError, TypeError):
            return True
        remaining = liquid - premium
        return remaining >= criterion.get("min_liquid_after_purchase", 0)

    # Existing annuities concentration check
    if name == "existing_annuities":
        # Would need total annuity value and net worth — skip if not available
        return True

    # Unknown criterion type — pass by default
    return True
