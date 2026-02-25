"""Application configuration via pydantic-settings."""
from __future__ import annotations

import logging
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # AWS Bedrock settings
    aws_region: str = "us-east-1"
    aws_default_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_session_token: str = ""
    bedrock_model: str = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    nova_sonic_model: str = "amazon.nova-sonic-v1:0"
    nova_sonic_voice: str = "tiffany"

    s3_statements_bucket: str = "iri-hackathon-statements"

    # Redtail CRM settings — loaded from env vars (locally) or SSM Parameter Store (prod)
    redtail_api_key: str = ""
    redtail_username: str = ""
    redtail_password: str = ""
    redtail_base_url: str = "https://smf.crm3.redtailtechnology.com/api/public/v1"

    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


def _resolve_ssm_params(s: Settings) -> Settings:
    """If Redtail creds are missing, attempt to fetch from SSM Parameter Store.

    This runs at startup so App Runner instances pick up secrets automatically
    via the attached IAM role (RedtailSSMParameterAccess policy).
    """
    if s.redtail_api_key and s.redtail_username and s.redtail_password:
        return s  # Already populated from env vars

    try:
        import boto3

        kwargs: dict = {"region_name": s.aws_region}
        if s.aws_access_key_id:
            kwargs["aws_access_key_id"] = s.aws_access_key_id
        if s.aws_secret_access_key:
            kwargs["aws_secret_access_key"] = s.aws_secret_access_key
        if s.aws_session_token:
            kwargs["aws_session_token"] = s.aws_session_token

        ssm = boto3.client("ssm", **kwargs)
        names = ["REDTAIL_API_KEY", "REDTAIL_USERNAME", "REDTAIL_PASSWORD", "REDTAIL_BASE_URL"]
        resp = ssm.get_parameters(Names=names, WithDecryption=True)

        for p in resp.get("Parameters", []):
            name = p["Name"]
            value = p["Value"]
            if name == "REDTAIL_API_KEY":
                s.redtail_api_key = value
            elif name == "REDTAIL_USERNAME":
                s.redtail_username = value
            elif name == "REDTAIL_PASSWORD":
                s.redtail_password = value
            elif name == "REDTAIL_BASE_URL":
                s.redtail_base_url = value

        resolved = [p["Name"] for p in resp.get("Parameters", [])]
        if resolved:
            logger.info("Resolved Redtail credentials from SSM Parameter Store: %s", resolved)
        invalid = resp.get("InvalidParameters", [])
        if invalid:
            logger.warning("SSM parameters not found: %s", invalid)
    except Exception as exc:
        logger.warning("Could not fetch Redtail credentials from SSM: %s", exc)

    return s


settings = _resolve_ssm_params(Settings())
