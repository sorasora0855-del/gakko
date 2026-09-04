import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { requireAdmin, logAdminAction } from "../middleware/admin.js";
import { updateAffiliationSchema, updateUserStatusSchema, subAdminSchema } from "../schemas/admin.js";

export async function adminUsersRoutes(app: FastifyInstance) {
  app.get("/admin/users", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const users = await prisma.user.findMany({
      include: {
        affiliations: {
          where: { isCurrent: true },
          include: { grade: true, class: true },
        },
        adminRole: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send(
      users.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        realName: u.realName,
        furigana: u.furigana,
        isStudent: u.isStudent,
        status: u.status,
        createdAt: u.createdAt,
        adminRole: u.adminRole && !u.adminRole.revokedAt ? u.adminRole.role : null,
        affiliation: u.affiliations[0]
          ? {
              gradeId: u.affiliations[0].gradeId,
              classId: u.affiliations[0].classId,
              gradeName: u.affiliations[0].grade.name,
              className: u.affiliations[0].class.name,
              attendanceNumber: u.affiliations[0].attendanceNumber,
            }
          : null,
      }))
    );
  });

  app.patch("/admin/users/:id/affiliation", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const { id: userId } = request.params as { id: string };
    const parsed = updateAffiliationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }
    const input = parsed.data;

    const [targetUser, grade, klass, currentYear] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.grade.findUnique({ where: { id: input.gradeId } }),
      prisma.class.findUnique({ where: { id: input.classId } }),
      prisma.academicYear.findFirst({ where: { isCurrent: true } }),
    ]);

    if (!targetUser) return reply.code(404).send({ error: "user_not_found" });
    if (!grade || !grade.isActive) return reply.code(400).send({ error: "invalid_grade" });
    if (!klass || !klass.isActive || klass.gradeId !== grade.id) {
      return reply.code(400).send({ error: "invalid_class" });
    }
    if (!currentYear) return reply.code(500).send({ error: "server_misconfigured" });

    const conflict = await prisma.userAffiliation.findFirst({
      where: {
        academicYearId: currentYear.id,
        gradeId: grade.id,
        attendanceNumber: input.attendanceNumber,
        isCurrent: true,
        userId: { not: userId },
      },
    });
    if (conflict) {
      return reply.code(409).send({ error: "affiliation_already_registered" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.userAffiliation.updateMany({
        where: { userId, isCurrent: true },
        data: { isCurrent: false, validTo: new Date() },
      });
      await tx.userAffiliation.create({
        data: {
          userId,
          academicYearId: currentYear.id,
          gradeId: grade.id,
          classId: klass.id,
          attendanceNumber: input.attendanceNumber,
          isCurrent: true,
        },
      });
    });

    await logAdminAction({
      adminId: admin.id,
      actionType: "update_affiliation",
      targetType: "user",
      targetId: userId,
      reason: `Moved to ${grade.name} ${klass.name} #${input.attendanceNumber}`,
    });

    return reply.send({ ok: true });
  });

  app.patch("/admin/users/:id/status", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const { id: userId } = request.params as { id: string };
    const parsed = updateUserStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) return reply.code(404).send({ error: "user_not_found" });

    await prisma.user.update({
      where: { id: userId },
      data: { status: parsed.data.status },
    });

    await logAdminAction({
      adminId: admin.id,
      actionType: `set_status_${parsed.data.status}`,
      targetType: "user",
      targetId: userId,
      reason: parsed.data.reason,
    });

    return reply.send({ ok: true });
  });

  app.post("/admin/sub-admins", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const parsed = subAdminSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
    if (!targetUser) return reply.code(404).send({ error: "user_not_found" });

    const existingRole = await prisma.adminRole.findUnique({ where: { userId: parsed.data.userId } });
    if (existingRole && !existingRole.revokedAt) {
      return reply.code(409).send({ error: "role_already_assigned" });
    }

    const role = existingRole
      ? await prisma.adminRole.update({
          where: { userId: parsed.data.userId },
          data: { role: "sub_admin", revokedAt: null, grantedBy: admin.id },
        })
      : await prisma.adminRole.create({
          data: { userId: parsed.data.userId, role: "sub_admin", grantedBy: admin.id },
        });

    await logAdminAction({
      adminId: admin.id,
      actionType: "grant_sub_admin",
      targetType: "user",
      targetId: parsed.data.userId,
    });

    return reply.code(201).send(role);
  });

  app.delete("/admin/sub-admins/:userId", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const { userId } = request.params as { userId: string };
    const role = await prisma.adminRole.findUnique({ where: { userId } });
    if (!role || role.role !== "sub_admin" || role.revokedAt) {
      return reply.code(404).send({ error: "sub_admin_not_found" });
    }

    await prisma.adminRole.update({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    await logAdminAction({
      adminId: admin.id,
      actionType: "revoke_sub_admin",
      targetType: "user",
      targetId: userId,
    });

    return reply.send({ ok: true });
  });
}
