// frontend/src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { listHouses, listAllotments } from "../api";

/* ---------- colors ---------- */
function colorFor(label) {
  const s = String(label ?? "").toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 65% 55%)`;
}

/* ---------- retention logic ---------- */
const DAY = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = 183; // ~6 months

function parseDate(x) {
  if (!x) return null;
  const d = new Date(x);
  return isNaN(d.getTime()) ? null : d;
}

/** Determine retention status for an allotment record */
function getRetentionStatus(a, now = new Date()) {
  const raw = a?.retirement_date ?? a?.allottee_retirement_date ?? a?.retire_date;
  const rdt = parseDate(raw);
  if (!rdt) return { status: "in-service", daysPast: 0, retirementDate: null };

  const diffDays = Math.floor((now - rdt) / DAY);
  if (diffDays < 0) {
    // not retired yet
    return { status: "in-service", daysPast: diffDays, retirementDate: rdt };
  }
  if (diffDays <= RETENTION_DAYS) {
    return { status: "retention", daysPast: diffDays, retirementDate: rdt };
  }
  return { status: "unauthorized", daysPast: diffDays, retirementDate: rdt };
}

/* ---------- small chart ---------- */
function PieChart({ title, data, size = 220, onSliceClick }) {
  const total = data.reduce((a, b) => a + (Number(b.value) || 0), 0);
  const radius = size / 2;
  const cx = radius, cy = radius;

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
            onClick={() => onSliceClick?.(d)}
            style={{ cursor: onSliceClick ? "pointer" : "default" }}
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
            <li
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: onSliceClick ? "pointer" : "default" }}
              onClick={() => onSliceClick?.(d)}
              title="Click to drill down"
            >
              <span
                style={{
                  width: 12, height: 12, borderRadius: 2,
                  background: d.color || colorFor(d.label), display: "inline-block",
                }}
              />
              <span style={{ minWidth: 140 }}>{d.label}</span>
              <strong style={{ marginLeft: "auto" }}>{Number(d.value) || 0}</strong>
            </li>
          ))}
          {!data.length && <li style={{ color: "#607d8b" }}>No data</li>}
        </ul>
      </div>
    </div>
  );
}

/* ---------- Dashboard ---------- */
export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [houses, setHouses] = useState([]);
  const [allots, setAllots] = useState([]);
  const [error, setError] = useState("");

  // drill-down state
  const [selection, setSelection] = useState({ type: null, key: null, label: "" }); // e.g. {type:'retention', key:'retention'}
  const [rows, setRows] = useState([]); // detailed rows under the charts

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

  /* ---------- aggregates ---------- */
  const counts = useMemo(() => {
    const c = { houses: houses.length, occupied: 0, vacant: 0, allotments: allots.length };
    houses.forEach((h) => {
      const st = String(h?.status ?? "").toLowerCase();
      if (st === "occupied") c.occupied++;
      else if (st === "vacant") c.vacant++;
    });
    return c;
  }, [houses, allots]);

  const byStatus = useMemo(() => {
    const map = new Map();
    houses.forEach((h) => {
      const label = (h?.status ?? "unknown").toString();
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map, ([label, value]) => ({ label, value, color: colorFor(label) }));
  }, [houses]);

  const byType = useMemo(() => {
    const map = new Map();
    houses.forEach((h) => {
      const label = (h?.type_code ?? "Unknown").toString();
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map, ([label, value]) => ({ label, value, color: colorFor(label) }));
  }, [houses]);

  const retentionTaggedAllots = useMemo(() => {
    const now = new Date();
    return allots.map((a) => {
      const r = getRetentionStatus(a, now);
      return { ...a, __retention: r };
    });
  }, [allots]);

  const byRetention = useMemo(() => {
    const map = new Map([["in-service",0],["retention",0],["unauthorized",0]]);
    retentionTaggedAllots.forEach((a) => {
      const s = a.__retention?.status || "in-service";
      map.set(s, (map.get(s) || 0) + 1);
    });
    return Array.from(map, ([label, value]) => ({ label, value, color: colorFor(label) }));
  }, [retentionTaggedAllots]);

  /* ---------- drill-down helpers ---------- */
  function openDrill(type, key, label) {
    setSelection({ type, key, label });

    if (type === "house-status") {
      const filt = houses.filter((h) => String(h?.status ?? "unknown") === key);
      setRows(filt.map(h => ({ kind: "house", ...h })));
      return;
    }

    if (type === "house-type") {
      const filt = houses.filter((h) => String(h?.type_code ?? "Unknown") === key);
      setRows(filt.map(h => ({ kind: "house", ...h })));
      return;
    }

    if (type === "retention") {
      const filt = retentionTaggedAllots.filter(a => (a.__retention?.status || "in-service") === key);
      // join minimal house info if we can match by house_id
      const mapById = new Map(houses.map(h => [h.id, h]));
      const withHouse = filt.map(a => ({ kind: "allotment", ...a, __house: mapById.get(a.house_id) || null }));
      setRows(withHouse);
      return;
    }
  }

  function clearDrill() {
    setSelection({ type: null, key: null, label: "" });
    setRows([]);
  }

  /* ---------- quick filters ---------- */
  function quickRetention() {
    openDrill("retention", "retention", "All in Retention");
  }
  function quickUnauthorized() {
    openDrill("retention", "unauthorized", "Unauthorized Occupation");
  }

  /* ---------- UI ---------- */
  return (
    <div className="container">
      <h1>Dashboard</h1>

      {error && (
        <div className="card" style={{ borderLeft: "4px solid #e53935", color: "#b71c1c" }}>
          {error}
        </div>
      )}

      {/* Top tiles - clickable */}
      <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12 }}>
        <Tile label="Total Houses" value={counts.houses} onClick={() => clearDrill()} />
        <Tile label="Occupied" value={counts.occupied} onClick={() => openDrill("house-status", "occupied", "Occupied Houses")} />
        <Tile label="Vacant" value={counts.vacant} onClick={() => openDrill("house-status", "vacant", "Vacant Houses")} />
        <Tile label="Allotments" value={counts.allotments} onClick={() => openDrill("retention", "in-service", "Allotments (In-Service)")} />
        <TileAccent label="Retention (click)" onClick={quickRetention} />
      </div>

      {loading ? (
        <div className="card">Loading…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
          <PieChart
            title="Houses by Status"
            data={byStatus}
            onSliceClick={(d) => openDrill("house-status", d.label, `Houses: ${d.label}`)}
          />
          <PieChart
            title="Houses by Type"
            data={byType}
            onSliceClick={(d) => openDrill("house-type", d.label, `Houses: Type ${d.label}`)}
          />
          <PieChart
            title="Allottees by Retention Status"
            data={byRetention}
            onSliceClick={(d) => openDrill("retention", d.label, `Allottees: ${d.label}`)}
          />
          <div className="card" style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Quick Actions</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" onClick={quickRetention}>View Retention</button>
              <button className="btn" onClick={quickUnauthorized}>View Unauthorized</button>
              <button className="btn" onClick={() => openDrill("retention", "in-service", "Allottees: In-Service")}>View In-Service</button>
              <button className="btn" onClick={() => clearDrill()}>Clear Selection</button>
            </div>
            <div style={{ fontSize: 12, color: "#607d8b" }}>
              Retention = retired ≤ 6 months; Unauthorized = retired &gt; 6 months.
            </div>
          </div>
        </div>
      )}

      {/* Drill-down panel */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <strong style={{ fontSize: 16 }}>{selection.label || "Details"}</strong>
          {selection.type && <button className="btn" style={{ marginLeft: "auto" }} onClick={clearDrill}>Reset</button>}
        </div>

        {rows.length === 0 ? (
          <div style={{ color: "#607d8b" }}>Click a tile or a chart slice to see details here.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="grid-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                {selection.type === "retention" ? (
                  <tr>
                    <Th>Allotment #</Th>
                    <Th>Allottee</Th>
                    <Th>File No</Th>
                    <Th>House</Th>
                    <Th>Pool</Th>
                    <Th>Medium</Th>
                    <Th>Retirement Date</Th>
                    <Th>Status</Th>
                    <Th>Days Past</Th>
                  </tr>
                ) : (
                  <tr>
                    <Th>House ID</Th>
                    <Th>File No</Th>
                    <Th>Sector</Th>
                    <Th>Street</Th>
                    <Th>Qtr No</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                  </tr>
                )}
              </thead>
              <tbody>
                {selection.type === "retention"
                  ? rows.map((a) => {
                      const r = a.__retention || {};
                      const h = a.__house || {};
                      return (
                        <tr key={a.id}>
                          <Td>{safe(a.id)}</Td>
                          <Td>{safe(a.allottee_name || a.allottee)}</Td>
                          <Td>{safe(h.file_no || a.file_no)}</Td>
                          <Td>{formatHouse(h)}</Td>
                          <Td>{safe(a.pool)}</Td>
                          <Td>{safe(a.medium)}</Td>
                          <Td>{r.retirementDate ? fmtDate(r.retirementDate) : "-"}</Td>
                          <Td>
                            <Pill text={r.status} tone={r.status} />
                          </Td>
                          <Td>{typeof r.daysPast === "number" && r.daysPast > 0 ? r.daysPast : 0}</Td>
                        </tr>
                      );
                    })
                  : rows.map((h) => (
                      <tr key={h.id}>
                        <Td>{safe(h.id)}</Td>
                        <Td>{safe(h.file_no)}</Td>
                        <Td>{safe(h.sector)}</Td>
                        <Td>{safe(h.street)}</Td>
                        <Td>{safe(h.qtr_no)}</Td>
                        <Td>{safe(h.type_code)}</Td>
                        <Td><Pill text={safe(h.status)} tone={String(h.status).toLowerCase()} /></Td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- tiny UI bits ---------- */
function Tile({ label, value, onClick }) {
  return (
    <div className="tile" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <div className="label" style={{ color: "#607d8b", fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
      <div className="value" style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
function TileAccent({ label, onClick }) {
  return (
    <div className="tile" onClick={onClick} style={{ cursor: "pointer", background: "rgba(255,193,7,0.12)", border: "1px solid rgba(255,193,7,0.35)" }}>
      <div className="label" style={{ color: "#795548", fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
      <div className="value" style={{ fontSize: 18, fontWeight: 700, color: "#5d4037" }}>Click to View</div>
    </div>
  );
}

function Th({ children }) {
  return <th style={{ textAlign: "left", padding: "10px 12px", background: "#fafafa", position: "sticky", top: 0 }}>{children}</th>;
}
function Td({ children }) {
  return <td style={{ padding: "10px 12px", borderTop: "1px solid #eee" }}>{children}</td>;
}

function Pill({ text, tone }) {
  const t = String(tone || "").toLowerCase();
  const bg =
    t.includes("unauthor") ? "rgba(239,68,68,0.12)" :
    t.includes("retent") ? "rgba(245,158,11,0.18)" :
    t.includes("occupied") ? "rgba(59,130,246,0.15)" :
    t.includes("vacant") ? "rgba(34,197,94,0.15)" :
    "rgba(107,114,128,0.15)";
  const color = "#111";
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, background: bg, color, fontSize: 12, lineHeight: "18px" }}>
      {String(text || "-")}
    </span>
  );
}

/* ---------- format helpers ---------- */
const safe = (x) => (x === null || x === undefined || String(x).trim() === "" ? "-" : x);
const fmtDate = (d) => {
  try {
    const dt = d instanceof Date ? d : new Date(d);
    return dt.toISOString().slice(0, 10);
  } catch {
    return "-";
  }
};
const formatHouse = (h) =>
  [h?.sector, h?.street ? `St-${h.street}` : null, h?.qtr_no ? `Qtr-${h.qtr_no}` : null]
    .filter(Boolean)
    .join(" / ");
