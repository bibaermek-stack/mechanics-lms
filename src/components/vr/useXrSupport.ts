"use client";

// What this device can actually do, asked of the browser rather than guessed
// from the user agent. The answer decides which entry buttons are worth showing
// and what the page tells the student to expect.

import { useEffect, useState } from "react";

export type XrSupport = {
  /** Still asking the browser. */
  checking: boolean;
  /** navigator.xr exists at all (needs a secure context). */
  hasWebXR: boolean;
  /** An immersive headset session is available. */
  vr: boolean;
  /** A pass-through / camera session is available (Quest, Android phones). */
  ar: boolean;
  /** Set when the page is not on https, which is what usually blocks WebXR. */
  insecure: boolean;
};

const INITIAL: XrSupport = {
  checking: true,
  hasWebXR: false,
  vr: false,
  ar: false,
  insecure: false,
};

export function useXrSupport(): XrSupport {
  const [support, setSupport] = useState<XrSupport>(INITIAL);

  useEffect(() => {
    let alive = true;
    const nav = navigator as Navigator & {
      xr?: { isSessionSupported: (mode: string) => Promise<boolean> };
    };

    if (!nav.xr) {
      setSupport({
        checking: false,
        hasWebXR: false,
        vr: false,
        ar: false,
        insecure: !window.isSecureContext,
      });
      return;
    }

    Promise.all([
      nav.xr.isSessionSupported("immersive-vr").catch(() => false),
      nav.xr.isSessionSupported("immersive-ar").catch(() => false),
    ]).then(([vr, ar]) => {
      if (!alive) return;
      setSupport({ checking: false, hasWebXR: true, vr, ar, insecure: !window.isSecureContext });
    });

    return () => {
      alive = false;
    };
  }, []);

  return support;
}
