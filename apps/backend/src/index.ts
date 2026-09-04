import Fastify from "fastify";
import "dotenv/config";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { prisma } from "./db/client.js";
import { redis } from "./cache/redis.js";
import { authRoutes } from "./routes/auth.js";
import { postsRoutes } from "./routes/posts.js";
import { attachmentsRoutes } from "./routes/attachments.js";

const app = Fastify({
  logger: true,
});

await app.register(cookie, {
  secret: process.env.COOKIE_SECRET,
});

await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

await app.register(authRoutes);
await app.register(postsRoutes);
await app.register(attachmentsRoutes);

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
