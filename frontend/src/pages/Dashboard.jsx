// frontend/src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { listHouses, listAllotments } from "../api";

const now = new Date();
const buckets = useMemo(() => computeRetentionBuckets(allotments, now), [allotments]);

/* =========================
   COLOR PALETTES (distinct)
   ========================= */
const STATUS_COLORS = {
  occupied: "#1f77b4",
  vacant: "#2ca02c",
  reserved: "#9467bd",
  unknown: "#7f7f7f",
};

// 20-category palette for Types (A/B/C/…/SITE/Unknown etc.)
const TYPE_PALETTE = [
  "#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd",
  "#8c564b","#e377c2","#7f7f7f","#bcbd22","#17becf",
  "#4e79a7","#f28e2c","#e15759","#76b7b2","#59a14f",
  "#edc948","#b07aa1","#ff9da7","#9c755f","#bab0ab",
];

function colorForType(label) {
  const s = String(label ?? "Unknown");
  // stable index from string
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TYPE_PALETTE[h % TYPE_PALETTE.length];
}

const RETENTION_COLORS = {
  "in-service": "#5c6bc0",
  "retention": "#f5a623",
  "unauthorized": "#e53935",
};

/* =========================
   RETENTION CALC (six months)
   ========================= */

const DAY = 24 * 60 * 60 * 1000;
const RETENTION_MONTHS = 6;   // exactly 6 calendar months

