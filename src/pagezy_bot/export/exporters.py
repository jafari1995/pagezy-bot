"""Export reports to xlsx, csv, pdf, txt."""

from __future__ import annotations

import csv
import io
from pathlib import Path
from typing import Any

from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from pagezy_bot.analysis.stats import PostForStats, ReportSummary, summary_to_dict
from pagezy_bot.config import get_settings

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
except ImportError:
    arabic_reshaper = None
    get_display = None


def _reshape_persian(text: str) -> str:
    if not text:
        return ""
    if arabic_reshaper and get_display:
        return get_display(arabic_reshaper.reshape(text))
    return text


def export_xlsx(summary: ReportSummary, posts: list[PostForStats], path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    wb = Workbook()
    ws = wb.active
    ws.title = "Summary"
    ws.append(["metric", "value"])
    d = summary_to_dict(summary)
    for k, v in d.items():
        if isinstance(v, dict):
            continue
        if isinstance(v, list):
            v = "; ".join(str(x) for x in v)
        ws.append([k, v])

    ws2 = wb.create_sheet("Posts")
    ws2.append(
        [
            "published_at",
            "format",
            "topic",
            "views",
            "likes",
            "comments",
            "forwards",
            "promotional",
            "caption",
        ]
    )
    for p in posts:
        ws2.append(
            [
                p.published_at.isoformat(),
                p.format_type,
                p.topic_style,
                p.views,
                p.likes,
                p.comments,
                p.forwards,
                p.is_promotional,
                p.caption[:500],
            ]
        )
    wb.save(path)
    return path


def export_csv(summary: ReportSummary, posts: list[PostForStats], path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["section", "key", "value"])
        for k, v in summary_to_dict(summary).items():
            if not isinstance(v, dict):
                w.writerow(["summary", k, v])
        w.writerow([])
        w.writerow(
            [
                "published_at",
                "format",
                "topic",
                "views",
                "likes",
                "promotional",
                "caption",
            ]
        )
        for p in posts:
            w.writerow(
                [
                    p.published_at.isoformat(),
                    p.format_type,
                    p.topic_style,
                    p.views,
                    p.likes,
                    p.is_promotional,
                    p.caption.replace("\n", " ")[:300],
                ]
            )
    return path


def export_txt(summary: ReportSummary, posts: list[PostForStats], path: Path) -> Path:
    from pagezy_bot.analysis.stats import format_report_fa

    path.parent.mkdir(parents=True, exist_ok=True)
    body = format_report_fa(summary, "export") + "\n\n--- پست‌ها ---\n"
    for p in posts:
        body += f"- {p.published_at.date()} | {p.format_type} | {p.topic_style} | views={p.views}\n"
    path.write_text(body, encoding="utf-8")
    return path


def export_pdf(summary: ReportSummary, posts: list[PostForStats], path: Path) -> Path:
    settings = get_settings()
    font_path = settings.resolved_font_path()
    path.parent.mkdir(parents=True, exist_ok=True)

    font_name = "Vazirmatn"
    pdfmetrics.registerFont(TTFont(font_name, str(font_path)))

    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    y = height - 50
    line_height = 16

    def draw_line(text: str) -> None:
        nonlocal y
        if y < 60:
            c.showPage()
            y = height - 50
            c.setFont(font_name, 11)
        shaped = _reshape_persian(text)
        # RTL: right-align
        c.setFont(font_name, 11)
        c.drawRightString(width - 40, y, shaped[:120])
        y -= line_height

    c.setFont(font_name, 14)
    draw_line("گزارش Pagezy")
    c.setFont(font_name, 11)
    draw_line(f"تعداد پست: {summary.total_posts}")
    draw_line(f"میانگین روزانه: {summary.avg_per_day:.2f}")
    for line in summary.format_topic_lines[:10]:
        draw_line(line)
    draw_line(f"تبلیغی: {summary.promo_count} — عادی: {summary.regular_count}")
    for p in posts[:25]:
        draw_line(
            f"{p.published_at.date()} | {p.format_type} | {p.topic_style} | {p.views or 0}"
        )

    c.save()
    return path


def export_bytes(
    fmt: str,
    summary: ReportSummary,
    posts: list[PostForStats],
) -> tuple[bytes, str, str]:
    """Return (bytes, filename, mime)."""
    import tempfile

    suffix = {"xlsx": ".xlsx", "csv": ".csv", "pdf": ".pdf", "txt": ".txt"}[fmt]
    with tempfile.TemporaryDirectory() as td:
        path = Path(td) / f"report{suffix}"
        if fmt == "xlsx":
            export_xlsx(summary, posts, path)
            mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif fmt == "csv":
            export_csv(summary, posts, path)
            mime = "text/csv"
        elif fmt == "pdf":
            export_pdf(summary, posts, path)
            mime = "application/pdf"
        else:
            export_txt(summary, posts, path)
            mime = "text/plain; charset=utf-8"
        data = path.read_bytes()
    return data, f"pagezy-report{suffix}", mime