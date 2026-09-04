import { z } from "zod";

export const createPostSchema = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください").max(200),
  body: z.string().trim().min(1, "本文を入力してください").max(20000),
  categoryId: z.string().min(1, "カテゴリを選択してください"),
  deadline: z.string().datetime().optional().nullable(),
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(20000).optional(),
  categoryId: z.string().min(1).optional(),
  deadline: z.string().datetime().optional().nullable(),
});
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const listPostsQuerySchema = z.object({
  categoryId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;

export const REPORT_REASONS = [
  "inappropriate",
  "misinformation",
  "personal_info",
  "spam",
  "other",
] as const;

export const createReportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  detail: z.string().trim().max(1000).optional(),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;
