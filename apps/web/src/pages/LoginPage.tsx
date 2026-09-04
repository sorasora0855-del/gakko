import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import GlassCard from "../components/GlassCard";

export default function LoginPage() {
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const [gradeId, setGradeId] = useState("seed-grade-1年");
  const [attendanceNumber, setAttendanceNumber] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login({ gradeId, attendanceNumber: Number(attendanceNumber), password });
      navigate("/admin");
    } catch {
      // error is surfaced via context
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-wrapper">
      <GlassCard strong className="login-card">
        <h1 className="login-title">SchoolLink 管理画面</h1>
        <p className="login-subtitle">管理者・副管理者としてログインしてください</p>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>学年ID</label>
            <input
              className="glass-input"
              value={gradeId}
              onChange={(e) => setGradeId(e.target.value)}
              placeholder="seed-grade-1年"
            />
          </div>
          <div className="form-row-inline">
            <div className="form-row">
              <label>出席番号</label>
              <input
                className="glass-input"
                type="number"
                value={attendanceNumber}
                onChange={(e) => setAttendanceNumber(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>パスワード</label>
              <input
                className="glass-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="glass-button" style={{ width: "100%", marginTop: 8 }} disabled={submitting}>
            {submitting ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
