import Redis from "ioredis";

/**
 * Redisクライアントの初期化。
 * セッション管理・レート制限の両方でこのインスタンスを共有する。
 * REDIS_URLが未設定の場合は起動時に気づけるよう即座にエラーにする。
 */
const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error("REDIS_URL is not set. Check your .env file.");
}

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    // 再接続間隔を徐々に伸ばす(最大5秒)。落ちても自動復旧を試みる。
    return Math.min(times * 200, 5000);
  },
});

redis.on("error", (err) => {
  console.error("[redis] connection error:", err.message);
});

redis.on("connect", () => {
  console.log("[redis] connected");
});
