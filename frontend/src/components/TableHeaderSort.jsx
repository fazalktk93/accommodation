import React from 'react';

export default function TableHeaderSort({ label, sortKey, activeSort, activeOrder, onChange }) {
  const isActive = activeSort === sortKey;
  const nextOrder = isActive && activeOrder === 'asc' ? 'desc' : 'asc';
  return (
    <button
      type="button"
      onClick={() => onChange(sortKey, nextOrder)}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontWeight: isActive ? 700 : 500
      }}
      aria-label={`Sort by ${label} ${isActive ? `(${activeOrder})` : ''}`}
      title={`Sort by ${label}`}
    >
      {label}{' '}
      {isActive ? (activeOrder === 'asc' ? '▲' : '▼') : '⇅'}
    </button>
  );
}
