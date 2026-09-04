import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { AdminUserRow, Grade } from "../api/types";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import { useAuth } from "../contexts/AuthContext";

export default function UsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.get<AdminUserRow[]>("/admin/users"),
  });
  const { data: grades } = useQuery({
    queryKey: ["admin-grades"],
    queryFn: () => api.get<Grade[]>("/admin/grades"),
    enabled: me?.adminRole === "admin",
  });

  const [affiliationTarget, setAffiliationTarget] = useState<AdminUserRow | null>(null);
  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [attendanceNumber, setAttendanceNumber] = useState("");

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "disabled" }) =>
      api.patch(`/admin/users/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const subAdminGrant = useMutation({
    mutationFn: (userId: string) => api.post("/admin/sub-admins", { userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const subAdminRevoke = useMutation({
    mutationFn: (userId: string) => api.delete(`/admin/sub-admins/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const affiliationMutation = useMutation({
    mutationFn: ({ id, gradeId, classId, attendanceNumber }: { id: string; gradeId: string; classId: string; attendanceNumber: number }) =>
      api.patch(`/admin/users/${id}/affiliation`, { gradeId, classId, attendanceNumber }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setAffiliationTarget(null);
    },
  });

  function openAffiliationModal(u: AdminUserRow) {
    setAffiliationTarget(u);
    setSelectedGradeId(u.affiliation?.gradeId ?? "");
    setSelectedClassId(u.affiliation?.classId ?? "");
    setAttendanceNumber(String(u.affiliation?.attendanceNumber ?? ""));
  }

  const classesForGrade = grades?.find((g) => g.id === selectedGradeId)?.classes ?? [];

  return (
    <div>
      <h1 className="page-title">ユーザー管理</h1>
      {isLoading && <p className="page-subtitle">読み込み中...</p>}
      {users && (
        <table className="glass-table">
          <thead>
            <tr>
              <th>氏名</th>
              <th>表示名</th>
              <th>所属</th>
              <th>権限</th>
              <th>状態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.realName}</td>
                <td>{u.displayName}</td>
                <td>
                  {u.affiliation
                    ? `${u.affiliation.gradeName} ${u.affiliation.className} #${u.affiliation.attendanceNumber}`
                    : "-"}
                </td>
                <td><StatusBadge value={u.adminRole} /></td>
                <td><StatusBadge value={u.status} /></td>
                <td className="action-cell">
                  {me?.adminRole === "admin" && (
                    <button className="glass-button secondary" onClick={() => openAffiliationModal(u)}>
                      所属変更
                    </button>
                  )}
                  {u.status === "active" ? (
                    <button
                      className="glass-button danger"
                      onClick={() => statusMutation.mutate({ id: u.id, status: "disabled" })}
                    >
                      停止
                    </button>
                  ) : (
                    <button
                      className="glass-button success"
                      onClick={() => statusMutation.mutate({ id: u.id, status: "active" })}
                    >
                      有効化
                    </button>
                  )}
                  {me?.adminRole === "admin" && !u.adminRole && (
                    <button className="glass-button secondary" onClick={() => subAdminGrant.mutate(u.id)}>
                      副管理者に任命
                    </button>
                  )}
                  {me?.adminRole === "admin" && u.adminRole === "sub_admin" && (
                    <button className="glass-button danger" onClick={() => subAdminRevoke.mutate(u.id)}>
                      副管理者を解除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {affiliationTarget && (
        <Modal title={`${affiliationTarget.displayName} の所属変更`} onClose={() => setAffiliationTarget(null)}>
          <div className="form-row">
            <label>学年</label>
            <select
              className="glass-select"
              value={selectedGradeId}
              onChange={(e) => {
                setSelectedGradeId(e.target.value);
                setSelectedClassId("");
              }}
            >
              <option value="">選択してください</option>
              {grades?.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>クラス</label>
            <select className="glass-select" value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
              <option value="">選択してください</option>
              {classesForGrade.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>出席番号</label>
            <input
              className="glass-input"
              type="number"
              value={attendanceNumber}
              onChange={(e) => setAttendanceNumber(e.target.value)}
            />
          </div>
          {affiliationMutation.isError && <p className="error-text">変更に失敗しました（番号の重複などをご確認ください）</p>}
          <div className="modal-actions">
            <button className="glass-button secondary" onClick={() => setAffiliationTarget(null)}>キャンセル</button>
            <button
              className="glass-button"
              disabled={!selectedGradeId || !selectedClassId || !attendanceNumber || affiliationMutation.isPending}
              onClick={() =>
                affiliationMutation.mutate({
                  id: affiliationTarget.id,
                  gradeId: selectedGradeId,
                  classId: selectedClassId,
                  attendanceNumber: Number(attendanceNumber),
                })
              }
            >
              保存
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
