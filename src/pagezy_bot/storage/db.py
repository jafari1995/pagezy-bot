"""Database session and helpers."""

from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from pagezy_bot.config import get_settings
from pagezy_bot.storage.models import Base, UserState


def _ensure_sqlite_dir(url: str) -> None:
    if url.startswith("sqlite:///"):
        raw = url.replace("sqlite:///", "")
        if raw != ":memory:" and not raw.startswith("/"):
            path = Path(raw)
            path.parent.mkdir(parents=True, exist_ok=True)


_engine = None
_SessionLocal = None


def init_db() -> sessionmaker[Session]:
    global _engine, _SessionLocal
    if _SessionLocal is not None:
        return _SessionLocal
    settings = get_settings()
    _ensure_sqlite_dir(settings.database_url)
    _engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
    )
    Base.metadata.create_all(_engine)
    _SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)
    return _SessionLocal


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    factory = init_db()
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_user_state(session: Session, user_id: int) -> UserState:
    state = session.get(UserState, user_id)
    if state is None:
        state = UserState(user_id=user_id, flow="idle", data_json={})
        session.add(state)
        session.flush()
    return state


def set_user_state(session: Session, user_id: int, flow: str, data: dict | None = None) -> UserState:
    state = get_user_state(session, user_id)
    state.flow = flow
    if data is not None:
        state.data_json = data
    session.flush()
    return state