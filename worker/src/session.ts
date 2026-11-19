import type { UserSession } from "./types";
import type { Env } from "./env";
import { isMock } from "./env";
import { loadSessionFromStore, saveSessionToStore } from "./storage/storeClient";

const mem = new Map<string, UserSession>();

/** Session + report context: DO SQLite in prod; in-memory when MOCK without DO. */
export async function loadSession(env: Env, userId: string): Promise<UserSession> {
  if (isMock(env) && !env.PAGEZY_STORE) {
    return mem.get(userId) ?? { slots: {} };
  }
  return loadSessionFromStore(env, userId);
}

export async function saveSession(env: Env, userId: string, session: UserSession): Promise<void> {
  if (isMock(env) && !env.PAGEZY_STORE) {
    mem.set(userId, session);
    return;
  }
  await saveSessionToStore(env, userId, session);
}