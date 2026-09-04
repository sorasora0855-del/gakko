import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../db/client.js";
import { requireAuth, type AuthenticatedUser } from "./auth.js";

export interface AdminUser extends AuthenticatedUser {
  adminRole: "admin" | "sub_admin";
}

/**
 * admin ロールのみ許可するプリハンドラー（計画書セクション4）。
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<AdminUser | undefined> {
  const user = await requireAuth(request, reply);
  if (!user) return undefined;

  const role = await prisma.adminRole.findUnique({ where: { userId: user.id } });
  if (!role || role.revokedAt || role.role !== "admin") {
    reply.code(403).send({ error: "admin_required" });
    return undefined;
  }

  return { ...user, adminRole: "admin" };
}

/**
 * admin または sub_admin のどちらかを許可するプリハンドラー（計画書セクション5）。
 * 実際にどちらの権限かは呼び出し側で adminRole を見て判断する。
 */
export async function requireAdminOrSubAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<AdminUser | undefined> {
  const user = await requireAuth(request, reply);
  if (!user) return undefined;

  const role = await prisma.adminRole.findUnique({ where: { userId: user.id } });
  if (!role || role.revokedAt || (role.role !== "admin" && role.role !== "sub_admin")) {
    reply.code(403).send({ error: "admin_or_sub_admin_required" });
    return undefined;
  }

  return { ...user, adminRole: role.role as "admin" | "sub_admin" };
}

/**
 * 管理操作ログを記録する（計画書セクション40: 誰が・いつ・何を・なぜ）。
 */
export async function logAdminAction(params: {
  adminId: string;
  actionType: string;
  targetType: string;
  targetId: string;
  reason?: string;
}): Promise<void> {
  await prisma.adminAction.create({
    data: {
      adminId: params.adminId,
      actionType: params.actionType,
      targetType: params.targetType,
      targetId: params.targetId,
      reason: params.reason,
    },
  });
}
