import { useEffect, useMemo, useState } from "react";
import { listHouses, listAllotments } from "../api";

/** ---------- Tiny SVG PieChart (no dependencies) ---------- */
function colorFor(label) {
  const s = String(label || '').toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const sat = 65; // %
  const light = 55; // %
  return `hsl(${hue} ${sat}% ${light}%)`;
}

function PieChart({ title, data, size = 220, onSliceClick }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;

  let acc = 0;
  const arcs = data.map((d) => {
    const start = (acc / total) * Math.PI * 2;
    acc += d.value;
    const end = (acc / total) * Math.PI * 2;

    // convert polar to cartesian
    const sx = cx + r * Math.cos(start - Math.PI / 2);
    const sy = cy + r * Math.sin(start - Math.PI / 2);
    const ex = cx + r * Math.cos(end - Math.PI / 2);
    const ey = cy + r * Math.sin(end - Math.PI / 2);
    const large = end - start > Math.PI ? 1 : 0;

    const path = `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z`;
    return { ...d, path };
  });

  return (
    <div className="card chart-card">
      <div className="card-title">{title}</div>
      <div className="chart-wrap">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
          <circle cx={cx} cy={cy} r={r} fill="var(--surface-2, #f2f4f7)" />
          {arcs.map((a, i) => (
            <path
              key={i}
              d={a.path}
              fill={a.color}
              className="chart-slice"
              onClick={() => onSliceClick?.(a)}
            >
              <title>{`${a.label}: ${a.value}`}</title>
            </path>
          ))}
        </svg>
        <div className="legend">
          {data.map((d, i) => (
            <button
              type="button"
              key={i}
              className="legend-item"
              onClick={() => onSliceClick?.(d)}
              title="Filter by this slice"
            >
              <span className="dot" style={{ background: d.color }} />
              <span>{d.label}</span>
              <span className="count">{d.value}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** ---------- helpers ---------- */
function toYMD(val) {
  if (!val) return "";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
function isOnOrAfterToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d.getTime() >= today.getTime();
}

/** ---------- Dashboard page ---------- */
export default function Dashboard() {
  const [houses, setHouses] = useState([]);
  const [allotments, setAllotments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(null); // {kind: 'houses'|'allot', field: 'status'|'type_code'|'medium', valueKey: 'occupied'...}

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setError("");
        setLoading(true);
        const [h, a] = await Promise.all([
          listHouses(), // expects GET /api/houses/
          listAllotments({ active: "true" }), // active allotments for medium/retention
        ]);
        if (!alive) return;
        setHouses(Array.isArray(h) ? h : h?.data ?? []);
        setAllotments(Array.isArray(a) ? a : a?.data ?? []);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load dashboard");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ----- Tiles: base totals -----
  const totals = useMemo(() => {
    const total = houses.length;
    const occupied = houses.filter((h) => (h.status || "").toLowerCase() === "occupied").length;
    const vacant = houses.filter((h) => {
      const s = (h.status || "").toLowerCase();
      return s === "vacant" || s === "available";
    }).length;
    const other = Math.max(total - occupied - vacant, 0);
    return { total, occupied, vacant, other };
  }, [houses]);

  // ----- Additional tiles you requested -----
  const extraCounts = useMemo(() => {
    const issuesInRecord = houses.filter((h) => (h.status || "").toLowerCase() === "issue_in_record").length;
    const missing = houses.filter((h) => (h.status || "").toLowerCase() === "missing").length;
    const onRetention = allotments.filter((a) => isOnOrAfterToday(a.retention_last)).length;
    const transit = allotments.filter((a) => (a.medium || "").trim().toLowerCase() === "transit").length;
    return { issuesInRecord, missing, onRetention, transit };
  }, [houses, allotments]);

  // ----- Pie: Quarter status -----
  const qtrData = useMemo(() => {
    const buckets = { Occupied: 0, Vacant: 0, Other: 0 };
    houses.forEach((h) => {
      const s = (h.status || "").toLowerCase();
      if (s === "occupied") buckets.Occupied++;
      else if (s === "vacant" || s === "available") buckets.Vacant++;
      else buckets.Other++;
    });
    return [
      { label: "Occupied", value: buckets.Occupied, color: colorFor("Occupied"), kind: "houses", field: "status", valueKey: "occupied" },
      { label: "Vacant", value: buckets.Vacant, color: colorFor("Vacant"),   kind: "houses", field: "status", valueKey: "vacant" },
      { label: "Other", value: buckets.Other, color: colorFor("Other"),      kind: "houses", field: "status", valueKey: "other" },
    ]
  }, [houses]);
color: colorFor(k)
  // ----- Pie: House Type (A–H + Other) -----
  const typeData = useMemo(() => {
    const counts = {};
    houses.forEach((h) => {
      const t = (h.type_code || "").toUpperCase();
      const label = /^[A-H]$/.test(t) ? t : "Other";
      counts[label] = (counts[label] || 0) + 1;
    });
    const palette = ["#845ef7", "#339af0", "#22b8cf", "#12b886", "#82c91e", "#fab005", "#ff922b", "#ff6b6b", "#adb5bd"];
    const keys = Object.keys(counts).sort();
    return keys.map((k, i) => ({
      label: k,
      value: counts[k],
      color: palette[i % palette.length],
      kind: "houses",
      field: "type_code",
      valueKey: k,
    }));
  }, [houses]);

  // ----- Pie: Allotment Medium (active only) -----
  const mediumData = useMemo(() => {
    const counts = {};
    allotments.forEach((a) => {
      const m = (a.medium || "").trim().toLowerCase();
      const norm = m || "unspecified";
      counts[norm] = (counts[norm] || 0) + 1;
    });
    const palette = ["#5b8def", "#2bb673", "#ffb020", "#ef6c5b", "#9f7aea", "#00bcd4", "#78909c"];
    return Object.keys(counts)
      .sort()
      .map((k, i) => ({
        label: k.replace(/^./, (c) => c.toUpperCase()),
        value: counts[k],
        color: palette[i % palette.length],
        kind: "allot",
        field: "medium",
        valueKey: k,
      }));
  }, [allotments]);

  // ----- Records filtered by clicked slice -----
  const filtered = useMemo(() => {
    if (!filter) return null;
    if (filter.kind === "houses") {
      if (filter.field === "status") {
        const val = filter.valueKey;
        return houses.filter((h) => {
          const s = (h.status || "").toLowerCase();
          if (val === "occupied") return s === "occupied";
          if (val === "vacant") return s === "vacant" || s === "available";
          return s !== "occupied" && s !== "vacant" && s !== "available";
        });
      }
      if (filter.field === "type_code") {
        return houses.filter((h) => {
          const t = (h.type_code || "").toUpperCase();
          return /^[A-H]$/.test(filter.valueKey) ? t === filter.valueKey : !/^[A-H]$/.test(t);
        });
      }
    } else if (filter.kind === "allot") {
      const want = (filter.valueKey || "").toLowerCase();
      return allotments.filter((a) => (a.medium || "").toLowerCase() === want);
    }
    return null;
  }, [filter, houses, allotments]);

  return (
    <div className="dashboard" style={{ padding: 16 }}>
      <h2>Dashboard</h2>

      {error && (
        <div className="error" style={{ color: "crimson", marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 24 }}>Loading…</div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="tile-row" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
            <div className="tile card" style={{ padding: 12 }}>
              <div className="tile-label">Total Houses</div>
              <div className="tile-value" style={{ fontSize: 24, fontWeight: 600 }}>{totals.total}</div>
            </div>
            <div className="tile card" style={{ padding: 12 }}>
              <div className="tile-label">Occupied</div>
              <div className="tile-value" style={{ fontSize: 24, fontWeight: 600 }}>{totals.occupied}</div>
            </div>
            <div className="tile card" style={{ padding: 12 }}>
              <div className="tile-label">Vacant/Available</div>
              <div className="tile-value" style={{ fontSize: 24, fontWeight: 600 }}>{totals.vacant}</div>
            </div>
            <div className="tile card" style={{ padding: 12 }}>
              <div className="tile-label">Other</div>
              <div className="tile-value" style={{ fontSize: 24, fontWeight: 600 }}>{totals.other}</div>
            </div>
          </div>

          {/* Requested tiles: Issues/Missing/Retention/Transit */}
          <div className="tile-row" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginTop: 12 }}>
            <div className="tile card" style={{ padding: 12 }}>
              <div className="tile-label">Issues in Record</div>
              <div className="tile-value" style={{ fontSize: 24, fontWeight: 600 }}>{extraCounts.issuesInRecord}</div>
            </div>
            <div className="tile card" style={{ padding: 12 }}>
              <div className="tile-label">Missing Files</div>
              <div className="tile-value" style={{ fontSize: 24, fontWeight: 600 }}>{extraCounts.missing}</div>
            </div>
            <div className="tile card" style={{ padding: 12 }}>
              <div className="tile-label">On Retention</div>
              <div className="tile-value" style={{ fontSize: 24, fontWeight: 600 }}>{extraCounts.onRetention}</div>
            </div>
            <div className="tile card" style={{ padding: 12 }}>
              <div className="tile-label">Transit (Active)</div>
              <div className="tile-value" style={{ fontSize: 24, fontWeight: 600 }}>{extraCounts.transit}</div>
            </div>
          </div>

          {/* Charts */}
          <div className="charts-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, marginTop: 16 }}>
            <PieChart
              title="Quarter Status"
              data={qtrData}
              onSliceClick={(slice) => setFilter({ kind: slice.kind, field: slice.field, value: slice.label, valueKey: slice.valueKey })}
            />
            <PieChart
              title="House Type (A–H, Other)"
              data={typeData}
              onSliceClick={(slice) => setFilter({ kind: slice.kind, field: slice.field, value: slice.label, valueKey: slice.valueKey })}
            />
            <PieChart
              title="Allotment Medium (Active)"
              data={mediumData}
              onSliceClick={(slice) => setFilter({ kind: slice.kind, field: slice.field, value: slice.label, valueKey: slice.valueKey })}
            />
          </div>

          {/* Filtered results */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title" style={{ padding: "12px 12px 0 12px" }}>
              {filter ? (
                <div className="filter-bar">
                  <strong>Filtered by:</strong>&nbsp;
                  <code>{filter.kind === "houses" ? "Houses" : "Allotments"} → {filter.field} = {filter.value}</code>
                  <button className="link-btn" style={{ marginLeft: 8 }} onClick={() => setFilter(null)}>
                    Clear
                  </button>
                </div>
              ) : (
                "Click a chart slice to view records"
              )}
            </div>

            {filter && filter.kind === "houses" && (
              <div className="table-wrap" style={{ padding: 12 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th><th>File No</th><th>Qtr No</th><th>Street</th><th>Sector</th><th>Type</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered && filtered.map((h) => (
                      <tr key={h.id}>
                        <td>{h.id}</td>
                        <td>{h.file_no}</td>
                        <td>{h.qtr_no}</td>
                        <td>{h.street}</td>
                        <td>{h.sector}</td>
                        <td>{h.type_code}</td>
                        <td>{h.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {filter && filter.kind === "allot" && (
              <div className="table-wrap" style={{ padding: 12 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>House File</th><th>Qtr</th><th>Allottee</th><th>Medium</th><th>Allotment</th><th>Occupation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered && filtered.map((a) => (
                      <tr key={a.id}>
                        <td>{a.house_file_no ?? "-"}</td>
                        <td>{a.house_qtr_no ?? "-"}</td>
                        <td>{a.person_name}</td>
                        <td>{a.medium || "-"}</td>
                        <td>{toYMD(a.allotment_date) || "-"}</td>
                        <td>{toYMD(a.occupation_date) || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
