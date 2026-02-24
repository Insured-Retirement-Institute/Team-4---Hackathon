"""Tests for validation logic (unit tests that don't require DynamoDB)."""

from app.utils.validators import validate_field, evaluate_conditions


class TestValidateField:
    def test_required_field_missing(self):
        field = {"field_id": "name", "type": "text", "label": "Name", "required": True}
        errors = validate_field(field, None)
        assert len(errors) == 1
        assert errors[0]["field_id"] == "name"

    def test_required_field_empty_string(self):
        field = {"field_id": "name", "type": "text", "label": "Name", "required": True}
        errors = validate_field(field, "")
        assert len(errors) == 1

    def test_required_field_present(self):
        field = {"field_id": "name", "type": "text", "label": "Name", "required": True}
        errors = validate_field(field, "John")
        assert len(errors) == 0

    def test_optional_field_empty(self):
        field = {"field_id": "name", "type": "text", "label": "Name", "required": False}
        errors = validate_field(field, "")
        assert len(errors) == 0

    def test_min_length(self):
        field = {
            "field_id": "name", "type": "text", "label": "Name",
            "required": True, "validation": {"min_length": 2},
        }
        errors = validate_field(field, "J")
        assert len(errors) == 1

    def test_max_length(self):
        field = {
            "field_id": "name", "type": "text", "label": "Name",
            "required": True, "validation": {"max_length": 5},
        }
        errors = validate_field(field, "Jonathan")
        assert len(errors) == 1

    def test_pattern_valid(self):
        field = {
            "field_id": "zip", "type": "text", "label": "ZIP",
            "required": True, "validation": {"pattern": "^\\d{5}$"},
        }
        errors = validate_field(field, "12345")
        assert len(errors) == 0

    def test_pattern_invalid(self):
        field = {
            "field_id": "zip", "type": "text", "label": "ZIP",
            "required": True, "validation": {"pattern": "^\\d{5}$"},
        }
        errors = validate_field(field, "abcde")
        assert len(errors) == 1

    def test_currency_min_value(self):
        field = {
            "field_id": "premium", "type": "currency", "label": "Premium",
            "required": True, "validation": {"min_value": 5000},
        }
        errors = validate_field(field, 1000)
        assert len(errors) == 1

    def test_currency_max_value(self):
        field = {
            "field_id": "premium", "type": "currency", "label": "Premium",
            "required": True, "validation": {"max_value": 1000000},
        }
        errors = validate_field(field, 2000000)
        assert len(errors) == 1

    def test_currency_valid(self):
        field = {
            "field_id": "premium", "type": "currency", "label": "Premium",
            "required": True, "validation": {"min_value": 5000, "max_value": 1000000},
        }
        errors = validate_field(field, 50000)
        assert len(errors) == 0

    def test_select_valid_option(self):
        field = {
            "field_id": "state", "type": "select", "label": "State",
            "required": True,
            "options": [{"value": "NY", "label": "New York"}, {"value": "CA", "label": "California"}],
        }
        errors = validate_field(field, "NY")
        assert len(errors) == 0

    def test_select_invalid_option(self):
        field = {
            "field_id": "state", "type": "select", "label": "State",
            "required": True,
            "options": [{"value": "NY", "label": "New York"}, {"value": "CA", "label": "California"}],
        }
        errors = validate_field(field, "XX")
        assert len(errors) == 1

    def test_number_not_a_number(self):
        field = {
            "field_id": "age", "type": "number", "label": "Age",
            "required": True,
        }
        errors = validate_field(field, "abc")
        assert len(errors) == 1

    def test_custom_message(self):
        field = {
            "field_id": "name", "type": "text", "label": "Name",
            "required": True,
            "validation": {"custom_message": "Please enter your name"},
        }
        errors = validate_field(field, None)
        assert errors[0]["message"] == "Please enter your name"


class TestEvaluateConditions:
    def test_no_conditions(self):
        assert evaluate_conditions([], {}) is True

    def test_equals_true(self):
        conditions = [{"field_id": "type", "operator": "equals", "value": "annuity"}]
        assert evaluate_conditions(conditions, {"type": "annuity"}) is True

    def test_equals_false(self):
        conditions = [{"field_id": "type", "operator": "equals", "value": "annuity"}]
        assert evaluate_conditions(conditions, {"type": "life"}) is False

    def test_not_equals(self):
        conditions = [{"field_id": "type", "operator": "not_equals", "value": "annuity"}]
        assert evaluate_conditions(conditions, {"type": "life"}) is True

    def test_in_operator(self):
        conditions = [{"field_id": "state", "operator": "in", "value": ["NY", "CA"]}]
        assert evaluate_conditions(conditions, {"state": "NY"}) is True
        assert evaluate_conditions(conditions, {"state": "TX"}) is False

    def test_greater_than(self):
        conditions = [{"field_id": "amount", "operator": "greater_than", "value": 1000}]
        assert evaluate_conditions(conditions, {"amount": 2000}) is True
        assert evaluate_conditions(conditions, {"amount": 500}) is False

    def test_multiple_conditions_all_must_pass(self):
        conditions = [
            {"field_id": "type", "operator": "equals", "value": "annuity"},
            {"field_id": "amount", "operator": "greater_than", "value": 1000},
        ]
        assert evaluate_conditions(conditions, {"type": "annuity", "amount": 2000}) is True
        assert evaluate_conditions(conditions, {"type": "annuity", "amount": 500}) is False
