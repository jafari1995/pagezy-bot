import { detectPromotional } from "./analysis/promo";
import { buildReport, formatReportFa, toStatsPosts } from "./analysis/stats";
import { collectPosts } from "./collectors";
import type { Env } from "./env";
import { OpenRouterClient } from "./llm/openrouter";
import type { CollectedPost, Platform, ReportPayload, TimeRange } from "./types";

export async function runReport(
  env: Env,
  platform: Platform,
  identifier: string,
  range: TimeRange,
): Promise<ReportPayload> {
  const posts = await collectPosts(env, platform, identifier, range);
  const llm = new OpenRouterClient(env);
  const promos = posts.map((p) => detectPromotional(p.caption).isPromo);
  const topics = await llm.classifyBatch(posts.map((p) => p.caption.slice(0, 800)));
  const statsPosts = toStatsPosts(posts, topics, promos);
  const summary = buildReport(statsPosts);
  const sourceLabel = `${platform} / ${identifier}`;
  return {
    summaryText: formatReportFa(summary, sourceLabel),
    summary: { ...summary, statsByFormat: summary.statsByFormat },
    posts,
    sourceLabel,
  };
}

export async function answerOnReport(env: Env, question: string, report: ReportPayload): Promise<string> {
  const llm = new OpenRouterClient(env);
  return llm.chat(
    `داده گزارش:\n${JSON.stringify(report.summary)}\n\nسوال: ${question}`,
    600,
  );
}