// app/houses/page.tsx
"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useRouter } from "next/navigation";

type Role = "admin" | "operator" | "viewer";

type House = {
  id: number;
  colony_id: number;       // still present but hidden in UI
  quarter_no: string;
  street?: string | null;
  sector?: string | null;
  type_letter: string;
  status: string;
  file_number?: string | null;
};

type Me = { id: number; email: string; role: Role };

const TYPES = ["A","B","C","D","E","F","G","H"] as const;

export default function HousesPage() {
  const router = useRouter();
  const [items, setItems] = useState<House[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  // Form state (no Colony ID input now; we keep colony_id=1 by default for now)
  const [form, setForm] = useState<Partial<House>>({
    colony_id: 1,
    quarter_no: "",
    street: "",
    sector: "",
    type_letter: "A",
    file_number: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const canWrite = me?.role === "admin" || me?.role === "operator";

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("token")) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const m = await API<Me>("/users/me");
        setMe(m);
      } catch (e:any) {
        setError(e.message || String(e));
      }
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    try {
      const data = await API<House[]>("/houses");
      setItems(data);
      setError(null);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  function onChange<K extends keyof House>(key: K, val: any) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        colony_id: form.colony_id ?? 1, // hidden default
        quarter_no: form.quarter_no,
        street: form.street,
        sector: form.sector,
        type_letter: form.type_letter,
        file_number: form.file_number,
      };
      if (editingId) {
        await API(`/houses/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await API("/houses", { method: "POST", body: JSON.stringify(payload) });
      }
      setForm({ colony_id: 1, quarter_no: "", street: "", sector: "", type_letter: "A", file_number: "" });
      setEditingId(null);
      await refresh();
    } catch (e:any) {
      setError(e.message || String(e));
    }
  }

  async function onEdit(h: House) {
    setEditingId(h.id);
    setForm({
      colony_id: h.colony_id,
      quarter_no: h.quarter_no,
      street: h.street || "",
      sector: h.sector || "",
      type_letter: h.type_letter,
      file_number: h.file_number || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this house? This cannot be undone.")) return;
    try {
      await API(`/houses/${id}`, { method: "DELETE" });
      await refresh();
    } catch (e:any) {
      setError(e.message || String(e));
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Houses</h1>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-800">{error}</div>}

      {canWrite && (
        <form onSubmit={onSubmit} className="grid gap-3 bg-white p-4 rounded border">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <label className="flex flex-col text-sm">
              <span className="mb-1">Quarter No</span>
              <input
                className="border rounded px-2 py-1"
                value={form.quarter_no ?? ""}
                onChange={(e) => onChange("quarter_no", e.target.value)}
                placeholder="e.g. 12-B"
                required
              />
            </label>

            <label className="flex flex-col text-sm">
              <span className="mb-1">Street</span>
              <input
                className="border rounded px-2 py-1"
                value={form.street ?? ""}
                onChange={(e) => onChange("street", e.target.value)}
                placeholder="Street name/number"
              />
            </label>

            <label className="flex flex-col text-sm">
              <span className="mb-1">Sector</span>
              <input
                className="border rounded px-2 py-1"
                value={form.sector ?? ""}
                onChange={(e) => onChange("sector", e.target.value)}
                placeholder="e.g. Sector G-1"
              />
            </label>

            <label className="flex flex-col text-sm">
              <span className="mb-1">Type (A–H)</span>
              <select
                className="border rounded px-2 py-1"
                value={form.type_letter as string}
                onChange={(e) => onChange("type_letter", e.target.value)}
              >
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            <label className="flex flex-col text-sm">
              <span className="mb-1">File Number</span>
              <input
                className="border rounded px-2 py-1"
                value={form.file_number ?? ""}
                onChange={(e) => onChange("file_number", e.target.value)}
                placeholder="e.g. GWL-2024-0157"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button type="submit" className="px-3 py-2 rounded bg-black text-white">
              {editingId ? "Update House" : "Add House"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => { setEditingId(null); setForm({ colony_id: 1, quarter_no: "", street: "", sector: "", type_letter: "A", file_number: "" }); }}
                className="px-3 py-2 rounded border"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <div className="overflow-x-auto bg-white border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">File Number</th>
              <th className="px-3 py-2 text-left">Quarter No</th>
              <th className="px-3 py-2 text-left">Street</th>
              <th className="px-3 py-2 text-left">Sector</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(h => (
              <tr key={h.id} className="border-t">
                <td className="px-3 py-2">{h.id}</td>
                <td className="px-3 py-2">{h.file_number || "—"}</td>
                <td className="px-3 py-2">{h.quarter_no}</td>
                <td className="px-3 py-2">{h.street || "—"}</td>
                <td className="px-3 py-2">{h.sector || "—"}</td>
                <td className="px-3 py-2">{h.type_letter}</td>
                <td className="px-3 py-2">{h.status}</td>
                <td className="px-3 py-2 text-right">
                  {me && (me.role === "admin" || me.role === "operator") ? (
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => onEdit(h)} className="px-2 py-1 border rounded">Edit</button>
                      {me.role === "admin" && (
                        <button onClick={() => onDelete(h.id)} className="px-2 py-1 border rounded">Delete</button>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">read-only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
