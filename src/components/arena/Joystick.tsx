"use client";

// An analogue thumb stick, in place of four arrow buttons.
//
// Four buttons can only ask for eight directions and always at full power, and
// on a phone the diagonals mean landing a thumb on the seam between two pads.
// A stick gives every direction and every magnitude, which the physics already
// understood: `step()` normalises the drive only when |input| > 1, so a
// half-deflected stick has always meant half the force. It just had no way to
// say so.

import { useCallback, useRef, useState } from "react";
import clsx from "clsx";

/** Radius of the ring the thumb moves in, px. Full deflection at the edge. */
const RADIUS = 52;
/** Below this the stick reads as centred, so a resting thumb does not drift. */
const DEADZONE = 0.14;

export interface JoystickProps {
  /** Called with a vector in the unit disc; (0, 0) on release. */
  onMove: (dx: number, dy: number) => void;
  className?: string;
}

export function Joystick({ onMove, className }: JoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = useCallback(
    (clientX: number, clientY: number) => {
      const el = baseRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = (clientX - cx) / RADIUS;
      let dy = (clientY - cy) / RADIUS;

      // Clamp to the unit disc rather than the square: pushing into a corner
      // must not be faster than pushing along an axis.
      const mag = Math.hypot(dx, dy);
      if (mag > 1) {
        dx /= mag;
        dy /= mag;
      }
      // The knob follows the finger even inside the dead zone, so the control
      // looks alive while it is deliberately reporting nothing.
      setKnob({ x: dx * RADIUS, y: dy * RADIUS });
      if (mag < DEADZONE) onMove(0, 0);
      else onMove(dx, dy);
    },
    [onMove]
  );

  const release = useCallback(() => {
    pointerRef.current = null;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  }, [onMove]);

  return (
    <div
      ref={baseRef}
      // touch-none stops the browser treating the drag as a page scroll, which
      // would otherwise steal the gesture halfway through a run.
      className={clsx(
        "relative touch-none select-none rounded-full border border-white/20 bg-slate-900/55 backdrop-blur",
        className
      )}
      style={{ width: RADIUS * 2 + 24, height: RADIUS * 2 + 24 }}
      onPointerDown={(e) => {
        // One finger owns the stick; a second thumb belongs to the buttons.
        if (pointerRef.current !== null) return;
        pointerRef.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (pointerRef.current !== e.pointerId) return;
        update(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (pointerRef.current === e.pointerId) release();
      }}
      onPointerCancel={(e) => {
        if (pointerRef.current === e.pointerId) release();
      }}
      // A finger that slides off the element keeps capture, but a lost capture
      // must still zero the input or the player runs into a wall for ever.
      onLostPointerCapture={release}
      aria-label="Қозғалыс тұтқасы"
      role="application"
    >
      {/* The travel ring, so the edge of full deflection is visible. */}
      <span
        className="pointer-events-none absolute rounded-full border border-white/10"
        style={{ inset: 12 }}
      />
      <span
        className="pointer-events-none absolute left-1/2 top-1/2 rounded-full bg-white/85 shadow-lg transition-transform duration-75"
        style={{
          width: 46,
          height: 46,
          marginLeft: -23,
          marginTop: -23,
          transform: `translate(${knob.x}px, ${knob.y}px)`,
        }}
      />
    </div>
  );
}

export default Joystick;
