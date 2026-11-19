"""OpenRouter client — free models only."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import httpx

from pagezy_bot.config import PAGEZY_SYSTEM_PROMPT_FA, assert_model_is_free, get_settings

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def chat(self, user_prompt: str, *, max_tokens: int = 1024) -> str:
        if self.settings.mock_mode or not self.settings.openrouter_api_key:
            return _mock_llm_response(user_prompt)

        models = self.settings.free_model_list()
        last_error: Exception | None = None

        for model in models:
            assert_model_is_free(model)
            try:
                return await self._request(model, user_prompt, max_tokens)
            except RateLimitError:
                await asyncio.sleep(2.0)
                last_error = RateLimitError(model)
            except Exception as e:
                logger.warning("Model %s failed: %s", model, e)
                last_error = e
                await asyncio.sleep(1.0)

        if last_error:
            raise RuntimeError(f"همه مدل‌های رایگان ناموفق بودند: {last_error}") from last_error
        raise RuntimeError("مدل LLM در دسترس نیست.")

    async def _request(self, model: str, user_prompt: str, max_tokens: int) -> str:
        headers = {
            "Authorization": f"Bearer {self.settings.openrouter_api_key}",
            "HTTP-Referer": "https://pagezy.local",
            "X-Title": "Pagezy Analyst Bot",
        }
        body = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": PAGEZY_SYSTEM_PROMPT_FA},
                {"role": "user", "content": user_prompt},
            ],
        }
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(OPENROUTER_URL, headers=headers, json=body)
            if resp.status_code == 429:
                raise RateLimitError(model)
            resp.raise_for_status()
            data = resp.json()
        choice = data["choices"][0]["message"]["content"]
        return choice.strip()

    async def classify_posts_batch(
        self,
        items: list[dict[str, str]],
        batch_size: int = 8,
    ) -> list[str]:
        """Return topic/style label per item."""
        if not items:
            return []
        if self.settings.mock_mode or not self.settings.openrouter_api_key:
            return [_mock_topic(it.get("caption", "")) for it in items]

        results: list[str] = []
        for i in range(0, len(items), batch_size):
            batch = items[i : i + batch_size]
            payload = json.dumps(batch, ensure_ascii=False)
            prompt = (
                "برای هر آیتم JSON زیر یک برچسب موضوع/سبک کوتاه فارسی بده "
                '(مثلاً: "آموزشی", "خبری/تحلیل", "تبلیغ ابزار", "سرگرمی").\n'
                "فقط آرایه JSON از رشته‌ها برگردان، همان ترتیب ورودی.\n"
                f"ورودی:\n{payload}"
            )
            raw = await self.chat(prompt, max_tokens=512)
            parsed = _parse_json_array(raw, len(batch))
            results.extend(parsed)
        return results

    async def answer_question(self, question: str, context: dict[str, Any]) -> str:
        ctx = json.dumps(context, ensure_ascii=False, default=str)[:12000]
        prompt = (
            f"با تکیه بر داده گزارش زیر به فارسی پاسخ بده:\n\nداده:\n{ctx}\n\nسوال: {question}"
        )
        return await self.chat(prompt, max_tokens=800)


class RateLimitError(Exception):
    def __init__(self, model: str):
        self.model = model
        super().__init__(f"rate limit on {model}")


def _parse_json_array(raw: str, expected: int) -> list[str]:
    raw = raw.strip()
    if "```" in raw:
        parts = raw.split("```")
        for p in parts:
            p = p.strip()
            if p.startswith("json"):
                p = p[4:].strip()
            if p.startswith("["):
                raw = p
                break
    try:
        arr = json.loads(raw)
        if isinstance(arr, list) and len(arr) >= expected:
            return [str(x) for x in arr[:expected]]
    except json.JSONDecodeError:
        pass
    return ["نامشخص"] * expected


def _mock_topic(caption: str) -> str:
    c = caption.lower()
    if "تبلیغ" in c or "تخفیف" in c or "اسپانس" in c:
        return "تبلیغ ابزار"
    if "آموزش" in c:
        return "آموزشی"
    if "تحلیل" in c or "خبر" in c:
        return "خبری/تحلیل"
    return "عمومی"


def _mock_llm_response(prompt: str) -> str:
    if "آرایه JSON" in prompt:
        return '["آموزشی", "تبلیغ ابزار", "خبری/تحلیل"]'
    if "سوال" in prompt or "?" in prompt:
        return "بر اساس داده‌های موجود، بیشترین بازدید مربوط به پست‌های خبری/تحلیلی و ویدیوهای آموزشی است."
    return "گزارش آماده است."