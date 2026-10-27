"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRoom, newRoomCode, type HostState, type LiveEvent, type LiveQuestion } from "@/lib/liveQuiz";
import { HostController } from "@/lib/liveQuizRuntime";
import { createTransport } from "@/lib/liveQuizTransport";

/**
 * Opens a room and keeps it running: the teacher's page is the server, so it ticks the
 * clock four times a second and repeats the state every two seconds for phones that have
 * only just arrived. Closing the page closes the room.
 */
export function useLiveHost() {
  const ctl = useRef<HostController | null>(null);
  const [state, setState] = useState<HostState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    ctl.current?.close();
    ctl.current = null;
    setState(null);
  }, []);

  const open = useCallback(
    (questions: LiveQuestion[], timeLimitMs: number) => {
      stop();
      try {
        const code = newRoomCode();
        const c = new HostController(createTransport(code), createRoom(code, questions, timeLimitMs), Date.now, (s) => setState(s));
        ctl.current = c;
        setState(c.state);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Бөлме ашылмады");
      }
    },
    [stop]
  );

  const command = useCallback((e: LiveEvent) => ctl.current?.command(e), []);

  useEffect(() => {
    if (!state) return;
    const tick = window.setInterval(() => {
      ctl.current?.tick();
      setNow(Date.now());
    }, 250);
    const beat = window.setInterval(() => ctl.current?.broadcast(), 2000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(beat);
    };
    // the room's existence, not each of its states, decides whether the timers run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state === null]);

  useEffect(() => () => ctl.current?.close(), []);

  return { state, now, error, open, stop, command };
}
