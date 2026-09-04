import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const linkClass = ({ isActive }: { isActive: boolean }) => `sidebar-link${isActive ? " active" : ""}`;

  return (
    <div className="app-shell">
      <nav className="glass-panel glass-sidebar">
        <div className="sidebar-brand">SchoolLink</div>
        <div className="sidebar-role">
          {user?.displayName} さん（{user?.adminRole === "admin" ? "管理者" : "副管理者"}）
        </div>
        <NavLink to="/admin/users" className={linkClass}>ユーザー管理</NavLink>
        <NavLink to="/admin/reports" className={linkClass}>通報管理</NavLink>
        {user?.adminRole === "admin" && (
          <>
            <NavLink to="/admin/academics" className={linkClass}>学年・クラス管理</NavLink>
            <NavLink to="/admin/actions" className={linkClass}>操作ログ</NavLink>
          </>
        )}
        <button className="sidebar-logout" onClick={handleLogout}>ログアウト</button>
      </nav>
      <main className="glass-panel glass-main">
        <Outlet />
      </main>
    </div>
  );
}
