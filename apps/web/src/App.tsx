import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardLayout from "./pages/DashboardLayout";
import UsersPage from "./pages/UsersPage";
import AcademicsPage from "./pages/AcademicsPage";
import ReportsPage from "./pages/ReportsPage";
import ActionsLogPage from "./pages/ActionsLogPage";
import { useAuth } from "./contexts/AuthContext";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="glass-loading">読み込み中...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.adminRole) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.adminRole !== "admin") return <Navigate to="/admin/reports" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="users" replace />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route
          path="academics"
          element={
            <RequireAdmin>
              <AcademicsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="actions"
          element={
            <RequireAdmin>
              <ActionsLogPage />
            </RequireAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
