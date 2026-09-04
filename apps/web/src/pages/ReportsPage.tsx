import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { ReportRow } from "../api/types";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";

type StatusFilter = "pending" | "resolved" | "dismissed";

export default function ReportsPage() {
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const qc = useQueryClient();
  const { data: reports, isLoading } = useQuery({
    queryKey: ["admin-reports", filter],
    queryFn: () => api.get<ReportRow[]>(`/admin/reports?status=${filter}`),
  });

  const [target, setTarget] = useState<ReportRow | null>(null);
  const [reason, setReason] = useState("");

  const resolveMutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "resolve" | "dismiss" | "delete_post"; reason?: string }) =>
      api.patch(`/admin/reports/${id}`, { action, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
      setTarget(null);
      setReason("");
    },
  });

  return (
    <div>
      <h1 className="page-title">通報管理</h1>
      <div className="tabs">
        {(
          [
            ["pending", "未処理"],
            ["resolved", "対応済み"],
            ["dismissed", "却下"],
          ] as [StatusFilter, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            className={`tab-button ${filter === value ? "active" : ""}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && <p className="page-subtitle">読み込み中...</p>}
      {reports?.length === 0 && <div className="empty-state glass-card">該当する通報はありません</div>}

      {reports?.map((r) => (
        <div className="glass-card" key={r.id} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{r.post.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                投稿者: {r.post.author.displayName} / 通報者: {r.reporter.displayName} / 理由: {r.reason}
                {r.post.deletedAt && <span style={{ color: "var(--accent-danger)" }}> ・投稿は削除済み</span>}
              </div>
              {r.detail && <div style={{ fontSize: 13, marginTop: 6 }}>{r.detail}</div>}
            </div>
            <div>
              <StatusBadge value={r.status} />
            </div>
          </div>
          {r.status === "pending" && (
            <div className="action-cell" style={{ marginTop: 14 }}>
              <button className="glass-button success" onClick={() => resolveMutation.mutate({ id: r.id, action: "resolve" })}>
                対応済みにする
              </button>
              <button className="glass-button secondary" onClick={() => resolveMutation.mutate({ id: r.id, action: "dismiss" })}>
                却下する
              </button>
              <button className="glass-button danger" onClick={() => setTarget(r)}>
                投稿を削除して処理
              </button>
            </div>
          )}
        </div>
      ))}

      {target && (
        <Modal title="投稿を削除して通報を処理" onClose={() => setTarget(null)}>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            「{target.post.title}」を削除し、この通報を対応済みにします。
          </p>
          <div className="form-row">
            <label>処理理由（任意）</label>
            <input className="glass-input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button className="glass-button secondary" onClick={() => setTarget(null)}>キャンセル</button>
            <button
              className="glass-button danger"
              disabled={resolveMutation.isPending}
              onClick={() => resolveMutation.mutate({ id: target.id, action: "delete_post", reason: reason || undefined })}
            >
              削除して処理
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
