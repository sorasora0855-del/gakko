export type AdminRole = "admin" | "sub_admin" | null;

export interface Affiliation {
  gradeId: string;
  classId: string;
  gradeName: string;
  className: string;
  attendanceNumber: number;
}

export interface AdminUserRow {
  id: string;
  displayName: string;
  realName: string;
  furigana: string;
  isStudent: boolean;
  status: "active" | "disabled";
  createdAt: string;
  adminRole: AdminRole;
  affiliation: Affiliation | null;
}

export interface Grade {
  id: string;
  name: string;
  isActive: boolean;
  classes: SchoolClass[];
}

export interface SchoolClass {
  id: string;
  gradeId: string;
  name: string;
  isActive: boolean;
}

export interface ReportRow {
  id: string;
  postId: string;
  reporterId: string;
  reason: string;
  detail: string | null;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  post: {
    id: string;
    title: string;
    deletedAt: string | null;
    author: { id: string; displayName: string };
    category: { id: string; name: string };
  };
  reporter: { id: string; displayName: string };
}

export interface AdminAction {
  id: string;
  adminId: string;
  actionType: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  createdAt: string;
}

export interface CurrentUser {
  id: string;
  displayName: string;
  adminRole: AdminRole;
}
