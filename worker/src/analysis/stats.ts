import type { CollectedPost } from "../types";

export interface PostForStats {
  publishedAt: string;
  formatType: string;
  topicStyle: string;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  forwards?: number | null;
  isPromotional: boolean;
  caption: string;
}

export interface ReportSummary {
  totalPosts: number;
  avgPerDay: number;
  avgPerMonth: number;
  formatTopicLines: string[];
  statsByFormat: Record<string, Record<string, number | null>>;
  promoCount: number;
  regularCount: number;
  promoAvgViews: number | null;
  regularAvgViews: number | null;
}

function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

export function buildReport(posts: PostForStats[]): ReportSummary {
  if (!posts.length) {
    return {
      totalPosts: 0,
      avgPerDay: 0,
      avgPerMonth: 0,
      formatTopicLines: [],
      statsByFormat: {},
      promoCount: 0,
      regularCount: 0,
      promoAvgViews: null,
      regularAvgViews: null,
    };
  }
  const sorted = [...posts].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const start = new Date(sorted[0].publishedAt).getTime();
  const end = new Date(sorted[sorted.length - 1].publishedAt).getTime();
  const spanDays = Math.max(Math.ceil((end - start) / 86400000) + 1, 1);
  const perDay = posts.length / spanDays;

  const ft: Record<string, number> = {};
  for (const p of posts) {
    const k = `${p.formatType} / ${p.topicStyle}`;
    ft[k] = (ft[k] ?? 0) + 1;
  }
  const formatTopicLines = Object.entries(ft)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, cnt]) => `~${((cnt / posts.length) * perDay).toFixed(1)} در روز: ${k}`);

  const statsByFormat: Record<string, Record<string, number | null>> = {};
  for (const p of posts) {
    if (!statsByFormat[p.formatType]) statsByFormat[p.formatType] = { count: 0, avgViews: null };
    statsByFormat[p.formatType].count = (statsByFormat[p.formatType].count ?? 0) + 1;
  }
  for (const fmt of Object.keys(statsByFormat)) {
    const views = posts.filter((p) => p.formatType === fmt && p.views != null).map((p) => p.views!);
    statsByFormat[fmt].avgViews = avg(views);
  }

  const promo = posts.filter((p) => p.isPromotional);
  const regular = posts.filter((p) => !p.isPromotional);

  return {
    totalPosts: posts.length,
    avgPerDay: perDay,
    avgPerMonth: perDay * 30,
    formatTopicLines,
    statsByFormat,
    promoCount: promo.length,
    regularCount: regular.length,
    promoAvgViews: avg(promo.filter((p) => p.views != null).map((p) => p.views!)),
    regularAvgViews: avg(regular.filter((p) => p.views != null).map((p) => p.views!)),
  };
}

export function formatReportFa(summary: ReportSummary, sourceLabel: string): string {
  const lines = [
    `📊 گزارش Pagezy — ${sourceLabel}`,
    "",
    `تعداد پست: ${summary.totalPosts}`,
    `میانگین روزانه: ${summary.avgPerDay.toFixed(2)}`,
    `میانگین ماهانه: ${summary.avgPerMonth.toFixed(1)}`,
    "",
    "🧩 ترکیب فرمت و موضوع:",
    ...summary.formatTopicLines.map((l) => `• ${l}`),
    "",
    "📈 میانگین بازدید بر اساس فرمت:",
  ];
  for (const [fmt, st] of Object.entries(summary.statsByFormat)) {
    lines.push(`• ${fmt}: ${st.avgViews != null ? Math.round(st.avgViews) : "—"}`);
  }
  lines.push(
    "",
    `🎯 تبلیغی: ${summary.promoCount} | عادی: ${summary.regularCount}`,
    `میانگین بازدید — تبلیغی: ${summary.promoAvgViews != null ? Math.round(summary.promoAvgViews) : "—"} | عادی: ${summary.regularAvgViews != null ? Math.round(summary.regularAvgViews) : "—"}`,
  );
  return lines.join("\n");
}

export function toStatsPosts(
  posts: CollectedPost[],
  topics: string[],
  promos: boolean[],
): PostForStats[] {
  return posts.map((p, i) => ({
    publishedAt: p.publishedAt,
    formatType: p.formatType,
    topicStyle: topics[i] ?? "نامشخص",
    views: p.views,
    likes: p.likes,
    comments: p.comments,
    forwards: p.forwards,
    isPromotional: promos[i] ?? false,
    caption: p.caption,
  }));
}