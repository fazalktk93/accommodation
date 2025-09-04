// frontend/src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, isLoggedIn } from "../auth";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (isLoggedIn()) nav("/dashboard", { replace: true });
  }, [nav]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(username.trim(), password);
      nav("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh", background: "#f6f7f9" }}>
      <form
        onSubmit={onSubmit}
        style={{
          background: "#fff", padding: 24, borderRadius: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,.08)", width: 320
        }}
      >
        <h2 style={{ marginTop: 0 }}>Sign in</h2>
        <label>Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          style={{ width: "100%", marginBottom: 8 }}
        />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          style={{ width: "100%" }}
        />
        <button type="submit" style={{ marginTop: 16, width: "100%" }}>Login</button>
        {error && <div style={{ color: "#b00020", marginTop: 10 }}>{error}</div>}
        <div style={{ color: "#666", fontSize: 12, marginTop: 10 }}>
          Authenticates via <code>/api/auth/token</code>.
        </div>
      </form>
    </div>
  );
}
