import type { CollectedPost } from "../../types";
import type { Env } from "../../env";
import { isMock as mockFlag } from "../../env";
import { fetchInstagramViaZarino } from "./zarino";
import { mockInstagram } from "../mock";

/** Pluggable Instagram providers — Zarino primary. */
export async function collectInstagram(env: Env, identifier: string): Promise<CollectedPost[]> {
  if (mockFlag(env)) {
    return mockInstagram(identifier.replace(/^@/, "").split("/").pop() ?? "demo");
  }
  if (env.ZARINO_API_KEY) {
    try {
      return await fetchInstagramViaZarino(env, identifier);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `اینستاگرام (Zarino): ${msg}. در صورت نیاز ZARINO_API_BASE_URL و مستندات endpoint را از تیم Zarino بگیرید.`,
      );
    }
  }
  throw new Error(
    "کلید Zarino تنظیم نشده (ZARINO_API_KEY). اینستاگرام بدون Zarino در Worker در دسترس نیست.",
  );
}