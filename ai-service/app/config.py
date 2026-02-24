"""Application configuration via pydantic-settings."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # AWS Bedrock settings
    aws_region: str = "us-east-1"
    aws_default_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_session_token: str = ""
    bedrock_model: str = "anthropic.claude-3-sonnet-20240229-v1:0"

    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
