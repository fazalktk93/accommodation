// frontend/src/components/RoleSelect.jsx
import { useEffect, useState } from "react";
import { api } from "../api";

export default function RoleSelect({ value, onChange, disabled }) {
  const [roles, setRoles] = useState(["admin", "manager", "viewer"]); // fallback

  useEffect(() => {
    (async () => {
      try {
        const res = await api.request("GET", "/users/roles");
        if (!res.ok) return; // keep fallback if 401/404 during setup
        const data = await res.json();
        if (Array.isArray(data?.roles) && data.roles.length) setRoles(data.roles);
      } catch {/* ignore; keep fallback */}
    })();
  }, []);

  return (
    <select
      className="input"
      value={value || "viewer"}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
    >
      {roles.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );
}