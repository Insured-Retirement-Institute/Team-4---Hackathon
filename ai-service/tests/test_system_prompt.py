"""Tests for phase-aware system prompt builder."""
from __future__ import annotations

from app.models.conversation import (
    ConversationState,
    FieldStatus,
    SessionPhase,
)
from app.prompts.system_prompt import build_system_prompt

from .conftest import SAMPLE_KNOWN_DATA, SAMPLE_QUESTIONS, make_fields


class TestBuildSystemPrompt:
    def _make_state(self, phase=SessionPhase.SPOT_CHECK, known_data=None, **overrides) -> ConversationState:
        kd = known_data if known_data is not None else SAMPLE_KNOWN_DATA
        fields = make_fields(SAMPLE_QUESTIONS, kd)
        defaults = dict(
            session_id="test",
            phase=phase,
            fields=fields,
            steps=SAMPLE_QUESTIONS,
        )
        defaults.update(overrides)
        return ConversationState(**defaults)

    def test_includes_persona(self):
        state = self._make_state()
        prompt = build_system_prompt(state)
        assert "warm, professional" in prompt

    def test_spot_check_phase(self):
        state = self._make_state(phase=SessionPhase.SPOT_CHECK)
        prompt = build_system_prompt(state)
        assert "Spot Check" in prompt
        assert "confirm_known_fields" in prompt

    def test_collecting_phase(self):
        state = self._make_state(phase=SessionPhase.COLLECTING)
        prompt = build_system_prompt(state)
        assert "Collecting" in prompt
        assert "extract_application_fields" in prompt

    def test_reviewing_phase(self):
        state = self._make_state(phase=SessionPhase.REVIEWING)
        prompt = build_system_prompt(state)
        assert "Final Review" in prompt

    def test_shows_unconfirmed_fields(self):
        state = self._make_state()
        prompt = build_system_prompt(state)
        assert "Needs Verification" in prompt
        assert "John" in prompt  # known first name value

    def test_shows_missing_fields(self):
        state = self._make_state()
        prompt = build_system_prompt(state)
        assert "Needs Collection" in prompt
        assert "SSN" in prompt

    def test_shows_validation_errors(self):
        state = self._make_state()
        state.fields["owner_ssn"].validation_error = "SSN must be in format XXX-XX-XXXX."
        prompt = build_system_prompt(state)
        assert "Validation Errors" in prompt
        assert "XXX-XX-XXXX" in prompt

    def test_select_options_shown(self):
        state = self._make_state()
        prompt = build_system_prompt(state)
        assert "Annuity" in prompt
        assert "Life Insurance" in prompt

    def test_never_fabricate_instruction(self):
        state = self._make_state()
        prompt = build_system_prompt(state)
        assert "NEVER fabricate" in prompt
