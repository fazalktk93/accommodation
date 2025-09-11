// frontend/src/context/AuthProvider.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { isLoggedIn, login as apiLogin, logout } from "../auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // check login status on mount
    if (isLoggedIn()) {
      setIsAuthed(true);
      // optionally fetch profile here
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    await apiLogin(username, password);
    setIsAuthed(true);
    // optionally fetch profile here
  };

  const signout = () => {
    logout();
    setIsAuthed(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ loading, isAuthed, user, login, signout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
