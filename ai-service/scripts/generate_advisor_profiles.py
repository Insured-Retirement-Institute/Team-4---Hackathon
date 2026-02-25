#!/usr/bin/env python3
"""Generate advisor preference profiles and upload to S3.

Usage:
    cd ai-service
    source venv/Scripts/activate
    python scripts/generate_advisor_profiles.py
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

ADVISORS = {
    "advisor_001": {
        "advisor_id": "advisor_001",
        "advisor_name": "Michael Reynolds",
        "firm": "Reynolds Financial Group",
        "years_experience": 22,
        "philosophy": (
            "Conservative, safety-first approach. Prioritizes principal protection and "
            "guaranteed income for clients approaching or in retirement. Believes annuities "
            "should serve as the stable foundation of a retirement portfolio, not a growth vehicle."
        ),
        "typical_client_profile": (
            "Pre-retirees and retirees age 55-75 with moderate to substantial savings who "
            "want predictable income and protection against market downturns."
        ),
        "product_preferences": {
            "preferred_carriers": ["Midland National", "EquiTrust"],
            "preferred_product_types": ["Fixed Annuity", "MYGA"],
            "reasoning": (
                "Favors carriers with strong financial ratings and straightforward fixed products. "
                "Midland National and EquiTrust offer competitive fixed rates with transparent "
                "surrender schedules. Avoids complex index strategies for most clients."
            ),
        },
        "allocation_strategy": {
            "fixed_account_target_pct": 80,
            "index_strategy_target_pct": 20,
            "preferred_index_strategies": ["S&P 500 Annual PTP with Cap"],
            "reasoning": (
                "Allocates the majority to fixed accounts for guaranteed growth. Only uses index "
                "strategies as a small supplemental allocation for clients who want some market "
                "participation without downside risk."
            ),
        },
        "suitability_thresholds": {
            "min_time_horizon": "5_to_10_years",
            "min_liquid_net_worth_after_purchase": 50000,
            "max_annuity_pct_of_net_worth": 50,
            "reasoning": (
                "Ensures clients retain adequate liquidity after purchase. Never recommends "
                "placing more than half of net worth into annuity products."
            ),
        },
    },
    "advisor_002": {
        "advisor_id": "advisor_002",
        "advisor_name": "Andrew Barnett",
        "firm": "Barnett Financial Partners",
        "years_experience": 15,
        "philosophy": (
            "Balanced growth approach. Seeks to optimize the blend of guaranteed returns and "
            "market-linked upside. Believes a well-structured annuity can serve both accumulation "
            "and income goals depending on the client's stage of life."
        ),
        "typical_client_profile": (
            "Working professionals age 45-65 with diversified portfolios who want to add "
            "guaranteed components without sacrificing all growth potential."
        ),
        "product_preferences": {
            "preferred_carriers": ["Midland National", "Aspida", "EquiTrust"],
            "preferred_product_types": ["Fixed Annuity", "MYGA", "Fixed Index Annuity"],
            "reasoning": (
                "Works with all three carriers depending on client needs. Uses Aspida MYGAs for "
                "pure rate plays, Midland National for traditional fixed, and EquiTrust for clients "
                "who want index-linked growth potential."
            ),
        },
        "allocation_strategy": {
            "fixed_account_target_pct": 50,
            "index_strategy_target_pct": 50,
            "preferred_index_strategies": [
                "S&P 500 Annual PTP with Cap",
                "S&P 500 Monthly Average",
                "Barclays Atlas 5 Index",
            ],
            "reasoning": (
                "Splits evenly between fixed and index strategies to balance guaranteed returns "
                "with market participation. Diversifies across multiple index strategies to smooth "
                "returns over the contract period."
            ),
        },
        "suitability_thresholds": {
            "min_time_horizon": "5_to_10_years",
            "min_liquid_net_worth_after_purchase": 75000,
            "max_annuity_pct_of_net_worth": 40,
            "reasoning": (
                "Maintains a higher liquidity buffer and lower annuity concentration than "
                "conservative advisors. Wants clients to have ample liquid assets for emergencies "
                "and other investment opportunities."
            ),
        },
    },
    "advisor_003": {
        "advisor_id": "advisor_003",
        "advisor_name": "David Martinez",
        "firm": "Martinez & Associates Financial Planning",
        "years_experience": 12,
        "philosophy": (
            "Accumulation-focused strategy. Uses annuities primarily as tax-deferred growth "
            "vehicles for clients with longer time horizons. Favors index-linked strategies "
            "that capture market upside while maintaining a floor of zero."
        ),
        "typical_client_profile": (
            "Younger pre-retirees age 40-55 with higher risk tolerance who want tax-deferred "
            "growth and are comfortable with longer surrender periods for better rates."
        ),
        "product_preferences": {
            "preferred_carriers": ["Aspida", "Midland National"],
            "preferred_product_types": ["MYGA", "Fixed Index Annuity"],
            "reasoning": (
                "Aspida offers competitive MYGA rates for pure accumulation. Midland National "
                "provides strong index strategy options. Recommends these carriers for clients "
                "focused on growing their money over 7-10 year periods."
            ),
        },
        "allocation_strategy": {
            "fixed_account_target_pct": 30,
            "index_strategy_target_pct": 70,
            "preferred_index_strategies": [
                "S&P 500 Annual PTP with Cap",
                "S&P 500 2-Year PTP with Participation Rate",
                "Nasdaq-100 Annual PTP with Cap",
            ],
            "reasoning": (
                "Heavily favors index strategies to maximize growth potential. Uses the fixed "
                "account as a small safety net while allocating the majority to S&P 500 and "
                "Nasdaq-100 linked strategies for maximum upside participation."
            ),
        },
        "suitability_thresholds": {
            "min_time_horizon": "10_plus_years",
            "min_liquid_net_worth_after_purchase": 100000,
            "max_annuity_pct_of_net_worth": 35,
            "reasoning": (
                "Requires a longer commitment horizon and higher liquidity buffer since "
                "accumulation-focused strategies benefit from full surrender period. Keeps "
                "annuity allocation modest relative to total portfolio."
            ),
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

    for advisor_id, profile in ADVISORS.items():
        body = json.dumps(profile, indent=2)
        key = f"advisors/{advisor_id}/profile.json"
        s3.put_object(Bucket=BUCKET, Key=key, Body=body, ContentType="application/json")
        print(f"Uploaded {key} ({len(body):,} bytes)")

    print(f"\nDone! {len(ADVISORS)} advisor profiles uploaded to s3://{BUCKET}/advisors/")


if __name__ == "__main__":
    main()
