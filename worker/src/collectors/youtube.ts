import type { CollectedPost } from "../types";
import type { Env } from "../env";
import { mockYoutube } from "./mock";
import { isMock } from "../env";

export async function collectYoutube(env: Env, linkOrId: string): Promise<CollectedPost[]> {
  if (isMock(env)) return mockYoutube();
  if (!env.YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY تنظیم نشده.");

  const channelId = await resolveChannelId(env.YOUTUBE_API_KEY, linkOrId);
  const uploads = await ytGet(
    env.YOUTUBE_API_KEY,
    `channels?part=contentDetails&id=${channelId}`,
  );
  const playlistId = uploads.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlistId) return [];

  const pl = await ytGet(
    env.YOUTUBE_API_KEY,
    `playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=50`,
  );
  const ids = (pl.items ?? []).map((i: { contentDetails: { videoId: string } }) => i.contentDetails.videoId);
  if (!ids.length) return [];

  const detail = await ytGet(
    env.YOUTUBE_API_KEY,
    `videos?part=snippet,statistics,contentDetails&id=${ids.join(",")}`,
  );

  return (detail.items ?? []).map((item: YoutubeVideoItem) => {
    const sec = parseDuration(item.contentDetails.duration);
    const isShort = sec <= 60;
    const stats = item.statistics ?? {};
    return {
      externalId: item.id,
      publishedAt: item.snippet.publishedAt,
      formatType: isShort ? "short" : "long_video",
      caption: `${item.snippet.title}\n${(item.snippet.description ?? "").slice(0, 400)}`,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      views: stats.viewCount ? Number(stats.viewCount) : null,
      likes: stats.likeCount ? Number(stats.likeCount) : null,
      comments: stats.commentCount ? Number(stats.commentCount) : null,
      raw: { duration_seconds: sec },
    };
  });
}

interface YoutubeVideoItem {
  id: string;
  snippet: { title: string; description?: string; publishedAt: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails: { duration: string };
}

async function ytGet(key: string, path: string) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}&key=${key}`);
  if (!res.ok) throw new Error(`YouTube API: ${await res.text()}`);
  return res.json() as Promise<{ items?: unknown[] }>;
}

async function resolveChannelId(key: string, value: string): Promise<string> {
  if (value.startsWith("UC") && value.length > 20) return value;
  const handle = value.match(/@([\w.-]+)/)?.[1];
  if (handle) {
    const data = (await ytGet(key, `channels?part=id&forHandle=${handle}`)) as { items?: { id: string }[] };
    if (data.items?.[0]?.id) return data.items[0].id;
  }
  const q = value.split("/").pop() ?? value;
  const search = (await ytGet(key, `search?part=snippet&type=channel&q=${encodeURIComponent(q)}&maxResults=1`)) as {
    items?: { snippet: { channelId: string } }[];
  };
  const id = search.items?.[0]?.snippet?.channelId;
  if (!id) throw new Error("کانال یوتیوب پیدا نشد.");
  return id;
}

function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}