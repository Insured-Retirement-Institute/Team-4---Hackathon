"""Tests for extraction_service — tool building for phases."""
from __future__ import annotations

from app.models.conversation import (
    ConversationState,
    FieldStatus,
    SessionPhase,
)
from app.services.extraction_service import (
    build_confirm_tool,
    build_extraction_tool,
    build_tools_for_phase,
)

from .conftest import SAMPLE_KNOWN_DATA, SAMPLE_QUESTIONS, make_fields


class TestBuildExtractionTool:
    def test_basic_tool_structure(self):
        fields = make_fields(SAMPLE_QUESTIONS)
        tool = build_extraction_tool(list(fields.values()))

        assert tool["name"] == "extract_application_fields"
        assert "input_schema" in tool
        assert tool["input_schema"]["type"] == "object"

    def test_select_field_has_enum(self):
        fields = make_fields(SAMPLE_QUESTIONS)
        tool = build_extraction_tool(list(fields.values()))

        props = tool["input_schema"]["properties"]
        assert "product_type" in props
        assert props["product_type"]["enum"] == ["annuity", "life"]

    def test_text_field_with_validation(self):
        fields = make_fields(SAMPLE_QUESTIONS)
        tool = build_extraction_tool(list(fields.values()))

        props = tool["input_schema"]["properties"]
        assert "owner_first_name" in props
        assert props["owner_first_name"]["type"] == "string"
        assert props["owner_first_name"]["maxLength"] == 50

    def test_currency_field(self):
        fields = make_fields(SAMPLE_QUESTIONS)
        tool = build_extraction_tool(list(fields.values()))

        props = tool["input_schema"]["properties"]
        assert "initial_premium" in props
        assert props["initial_premium"]["type"] == "number"
        assert props["initial_premium"]["minimum"] == 5000
        assert props["initial_premium"]["maximum"] == 1000000

    def test_ssn_field_has_pattern(self):
        fields = make_fields(SAMPLE_QUESTIONS)
        tool = build_extraction_tool(list(fields.values()))

        props = tool["input_schema"]["properties"]
        assert "owner_ssn" in props
        assert "pattern" in props["owner_ssn"]

    def test_date_field(self):
        fields = make_fields(SAMPLE_QUESTIONS)
        tool = build_extraction_tool(list(fields.values()))

        props = tool["input_schema"]["properties"]
        assert props["owner_dob"]["type"] == "string"
        assert props["owner_dob"]["format"] == "date"


class TestBuildConfirmTool:
    def test_confirm_tool_structure(self):
        fields = make_fields(SAMPLE_QUESTIONS, SAMPLE_KNOWN_DATA)
        unconfirmed = [f for f in fields.values() if f.status == FieldStatus.UNCONFIRMED]
        tool = build_confirm_tool(unconfirmed)

        assert tool["name"] == "confirm_known_fields"
        assert "field_ids" in tool["input_schema"]["properties"]
        enum = tool["input_schema"]["properties"]["field_ids"]["items"]["enum"]
        assert "owner_first_name" in enum
        assert "owner_last_name" in enum
        assert "owner_dob" in enum

    def test_confirm_tool_only_has_unconfirmed(self):
        fields = make_fields(SAMPLE_QUESTIONS, SAMPLE_KNOWN_DATA)
        unconfirmed = [f for f in fields.values() if f.status == FieldStatus.UNCONFIRMED]
        tool = build_confirm_tool(unconfirmed)
        enum = tool["input_schema"]["properties"]["field_ids"]["items"]["enum"]
        # Should not have fields that weren't in known_data
        assert "owner_ssn" not in enum
        assert "product_type" not in enum


class TestBuildToolsForPhase:
    def _make_state(self, phase, known_data=None):
        kd = known_data if known_data is not None else SAMPLE_KNOWN_DATA
        fields = make_fields(SAMPLE_QUESTIONS, kd)
        if phase == SessionPhase.COLLECTING:
            for fid in (kd or {}):
                if fid in fields:
                    fields[fid].status = FieldStatus.CONFIRMED
        return ConversationState(
            session_id="test",
            phase=phase,
            fields=fields,
            steps=SAMPLE_QUESTIONS,
        )

    def test_spot_check_has_both_tools(self):
        state = self._make_state(SessionPhase.SPOT_CHECK)
        tools = build_tools_for_phase(state)
        names = [t["name"] for t in tools]
        assert "confirm_known_fields" in names
        assert "extract_application_fields" in names

    def test_collecting_has_extract_only(self):
        state = self._make_state(SessionPhase.COLLECTING)
        tools = build_tools_for_phase(state)
        names = [t["name"] for t in tools]
        assert "extract_application_fields" in names
        assert "confirm_known_fields" not in names

    def test_reviewing_has_both_tools(self):
        state = self._make_state(SessionPhase.REVIEWING)
        # Mark all as confirmed/collected for reviewing
        for f in state.fields.values():
            if f.status == FieldStatus.MISSING:
                f.value = "test"
                f.status = FieldStatus.COLLECTED
        tools = build_tools_for_phase(state)
        names = [t["name"] for t in tools]
        assert "confirm_known_fields" in names
        assert "extract_application_fields" in names

    def test_no_known_data_no_confirm_in_spot_check(self):
        state = self._make_state(SessionPhase.SPOT_CHECK, known_data={})
        tools = build_tools_for_phase(state)
        names = [t["name"] for t in tools]
        assert "confirm_known_fields" not in names
