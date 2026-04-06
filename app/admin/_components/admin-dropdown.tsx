"use client";

import { useEffect, useRef, useState } from "react";

type AdminDropdownProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align: "left" | "right";
};

export function AdminDropdown({ trigger, children, align }: AdminDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="admin-topbar-menu relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((prev) => !prev)}
        className="btn-secondary list-none cursor-pointer admin-topbar-button"
      >
        {trigger}
      </button>
      {open ? (
        <div className="admin-menu-surface" role="menu" style={{ [align === "right" ? "right" : "left"]: 0 }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
