// app/admin/page.tsx
export default function AdminLanding() {
  return (
    <main style={{ padding:"2rem" }}>
      <h1>Admin</h1>
      <ul>
        <li><a href="/admin/users/new">Register User</a></li>
      </ul>
    </main>
  );
}
