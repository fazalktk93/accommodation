// app/(protected)/layout.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) router.replace("/login");
    else setChecking(false);
  }, [router]);

  if (checking) return <main style={{ padding: "2rem" }}>Checking session…</main>;
  return <>{children}</>;
}
