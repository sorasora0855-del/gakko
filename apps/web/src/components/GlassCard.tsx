import type { ReactNode } from "react";

export default function GlassCard({
  children,
  className = "",
  strong = false,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return <div className={`${strong ? "glass-panel-strong" : "glass-card"} ${className}`}>{children}</div>;
}
