import os
from dotenv import load_dotenv

load_dotenv()


class BaseConfig:
    DEBUG = False
    TESTING = False
    AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
    AWS_ENDPOINT_URL = os.getenv("AWS_ENDPOINT_URL") or None
    DYNAMODB_SCHEMAS_TABLE = os.getenv("DYNAMODB_SCHEMAS_TABLE", "CarrierSchemas")
    DYNAMODB_APPLICATIONS_TABLE = os.getenv("DYNAMODB_APPLICATIONS_TABLE", "Applications")


class DevelopmentConfig(BaseConfig):
    DEBUG = True


class TestingConfig(BaseConfig):
    TESTING = True
    DEBUG = True
    DYNAMODB_SCHEMAS_TABLE = "CarrierSchemas_test"
    DYNAMODB_APPLICATIONS_TABLE = "Applications_test"


class ProductionConfig(BaseConfig):
    pass


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}
