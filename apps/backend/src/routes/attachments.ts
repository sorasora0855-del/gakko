import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), "uploads");

function detectRealMimeType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  const sig = buffer.subarray(0, 4);
  if (sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff) return "image/jpeg";
  if (sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47) return "image/png";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  if (buffer.subarray(0, 4).toString("ascii") === "%PDF") return "application/pdf";
  return null;
}

export async function attachmentsRoutes(app: FastifyInstance) {
  app.post("/posts/:id/attachments", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;

    const { id: postId } = request.params as { id: string };
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      return reply.code(404).send({ error: "post_not_found" });
    }
    if (post.authorId !== user.id) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const data = await (request as any).file();
    if (!data) {
      return reply.code(400).send({ error: "file_required" });
    }

    if (!ALLOWED_MIME_TYPES.has(data.mimetype)) {
      return reply.code(400).send({ error: "unsupported_file_type" });
    }

    const buffer = await data.toBuffer();
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return reply.code(400).send({ error: "file_too_large" });
    }

    const realMimeType = detectRealMimeType(buffer);
    if (!realMimeType || !ALLOWED_MIME_TYPES.has(realMimeType)) {
      return reply.code(400).send({ error: "file_content_mismatch" });
    }

    const extension = path.extname(data.filename) || "";
    const storedFileName = `${randomUUID()}${extension}`;
    const postUploadDir = path.join(UPLOAD_DIR, postId);
    await mkdir(postUploadDir, { recursive: true });
    const storagePath = path.join(postUploadDir, storedFileName);
    await writeFile(storagePath, buffer);

    const attachment = await prisma.attachment.create({
      data: {
        postId,
        fileName: data.filename,
        mimeType: realMimeType,
        sizeBytes: buffer.length,
        storagePath,
      },
    });

    return reply.code(201).send(attachment);
  });

  app.delete("/attachments/:id", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: { post: true },
    });
    if (!attachment) {
      return reply.code(404).send({ error: "attachment_not_found" });
    }
    if (attachment.post.authorId !== user.id) {
      return reply.code(403).send({ error: "forbidden" });
    }

    await prisma.attachment.delete({ where: { id } });
    await unlink(attachment.storagePath).catch(() => {
      app.log.warn(`Failed to delete file on disk: ${attachment.storagePath}`);
    });

    return reply.send({ ok: true });
  });
}
