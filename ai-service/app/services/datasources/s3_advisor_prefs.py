"""S3-backed advisor preferences store."""

from __future__ import annotations

import json
import logging
from typing import Any

import boto3
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger(__name__)


class S3AdvisorPrefsStore:
    """Fetches advisor preference profiles from S3."""

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

    def fetch_advisor_profile(self, advisor_id: str) -> dict[str, Any] | None:
        """Download an advisor's preference profile from S3.

        Returns parsed JSON dict or None on failure.
        """
        key = f"advisors/{advisor_id}/profile.json"
        try:
            resp = self._s3.get_object(Bucket=self._bucket, Key=key)
            body = resp["Body"].read().decode("utf-8")
            return json.loads(body)
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code", "")
            if error_code == "NoSuchKey":
                logger.info("No advisor profile found for %s", advisor_id)
            else:
                logger.error("S3 get_object failed for %s: %s", key, exc)
            return None
