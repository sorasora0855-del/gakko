import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * 初期管理者の登録スクリプト（計画書セクション4: 初期管理者は開発者本人）。
 * 環境変数 INITIAL_ADMIN_USER_ID で指定したユーザーIDを admin にする。
 *
 * 使い方:
 *   INITIAL_ADMIN_USER_ID=<user-id> npx tsx prisma/seed-admin.ts
 */
async function main() {
  const userId = process.env.INITIAL_ADMIN_USER_ID;
  if (!userId) {
    console.error("INITIAL_ADMIN_USER_ID environment variable is required.");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error(`User not found: ${userId}`);
    process.exit(1);
  }

  const existing = await prisma.adminRole.findUnique({ where: { userId } });
  if (existing && !existing.revokedAt) {
    console.log(`User ${userId} already has role: ${existing.role}`);
    return;
  }

  const role = existing
    ? await prisma.adminRole.update({
        where: { userId },
        data: { role: "admin", revokedAt: null, grantedBy: null },
      })
    : await prisma.adminRole.create({
        data: { userId, role: "admin", grantedBy: null },
      });

  console.log(`Granted admin role to user ${userId} (${user.displayName}).`);
  console.log(role);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
