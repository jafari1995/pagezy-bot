"""Heuristic promotional / sponsored content detection."""

from __future__ import annotations

import re

PROMO_PATTERNS = [
    re.compile(r"(?i)اسپانسور|تبلیغ|همکاری\s*در\s*فروش|اد|sponsored|#ad"),
    re.compile(r"(?i)تخفیف|کد\s*تخفیف|discount|promo\s*code|%\s*off"),
    re.compile(r"(?i)لینک\s*ربات|t\.me/|@\w+_bot"),
    re.compile(r"(?i)حمایت\s*شده|paid\s*partnership"),
    re.compile(r"(?i)معرفی\s*ابزار|affiliate"),
]

TOOL_LINK_PATTERNS = [
    re.compile(r"https?://\S+"),
    re.compile(r"(?i)bit\.ly|tinyurl"),
]


def detect_promotional(text: str) -> tuple[bool, str | None]:
    if not text or not text.strip():
        return False, None
    hits: list[str] = []
    for pat in PROMO_PATTERNS:
        if pat.search(text):
            hits.append(pat.pattern[:40])
    if len(hits) >= 1:
        return True, "؛ ".join(hits[:3])
    # Strong signal: discount code pattern
    if re.search(r"[A-Z0-9]{5,}30|[A-Z]{4,}\d+", text):
        return True, "کد تخفیف احتمالی"
    return False, None