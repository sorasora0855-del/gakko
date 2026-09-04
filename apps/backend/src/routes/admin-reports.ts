import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { requireAdminOrSubAdmin, logAdminAction } from "../middleware/admin.js";
import { resolveReportSchema } from "../schemas/admin.js";

export async function adminReportsRoutes(app: FastifyInstance) {
  app.get("/admin/reports", async (request, reply) => {
    const admin = await requireAdminOrSubAdmin(request, reply);
    if (!admin) return;

    const { status } = request.query as { status?: string };

    const reports = await prisma.report.findMany({
      where: status ? { status } : { status: "pending" },
      include: {
        post: {
          include: { author: { select: { id: true, displayName: true } }, category: true },
        },
        reporter: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send(reports);
  });

  app.patch("/admin/reports/:id", async (request, reply) => {
    const admin = await requireAdminOrSubAdmin(request, reply);
    if (!admin) return;

    const { id } = request.params as { id: string };
    const parsed = resolveReportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) return reply.code(404).send({ error: "report_not_found" });

    const newStatus = parsed.data.action === "dismiss" ? "dismissed" : "resolved";

    await prisma.report.update({
      where: { id },
      data: { status: newStatus, resolvedAt: new Date(), resolvedBy: admin.id },
    });

    if (parsed.data.action === "delete_post") {
      await prisma.post.update({
        where: { id: report.postId },
        data: { deletedAt: new Date(), deletedBy: admin.id },
      });
    }

    await logAdminAction({
      adminId: admin.id,
      actionType: `report_${parsed.data.action}`,
      targetType: "report",
      targetId: id,
      reason: parsed.data.reason,
    });

    return reply.send({ ok: true });
  });

  app.delete("/admin/posts/:id", async (request, reply) => {
    const admin = await requireAdminOrSubAdmin(request, reply);
    if (!admin) return;

    const { id } = request.params as { id: string };
    const { reason } = (request.query as { reason?: string }) ?? {};

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post || post.deletedAt) return reply.code(404).send({ error: "post_not_found" });

    await prisma.post.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: admin.id },
    });

    await logAdminAction({
      adminId: admin.id,
      actionType: "admin_delete_post",
      targetType: "post",
      targetId: id,
      reason,
    });

    return reply.send({ ok: true });
  });

  app.get("/admin/actions", async (request, reply) => {
    const admin = await requireAdminOrSubAdmin(request, reply);
    if (!admin) return;
    if (admin.adminRole !== "admin") {
      return reply.code(403).send({ error: "admin_required" });
    }

    const actions = await prisma.adminAction.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return reply.send(actions);
  });
}
