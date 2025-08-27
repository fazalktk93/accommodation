"use client";
import { useEffect, useState } from "react";
import { API, authHeaders } from "@/lib/api";

type Employee = { id:number; nic:string; name:string };

export default function EmployeesPage() {
  const [list, setList] = useState<Employee[]>([]);
  const [nic, setNic] = useState(""); const [name, setName] = useState("");
  const load = async () => {
    const res = await fetch(`${API}/employees`, { headers: { ...authHeaders() }});
    setList(await res.json());
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API}/employees`, {
      method:"POST",
      headers: { "Content-Type":"application/json", ...authHeaders() },
      body: JSON.stringify({ nic, name })
    });
    setNic(""); setName(""); load();
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm">NIC</label>
          <input className="input" value={nic} onChange={e=>setNic(e.target.value)} required />
        </div>
        <div className="flex-1">
          <label className="block text-sm">Name</label>
          <input className="input" value={name} onChange={e=>setName(e.target.value)} required />
        </div>
        <button className="btn">Add</button>
      </form>

      <div className="card">
        <h2 className="font-semibold mb-3">Employees</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th className="py-2">ID</th><th>NIC</th><th>Name</th></tr></thead>
          <tbody>
            {list.map(e=>(
              <tr key={e.id} className="border-t">
                <td className="py-2">{e.id}</td><td>{e.nic}</td><td>{e.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
