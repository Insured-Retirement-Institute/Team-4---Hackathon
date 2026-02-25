#!/usr/bin/env python3
"""Generate carrier suitability guidelines and upload to S3.

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

CARRIERS = {
    "midland-national": {
        "carrier_id": "midland-national",
        "carrier_name": "Midland National Life Insurance Company",
        "product_id": "midland-fixed-annuity-001",
        "product_name": "Fixed Annuity Application",
        "suitability_criteria": {
            "age": {
                "min": 18,
                "max": 85,
                "weight": 15,
                "description": "Applicant must be between 18 and 85 years old at issue.",
            },
            "annual_income": {
                "min": 25000,
                "weight": 10,
                "description": "Minimum annual household income of $25,000.",
            },
            "net_worth": {
                "min": 50000,
                "weight": 10,
                "description": "Minimum net worth of $50,000 excluding primary residence.",
            },
            "risk_tolerance": {
                "acceptable": ["conservative", "moderate"],
                "weight": 15,
                "description": "Fixed annuities are suitable for conservative to moderate risk profiles.",
            },
            "investment_objective": {
                "acceptable": ["preservation", "accumulation", "income"],
                "weight": 10,
                "description": "Product supports capital preservation, steady accumulation, and income generation.",
            },
            "time_horizon": {
                "acceptable": ["5_to_10_years", "10_plus_years"],
                "weight": 15,
                "description": "Surrender period is 7 years; recommended holding period is 5+ years.",
            },
            "source_of_funds": {
                "acceptable": ["savings", "retirement_rollover", "investment_portfolio", "inheritance"],
                "weight": 5,
                "description": "Funds must come from legitimate, documented sources.",
            },
            "liquidity": {
                "min_liquid_after_purchase": 25000,
                "weight": 10,
                "description": "Client should retain at least $25,000 in liquid assets after purchase.",
            },
            "existing_annuities": {
                "max_total_annuity_pct_of_net_worth": 60,
                "weight": 10,
                "description": "Total annuity holdings should not exceed 60% of net worth.",
            },
        },
        "surrender_schedule": "7-year: 7%, 6%, 5%, 4%, 3%, 2%, 1%",
        "minimum_premium": 10000,
        "maximum_issue_age": 85,
        "scoring": {
            "excellent": {"min": 85, "label": "Excellent Fit"},
            "good": {"min": 70, "label": "Good Fit"},
            "fair": {"min": 50, "label": "Fair Fit — Review Recommended"},
            "poor": {"min": 0, "label": "Poor Fit — Not Recommended"},
        },
    },
    "aspida": {
        "carrier_id": "aspida",
        "carrier_name": "Aspida Life Insurance Company",
        "product_id": "aspida-myga-001",
        "product_name": "Multi-Year Guaranteed Annuity (MYGA)",
        "suitability_criteria": {
            "age": {
                "min": 18,
                "max": 90,
                "weight": 15,
                "description": "Applicant must be between 18 and 90 years old at issue.",
            },
            "annual_income": {
                "min": 20000,
                "weight": 10,
                "description": "Minimum annual household income of $20,000.",
            },
            "net_worth": {
                "min": 40000,
                "weight": 10,
                "description": "Minimum net worth of $40,000 excluding primary residence.",
            },
            "risk_tolerance": {
                "acceptable": ["conservative", "moderate"],
                "weight": 15,
                "description": "MYGAs are suitable for conservative to moderate risk profiles seeking guaranteed rates.",
            },
            "investment_objective": {
                "acceptable": ["preservation", "accumulation"],
                "weight": 10,
                "description": "Product is designed for capital preservation and steady accumulation at a guaranteed rate.",
            },
            "time_horizon": {
                "acceptable": ["3_to_5_years", "5_to_10_years", "10_plus_years"],
                "weight": 15,
                "description": "MYGA terms range from 3-10 years; client should match term to time horizon.",
            },
            "source_of_funds": {
                "acceptable": ["savings", "retirement_rollover", "investment_portfolio", "cd_transfer", "inheritance"],
                "weight": 5,
                "description": "Common source is CD transfers or retirement rollovers seeking better guaranteed rates.",
            },
            "liquidity": {
                "min_liquid_after_purchase": 20000,
                "weight": 10,
                "description": "Client should retain at least $20,000 in liquid assets after purchase.",
            },
            "existing_annuities": {
                "max_total_annuity_pct_of_net_worth": 65,
                "weight": 10,
                "description": "Total annuity holdings should not exceed 65% of net worth.",
            },
        },
        "surrender_schedule": "5-year: 8%, 7%, 6%, 4%, 2%",
        "minimum_premium": 5000,
        "maximum_issue_age": 90,
        "scoring": {
            "excellent": {"min": 85, "label": "Excellent Fit"},
            "good": {"min": 70, "label": "Good Fit"},
            "fair": {"min": 50, "label": "Fair Fit — Review Recommended"},
            "poor": {"min": 0, "label": "Poor Fit — Not Recommended"},
        },
    },
    "equitrust": {
        "carrier_id": "equitrust",
        "carrier_name": "EquiTrust Life Insurance Company",
        "product_id": "certainty-select",
        "product_name": "Certainty Select Fixed Annuity",
        "suitability_criteria": {
            "age": {
                "min": 18,
                "max": 85,
                "weight": 15,
                "description": "Applicant must be between 18 and 85 years old at issue.",
            },
            "annual_income": {
                "min": 25000,
                "weight": 10,
                "description": "Minimum annual household income of $25,000.",
            },
            "net_worth": {
                "min": 50000,
                "weight": 10,
                "description": "Minimum net worth of $50,000 excluding primary residence.",
            },
            "risk_tolerance": {
                "acceptable": ["conservative", "moderate", "moderately_aggressive"],
                "weight": 15,
                "description": "Certainty Select supports conservative through moderately aggressive profiles with its index options.",
            },
            "investment_objective": {
                "acceptable": ["preservation", "accumulation", "income", "growth"],
                "weight": 10,
                "description": "Versatile product supporting multiple objectives through allocation flexibility.",
            },
            "time_horizon": {
                "acceptable": ["5_to_10_years", "10_plus_years"],
                "weight": 15,
                "description": "Surrender period is 7 years; index strategies benefit from longer holding periods.",
            },
            "source_of_funds": {
                "acceptable": ["savings", "retirement_rollover", "investment_portfolio", "inheritance"],
                "weight": 5,
                "description": "Funds must come from legitimate, documented sources.",
            },
            "liquidity": {
                "min_liquid_after_purchase": 30000,
                "weight": 10,
                "description": "Client should retain at least $30,000 in liquid assets after purchase.",
            },
            "existing_annuities": {
                "max_total_annuity_pct_of_net_worth": 55,
                "weight": 10,
                "description": "Total annuity holdings should not exceed 55% of net worth.",
            },
        },
        "surrender_schedule": "7-year: 8%, 7%, 6%, 5%, 4%, 3%, 2%",
        "minimum_premium": 15000,
        "maximum_issue_age": 85,
        "scoring": {
            "excellent": {"min": 85, "label": "Excellent Fit"},
            "good": {"min": 70, "label": "Good Fit"},
            "fair": {"min": 50, "label": "Fair Fit — Review Recommended"},
            "poor": {"min": 0, "label": "Poor Fit — Not Recommended"},
        },
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
