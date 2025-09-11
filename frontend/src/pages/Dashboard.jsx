// frontend/src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { listHouses, listAllotments } from "../api";

function colorFor(label) {
  const s = String(label ?? "").toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 65% 55%)`;
}

function PieChart({ title, data, size = 220 }) {
  const total = data.reduce((a, b) => a + (Number(b.value) || 0), 0);
  const radius = size / 2;
  const cx = radius;
  const cy = radius;

  let acc = 0;
  const arcs = total
    ? data.map((d, i) => {
        const value = Number(d.value) || 0;
        const frac = value / total;
        const start = acc * 2 * Math.PI;
        acc += frac;
        const end = acc * 2 * Math.PI;

        const x1 = cx + radius * Math.sin(start);
        const y1 = cy - radius * Math.cos(start);
        const x2 = cx + radius * Math.sin(end);
        const y2 = cy - radius * Math.cos(end);
        const largeArc = end - start > Math.PI ? 1 : 0;

        const pathData = [
          `M ${cx} ${cy}`,
          `L ${x1} ${y1}`,
          `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
          "Z",
        ].join(" ");

        return (
          <path
            key={i}
            d={pathData}
            fill={d.color || colorFor(d.label)}
            aria-label={`${d.label}: ${value}`}
          />
        );
      })
    : [<circle key="empty" cx={cx} cy={cy} r={radius} fill="#eceff1" />];

  return (
    <div className="card" style={{ display: "flex", gap: 16 }}>
      <div style={{ minWidth: size, minHeight: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {arcs}
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
          {data.map((d, i) => (
            <li key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: d.color || colorFor(d.label),
                  display: "inline-block",
                }}
              />
              <span style={{ minWidth: 120 }}>{d.label}</span>
              <strong style={{ marginLeft: "auto" }}>{Number(d.value) || 0}</strong>
            </li>
          ))}
          {!data.length && <li style={{ color: "#607d8b" }}>No data</li>}
        </ul>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [houses, setHouses] = useState([]);
  const [allots, setAllots] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const [h, a] = await Promise.all([
          listHouses({ limit: 5000 }),
          listAllotments({ limit: 5000 }),
        ]);
        if (!alive) return;
        setHouses(Array.isArray(h) ? h : []);
        setAllots(Array.isArray(a) ? a : []);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load dashboard");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => {
    const c = { houses: houses.length, occupied: 0, vacant: 0, available: 0, allotments: allots.length };
    houses.forEach((h) => {
      const st = String(h?.status ?? "").toLowerCase();
      if (st === "occupied") c.occupied++;
      else if (st === "vacant") c.vacant++;
      else c.available++;
    });
    return c;
  }, [houses, allots]);

  const byType = useMemo(() => {
    const map = new Map();
    houses.forEach((h) => {
      const label = (h?.type_code ?? "Unknown").toString();
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map, ([label, value]) => ({ label, value, color: colorFor(label) }));
  }, [houses]);

  const byStatus = useMemo(() => {
    const map = new Map();
    houses.forEach((h) => {
      const label = (h?.status ?? "unknown").toString();
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map, ([label, value]) => ({ label, value, color: colorFor(label) }));
  }, [houses]);

  const byPool = useMemo(() => {
    const map = new Map();
    allots.forEach((a) => {
      const label = a?.pool || "Unknown";
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map, ([label, value]) => ({ label, value, color: colorFor(label) }));
  }, [allots]);

  const byMedium = useMemo(() => {
    const map = new Map();
    allots.forEach((a) => {
      const label = a?.medium || "Unknown";
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map, ([label, value]) => ({ label, value, color: colorFor(label) }));
  }, [allots]);

  return (
    <div className="container">
      <h1>Dashboard</h1>

      {error && (
        <div className="card" style={{ borderLeft: "4px solid #e53935", color: "#b71c1c" }}>
          {error}
        </div>
      )}

      <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <Tile label="Total Houses" value={counts.houses} />
        <Tile label="Occupied" value={counts.occupied} />
        <Tile label="Vacant" value={counts.vacant} />
        <Tile label="Allotments" value={counts.allotments} />
      </div>

      {loading ? (
        <div className="card">Loading…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
          <PieChart title="Houses by Status" data={byStatus} />
          <PieChart title="Houses by Type" data={byType} />
          <PieChart title="Allotments by Pool" data={byPool} />
          <PieChart title="Allotments by Medium" data={byMedium} />
        </div>
      )}
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <div className="tile">
      <div className="label" style={{ color: "#607d8b", fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
      <div className="value" style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
