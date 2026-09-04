import { randomBytes } from "node:crypto";
import { redis } from "../cache/redis.js";

const SESSION_PREFIX = "session:";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14日間

export interface SessionData {
  userId: string;
  isStudent: boolean;
  createdAt: string;
}

/**
 * 新しいセッションを発行し、Redisへ保存する。
 * セッションIDは推測不可能なランダム値とし、Cookieの値として使う。
 */
export async function createSession(data: Omit<SessionData, "createdAt">): Promise<string> {
  const sessionId = randomBytes(32).toString("hex");
  const payload: SessionData = { ...data, createdAt: new Date().toISOString() };
  await redis.set(SESSION_PREFIX + sessionId, JSON.stringify(payload), "EX", SESSION_TTL_SECONDS);
  return sessionId;
}

/**
 * セッションIDからセッション情報を取得する。存在しない/期限切れならnull。
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  const raw = await redis.get(SESSION_PREFIX + sessionId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

/**
 * ログアウト時にセッションを破棄する。
 */
export async function destroySession(sessionId: string): Promise<void> {
  await redis.del(SESSION_PREFIX + sessionId);
}

/**
 * アクティビティに応じてセッションの有効期限を延長する（任意で使用）。
 */
export async function touchSession(sessionId: string): Promise<void> {
  await redis.expire(SESSION_PREFIX + sessionId, SESSION_TTL_SECONDS);
}

export const SESSION_COOKIE_NAME = "sl_session";
export { SESSION_TTL_SECONDS };
