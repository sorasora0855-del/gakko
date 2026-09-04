import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../db/client.js";
import { getSession, SESSION_COOKIE_NAME } from "../lib/session.js";

export interface AuthenticatedUser {
  id: string;
  displayName: string;
  isStudent: boolean;
  status: string;
  gradeId: string;
  classId: string;
  gradeName: string;
  className: string;
}

/**
 * リクエストに認証済みユーザー情報を付与するプリハンドラー。
 * 未認証なら0401を返してハンドラーの実行を止める。
 * ルート権限のサーバー側検証（計画書第43条10.）をここで一元的に行う。
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<AuthenticatedUser | undefined> {
  const sessionId = request.cookies[SESSION_COOKIE_NAME];
  if (!sessionId) {
    reply.code(401).send({ error: "not_authenticated" });
    return undefined;
  }
  const session = await getSession(sessionId);
  if (!session) {
    reply.code(401).send({ error: "not_authenticated" });
    return undefined;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      affiliations: {
        where: { isCurrent: true },
        include: { grade: true, class: true },
      },
    },
  });

  if (!user || user.status !== "active") {
    reply.code(401).send({ error: "not_authenticated" });
    return undefined;
  }

  const affiliation = user.affiliations[0];
  if (!affiliation) {
    reply.code(403).send({ error: "no_active_affiliation" });
    return undefined;
  }

  return {
    id: user.id,
    displayName: user.displayName,
    isStudent: user.isStudent,
    status: user.status,
    gradeId: affiliation.gradeId,
    classId: affiliation.classId,
    gradeName: affiliation.grade.name,
    className: affiliation.class.name,
  };
}
