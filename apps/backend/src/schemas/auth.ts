import { z } from "zod";

/**
 * アカウント登録の入力スキーマ。
 * 計画書セクション6: 名前・ふりがな・学年・クラス・出席番号・パスワード・表示名。
 */
export const registerSchema = z.object({
  realName: z.string().trim().min(1, "名前を入力してください").max(50),
  furigana: z
    .string()
    .trim()
    .min(1, "ふりがなを入力してください")
    .max(50)
    .regex(/^[ぁ-んー\s]+$/, "ふりがなはひらがなで入力してください"),
  displayName: z.string().trim().min(1, "表示名を入力してください").max(30),
  gradeId: z.string().min(1, "学年を選択してください"),
  classId: z.string().min(1, "クラスを選択してください"),
  attendanceNumber: z
    .number()
    .int()
    .min(1, "出席番号は1以上で入力してください")
    .max(99, "出席番号が不正です"),
  password: z
    .string()
    .min(8, "パスワードは8文字以上で入力してください")
    .max(128, "パスワードが長すぎます"),
  isStudent: z.boolean().optional().default(true),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * ログインの入力スキーマ。
 * 計画書セクション7: 学年+出席番号を所属情報の一意キーとして扱うため、
 * ログインも「学年 + 出席番号 + パスワード」で行う。
 */
export const loginSchema = z.object({
  gradeId: z.string().min(1, "学年を選択してください"),
  attendanceNumber: z.number().int().min(1).max(99),
  password: z.string().min(1, "パスワードを入力してください"),
});
export type LoginInput = z.infer<typeof loginSchema>;
