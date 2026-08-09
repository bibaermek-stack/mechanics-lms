"use client";

// The inbox and the outbox.
//
// A request is only actionable by the side that did not send it, so the two
// lists take different buttons: accept/decline on the way in, withdraw on the
// way out. Both are driven by the same `awaitingMe` flag the data layer sets.

import { useState } from "react";
import { Check, X, Undo2 } from "lucide-react";
import type { TeacherLink } from "@/lib/types";
import { removeLink, respondToRequest } from "@/lib/supabase/links";
import { PersonRow } from "./PersonRow";

function when(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "бүгін";
  if (days === 1) return "кеше";
  return `${days} күн бұрын`;
}

export function IncomingRequests({
  links,
  onChanged,
  emptyText,
}: {
  links: TeacherLink[];
  onChanged: () => void;
  emptyText: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function respond(id: string, accept: boolean) {
    setBusy(id);
    try {
      await respondToRequest(id, accept);
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  if (links.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300/60 p-6 text-center text-label text-slate-500 dark:border-white/10 dark:text-slate-400">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {links.map((l) => (
        <PersonRow
          key={l.id}
          person={l.person}
          subtitle={
            <>
              {l.person.studyGroup ? `${l.person.studyGroup} · ` : ""}
              <span className="data-num">{l.person.userCode}</span> · {when(l.createdAt)}
              {l.message ? ` · «${l.message}»` : ""}
            </>
          }
        >
          <button
            onClick={() => respond(l.id, true)}
            disabled={busy === l.id}
            className="btn-primary px-3 py-1.5 text-sm disabled:opacity-60"
          >
            <Check size={14} /> Қабылдау
          </button>
          <button
            onClick={() => respond(l.id, false)}
            disabled={busy === l.id}
            className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-60"
            aria-label={`${l.person.fullName} сұранысын қабылдамау`}
          >
            <X size={14} /> Бас тарту
          </button>
        </PersonRow>
      ))}
    </ul>
  );
}

export function OutgoingRequests({
  links,
  onChanged,
  emptyText,
}: {
  links: TeacherLink[];
  onChanged: () => void;
  emptyText: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function withdraw(id: string) {
    setBusy(id);
    try {
      await removeLink(id);
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  if (links.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300/60 p-6 text-center text-label text-slate-500 dark:border-white/10 dark:text-slate-400">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {links.map((l) => (
        <PersonRow
          key={l.id}
          person={l.person}
          subtitle={
            <>
              <span className="data-num">{l.person.userCode}</span> · {when(l.createdAt)} жіберілді ·
              жауап күтілуде
            </>
          }
        >
          <button
            onClick={() => withdraw(l.id)}
            disabled={busy === l.id}
            className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-60"
          >
            <Undo2 size={14} /> Қайтарып алу
          </button>
        </PersonRow>
      ))}
    </ul>
  );
}
