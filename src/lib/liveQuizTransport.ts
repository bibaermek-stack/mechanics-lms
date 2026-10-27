"use client";

// The two real wires. Without Supabase, a BroadcastChannel carries the quiz between tabs of
// ONE browser — enough to try it out and to run it from a single computer. With Supabase,
// Realtime Broadcast carries it between devices, which is what a classroom needs.
//
// Nothing is stored: no table, no record. A room exists while the teacher's page is open.
// The channel is as private as its six-digit code; a mischievous student could join a room
// or guess a code, which costs a quiz that grades nothing a moment of annoyance — and the
// host ignores everything but joins and answers, so nobody can pose as the teacher to it.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabase/client";
import type { Msg, Transport } from "./liveQuiz";

export class BroadcastChannelTransport implements Transport {
  private readonly channel: BroadcastChannel;
  constructor(code: string) {
    this.channel = new BroadcastChannel(`live-quiz-${code}`);
  }
  send(msg: Msg) {
    this.channel.postMessage(msg);
  }
  subscribe(cb: (msg: Msg) => void) {
    const handler = (e: MessageEvent) => cb(e.data as Msg);
    this.channel.addEventListener("message", handler);
    return () => this.channel.removeEventListener("message", handler);
  }
  close() {
    this.channel.close();
  }
}

export class SupabaseTransport implements Transport {
  private readonly channel: ReturnType<SupabaseClient["channel"]>;
  private readonly listeners = new Set<(msg: Msg) => void>();
  private ready = false;
  private queue: Msg[] = [];

  constructor(private readonly client: SupabaseClient, code: string) {
    this.channel = client.channel(`live-quiz-${code}`, { config: { broadcast: { self: false } } });
    this.channel
      .on("broadcast", { event: "msg" }, ({ payload }) => {
        for (const cb of this.listeners) cb(payload as Msg);
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        this.ready = true;
        for (const m of this.queue.splice(0)) this.push(m);
      });
  }
  private push(msg: Msg) {
    void this.channel.send({ type: "broadcast", event: "msg", payload: msg });
  }
  send(msg: Msg) {
    if (this.ready) this.push(msg);
    else this.queue.push(msg);
  }
  subscribe(cb: (msg: Msg) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  close() {
    this.listeners.clear();
    void this.client.removeChannel(this.channel);
  }
}

/** True when two devices can take part: the demo's wire only joins tabs of one browser. */
export const liveAcrossDevices = isSupabaseConfigured && supabase !== null;

export function createTransport(code: string): Transport {
  if (isSupabaseConfigured && supabase) return new SupabaseTransport(supabase, code);
  if (typeof BroadcastChannel === "undefined") throw new Error("Бұл браузер тікелей викторинаны қолдамайды.");
  return new BroadcastChannelTransport(code);
}
