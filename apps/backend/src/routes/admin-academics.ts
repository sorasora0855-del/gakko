import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { requireAdmin, logAdminAction } from "../middleware/admin.js";
import { gradeSchema, classSchema } from "../schemas/admin.js";

export async function adminAcademicsRoutes(app: FastifyInstance) {
  app.get("/admin/grades", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const grades = await prisma.grade.findMany({
      include: { classes: true },
      orderBy: { name: "asc" },
    });
    return reply.send(grades);
  });

  app.post("/admin/grades", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const parsed = gradeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }

    const grade = await prisma.grade.create({
      data: { name: parsed.data.name, isActive: parsed.data.isActive ?? true },
    });

    await logAdminAction({
      adminId: admin.id,
      actionType: "create_grade",
      targetType: "grade",
      targetId: grade.id,
    });

    return reply.code(201).send(grade);
  });

  app.patch("/admin/grades/:id", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const { id } = request.params as { id: string };
    const parsed = gradeSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }

    const grade = await prisma.grade.findUnique({ where: { id } });
    if (!grade) return reply.code(404).send({ error: "grade_not_found" });

    const updated = await prisma.grade.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    });

    await logAdminAction({
      adminId: admin.id,
      actionType: "update_grade",
      targetType: "grade",
      targetId: id,
    });

    return reply.send(updated);
  });

  app.post("/admin/classes", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const parsed = classSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }

    const grade = await prisma.grade.findUnique({ where: { id: parsed.data.gradeId } });
    if (!grade) return reply.code(400).send({ error: "invalid_grade" });

    const klass = await prisma.class.create({
      data: {
        gradeId: parsed.data.gradeId,
        name: parsed.data.name,
        isActive: parsed.data.isActive ?? true,
      },
    });

    await logAdminAction({
      adminId: admin.id,
      actionType: "create_class",
      targetType: "class",
      targetId: klass.id,
    });

    return reply.code(201).send(klass);
  });

  app.patch("/admin/classes/:id", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const { id } = request.params as { id: string };
    const parsed = classSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }

    const klass = await prisma.class.findUnique({ where: { id } });
    if (!klass) return reply.code(404).send({ error: "class_not_found" });

    const updated = await prisma.class.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        ...(parsed.data.gradeId !== undefined ? { gradeId: parsed.data.gradeId } : {}),
      },
    });

    await logAdminAction({
      adminId: admin.id,
      actionType: "update_class",
      targetType: "class",
      targetId: id,
    });

    return reply.send(updated);
  });
}
