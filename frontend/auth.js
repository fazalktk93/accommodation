<script>
/** Simple auth helper for your app (vanilla JS). */
const AUTH_STORAGE_KEY = "auth_token";

export const auth = {
  get token() {
    return localStorage.getItem(AUTH_STORAGE_KEY);
  },
  set token(value) {
    if (value) localStorage.setItem(AUTH_STORAGE_KEY, value);
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  },
  isLoggedIn() {
    return !!auth.token;
  },
  logout() {
    auth.token = null;
    window.location.href = "/web/login.html";
  },
  async login(username, password) {
    const res = await fetch("/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      const msg = detail?.detail || "Login failed";
      throw new Error(msg);
    }
    const data = await res.json();
    if (!data?.access_token) {
      throw new Error("No token returned by server");
    }
    auth.token = data.access_token;
  },
  /** Wrap fetch to auto-attach Authorization header. */
  async fetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (auth.token) headers.set("Authorization", `Bearer ${auth.token}`);
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      // token invalid/expired → bounce to login
      auth.logout();
      return;
    }
    return res;
  },
};
</script>
