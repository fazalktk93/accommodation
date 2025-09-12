// src/components/SearchBar.jsx
import React, { useState } from "react";

export default function SearchBar({ defaultValue = "", onSearch, onClear }) {
  const [q, setQ] = useState(defaultValue);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSearch?.(q.trim()); }}
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        margin: "12px 0",
      }}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search qtr / file no / CNIC / allottee name"
        style={{ flex: 1, padding: "8px 10px", border: "1px solid #ddd", borderRadius: 6 }}
      />
      <button type="submit">Search</button>
      <button type="button" onClick={() => { setQ(""); onClear?.(); }}>Clear</button>
    </form>
  );
}
