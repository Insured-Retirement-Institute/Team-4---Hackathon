"""Tests for conversation state model and phase logic."""
from __future__ import annotations

from app.models.conversation import (
    ConversationState,
    FieldStatus,
    SessionPhase,
)

from .conftest import SAMPLE_KNOWN_DATA, SAMPLE_QUESTIONS, make_fields


class TestConversationState:
    def _make_state(self, known_data=None, **overrides) -> ConversationState:
        kd = known_data if known_data is not None else SAMPLE_KNOWN_DATA
        fields = make_fields(SAMPLE_QUESTIONS, kd)
        defaults = dict(
            session_id="test",
            phase=SessionPhase.SPOT_CHECK if kd else SessionPhase.COLLECTING,
            fields=fields,
            steps=SAMPLE_QUESTIONS,
        )
        defaults.update(overrides)
        return ConversationState(**defaults)

    def test_fields_by_status(self):
        state = self._make_state()
        unconfirmed = state.fields_by_status(FieldStatus.UNCONFIRMED)
        assert len(unconfirmed) == 3  # first_name, last_name, dob

    def test_missing_required(self):
        state = self._make_state()
        missing = state.missing_required()
        ids = [f.field_id for f in missing]
        assert "owner_ssn" in ids
        assert "product_type" in ids
        assert "initial_premium" in ids

    def test_unconfirmed_fields(self):
        state = self._make_state()
        unconfirmed = state.unconfirmed_fields()
        ids = [f.field_id for f in unconfirmed]
        assert "owner_first_name" in ids
        assert "owner_last_name" in ids
        assert "owner_dob" in ids

    def test_all_required_resolved_false(self):
        state = self._make_state()
        assert not state.all_required_resolved()

    def test_all_required_resolved_true(self):
        state = self._make_state()
        # Confirm all known, collect all missing required
        for f in state.fields.values():
            if f.status == FieldStatus.UNCONFIRMED:
                f.status = FieldStatus.CONFIRMED
            elif f.required and f.status == FieldStatus.MISSING:
                f.value = "test"
                f.status = FieldStatus.COLLECTED
        assert state.all_required_resolved()

    def test_application_data_only_resolved(self):
        state = self._make_state()
        # Initially no confirmed/collected
        assert len(state.application_data()) == 0

        # Confirm one field
        state.fields["owner_first_name"].status = FieldStatus.CONFIRMED
        data = state.application_data()
        assert data["owner_first_name"] == "John"
        assert "owner_ssn" not in data  # still missing

    def test_field_summary(self):
        state = self._make_state()
        summary = state.field_summary()
        assert summary["unconfirmed"] == 3
        assert summary["missing"] == 4  # ssn, email, product_type, initial_premium
        assert summary["confirmed"] == 0
        assert summary["collected"] == 0

    def test_no_known_data_starts_collecting(self):
        state = self._make_state(known_data={})
        assert state.phase == SessionPhase.COLLECTING

    def test_with_known_data_starts_spot_check(self):
        state = self._make_state()
        assert state.phase == SessionPhase.SPOT_CHECK
