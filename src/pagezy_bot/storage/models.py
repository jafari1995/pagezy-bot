"""SQLAlchemy models."""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Platform(str, enum.Enum):
    TELEGRAM = "telegram"
    INSTAGRAM = "instagram"
    YOUTUBE = "youtube"


class PostRecord(Base):
    __tablename__ = "posts"
    __table_args__ = (UniqueConstraint("platform", "source_id", "external_id", name="uq_post"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    platform: Mapped[Platform] = mapped_column(Enum(Platform), index=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("tracked_sources.id"), index=True)
    external_id: Mapped[str] = mapped_column(String(256))
    published_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    format_type: Mapped[str] = mapped_column(String(64), default="unknown")
    caption: Mapped[str] = mapped_column(Text, default="")
    url: Mapped[str] = mapped_column(String(512), default="")
    views: Mapped[int | None] = mapped_column(Integer, nullable=True)
    likes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comments: Mapped[int | None] = mapped_column(Integer, nullable=True)
    forwards: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reactions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    raw_meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    topic_style: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_promotional: Mapped[bool] = mapped_column(Boolean, default=False)
    promo_reason: Mapped[str | None] = mapped_column(String(256), nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    source: Mapped["TrackedSource"] = relationship(back_populates="posts")


class TrackedSource(Base):
    __tablename__ = "tracked_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_user_id: Mapped[int] = mapped_column(Integer, index=True)
    platform: Mapped[Platform] = mapped_column(Enum(Platform))
    identifier: Mapped[str] = mapped_column(String(256))
    display_name: Mapped[str] = mapped_column(String(256), default="")
    last_fetched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    posts: Mapped[list[PostRecord]] = relationship(back_populates="source")


class MonitoredBrand(Base):
    __tablename__ = "monitored_brands"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_user_id: Mapped[int] = mapped_column(Integer, index=True)
    name: Mapped[str] = mapped_column(String(128))
    keywords_json: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    scan_channels: Mapped[list["BrandScanChannel"]] = relationship(back_populates="brand")
    alerts: Mapped[list["AdAlert"]] = relationship(back_populates="brand")


class BrandScanChannel(Base):
    __tablename__ = "brand_scan_channels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("monitored_brands.id"), index=True)
    platform: Mapped[Platform] = mapped_column(Enum(Platform))
    identifier: Mapped[str] = mapped_column(String(256))

    brand: Mapped[MonitoredBrand] = relationship(back_populates="scan_channels")


class AdAlert(Base):
    __tablename__ = "ad_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("monitored_brands.id"), index=True)
    source_platform: Mapped[Platform] = mapped_column(Enum(Platform))
    source_identifier: Mapped[str] = mapped_column(String(256))
    post_external_id: Mapped[str] = mapped_column(String(256), default="")
    sample_text: Mapped[str] = mapped_column(Text, default="")
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    views: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notified: Mapped[bool] = mapped_column(Boolean, default=False)
    raw_meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    brand: Mapped[MonitoredBrand] = relationship(back_populates="alerts")


class UserState(Base):
    """Conversation flow state per Telegram user."""

    __tablename__ = "user_states"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    flow: Mapped[str] = mapped_column(String(64), default="idle")
    data_json: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ReportCache(Base):
    __tablename__ = "report_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cache_key: Mapped[str] = mapped_column(String(512), unique=True, index=True)
    payload_json: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)