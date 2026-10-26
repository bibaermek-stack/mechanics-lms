"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Registers the service worker (public/sw.js) and tells the user when the
 * connection drops.
 *
 * Registration is production-only. In `next dev` a service worker caches the
 * very chunks hot-reload is trying to replace, and the confusion that causes —
 * edits that do not show up — is far worse than not testing offline in dev.
 */
export function PwaSupport() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      const register = () => {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
          // Private browsing or a blocked worker: the site works the same, just online-only.
        });
      };
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }

    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4"
    >
      <p className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-400/40 bg-slate-900/95 px-4 py-2 text-micro font-medium text-amber-100 shadow-float backdrop-blur">
        <WifiOff size={14} aria-hidden /> Интернет жоқ — сақталған беттер ғана көрсетіледі
      </p>
    </div>
  );
}
