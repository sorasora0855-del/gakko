import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { prisma } from "../db/client.js";
import { registerSchema, loginSchema } from "../schemas/auth.js";
import {
  createSession,
  getSession,
  destroySession,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "../lib/session.js";

/**
 * Argon2idのパラメータ。scripts/benchmark-argon2.tsで測定した値に合わせて調整する。
 * 現時点では公式推奨の初期値を使用する。
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export async function authRoutes(app: FastifyInstance) {
  /**
   * POST /auth/register
   * 計画書セクション6, 7準拠。
   * 学年+出席番号（isCurrent=trueの行）が既に登録されている場合は409を返す。
   * DB側の部分ユニークインデックス(user_affiliations_current_unique)が最終防波堤となる。
   */
  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }
    const input = parsed.data;

    const [grade, klass, currentYear] = await Promise.all([
      prisma.grade.findUnique({ where: { id: input.gradeId } }),
      prisma.class.findUnique({ where: { id: input.classId } }),
      prisma.academicYear.findFirst({ where: { isCurrent: true } }),
    ]);

    if (!grade || !grade.isActive) {
      return reply.code(400).send({ error: "invalid_grade" });
    }
    if (!klass || !klass.isActive || klass.gradeId !== grade.id) {
      return reply.code(400).send({ error: "invalid_class" });
    }
    if (!currentYear) {
      app.log.error("No current academic year is configured");
      return reply.code(500).send({ error: "server_misconfigured" });
    }

    const existing = await prisma.userAffiliation.findFirst({
      where: {
        academicYearId: currentYear.id,
        gradeId: grade.id,
        attendanceNumber: input.attendanceNumber,
        isCurrent: true,
      },
    });
    if (existing) {
      return reply.code(409).send({ error: "affiliation_already_registered" });
    }

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);

    try {
      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            passwordHash,
            displayName: input.displayName,
            realName: input.realName,
            furigana: input.furigana,
            isStudent: input.isStudent,
          },
        });
        await tx.userAffiliation.create({
          data: {
            userId: created.id,
            academicYearId: currentYear.id,
            gradeId: grade.id,
            classId: klass.id,
            attendanceNumber: input.attendanceNumber,
            isCurrent: true,
          },
        });
        return created;
      });

      return reply.code(201).send({
        id: user.id,
        displayName: user.displayName,
      });
    } catch (err: any) {
      // DB側の部分ユニークインデックス違反(P2002相当)を最終防波堤として捕捉する。
      if (err?.code === "P2002" || /unique/i.test(String(err?.message))) {
        return reply.code(409).send({ error: "affiliation_already_registered" });
      }
      app.log.error({ err }, "Failed to register user");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * POST /auth/login
   * 学年 + 出席番号 + パスワードでログインする（計画書セクション7準拠）。
   * 成功時はRedisにセッションを発行し、HttpOnly Cookieとして返す。
   */
  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }
    const input = parsed.data;

    const currentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    if (!currentYear) {
      app.log.error("No current academic year is configured");
      return reply.code(500).send({ error: "server_misconfigured" });
    }

    const affiliation = await prisma.userAffiliation.findFirst({
      where: {
        academicYearId: currentYear.id,
        gradeId: input.gradeId,
        attendanceNumber: input.attendanceNumber,
        isCurrent: true,
      },
      include: { user: true },
    });

    // ユーザーが見つからない場合とパスワード不一致の場合で応答を変えない（列挙攻撃対策）。
    const genericError = () => reply.code(401).send({ error: "invalid_credentials" });

    if (!affiliation || !affiliation.user) {
      return genericError();
    }
    if (affiliation.user.status !== "active") {
      return reply.code(403).send({ error: "account_not_active" });
    }

    const passwordOk = await argon2.verify(affiliation.user.passwordHash, input.password).catch(() => false);
    if (!passwordOk) {
      return genericError();
    }

    const sessionId = await createSession({
      userId: affiliation.user.id,
      isStudent: affiliation.user.isStudent,
    });

    reply.setCookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    return reply.send({
      id: affiliation.user.id,
      displayName: affiliation.user.displayName,
    });
  });

  /**
   * POST /auth/logout
   * セッションをRedisから破棄し、Cookieもクリアする。
   */
  app.post("/auth/logout", async (request, reply) => {
    const sessionId = request.cookies[SESSION_COOKIE_NAME];
    if (sessionId) {
      await destroySession(sessionId);
    }
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return reply.send({ ok: true });
  });

  /**
   * GET /me
   * ログイン中ユーザー自身のアカウント情報を返す（計画書: 一般ユーザーができること）。
   */
  app.get("/me", async (request, reply) => {
    const sessionId = request.cookies[SESSION_COOKIE_NAME];
    if (!sessionId) {
      return reply.code(401).send({ error: "not_authenticated" });
    }
    const session = await getSession(sessionId);
    if (!session) {
      return reply.code(401).send({ error: "not_authenticated" });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        affiliations: {
          where: { isCurrent: true },
          include: { grade: true, class: true, academicYear: true },
        },
      },
    });

    if (!user || user.status !== "active") {
      return reply.code(401).send({ error: "not_authenticated" });
    }

    const currentAffiliation = user.affiliations[0] ?? null;

    return reply.send({
      id: user.id,
      displayName: user.displayName,
      isStudent: user.isStudent,
      affiliation: currentAffiliation
        ? {
            grade: currentAffiliation.grade.name,
            class: currentAffiliation.class.name,
            attendanceNumber: currentAffiliation.attendanceNumber,
            academicYear: currentAffiliation.academicYear.year,
          }
        : null,
    });
  });
}
