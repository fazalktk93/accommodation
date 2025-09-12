// src/context/AuthProvider.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import auth, { authFetch, isLoggedIn as hasToken, login as rawLogin, logout as rawLogout } from "../auth";

const Ctx = createContext(null);

// Probe a bunch of "who am I" endpoints; some projects only expose one of them.
async function fetchCurrentUser() {
  const probes = ["/auth/me", "/users/me", "/me", "/auth/user", "/profile/me"];
  for (const p of probes) {
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

  useEffect(() => {
    let alive = true;
    (async () => {
      const u = await fetchCurrentUser().catch(() => null);
      if (!alive) return;
      if (u) {
        setUser(u);
        setIsAuthed(true);
      } else {
        // if JWT exists, we still try to treat as logged in (backend may not have /me)
        setIsAuthed(hasToken());
      }
      setLoading(false);
    })();

    const onStorage = (e) => { if (e.key === "auth_token") window.location.reload(); };
    window.addEventListener("storage", onStorage);
    return () => { alive = false; window.removeEventListener("storage", onStorage); };
  }, []);

  async function login(username, password) {
    const r = await rawLogin(username, password);
    if (!r.ok) throw new Error(r.error || "Login failed");
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
