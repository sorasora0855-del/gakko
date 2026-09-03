import { PrismaClient } from "@prisma/client";

/**
 * Prismaクライアントのシングルトン初期化。
 * 開発時のホットリロードで複数のPrismaClientインスタンスが生成され、
 * DBコネクションが枯渴する問題を避けるため、globalに保持して使い回す。
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV === "development") {
  global.__prisma = prisma;
}
