import type { UserSession } from "./types";
import type { Env } from "./env";

export async function loadSession(env: Env, userId: string): Promise<UserSession> {
  const row = await env.DB.prepare("SELECT state_json FROM user_states WHERE user_id = ?")
    .bind(userId)
    .first<{ state_json: string }>();
  if (!row?.state_json) return { slots: {} };
  try {
    return JSON.parse(row.state_json) as UserSession;
  } catch {
    return { slots: {} };
  }
}

export async function saveSession(env: Env, userId: string, session: UserSession): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO user_states (user_id, state_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
  )
    .bind(userId, JSON.stringify(session), new Date().toISOString())
    .run();
}