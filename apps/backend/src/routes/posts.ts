import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import {
  createPostSchema,
  updatePostSchema,
  listPostsQuerySchema,
  createReportSchema,
} from "../schemas/posts.js";

const POST_RETENTION_DAYS = 60;

export async function postsRoutes(app: FastifyInstance) {
  app.post("/posts", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;

    const parsed = createPostSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }
    const input = parsed.data;

    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category || !category.isActive) {
      return reply.code(400).send({ error: "invalid_category" });
    }

    const post = await prisma.post.create({
      data: {
        authorId: user.id,
        title: input.title,
        body: input.body,
        categoryId: category.id,
        deadline: input.deadline ? new Date(input.deadline) : null,
        authorGradeId: user.gradeId,
        authorClassId: user.classId,
        authorGradeName: user.gradeName,
        authorClassName: user.className,
      },
    });

    return reply.code(201).send(post);
  });

  app.get("/posts", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;

    const parsed = listPostsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }
    const { categoryId, cursor, limit } = parsed.data;

    const retentionCutoff = new Date(Date.now() - POST_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const posts = await prisma.post.findMany({
      where: {
        authorGradeId: user.gradeId,
        authorClassId: user.classId,
        deletedAt: null,
        createdAt: { gte: retentionCutoff },
        ...(categoryId ? { categoryId } : {}),
      },
      include: {
        author: { select: { id: true, displayName: true } },
        category: true,
        attachments: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;

    const now = new Date();
    const withExpiry = items.map((p) => ({
      ...p,
      isExpired: p.deadline ? p.deadline.getTime() < now.getTime() : false,
    }));

    return reply.send({
      items: withExpiry,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    });
  });

  app.get("/posts/:id", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, displayName: true } },
        category: true,
        attachments: true,
      },
    });

    if (!post || post.deletedAt) {
      return reply.code(404).send({ error: "post_not_found" });
    }
    if (post.authorGradeId !== user.gradeId || post.authorClassId !== user.classId) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const isExpired = post.deadline ? post.deadline.getTime() < Date.now() : false;

    return reply.send({ ...post, isExpired });
  });

  app.patch("/posts/:id", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const parsed = updatePostSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post || post.deletedAt) {
      return reply.code(404).send({ error: "post_not_found" });
    }
    if (post.authorId !== user.id) {
      return reply.code(403).send({ error: "forbidden" });
    }

    if (parsed.data.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
      if (!category || !category.isActive) {
        return reply.code(400).send({ error: "invalid_category" });
      }
    }

    const updated = await prisma.post.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
        ...(parsed.data.categoryId !== undefined ? { categoryId: parsed.data.categoryId } : {}),
        ...(parsed.data.deadline !== undefined
          ? { deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null }
          : {}),
      },
    });

    return reply.send(updated);
  });

  app.delete("/posts/:id", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post || post.deletedAt) {
      return reply.code(404).send({ error: "post_not_found" });
    }
    if (post.authorId !== user.id) {
      return reply.code(403).send({ error: "forbidden" });
    }

    await prisma.post.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: user.id },
    });

    return reply.send({ ok: true });
  });

  app.post("/posts/:id/reports", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const parsed = createReportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post || post.deletedAt) {
      return reply.code(404).send({ error: "post_not_found" });
    }

    const report = await prisma.report.create({
      data: {
        postId: id,
        reporterId: user.id,
        reason: parsed.data.reason,
        detail: parsed.data.detail,
      },
    });

    return reply.code(201).send(report);
  });

  app.get("/categories", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return reply.send(categories);
  });
}
