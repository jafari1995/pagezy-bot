from datetime import datetime
from pathlib import Path

from pagezy_bot.analysis.stats import PostForStats, build_report
from pagezy_bot.export.exporters import export_csv, export_pdf, export_xlsx


def test_exports_create_files(tmp_path: Path):
    posts = [
        PostForStats(datetime(2025, 1, 1), "reel", "آموزشی", 1000, 50, 3, None, False, "کپشن"),
    ]
    summary = build_report(posts)
    assert export_xlsx(summary, posts, tmp_path / "r.xlsx").exists()
    assert export_csv(summary, posts, tmp_path / "r.csv").exists()
    assert export_pdf(summary, posts, tmp_path / "r.pdf").exists()