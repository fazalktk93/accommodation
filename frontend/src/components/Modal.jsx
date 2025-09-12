// src/components/Modal.jsx
import React, { useEffect } from "react";

export default function Modal({ open, title, onClose, children, maxWidth = 640 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      aria-modal
      role="dialog"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "100%",
          maxWidth,
          boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 16, flex: 1 }}>{title}</div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "#f7f7f7",
              border: "1px solid #e1e1e1",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              color: "#111",
            }}
          >
            Close
          </button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  );
}
