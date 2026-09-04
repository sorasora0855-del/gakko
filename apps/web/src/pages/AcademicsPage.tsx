import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Grade } from "../api/types";
import StatusBadge from "../components/StatusBadge";

export default function AcademicsPage() {
  const qc = useQueryClient();
  const { data: grades, isLoading } = useQuery({
    queryKey: ["admin-grades"],
    queryFn: () => api.get<Grade[]>("/admin/grades"),
  });

  const [newGradeName, setNewGradeName] = useState("");
  const [newClassGradeId, setNewClassGradeId] = useState("");
  const [newClassName, setNewClassName] = useState("");

  const createGrade = useMutation({
    mutationFn: (name: string) => api.post("/admin/grades", { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-grades"] });
      setNewGradeName("");
    },
  });

  const createClass = useMutation({
    mutationFn: ({ gradeId, name }: { gradeId: string; name: string }) =>
      api.post("/admin/classes", { gradeId, name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-grades"] });
      setNewClassName("");
    },
  });

  const toggleGrade = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/grades/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-grades"] }),
  });

  const toggleClass = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/classes/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-grades"] }),
  });

  return (
    <div>
      <h1 className="page-title">学年・クラス管理</h1>
      {isLoading && <p className="page-subtitle">読み込み中...</p>}

      <div className="glass-card" style={{ marginBottom: 24, display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>新しい学年を追加</label>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input className="glass-input" value={newGradeName} onChange={(e) => setNewGradeName(e.target.value)} placeholder="例: 4年" />
            <button className="glass-button" disabled={!newGradeName || createGrade.isPending} onClick={() => createGrade.mutate(newGradeName)}>
              追加
            </button>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>新しいクラスを追加</label>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <select className="glass-select" value={newClassGradeId} onChange={(e) => setNewClassGradeId(e.target.value)}>
              <option value="">学年を選択</option>
              {grades?.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <input className="glass-input" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="例: 4組" />
            <button
              className="glass-button"
              disabled={!newClassGradeId || !newClassName || createClass.isPending}
              onClick={() => createClass.mutate({ gradeId: newClassGradeId, name: newClassName })}
            >
              追加
            </button>
          </div>
        </div>
      </div>

      {grades?.map((g) => (
        <div className="glass-card" key={g.id} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <strong style={{ fontSize: 16 }}>{g.name}</strong>
              <StatusBadge value={g.isActive ? "active" : "disabled"} />
            </div>
            <button
              className={`glass-button ${g.isActive ? "danger" : "success"}`}
              onClick={() => toggleGrade.mutate({ id: g.id, isActive: !g.isActive })}
            >
              {g.isActive ? "無効化" : "有効化"}
            </button>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {g.classes.map((c) => (
              <div key={c.id} className="glass-panel" style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <span>{c.name}</span>
                <StatusBadge value={c.isActive ? "active" : "disabled"} />
                <button
                  className={`glass-button ${c.isActive ? "danger" : "success"}`}
                  style={{ padding: "5px 10px", fontSize: 12 }}
                  onClick={() => toggleClass.mutate({ id: c.id, isActive: !c.isActive })}
                >
                  {c.isActive ? "無効化" : "有効化"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
