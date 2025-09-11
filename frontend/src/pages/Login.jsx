// frontend/src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { login, isLoggedIn } from "../auth";

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoggedIn()) nav("/dashboard", { replace: true });
  }, [nav]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      const redirectTo = (location.state && location.state.from) || "/dashboard";
      nav(redirectTo, { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Login failed";
      setError(String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container narrow">
      <h1 style={{ textAlign: "center" }}>Sign in</h1>
      <form onSubmit={onSubmit} className="card">
        <label>
          <div>Username</div>
          <input
            type="text"
            value={username}
            autoFocus
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            style={{ width: "100%" }}
          />
        </label>
        <label>
          <div>Password</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{ width: "100%" }}
            />
            <button
              type="button"
              className="btn"
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        <button
          type="submit"
          className="btn primary"
          style={{ marginTop: 16, width: "100%" }}
          disabled={submitting}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
      </form>
    </div>
  );
}
