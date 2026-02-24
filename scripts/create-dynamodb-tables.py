#!/usr/bin/env python3
"""Create DynamoDB tables for the IRI Retirement Application Platform."""

import argparse
import json
import os
import sys

import boto3
from botocore.exceptions import ClientError


def create_tables(endpoint_url=None, region="us-east-1"):
    kwargs = {"region_name": region}
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url

    client = boto3.client("dynamodb", **kwargs)

    tables_file = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "infra",
        "dynamodb-tables.json",
    )

    with open(tables_file) as f:
        config = json.load(f)

    for table_def in config["tables"]:
        table_name = table_def["TableName"]
        try:
            client.describe_table(TableName=table_name)
            print(f"Table '{table_name}' already exists, skipping.")
        except ClientError as e:
            if e.response["Error"]["Code"] == "ResourceNotFoundException":
                print(f"Creating table '{table_name}'...")
                client.create_table(**table_def)
                waiter = client.get_waiter("table_exists")
                waiter.wait(TableName=table_name)
                print(f"Table '{table_name}' created.")
            else:
                raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create DynamoDB tables")
    parser.add_argument(
        "--endpoint",
        default=os.getenv("AWS_ENDPOINT_URL"),
        help="DynamoDB endpoint URL (for local dev)",
    )
    parser.add_argument(
        "--region",
        default=os.getenv("AWS_REGION", "us-east-1"),
        help="AWS region",
    )
    args = parser.parse_args()

    create_tables(endpoint_url=args.endpoint, region=args.region)
