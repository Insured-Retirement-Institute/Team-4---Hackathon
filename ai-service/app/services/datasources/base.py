"""Abstract data source interface for pre-fill agent."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class DataSource(ABC):
    """Base class for external data sources that provide pre-fill data."""

    @abstractmethod
    async def query(self, params: dict[str, Any]) -> dict[str, Any]:
        """Query the data source and return {field_id: value} mappings."""

    @abstractmethod
    def available_fields(self) -> list[str]:
        """Return list of field_ids this source can provide."""
