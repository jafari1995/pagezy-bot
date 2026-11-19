import { detectPromotional } from "./analysis/promo";
import { buildExport } from "./export";
import type { Env } from "./env";
import { assertFreeModel, FREE_MODELS } from "./env";
import { runReport } from "./pipeline";

export async function runMockE2E(env: Env) {
  for (const m of FREE_MODELS) assertFreeModel(m);
  try {
    assertFreeModel("gpt-4o");
    throw new Error("paid model should fail");
  } catch {
    /* ok */
  }
  const report = await runReport(env, "telegram", "@pagezy_demo", { kind: "last_week" });
  const xlsx = await buildExport("xlsx", report);
  const pdf = await buildExport("pdf", report);
  const promo = detectPromotional("تخفیف PAGEZY30 چراغ");
  return {
    ok: true,
    postCount: report.posts.length,
    summaryLines: report.summaryText.split("\n").length,
    exports: { xlsx: xlsx.bytes.byteLength, pdf: pdf.bytes.byteLength },
    promoDetected: promo.isPromo,
  };
}