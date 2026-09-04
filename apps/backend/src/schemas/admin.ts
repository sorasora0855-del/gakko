import { z } from "zod";

export const updateAffiliationSchema = z.object({
  gradeId: z.string().min(1),
  classId: z.string().min(1),
  attendanceNumber: z.number().int().min(1).max(99),
});
export type UpdateAffiliationInput = z.infer<typeof updateAffiliationSchema>;

export const updateUserStatusSchema = z.object({
  status: z.enum(["active", "disabled"]),
  reason: z.string().trim().max(500).optional(),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export const gradeSchema = z.object({
  name: z.string().trim().min(1).max(20),
  isActive: z.boolean().optional(),
});
export type GradeInput = z.infer<typeof gradeSchema>;

export const classSchema = z.object({
  gradeId: z.string().min(1),
  name: z.string().trim().min(1).max(20),
  isActive: z.boolean().optional(),
});
export type ClassInput = z.infer<typeof classSchema>;

export const resolveReportSchema = z.object({
  action: z.enum(["resolve", "dismiss", "delete_post"]),
  reason: z.string().trim().max(500).optional(),
});
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;

export const subAdminSchema = z.object({
  userId: z.string().min(1),
});
export type SubAdminInput = z.infer<typeof subAdminSchema>;
