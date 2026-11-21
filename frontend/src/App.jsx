import { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import "./App.css";

const API = process.env.REACT_APP_API_URL || "http://localhost/api";

export default function App() {
  const [token, setToken]   = useState(localStorage.getItem("fs_token") || "");
  const [user, setUser]     = useState(localStorage.getItem("fs_user") || "");
  const [view, setView]     = useState("login"); // login | register | dashboard
  const [form, setForm]     = useState({ username: "", password: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) setView("dashboard");
  }, [token]);

  const submit = async (e, mode) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "register") {
        const res = await fetch(`${API}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json()).detail);
        setView("login");
        return;
      }
      // Login — use form-encoded body for OAuth2
      const body = new URLSearchParams({ username: form.username, password: form.password });
      const res  = await fetch(`${API}/auth/token`, { method: "POST", body });
      if (!res.ok) throw new Error("Invalid credentials");
      const data = await res.json();
      localStorage.setItem("fs_token", data.access_token);
      localStorage.setItem("fs_user", form.username);
      setToken(data.access_token);
      setUser(form.username);
      setView("dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("fs_token");
    localStorage.removeItem("fs_user");
    setToken(""); setUser(""); setView("login");
  };

  if (view === "dashboard") return <Dashboard token={token} user={user} onLogout={logout} api={API} />;

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-card">
        <div className="auth-logo">📈 FinSight</div>
        <div className="auth-subtitle">
          {view === "login" ? "Sign in to your dashboard" : "Create your account"}
        </div>
        <form onSubmit={(e) => submit(e, view)}>
          <div className="auth-field">
            <label>Username</label>
            <input
              type="text" placeholder="sreeja"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input
              type="password" placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Please wait..." : view === "login" ? "Sign In →" : "Create Account →"}
          </button>
        </form>
        <div className="auth-switch">
          {view === "login" ? (
            <>Don't have an account? <span onClick={() => setView("register")}>Register</span></>
          ) : (
            <>Already have an account? <span onClick={() => setView("login")}>Sign in</span></>
          )}
        </div>
      </div>
    </div>
  );
}