// Parse date safely in LOCAL time. "YYYY-MM-DD" → Date(y, m-1, d) at local midnight
function parseDateLocal(x) {
  if (!x) return null;
  if (x instanceof Date) {
    if (Number.isNaN(x.getTime())) return null;
    return new Date(x.getFullYear(), x.getMonth(), x.getDate());
  }
  if (typeof x === "string") {
    const s = x.trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  try {
    const d = new Date(x);
    return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  } catch {
    return null;
  }
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Add N calendar months; clamp day (e.g. Aug 31 + 6 = end of Feb)
function addMonths(d, months) {
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const target = new Date(y, m + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return startOfDay(target);
}

// Backend field pickers (confirmed names)
function pickDor(row) {
  return row?.dor ?? null;
}
function pickRetentionUntil(row) {
  return row?.retention_until ?? null;
}

// Core status calc
export function getRetentionStatus(row, now = new Date()) {
  const now0 = startOfDay(now);

  const dor = parseDateLocal(pickDor(row));
  if (!dor) {
    return { status: "in-service", daysPast: 0, retirementDate: null, retentionUntil: null };
  }

  const until = parseDateLocal(pickRetentionUntil(row)) || addMonths(dor, RETENTION_MONTHS);
  const diffDays = Math.floor((now0 - dor) / DAY);

  if (now0 < dor) {
    return { status: "in-service", daysPast: diffDays, retirementDate: dor, retentionUntil: until };
  }
  if (now0 <= until) {
    return { status: "retention", daysPast: diffDays, retirementDate: dor, retentionUntil: until };
  }
  return { status: "unauthorized", daysPast: diffDays, retirementDate: dor, retentionUntil: until };
}

// Helper: annotate each row with status (for tables/cards)
export function withRetention(row, now = new Date()) {
  const r = getRetentionStatus(row, now);
  return { ...row, _retention: r };
}

// Helper: compute buckets for dashboard widgets
export function computeRetentionBuckets(rows, now = new Date()) {
  const init = { inService: 0, retention: 0, unauthorized: 0 };
  return (Array.isArray(rows) ? rows : []).reduce((acc, row) => {
    const { status } = getRetentionStatus(row, now);
    if (status === "in-service") acc.inService += 1;
    else if (status === "retention") acc.retention += 1;
    else acc.unauthorized += 1;
    return acc;
  }, init);
}


/* ================
   SIMPLE PIE CHART
   ================ */
function PieChart({ title, data, size = 220, onSliceClick }) {
  const total = data.reduce((a, b) => a + (Number(b.value) || 0), 0);
  const radius = size / 2, cx = radius, cy = radius;

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

        const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

        return (
          <path
            key={i}
            d={path}
            fill={d.color}
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
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{arcs}</svg>
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
              <span style={{ width: 12, height: 12, borderRadius: 2, background: d.color, display: "inline-block" }} />
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

/* ===========
   DASHBOARD
   =========== */
const DETAIL_PAGE_SIZE = 50;

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [houses, setHouses] = useState([]);
  const [allots, setAllots] = useState([]);
  const [error, setError] = useState("");

  // drill-down & pagination for details
  const [selection, setSelection] = useState({ type: null, key: null, label: "" });
  const [detailPage, setDetailPage] = useState(0);
  const [detailRows, setDetailRows] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        // Tip: if your API supports it, fetch fewer fields here for speed.
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

  /* ---- memoized lookups (speed) ---- */
  const houseById = useMemo(
    () => new Map(houses.map(h => [h.id, h])),
    [houses]
  );

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
      const label = (h?.status ?? "unknown").toString().toLowerCase();
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map, ([label, value]) => ({
      label,
      value,
      color: STATUS_COLORS[label] || STATUS_COLORS.unknown,
    }));
  }, [houses]);

  const byType = useMemo(() => {
    const map = new Map();
    houses.forEach((h) => {
      const label = (h?.type_code ?? "Unknown").toString();
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map, ([label, value]) => ({
      label,
      value,
      color: colorForType(label),
    }));
  }, [houses]);

  const retentionTaggedAllots = useMemo(() => {
    const now = new Date();
    return allots.map((a) => ({ ...a, __retention: getRetentionStatus(a, now) }));
  }, [allots]);

  const byRetention = useMemo(() => {
    const counters = new Map([["in-service",0],["retention",0],["unauthorized",0]]);
    retentionTaggedAllots.forEach((a) => {
      const s = a.__retention?.status || "in-service";
      counters.set(s, (counters.get(s) || 0) + 1);
    });
    return Array.from(counters, ([label, value]) => ({
      label,
      value,
      color: RETENTION_COLORS[label] || "#7f7f7f",
    }));
  }, [retentionTaggedAllots]);

  /* ---- drill-down handlers ---- */
  function openDrill(type, key, label) {
    setSelection({ type, key, label });
    setDetailPage(0);

    if (type === "house-status") {
      const filt = houses.filter((h) => String(h?.status ?? "unknown").toLowerCase() === String(key).toLowerCase());
      setDetailRows(filt.map(h => ({ kind: "house", ...h })));
      return;
    }

    if (type === "house-type") {
      const filt = houses.filter((h) => String(h?.type_code ?? "Unknown") === key);
      setDetailRows(filt.map(h => ({ kind: "house", ...h })));
      return;
    }

    if (type === "retention") {
      const filt = retentionTaggedAllots.filter(a => (a.__retention?.status || "in-service") === key);
      const joined = filt.map(a => ({ kind: "allotment", ...a, __house: houseById.get(a.house_id) || null }));
      setDetailRows(joined);
      return;
    }
  }

  function clearDrill() {
    setSelection({ type: null, key: null, label: "" });
    setDetailRows([]);
    setDetailPage(0);
  }

  const pageCount = Math.max(1, Math.ceil(detailRows.length / DETAIL_PAGE_SIZE));
  const paged = useMemo(() => {
    const start = detailPage * DETAIL_PAGE_SIZE;
    return detailRows.slice(start, start + DETAIL_PAGE_SIZE);
  }, [detailRows, detailPage]);

  /* ---- quick filters ---- */
  const quickRetention = () => openDrill("retention", "retention", "All in Retention");
  const quickUnauthorized = () => openDrill("retention", "unauthorized", "Unauthorized Occupation");

  /* ---- UI ---- */
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
        <Tile label="Total Houses" value={counts.houses} onClick={clearDrill} />
        <Tile label="Occupied" value={counts.occupied} color={STATUS_COLORS.occupied} onClick={() => openDrill("house-status", "occupied", "Occupied Houses")} />
        <Tile label="Vacant" value={counts.vacant} color={STATUS_COLORS.vacant} onClick={() => openDrill("house-status", "vacant", "Vacant Houses")} />
        <Tile label="Allotments" value={allots.length} onClick={() => openDrill("retention", "in-service", "Allotments (In-Service)")} />
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
              <button className="btn" onClick={clearDrill}>Clear Selection</button>
            </div>
            <div style={{ fontSize: 12, color: "#607d8b" }}>
              Retention = retired ≤ 6 months; Unauthorized = retired &gt; 6 months.
            </div>
          </div>
        </div>
      )}

      {/* Drill-down panel with pagination (fast rendering) */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <strong style={{ fontSize: 16 }}>{selection.label || "Details"}</strong>
          {selection.type && <button className="btn" style={{ marginLeft: "auto" }} onClick={clearDrill}>Reset</button>}
        </div>

        {detailRows.length === 0 ? (
          <div style={{ color: "#607d8b" }}>Click a tile or a chart slice to see details here.</div>
        ) : (
          <>
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
                    ? paged.map((a) => {
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
                            <Td><Pill text={r.status} tone={RETENTION_COLORS[r.status]} /></Td>
                            <Td>{typeof r.daysPast === "number" && r.daysPast > 0 ? r.daysPast : 0}</Td>
                          </tr>
                        );
                      })
                    : paged.map((h) => (
                        <tr key={h.id}>
                          <Td>{safe(h.id)}</Td>
                          <Td>{safe(h.file_no)}</Td>
                          <Td>{safe(h.sector)}</Td>
                          <Td>{safe(h.street)}</Td>
                          <Td>{safe(h.qtr_no)}</Td>
                          <Td><Pill text={safe(h.type_code)} tone={colorForType(h.type_code)} /></Td>
                          <Td><Pill text={safe(h.status)} tone={STATUS_COLORS[String(h.status).toLowerCase()] || STATUS_COLORS.unknown} /></Td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center", paddingTop: 8 }}>
              <span style={{ color: "#607d8b", fontSize: 12 }}>
                Showing {detailRows.length ? detailPage * DETAIL_PAGE_SIZE + 1 : 0}
                –
                {Math.min((detailPage + 1) * DETAIL_PAGE_SIZE, detailRows.length)}
                {" of "}
                {detailRows.length}
              </span>
              <button className="btn" onClick={() => setDetailPage((p) => Math.max(0, p - 1))} disabled={detailPage === 0}>← Prev</button>
              <button className="btn" onClick={() => setDetailPage((p) => Math.min(pageCount - 1, p + 1))} disabled={detailPage >= pageCount - 1}>Next →</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ======= tiny UI bits ======= */
function Tile({ label, value, onClick, color }) {
  return (
    <div
      className="tile"
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : "default",
        borderLeft: `4px solid ${color || "#90a4ae"}`,
      }}
    >
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
  const bg = tone || "#e0e0e0";
  const color = "#111";
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, background: bg, color, fontSize: 12, lineHeight: "18px" }}>
      {String(text || "-")}
    </span>
  );
}

/* ======= helpers ======= */
const safe = (x) => (x === null || x === undefined || String(x).trim() === "" ? "-" : x);
const fmtDate = (d) => {
  try {
    const dt = d instanceof Date ? d : new Date(d);
    return dt.toISOString().slice(0, 10);
  } catch { return "-"; }
};
const formatHouse = (h) =>
  [h?.sector, h?.street ? `St-${h.street}` : null, h?.qtr_no ? `Qtr-${h.qtr_no}` : null]
    .filter(Boolean)
    .join(" / ");
