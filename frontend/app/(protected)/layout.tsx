"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) router.replace("/login");
    else setReady(true);
  }, [router]);
  if (!ready) return null;
  return (<div><Nav /> <main className="mx-auto max-w-6xl p-4">{children}</main></div>);
}
