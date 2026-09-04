import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { AdminAction } from "../api/types";

const actionLabels: Record<string, string> = {
  update_affiliation: "所属変更",
  set_status_active: "有効化",
  set_status_disabled: "停止",
  grant_sub_admin: "副管理者を任命",
  revoke_sub_admin: "副管理者を解除",
  create_grade: "学年を追加",
  update_grade: "学年を更新",
  create_class: "クラスを追加",
  update_class: "クラスを更新",
  report_resolve: "通報を対応済みに",
  report_dismiss: "通報を却下",
  report_delete_post: "投稿を削除して通報処理",
  admin_delete_post: "投稿を管理者削除",
};

export default function ActionsLogPage() {
  const { data: actions, isLoading } = useQuery({
    queryKey: ["admin-actions"],
    queryFn: () => api.get<AdminAction[]>("/admin/actions"),
  });

  return (
    <div>
      <h1 className="page-title">操作ログ</h1>
      <p className="page-subtitle">直近200件の管理操作を表示しています</p>
      {isLoading && <p>読み込み中...</p>}
      {actions && (
        <table className="glass-table">
          <thead>
            <tr>
              <th>日時</th>
              <th>操作</th>
              <th>対象</th>
              <th>理由</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.createdAt).toLocaleString("ja-JP")}</td>
                <td>{actionLabels[a.actionType] ?? a.actionType}</td>
                <td>{a.targetType} / {a.targetId.slice(0, 8)}...</td>
                <td>{a.reason ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
