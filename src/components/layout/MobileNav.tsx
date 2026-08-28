"use client";

// The phone drawer.
//
// The rail is `hidden md:flex`, and the hamburger beside it had no handler — so
// on a phone the platform had no navigation at all: whatever page you landed on
// was the only one you could reach. This is that handler's other half.
//
// It renders <NavLinks> rather than its own copy of the list, so a route added
// to the rail cannot go missing here.

import { useEffect } from "react";
import { X } from "lucide-react";
import { NavBrand, NavLinks } from "./Sidebar";

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Escape closes it, and the page behind must not scroll while it is open —
  // on iOS a scrolling backdrop under a drawer feels like a broken app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        aria-label="Мәзірді жабу"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />
      <nav
        aria-label="Негізгі мәзір"
        className="absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col gap-0.5 overflow-y-auto border-r border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between">
          <NavBrand />
          <button
            onClick={onClose}
            aria-label="Жабу"
            className="mt-1 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>
        {/* Closing on navigation: without it the drawer would stay over the
            page it just took you to. */}
        <NavLinks onNavigate={onClose} />
      </nav>
    </div>
  );
}

export default MobileNav;
