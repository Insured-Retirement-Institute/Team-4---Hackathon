"""Tests for schema_adapter — eApp format to internal format conversion."""
from __future__ import annotations

import json
from pathlib import Path

from app.services.schema_adapter import adapt_eapp_schema

SCHEMAS_DIR = Path(__file__).parent.parent / "app" / "schemas"


class TestAdaptEappSchema:
    def _load_midland(self):
        with open(SCHEMAS_DIR / "midland-national-eapp.json") as f:
            return json.load(f)

    def test_returns_list_of_steps(self):
        eapp = self._load_midland()
        steps = adapt_eapp_schema(eapp)
        assert isinstance(steps, list)
        assert len(steps) > 0

    def test_step_has_required_keys(self):
        eapp = self._load_midland()
        steps = adapt_eapp_schema(eapp)
        for step in steps:
            assert "step_id" in step
            assert "title" in step
            assert "fields" in step
            assert isinstance(step["fields"], list)

    def test_first_step_is_annuitant(self):
        eapp = self._load_midland()
        steps = adapt_eapp_schema(eapp)
        assert steps[0]["step_id"] == "page-annuitant"
        assert steps[0]["title"] == "Annuitant Information"

    def test_fields_have_correct_structure(self):
        eapp = self._load_midland()
        steps = adapt_eapp_schema(eapp)
        # Check first field of first step
        field = steps[0]["fields"][0]
        assert "field_id" in field
        assert "type" in field
        assert "label" in field
        assert "required" in field

    def test_radio_type_mapped_to_select(self):
        eapp = self._load_midland()
        steps = adapt_eapp_schema(eapp)
        # annuitant_gender is a radio type in the original
        gender_field = None
        for step in steps:
            for f in step["fields"]:
                if f["field_id"] == "annuitant_gender":
                    gender_field = f
                    break
        assert gender_field is not None
        assert gender_field["type"] == "select"
        assert gender_field["options"] is not None
        assert len(gender_field["options"]) == 2

    def test_short_text_mapped_to_text(self):
        eapp = self._load_midland()
        steps = adapt_eapp_schema(eapp)
        first_name = None
        for step in steps:
            for f in step["fields"]:
                if f["field_id"] == "annuitant_first_name":
                    first_name = f
                    break
        assert first_name is not None
        assert first_name["type"] == "text"

    def test_validation_converted(self):
        eapp = self._load_midland()
        steps = adapt_eapp_schema(eapp)
        # annuitant_first_name has max_length: 50
        first_name = None
        for step in steps:
            for f in step["fields"]:
                if f["field_id"] == "annuitant_first_name":
                    first_name = f
                    break
        assert first_name is not None
        assert first_name["validation"]["max_length"] == 50

    def test_visibility_converted_to_conditions(self):
        eapp = self._load_midland()
        steps = adapt_eapp_schema(eapp)
        # joint_annuitant_gender has visibility on has_joint_annuitant=true
        ja_gender = None
        for step in steps:
            for f in step["fields"]:
                if f["field_id"] == "joint_annuitant_gender":
                    ja_gender = f
                    break
        assert ja_gender is not None
        assert "conditions" in ja_gender
        assert len(ja_gender["conditions"]) > 0

    def test_total_field_count_reasonable(self):
        eapp = self._load_midland()
        steps = adapt_eapp_schema(eapp)
        total = sum(len(s["fields"]) for s in steps)
        # Original has 143 questions, some may be filtered (allocation_table)
        assert total > 100

    def test_disclosure_page_skipped(self):
        eapp = self._load_midland()
        steps = adapt_eapp_schema(eapp)
        step_ids = [s["step_id"] for s in steps]
        # Disclosures page has no questions, should be skipped
        assert "page-disclosures" not in step_ids


class TestCompoundConditions:
    """Test that compound AND/OR conditions from Midland work with our evaluator."""

    def test_and_condition_met(self):
        from app.models.conversation import ConversationState, FieldStatus, TrackedField

        fields = {
            "has_joint_annuitant": TrackedField(
                field_id="has_joint_annuitant",
                value=True,
                status=FieldStatus.COLLECTED,
                field_type="checkbox",
            ),
            "test_field": TrackedField(
                field_id="test_field",
                field_type="text",
                conditions=[{
                    "operator": "AND",
                    "conditions": [
                        {"field": "has_joint_annuitant", "op": "eq", "value": True}
                    ],
                }],
            ),
        }
        state = ConversationState(session_id="t", fields=fields)
        active = state.active_fields()
        active_ids = [f.field_id for f in active]
        assert "test_field" in active_ids

    def test_and_condition_not_met(self):
        from app.models.conversation import ConversationState, FieldStatus, TrackedField

        fields = {
            "has_joint_annuitant": TrackedField(
                field_id="has_joint_annuitant",
                value=False,
                status=FieldStatus.COLLECTED,
                field_type="checkbox",
            ),
            "test_field": TrackedField(
                field_id="test_field",
                field_type="text",
                conditions=[{
                    "operator": "AND",
                    "conditions": [
                        {"field": "has_joint_annuitant", "op": "eq", "value": True}
                    ],
                }],
            ),
        }
        state = ConversationState(session_id="t", fields=fields)
        active = state.active_fields()
        active_ids = [f.field_id for f in active]
        assert "test_field" not in active_ids

    def test_or_condition(self):
        from app.models.conversation import ConversationState, FieldStatus, TrackedField

        fields = {
            "field_a": TrackedField(
                field_id="field_a", value="x", status=FieldStatus.COLLECTED, field_type="text",
            ),
            "field_b": TrackedField(
                field_id="field_b", value="y", status=FieldStatus.COLLECTED, field_type="text",
            ),
            "test_field": TrackedField(
                field_id="test_field",
                field_type="text",
                conditions=[{
                    "operator": "OR",
                    "conditions": [
                        {"field": "field_a", "op": "eq", "value": "z"},
                        {"field": "field_b", "op": "eq", "value": "y"},
                    ],
                }],
            ),
        }
        state = ConversationState(session_id="t", fields=fields)
        active_ids = [f.field_id for f in state.active_fields()]
        assert "test_field" in active_ids
