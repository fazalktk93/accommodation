// frontend/src/components/Modal.jsx
import React, { useEffect, useRef } from "react";

/**
 * Accessible lightweight modal using <dialog>
 * Fallbacks to a div if <dialog> isn't supported.
 */
export default function Modal({ open, title, onClose, children, actions }) {
  const ref = useRef(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "open");
      const onCancel = (e) => {
        e.preventDefault();
        onClose?.();
      };
      dlg.addEventListener("cancel", onCancel);
      return () => dlg.removeEventListener("cancel", onCancel);
    } else {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog ref={ref} className="modal">
      <form method="dialog" className="modal__surface" onSubmit={(e)=>e.preventDefault()}>
        <header className="modal__header">
          <strong className="modal__title">{title}</strong>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="modal__content">{children}</div>
        {actions && <footer className="modal__footer">{actions}</footer>}
      </form>
    </dialog>
  );
}
