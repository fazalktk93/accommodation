// src/components/AdminOnly.jsx
import React from "react";
import { useAuth } from "../context/AuthProvider";

export default function AdminOnly({ children, fallback = null }) {
  const { user } = useAuth?.() ?? { user: null };
  const role = user?.role || user?.user?.role; // tolerate nested shapes
  const isAdmin = role === "admin" || user?.is_admin === true;
  return isAdmin ? children : fallback;
}
