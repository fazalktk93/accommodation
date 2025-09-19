// src/context/AuthProvider.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import auth, {
  authFetch,
  isLoggedIn as hasToken,
  login as rawLogin,
  logout as rawLogout,
} from "../auth";

const Ctx = createContext(null);

// Try common "who am I" endpoints. Return a user object or null.
async function fetchCurrentUser() {
  const paths = ["/auth/me", "/users/me", "/me"];
  for (const p of paths) {
    try {
      const res = await authFetch(p);
      if (!res || !res.ok) continue;
      const data = await res.json().catch(() => null);
      if (data && typeof data === "object") return data;
    } catch {
      // keep trying next path
    }
  }
  return null;
}

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [user, setUser] = useState(null);

  // Centralized revalidation
  const refresh = React.useCallback(async () => {
    const u = await fetchCurrentUser().catch(() => null);
    setUser(u);
    // treat presence of a valid user OR a token as "authed" (token might back a /me that’s disabled)
    setIsAuthed(!!u || hasToken());
    return u;
  }, []);

  // On mount: revalidate once
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const u = await refresh();
        if (!alive) return;
      } finally {
        if (alive) setLoading(false);
      }
    })();

    // Cross-tab token sync
    const onStorage = (e) => {
      if (e.key === "auth_token") {
        // token changed elsewhere → revalidate this tab
        refresh();
      }
    };
    window.addEventListener("storage", onStorage);

    // Revalidate when tab becomes visible or window gains focus
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      alive = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  // Login that works with different return shapes from ../auth
  async function login(username, password) {
    const r = await rawLogin(username, password).catch((e) => ({ ok: false, error: String(e) }));

    // Normalize success detection (../auth might return Response, {ok}, or data)
    let ok = true;
    if (r && typeof r === "object") {
      if ("ok" in r) ok = !!r.ok;
      else if ("status" in r) ok = r.status >= 200 && r.status < 300;
    }
    if (ok === false) {
      const msg =
        (r && (r.error || r.detail || r.message)) ||
        "Login failed";
      throw new Error(msg);
    }

    // After any login (JWT or cookie), load the user
    const u = await refresh();
    if (!u && !hasToken()) {
      // edge case: login endpoint succeeded but no session visible
      throw new Error("Login succeeded but session not established");
    }
    return { ok: true, user: u };
  }

  // Sign out from both client and server (if your ../auth.logout calls backend)
  async function signout() {
    try {
      await rawLogout();
    } catch {
      // ignore
    }
    setIsAuthed(false);
    setUser(null);
  }

  return (
    <Ctx.Provider value={{ loading, isAuthed, user, login, signout, refresh, setUser }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
