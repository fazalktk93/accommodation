// frontend/src/context/AuthProvider.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { isLoggedIn as hasToken, login as rawLogin, logout as rawLogout, getToken } from "../auth";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [user, setUser] = useState(null); // optional: fill via /api/auth/me if you have it

  useEffect(() => {
    setIsAuthed(hasToken());
    setLoading(false);

    // keep state in sync across tabs
    const onStorage = (e) => {
      if (e.key === "auth_token") setIsAuthed(!!e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  async function login(username, password) {
    await rawLogin(username, password);   // stores token
    setIsAuthed(true);                    // reflect immediately
    // optional: load profile here and setUser(...)
    return { token: getToken() };
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
