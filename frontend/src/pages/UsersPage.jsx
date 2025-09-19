import { useEffect, useMemo, useState } from "react";
import { getUsers, createUser } from "../api";
import RoleSelect from "../components/RoleSelect";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");

  async function load() {
    setBusy(true);
    setErr("");
    try {
      const list = await getUsers({ limit: 500 });
      setUsers(list);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await createUser({
        username,
        password,
        full_name: fullName,
        email,
        role,            // <- only role is sent; backend derives permissions
        // permissions: [] // not needed
      });
      setUsername(""); setPassword(""); setFullName(""); setEmail(""); setRole("viewer");
      await load();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ padding: 16 }}>
      <h1>Users</h1>

      <section style={{ margin: "16px 0", padding: 16, border: "1px solid var(--border)", borderRadius: 8 }}>
        <h2 style={{ marginTop: 0 }}>Create user</h2>
        <form onSubmit={handleCreate} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
          <label>
            <div>Username</div>
            <input className="input" value={username} onChange={(e)=>setUsername(e.target.value)} required />
          </label>
          <label>
            <div>Password</div>
            <input className="input" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
          </label>
          <label>
            <div>Full name</div>
            <input className="input" value={fullName} onChange={(e)=>setFullName(e.target.value)} />
          </label>
          <label>
            <div>Email</div>
            <input className="input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          </label>
          <label>
            <div>Role</div>
            <RoleSelect value={role} onChange={setRole} />
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" type="submit" disabled={busy}>Create</button>
            {err ? <div style={{ color: "crimson" }}>{err}</div> : null}
          </div>
        </form>
      </section>

      <section>
        <h2 style={{ marginTop: 0 }}>All users</h2>
        {busy && <div>Loading…</div>}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th><th>Username</th><th>Full name</th><th>Email</th><th>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>{u.full_name || "—"}</td>
                  <td>{u.email || "—"}</td>
                  <td>{u.role}</td>
                </tr>
              ))}
              {!users.length && !busy ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 16 }}>No users yet</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
