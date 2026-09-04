import Fastify from "fastify";
import "dotenv/config";
import cookie from "@fastify/cookie";
import { prisma } from "./db/client.js";
import { redis } from "./cache/redis.js";
import { authRoutes } from "./routes/auth.js";

const app = Fastify({
  logger: true,
});

await app.register(cookie, {
  secret: process.env.COOKIE_SECRET, // 署名付きCookieは未使用のため任意。今後CSRF対策で利用する可能性あり。
});

await app.register(authRoutes);

/**
 * ヘ ル ス チ ェ ッ ク
 * DB・ Redisへ の 接 続 を 実 際 に 確 認 し 、 両 方 生 き て い る 場 合 の み 200を 返
す 。
 * ど ち ら か が 落 ち て い る 場 合 は 503を 返 し 、 監 視 ・ デ プ ロ イ パ イ プ ラ イ ンで 検 知 で き る よ う に す る 。
 */
app.get("/health", async (_request, reply) => {
  const status: { db: boolean; redis: boolean } = { db: false, redis: false };
  try {
    await prisma.$queryRaw`SELECT 1`;
    status.db = true;
  } catch (err) {
    app.log.error({ err }, "DB health check failed");
  }
  try {
    const pong = await redis.ping();
    status.redis = pong === "PONG";
  } catch (err) {
    app.log.error({ err }, "Redis health check failed");
  }
  const healthy = status.db && status.redis;
  reply.code(healthy ? 200 : 503).send({
    status: healthy ? "ok" : "degraded",
    checks: status,
    timestamp: new Date().toISOString(),
  });
});

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? "0.0.0.0";

async function main() {
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`SchoolLink backend listening on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  app.log.info(`Received ${signal}, shutting down gracefully`);
  await app.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main();
