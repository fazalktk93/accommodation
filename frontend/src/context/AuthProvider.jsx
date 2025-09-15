// src/context/AuthProvider.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import auth, { authFetch, isLoggedIn as hasToken, login as rawLogin, logout as rawLogout } from "../auth";

const Ctx = createContext(null);

async function fetchCurrentUser() {
  const paths = ["/auth/me", "/users/me", "/me"];
  for (const p of paths) {
    try {
      const res = await authFetch(p);
      if (!res.ok) continue;
      return await res.json();
    } catch {}
  }
  return null;
}

export function AuthProvider({ children }) {
  const [loading, setLoading]   = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [user, setUser]         = useState(null);

  // on mount: try JWT, then cookie session via /auth/me
  useEffect(() => {
    let alive = true;
    (async () => {
      // If we already have a JWT, we’re likely logged in
      if (hasToken()) {
        const u = await fetchCurrentUser().catch(() => null);
        if (!alive) return;
        setUser(u);
        setIsAuthed(true);
        setLoading(false);
      } else {
        // Maybe cookie session exists
        const u = await fetchCurrentUser().catch(() => null);
        if (!alive) return;
        if (u) {
          setUser(u);
          setIsAuthed(true);
        } else {
          setIsAuthed(false);
          setUser(null);
        }
        setLoading(false);
      }
    })();

    // sync across tabs
    const onStorage = (e) => { if (e.key === "auth_token") window.location.reload(); };
    window.addEventListener("storage", onStorage);
    return () => { alive = false; window.removeEventListener("storage", onStorage); };
  }, []);

  async function login(username, password) {
    const r = await rawLogin(username, password);
    if (!r.ok) throw new Error(r.error || "Login failed");
    // after any login attempt (JWT or cookie), populate user
    const u = await fetchCurrentUser().catch(() => null);
    setUser(u);
    setIsAuthed(!!u || hasToken());
    return { ok: true, user: u };
  }

  function signout() {
    rawLogout();
    setIsAuthed(false);
    setUser(null);
  }

  return (
    <Ctx.Provider value={{ loading, isAuthed, user, login, signout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
