"""YouTube Data API v3 collector."""

from __future__ import annotations

import logging
import re
from datetime import datetime

from googleapiclient.discovery import build

from pagezy_bot.collectors.base import CollectedPost
from pagezy_bot.config import get_settings

logger = logging.getLogger(__name__)

YT_CHANNEL_PATTERNS = [
    re.compile(r"youtube\.com/channel/([A-Za-z0-9_-]+)"),
    re.compile(r"youtube\.com/@([\w.-]+)"),
    re.compile(r"youtube\.com/c/([\w.-]+)"),
]


class YouTubeCollector:
    def _client(self):
        settings = get_settings()
        if not settings.youtube_api_key:
            raise RuntimeError("YOUTUBE_API_KEY تنظیم نشده است.")
        return build("youtube", "v3", developerKey=settings.youtube_api_key, cache_discovery=False)

    def resolve_channel_id(self, link_or_id: str) -> str:
        if link_or_id.startswith("UC") and len(link_or_id) >= 20:
            return link_or_id
        for pat in YT_CHANNEL_PATTERNS:
            m = pat.search(link_or_id)
            if m:
                handle = m.group(1)
                if handle.startswith("UC"):
                    return handle
                yt = self._client()
                resp = (
                    yt.channels()
                    .list(part="id", forHandle=handle if link_or_id.find("@") >= 0 else None, forUsername=None)
                )
                # forHandle only when @ form
                if "@" in link_or_id or "/@" in link_or_id:
                    resp = yt.channels().list(part="id", forHandle=handle)
                    data = resp.execute()
                    if data.get("items"):
                        return data["items"][0]["id"]
                search = (
                    yt.search()
                    .list(part="snippet", q=handle, type="channel", maxResults=1)
                    .execute()
                )
                if search.get("items"):
                    return search["items"][0]["snippet"]["channelId"]
        raise ValueError("شناسه یا لینک کانال یوتیوب نامعتبر است.")

    async def fetch_channel_videos(self, link_or_id: str, limit: int = 50) -> list[CollectedPost]:
        channel_id = self.resolve_channel_id(link_or_id)
        yt = self._client()

        uploads_playlist = None
        ch = yt.channels().list(part="contentDetails,snippet", id=channel_id).execute()
        if not ch.get("items"):
            raise RuntimeError("کانال یوتیوب پیدا نشد.")
        uploads_playlist = ch["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]

        video_ids: list[str] = []
        next_token = None
        while len(video_ids) < limit:
            pl = (
                yt.playlistItems()
                .list(
                    part="contentDetails",
                    playlistId=uploads_playlist,
                    maxResults=min(50, limit - len(video_ids)),
                    pageToken=next_token,
                )
                .execute()
            )
            for item in pl.get("items", []):
                video_ids.append(item["contentDetails"]["videoId"])
            next_token = pl.get("nextPageToken")
            if not next_token:
                break

        if not video_ids:
            return []

        posts: list[CollectedPost] = []
        for i in range(0, len(video_ids), 50):
            batch = video_ids[i : i + 50]
            detail = (
                yt.videos()
                .list(part="snippet,statistics,contentDetails", id=",".join(batch))
                .execute()
            )
            for item in detail.get("items", []):
                duration = item["contentDetails"].get("duration", "")
                seconds = _parse_iso8601_duration(duration)
                is_short = seconds <= 60 or "shorts" in item["snippet"].get("title", "").lower()
                fmt = "short" if is_short else "long_video"
                stats = item.get("statistics", {})
                published = datetime.fromisoformat(
                    item["snippet"]["publishedAt"].replace("Z", "+00:00")
                ).replace(tzinfo=None)
                vid = item["id"]
                posts.append(
                    CollectedPost(
                        external_id=vid,
                        published_at=published,
                        format_type=fmt,
                        caption=item["snippet"].get("title", "") + "\n" + item["snippet"].get("description", "")[:500],
                        url=f"https://www.youtube.com/watch?v={vid}",
                        views=int(stats.get("viewCount", 0)) if stats.get("viewCount") else None,
                        likes=int(stats.get("likeCount", 0)) if stats.get("likeCount") else None,
                        comments=int(stats.get("commentCount", 0)) if stats.get("commentCount") else None,
                        raw_meta={"duration_seconds": seconds},
                    )
                )
        return posts


def _parse_iso8601_duration(duration: str) -> int:
    import re

    if not duration:
        return 0
    m = re.match(
        r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?",
        duration,
    )
    if not m:
        return 0
    h, mi, s = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mi * 60 + s