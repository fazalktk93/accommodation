"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Nav() {
    const router = useRouter();
    const logout = () => {
        localStorage.removeItem("token");
        router.push("/login");
    };
    return (
        <nav className="bg-white border-b">
            <div className="mx-auto max-w-6xl px-4 py-3 flex justify-between items-center">
                <div className="font-semibold">House Allotment</div>
                <div className="space-x-4">
                    <Link href="/dashboard">Dashboard</Link>
                    <Link href="/employees">Employees</Link>
                    <button onClick={logout} className="btn">
                        Logout
                    </button>
                </div>
            </div>
        </nav>
    );
}

