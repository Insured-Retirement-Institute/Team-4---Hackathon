"""Tests for validation_service — field-level validation."""
from __future__ import annotations

from app.models.conversation import TrackedField
from app.services.validation_service import validate_field


def _field(field_type="text", required=False, validation=None, options=None, label="Test Field"):
    return TrackedField(
        field_id="test_field",
        field_type=field_type,
        required=required,
        validation=validation or {},
        options=options,
        label=label,
    )


class TestValidateText:
    def test_valid_text(self):
        ok, err = validate_field(_field("text"), "hello")
        assert ok
        assert err is None

    def test_min_length(self):
        ok, err = validate_field(_field("text", validation={"min_length": 3}), "ab")
        assert not ok
        assert "at least 3" in err

    def test_max_length(self):
        ok, err = validate_field(_field("text", validation={"max_length": 5}), "toolong")
        assert not ok
        assert "at most 5" in err

    def test_pattern(self):
        ok, err = validate_field(_field("text", validation={"pattern": r"^\d+$"}), "abc")
        assert not ok

    def test_pattern_valid(self):
        ok, err = validate_field(_field("text", validation={"pattern": r"^\d+$"}), "123")
        assert ok


class TestValidateEmail:
    def test_valid_email(self):
        ok, err = validate_field(_field("email"), "test@example.com")
        assert ok

    def test_invalid_email(self):
        ok, err = validate_field(_field("email"), "not-an-email")
        assert not ok
        assert "email" in err.lower()


class TestValidatePhone:
    def test_valid_phone(self):
        ok, err = validate_field(_field("phone"), "555-123-4567")
        assert ok

    def test_short_phone(self):
        ok, err = validate_field(_field("phone"), "12345")
        assert not ok
        assert "10 digits" in err


class TestValidateSSN:
    def test_valid_ssn(self):
        ok, err = validate_field(_field("ssn"), "123-45-6789")
        assert ok

    def test_invalid_ssn(self):
        ok, err = validate_field(_field("ssn"), "12345")
        assert not ok
        assert "XXX-XX-XXXX" in err


class TestValidateNumber:
    def test_valid_number(self):
        ok, err = validate_field(_field("number"), 42)
        assert ok

    def test_min_value(self):
        ok, err = validate_field(_field("number", validation={"min_value": 10}), 5)
        assert not ok
        assert "at least 10" in err

    def test_max_value(self):
        ok, err = validate_field(_field("number", validation={"max_value": 100}), 200)
        assert not ok
        assert "at most 100" in err

    def test_not_a_number(self):
        ok, err = validate_field(_field("number"), "abc")
        assert not ok
        assert "number" in err.lower()


class TestValidateCurrency:
    def test_valid_currency(self):
        ok, err = validate_field(
            _field("currency", validation={"min_value": 5000, "max_value": 1000000}),
            50000,
        )
        assert ok

    def test_below_minimum(self):
        ok, err = validate_field(
            _field("currency", validation={"min_value": 5000}),
            1000,
        )
        assert not ok


class TestValidateSelect:
    def test_valid_option(self):
        f = _field("select", options=[{"value": "a", "label": "A"}, {"value": "b", "label": "B"}])
        ok, err = validate_field(f, "a")
        assert ok

    def test_invalid_option(self):
        f = _field("select", options=[{"value": "a", "label": "A"}, {"value": "b", "label": "B"}])
        ok, err = validate_field(f, "c")
        assert not ok
        assert "must be one of" in err


class TestValidateCheckbox:
    def test_valid_bool(self):
        ok, err = validate_field(_field("checkbox"), True)
        assert ok

    def test_invalid_bool(self):
        ok, err = validate_field(_field("checkbox"), "yes")
        assert not ok


class TestValidateDate:
    def test_valid_date(self):
        ok, err = validate_field(_field("date"), "1965-03-15")
        assert ok

    def test_invalid_date(self):
        ok, err = validate_field(_field("date"), "not-a-date")
        assert not ok
        assert "valid date" in err


class TestRequired:
    def test_required_empty(self):
        ok, err = validate_field(_field("text", required=True), "")
        assert not ok
        assert "required" in err

    def test_required_none(self):
        ok, err = validate_field(_field("text", required=True), None)
        assert not ok

    def test_optional_empty(self):
        ok, err = validate_field(_field("text", required=False), "")
        assert ok

    def test_optional_none(self):
        ok, err = validate_field(_field("text", required=False), None)
        assert ok


class TestCustomMessage:
    def test_custom_message_on_failure(self):
        f = _field("number", validation={"min_value": 10, "custom_message": "Must be 10+"})
        ok, err = validate_field(f, 5)
        assert not ok
        assert err == "Must be 10+"
