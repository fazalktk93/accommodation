// frontend/src/pages/FileMovement.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api'; // your axios wrapper

const asList = (d) => (Array.isArray(d) ? d : (d?.results ?? []));
const isBlank = (s) => !String(s || '').trim();

export default function FileMovement() {
  // form state
  const [fileNoInput, setFileNoInput] = useState('');
  const [houseOptions, setHouseOptions] = useState([]);
  const [selectedHouse, setSelectedHouse] = useState(null);

  const [subject, setSubject] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  const [department, setDepartment] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [remarks, setRemarks] = useState('');

  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState('');

  // list below the form (your existing table)
  const [rows, setRows] = useState([]);

  // --- helpers
  const canIssue = useMemo(() => {
    // gatekeeping: a house MUST be chosen, and basic fields not empty
    if (!selectedHouse) return false;
    if (isBlank(issuedTo)) return false;
    // you can add more required fields here if needed:
    // if (isBlank(subject)) return false;
    return true;
  }, [selectedHouse, issuedTo /*, subject */]);

  async function loadIssues() {
    try {
      const r = await api.get('/file-movements/'); // adjust to your list endpoint
      setRows(asList(r.data));
    } catch (e) {
      // non-blocking
    }
  }

  useEffect(() => { loadIssues(); }, []);

  // --- search houses by file number (prefer exact matches, but show options)
  async function searchHousesByFileNo(q) {
    setSelectedHouse(null);
    setHouseOptions([]);
    if (isBlank(q)) return;

    try {
      // try exact route first, if your backend has it
      const exact = await api.get(`/houses/by-file/${encodeURIComponent(q)}`).catch(() => null);
      if (exact?.data) {
        setHouseOptions([exact.data]);
        return;
      }

      // fallback to list search
      const r = await api.get('/houses/', { params: { q } });
      const list = asList(r.data)
        .filter(h => String(h.file_no).toLowerCase().includes(String(q).toLowerCase()));
      setHouseOptions(list);
    } catch (e) {
      setHouseOptions([]);
    }
  }

  // prevent “auto-submit” – this button will never submit the form by default
  async function handleIssueClick() {
    setError('');
    // client-side validation
    if (!selectedHouse) {
      setError('Please pick a house for this file number.');
      return;
    }
    if (isBlank(issuedTo)) {
      setError('Please fill “Issued To”.');
      return;
    }

    // build payload (uses file_no; include house_id if your backend needs it)
    const payload = {
      file_no: selectedHouse.file_no,
      house_id: selectedHouse.id, // harmless if backend ignores; useful if it needs it
      subject: subject || null,
      issued_to: issuedTo,
      department: department || null,
      due_date: dueDate || null,
      remarks: remarks || null,
      status: 'issued',
    };

    try {
      setIssuing(true);
      await api.post('/file-movements/', payload); // adjust to your create endpoint
      // reset inputs except fileNo (keep it so you can issue another related item)
      setSubject('');
      setIssuedTo('');
      setDepartment('');
      setDueDate('');
      setRemarks('');
      await loadIssues();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Failed to issue');
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div>
      <h2>File Movement</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Issue File</h3>

        {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}

        {/* not a <form> submit; explicit controlled Issue button */}
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {/* File No + House confirmation */}
          <div style={{ gridColumn: '1 / span 3' }}>
            <label>File No</label>
            <input
              placeholder="e.g. ABC-123"
              value={fileNoInput}
              onChange={(e) => setFileNoInput(e.target.value)}
              onBlur={(e) => searchHousesByFileNo(e.target.value)}
            />
            {/* show a confirm dropdown once we have options */}
            {houseOptions.length > 0 && (
              <select
                style={{ marginTop: 8, width: '100%' }}
                value={selectedHouse?.id || ''}
                onChange={(e) => {
                  const h = houseOptions.find(x => String(x.id) === e.target.value);
                  setSelectedHouse(h || null);
                }}
              >
                <option value="">— Select house for this file —</option>
                {houseOptions.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.file_no} — Qtr {h.qtr_no}, Street {h.street}, Sector {h.sector}, Type {h.type_code}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label>Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div>
            <label>Issued To</label>
            <input value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} />
          </div>

          <div>
            <label>Department</label>
            <input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>

          <div>
            <label>Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div style={{ gridColumn: '1 / span 3' }}>
            <label>Remarks</label>
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>

          <div style={{ gridColumn: '1 / span 3' }}>
            <button
              type="button"
              onClick={handleIssueClick}
              disabled={!canIssue || issuing}
              style={{ opacity: (!canIssue || issuing) ? 0.6 : 1 }}
            >
              {issuing ? 'Issuing…' : 'Issue File'}
            </button>
          </div>
        </div>
      </div>

      {/* Issued list (unchanged; hook to your existing table) */}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th><th>File No</th><th>Issued To</th><th>Issue Date</th><th>Due</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.file_no}</td>
                <td>{r.issued_to || '-'}</td>
                <td>{r.issue_date || '-'}</td>
                <td>{r.due_date || '-'}</td>
                <td>{r.status || '-'}</td>
                <td>
                  {/* your existing Mark In-Record button */}
                  <button type="button" onClick={async () => {
                    try {
                      await api.post(`/file-movements/${r.id}/mark-in`);
                      await loadIssues();
                    } catch (e) {}
                  }}>
                    Mark In-Record
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 12, color: '#777' }}>No records.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
