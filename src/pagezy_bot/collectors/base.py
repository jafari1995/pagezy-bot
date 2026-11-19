"""Shared collector types and time-range parsing."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any


class TimeRangeKind(str, Enum):
    LAST_WEEK = "last_week"
    LAST_MONTH = "last_month"
    ALL = "all"
    CUSTOM = "custom"


@dataclass
class TimeRange:
    kind: TimeRangeKind
    start: datetime | None = None
    end: datetime | None = None

    def resolve(self) -> tuple[datetime | None, datetime | None]:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if self.kind == TimeRangeKind.LAST_WEEK:
            return now - timedelta(days=7), now
        if self.kind == TimeRangeKind.LAST_MONTH:
            return now - timedelta(days=30), now
        if self.kind == TimeRangeKind.ALL:
            return None, None
        if self.kind == TimeRangeKind.CUSTOM:
            return self.start, self.end or now
        return None, None


@dataclass
class CollectedPost:
    external_id: str
    published_at: datetime
    format_type: str
    caption: str
    url: str
    views: int | None = None
    likes: int | None = None
    comments: int | None = None
    forwards: int | None = None
    reactions: dict[str, int] | None = None
    raw_meta: dict[str, Any] = field(default_factory=dict)

    def in_range(self, start: datetime | None, end: datetime | None) -> bool:
        if start and self.published_at < start:
            return False
        if end and self.published_at > end:
            return False
        return True