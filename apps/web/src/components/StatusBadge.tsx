export default function StatusBadge({ value }: { value: string | null }) {
  if (!value) return <span className="badge" style={{ background: "rgba(0,0,0,0.05)", color: "#8e8e93" }}>-</span>;
  const labels: Record<string, string> = {
    admin: "管理者",
    sub_admin: "副管理者",
    active: "有効",
    disabled: "停止中",
    pending: "未処理",
    resolved: "対応済み",
    dismissed: "却下",
  };
  return <span className={`badge ${value}`}>{labels[value] ?? value}</span>;
}
