"use client";

// Find somebody you are not linked to yet and send them a request.
//
// Three ways in, because people know each other by different handles: the
// shareable code (STU-7K3M2A), the full name, or the exact email. The code is
// listed first in the hint because it is the only one that is unambiguous —
// two students really can share a name.

import { useState } from "react";
import { Search, Send, Check, Clock } from "lucide-react";
import type { AppUser, PersonSummary, UserRole } from "@/lib/types";
import { searchPeople, sendLinkRequest } from "@/lib/supabase/links";
import { sendFriendRequest } from "@/lib/supabase/friends";
import { PersonRow } from "./PersonRow";
import { Badge } from "@/components/ui/Badge";

export function PeopleSearch({
  me,
  wantRole,
  onChanged,
  /**
   * "teacher" opens a teaching link, "friend" opens a friendship. Both search
   * the same directory; only the edge that gets written differs.
   */
  kind = "teacher",
  title,
  hint,
}: {
  me: AppUser;
  /** Which side you are looking for. */
  wantRole: UserRole;
  /** Called after a request is sent so the parent can refresh its lists. */
  onChanged: () => void;
  kind?: "teacher" | "friend";
  title?: string;
  hint?: string;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<PersonSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (term.trim().length < 2) {
      setError("Кемінде 2 таңба енгізіңіз.");
      return;
    }
    setBusy(true);
    try {
      setResults(await searchPeople(term, wantRole));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Іздеу сәтсіз аяқталды");
    } finally {
      setBusy(false);
    }
  }

  async function send(person: PersonSummary) {
    setSending(person.id);
    setError(null);
    try {
      if (kind === "friend") await sendFriendRequest(me, person);
      else await sendLinkRequest(me, person);
      // Reflect it locally so the button changes without a second round trip.
      setResults((rs) =>
        rs?.map((r) =>
          r.id === person.id ? { ...r, linkStatus: "pending", requestedBy: me.uid } : r
        ) ?? rs
      );
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Жіберу сәтсіз аяқталды");
    } finally {
      setSending(null);
    }
  }

  const noun = wantRole === "teacher" ? "оқытушы" : "студент";

  return (
    <section className="glass glass-lit rounded-3xl2 p-5 sm:p-6">
      <h2 className="text-h3 text-slate-900 dark:text-white">
        {title ?? (wantRole === "teacher" ? "Оқытушы табу" : "Студент табу")}
      </h2>
      <p className="mt-1 text-label text-slate-600 dark:text-slate-400">
        {hint ??
          `Коды бойынша (мыс. ${
            wantRole === "teacher" ? "TCH-A7K2M9" : "STU-A7K2M9"
          }), аты-жөні немесе толық email арқылы іздеңіз.`}
      </p>

      <form onSubmit={run} className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={`Код, аты-жөні немесе email`}
            aria-label={`${noun} іздеу`}
            className="input-glow w-full pl-10"
          />
        </div>
        <button type="submit" disabled={busy} className="btn-primary shrink-0 disabled:opacity-60">
          {busy ? "Ізделуде…" : "Іздеу"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-label text-rose-300">
          {error}
        </p>
      )}

      {results && (
        <div className="mt-5">
          {results.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300/60 p-6 text-center text-label text-slate-500 dark:border-white/10 dark:text-slate-400">
              «{term}» бойынша {noun} табылмады. Кодты немесе жазылуын тексеріңіз.
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map((p) => (
                <PersonRow key={p.id} person={p}>
                  {p.linkStatus === "accepted" ? (
                    <Badge variant="success">
                      <Check size={13} /> {kind === "friend" ? "Дос" : "Қосылған"}
                    </Badge>
                  ) : p.linkStatus === "pending" ? (
                    <Badge variant="warning">
                      <Clock size={13} />
                      {p.requestedBy === me.uid ? "Жіберілді" : "Сізден жауап күтуде"}
                    </Badge>
                  ) : (
                    <button
                      onClick={() => send(p)}
                      disabled={sending === p.id}
                      className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-60"
                    >
                      <Send size={14} />
                      {sending === p.id
                        ? "Жіберілуде…"
                        : kind === "friend"
                          ? "Дос ретінде қосу"
                          : "Сұраныс жіберу"}
                    </button>
                  )}
                </PersonRow>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
