"""Tests for the validation service (schema-level validation)."""

import json
import os
from app.services.validation_service import validate_application


def load_sample_schema():
    schema_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "app", "schemas", "carriers", "sample_carrier.json",
    )
    with open(schema_path) as f:
        return json.load(f)


class TestValidateApplication:
    def setup_method(self):
        self.schema = load_sample_schema()

    def test_empty_application_has_errors(self):
        is_valid, errors = validate_application(self.schema, {})
        assert is_valid is False
        assert len(errors) > 0

    def test_valid_annuity_application(self):
        data = {
            "product_type": "annuity",
            "owner_first_name": "John",
            "owner_last_name": "Doe",
            "owner_dob": "1980-01-15",
            "owner_ssn": "123-45-6789",
            "owner_email": "john@example.com",
            "owner_phone": "(555) 555-5555",
            "owner_address": "123 Main St",
            "owner_city": "New York",
            "owner_state": "NY",
            "owner_zip": "10001",
            "annuity_type": "fixed",
            "initial_premium": 50000,
            "payment_method": "check",
            "beneficiary_first_name": "Jane",
            "beneficiary_last_name": "Doe",
            "beneficiary_relationship": "spouse",
            "beneficiary_percentage": 100,
            "consent_accuracy": True,
            "consent_terms": True,
        }
        is_valid, errors = validate_application(self.schema, data)
        assert is_valid is True
        assert len(errors) == 0

    def test_annuity_conditional_fields_not_required_for_life(self):
        """When product_type is 'life', annuity fields should be skipped."""
        data = {
            "product_type": "life",
            "owner_first_name": "John",
            "owner_last_name": "Doe",
            "owner_dob": "1980-01-15",
            "owner_ssn": "123-45-6789",
            "owner_email": "john@example.com",
            "owner_phone": "(555) 555-5555",
            "owner_address": "123 Main St",
            "owner_city": "New York",
            "owner_state": "NY",
            "owner_zip": "10001",
            "coverage_amount": 100000,
            "tobacco_use": "never",
            "beneficiary_first_name": "Jane",
            "beneficiary_last_name": "Doe",
            "beneficiary_relationship": "spouse",
            "beneficiary_percentage": 100,
            "consent_accuracy": True,
            "consent_terms": True,
        }
        is_valid, errors = validate_application(self.schema, data)
        assert is_valid is True
        assert len(errors) == 0

    def test_missing_required_field_returns_error(self):
        data = {
            "product_type": "annuity",
            # missing owner_first_name
            "owner_last_name": "Doe",
        }
        is_valid, errors = validate_application(self.schema, data)
        assert is_valid is False
        field_ids = [e["field_id"] for e in errors]
        assert "owner_first_name" in field_ids

    def test_invalid_premium_range(self):
        data = {
            "product_type": "annuity",
            "owner_first_name": "John",
            "owner_last_name": "Doe",
            "owner_dob": "1980-01-15",
            "owner_ssn": "123-45-6789",
            "owner_email": "john@example.com",
            "owner_phone": "(555) 555-5555",
            "owner_address": "123 Main St",
            "owner_city": "New York",
            "owner_state": "NY",
            "owner_zip": "10001",
            "annuity_type": "fixed",
            "initial_premium": 100,  # below minimum of 5000
            "payment_method": "check",
            "beneficiary_first_name": "Jane",
            "beneficiary_last_name": "Doe",
            "beneficiary_relationship": "spouse",
            "beneficiary_percentage": 100,
            "consent_accuracy": True,
            "consent_terms": True,
        }
        is_valid, errors = validate_application(self.schema, data)
        assert is_valid is False
        field_ids = [e["field_id"] for e in errors]
        assert "initial_premium" in field_ids
