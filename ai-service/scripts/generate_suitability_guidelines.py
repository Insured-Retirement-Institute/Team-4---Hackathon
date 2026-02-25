#!/usr/bin/env python3
"""Generate carrier suitability guidelines and upload to S3.

Each carrier gets product parameters + the shared suitability decision prompt.
The decision prompt is evaluated by an LLM at runtime (see s3_suitability.py).

Usage:
    cd ai-service
    source venv/Scripts/activate
    python scripts/generate_suitability_guidelines.py
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import boto3
from botocore.exceptions import ClientError

from app.config import settings

BUCKET = settings.s3_statements_bucket

# Load the shared suitability decision prompt
_PROMPT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "suitability", "suitability-decision-prompt.md"
)
with open(_PROMPT_PATH, "r", encoding="utf-8") as f:
    SUITABILITY_DECISION_PROMPT = f.read()

SUITABILITY_FIELDS_REQUIRED = [
    "owner_name", "owner_dob", "owner_age", "owner_ssn",
    "annual_household_income", "annual_household_expenses",
    "total_net_worth", "liquid_net_worth", "has_emergency_funds",
    "expected_hold_years", "total_premium",
    "signed_at_state", "is_replacement", "nursing_home_status",
]

CARRIERS = {
    "aspida": {
        "carrier_id": "aspida",
        "carrier_name": "Aspida Life Insurance Company",
        "product_id": "aspida-myga-001",
        "product_name": "SynergyChoice MYGA",
        "product_parameters": {
            "productMaxIssueAge": 90,
            "withdrawalChargePeriodYears": 7,
            "guaranteedRatePct": 5.25,
            "minPremium": 5000,
            "guaranteePeriods": [3, 5, 7, 10],
            "surrenderSchedule7yr": "9%, 8%, 7%, 6%, 5%, 4%, 2%",
            "freeWithdrawalPct": 10,
            "currentRates": {
                "3yr": "4.50%",
                "5yr": "5.00%",
                "7yr": "5.25%",
                "10yr": "5.10%",
            },
        },
        "suitability_decision_prompt": SUITABILITY_DECISION_PROMPT,
        "suitability_fields_required": SUITABILITY_FIELDS_REQUIRED,
    },
    "midland-national": {
        "carrier_id": "midland-national",
        "carrier_name": "Midland National Life Insurance Company",
        "product_id": "midland-fixed-annuity-001",
        "product_name": "Innovator Choice 14 Fixed Index Annuity",
        "product_parameters": {
            "productMaxIssueAge": 85,
            "withdrawalChargePeriodYears": 14,
            "guaranteedRatePct": 1.10,
            "minPremium": 10000,
            "guaranteePeriods": [14],
            "surrenderSchedule14yr": "12%, 12%, 11%, 10%, 10%, 9%, 8%, 7%, 6%, 5%, 4%, 3%, 2%, 1%",
            "freeWithdrawalPct": 10,
            "premiumBonusPct": 8,
            "indexStrategies": [
                "S&P 500 Annual Point-to-Point with Cap",
                "S&P 500 Monthly Average",
                "Fixed Account",
            ],
        },
        "suitability_decision_prompt": SUITABILITY_DECISION_PROMPT,
        "suitability_fields_required": SUITABILITY_FIELDS_REQUIRED,
    },
    "equitrust": {
        "carrier_id": "equitrust",
        "carrier_name": "EquiTrust Life Insurance Company",
        "product_id": "certainty-select",
        "product_name": "Certainty Select Fixed Annuity",
        "product_parameters": {
            "productMaxIssueAge": 85,
            "withdrawalChargePeriodYears": 7,
            "guaranteedRatePct": 4.75,
            "minPremium": 15000,
            "guaranteePeriods": [5, 7],
            "surrenderSchedule7yr": "8%, 7%, 6%, 5%, 4%, 3%, 2%",
            "freeWithdrawalPct": 10,
            "currentRates": {
                "5yr": "4.50%",
                "7yr": "4.75%",
            },
        },
        "suitability_decision_prompt": SUITABILITY_DECISION_PROMPT,
        "suitability_fields_required": SUITABILITY_FIELDS_REQUIRED,
    },
}


def main() -> None:
    kwargs = {"region_name": settings.aws_region}
    if settings.aws_access_key_id:
        kwargs["aws_access_key_id"] = settings.aws_access_key_id
    if settings.aws_secret_access_key:
        kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
    if settings.aws_session_token:
        kwargs["aws_session_token"] = settings.aws_session_token

    s3 = boto3.client("s3", **kwargs)

    for carrier_id, guidelines in CARRIERS.items():
        body = json.dumps(guidelines, indent=2)
        key = f"suitability/{carrier_id}/guidelines.json"
        s3.put_object(Bucket=BUCKET, Key=key, Body=body, ContentType="application/json")
        print(f"Uploaded {key} ({len(body):,} bytes)")

    print(f"\nDone! {len(CARRIERS)} carrier guidelines uploaded to s3://{BUCKET}/suitability/")


if __name__ == "__main__":
    main()
