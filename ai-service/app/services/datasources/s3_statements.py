"""S3-backed annual statement document store."""

from __future__ import annotations

import base64
import logging
from typing import Any

import boto3
from botocore.exceptions import ClientError

from app.config import settings
from app.services.datasources.base import DataSource

logger = logging.getLogger(__name__)

MAX_PDF_SIZE = 4 * 1024 * 1024  # 4 MB


class S3StatementStore(DataSource):
    """Fetches annual statement PDFs from an S3 bucket."""

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

    async def query(self, params: dict[str, Any]) -> dict[str, Any]:
        """Query delegates to fetch_latest_statement."""
        result = self.fetch_latest_statement(params.get("client_id", ""))
        return result or {}

    def available_fields(self) -> list[str]:
        return [
            "contract_number", "contract_value", "surrender_value",
            "death_benefit", "guaranteed_minimum", "current_interest_rate",
            "guaranteed_minimum_rate", "beneficiary_name", "beneficiary_relationship",
        ]

    def fetch_latest_statement(self, client_id: str) -> dict[str, Any] | None:
        """Download the latest annual statement PDF for a client.

        Returns {filename, pdf_base64, media_type} or None on failure.
        """
        prefix = f"statements/{client_id}/"
        try:
            resp = self._s3.list_objects_v2(
                Bucket=self._bucket,
                Prefix=prefix,
            )
        except ClientError as exc:
            logger.error("S3 list_objects_v2 failed for %s: %s", prefix, exc)
            return None

        contents = resp.get("Contents", [])
        if not contents:
            logger.info("No statements found for client %s", client_id)
            return None

        # Sort descending by key (filenames include year → latest first)
        contents.sort(key=lambda obj: obj["Key"], reverse=True)

        for obj in contents:
            if obj["Size"] > MAX_PDF_SIZE:
                logger.warning("Skipping %s — too large (%d bytes)", obj["Key"], obj["Size"])
                continue

            try:
                s3_resp = self._s3.get_object(Bucket=self._bucket, Key=obj["Key"])
                pdf_bytes = s3_resp["Body"].read()
                filename = obj["Key"].rsplit("/", 1)[-1]
                return {
                    "filename": filename,
                    "pdf_base64": base64.b64encode(pdf_bytes).decode(),
                    "media_type": "application/pdf",
                }
            except ClientError as exc:
                logger.error("S3 get_object failed for %s: %s", obj["Key"], exc)
                continue

        return None
