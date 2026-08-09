"use client";

// Student side of the graph: find your teacher, answer their invitations, see
// who you are currently attached to.

import { useState } from "react";
import { Copy, Check, UserMinus } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { useAuthStore } from "@/lib/authStore";
import { PeopleSearch } from "@/components/connections/PeopleSearch";
import { IncomingRequests, OutgoingRequests } from "@/components/connections/RequestLists";
import { PersonRow } from "@/components/connections/PersonRow";
import { useLinks } from "@/components/connections/useLinks";
import { removeLink } from "@/lib/supabase/links";

/** The code is the thing a student reads out when a teacher asks for it. */
function MyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="flex items-center gap-2 rounded-xl border border-slate-200/70 px-3 py-2 text-sm hover:border-brand-400 dark:border-white/10"
      aria-label="Менің кодымды көшіру"
    >
      <span className="data-num font-semibold text-slate-900 dark:text-white">{code}</span>
      {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} className="text-slate-400" />}
    </button>
  );
}

export default function ConnectionsPage() {
  const user = useAuthStore((s) => s.user);
  const { accepted, incoming, outgoing, loading, error, reload } = useLinks(user);
  const [removing, setRemoving] = useState<string | null>(null);

  async function detach(id: string) {
    setRemoving(id);
    try {
      await removeLink(id);
      await reload();
    } finally {
      setRemoving(null);
    }
  }

  return (
    <DashboardShell role="student">
      <div className="space-y-6">
        <SectionHeader
          as="h1"
          title="Менің оқытушым"
          description="Оқытушыңызды тауып, қосылу сұранысын жіберіңіз. Оқытушы да сізге шақыру жібере алады."
          action={user?.userCode ? <MyCode code={user.userCode} /> : undefined}
        />

        {error && (
          <p role="alert" className="text-label text-rose-300">
            {error}
          </p>
        )}

        {/* Requests that need this student's answer come first. */}
        {incoming.length > 0 && (
          <section className="glass glass-lit rounded-3xl2 p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-h3 text-slate-900 dark:text-white">Кіріс шақырулар</h2>
              <Badge variant="warning" marker={String(incoming.length)}>
                жауап күтуде
              </Badge>
            </div>
            <IncomingRequests
              links={incoming}
              onChanged={reload}
              emptyText="Шақыру жоқ."
            />
          </section>
        )}

        <section className="glass glass-lit rounded-3xl2 p-5 sm:p-6">
          <h2 className="text-h3 text-slate-900 dark:text-white">Қосылған оқытушылар</h2>
          <div className="mt-4">
            {loading ? (
              <div className="h-20 rounded-2xl bg-slate-200/40 dark:bg-white/5" aria-busy="true" />
            ) : accepted.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300/60 p-6 text-center text-label text-slate-500 dark:border-white/10 dark:text-slate-400">
                Әзірге оқытушыға қосылмағансыз. Төменнен іздеп, сұраныс жіберіңіз.
              </p>
            ) : (
              <ul className="space-y-2">
                {accepted.map((l) => (
                  <PersonRow key={l.id} person={l.person}>
                    <Badge variant="success">Қосылған</Badge>
                    <button
                      onClick={() => detach(l.id)}
                      disabled={removing === l.id}
                      className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-60"
                    >
                      <UserMinus size={14} /> Ажырату
                    </button>
                  </PersonRow>
                ))}
              </ul>
            )}
          </div>
        </section>

        {outgoing.length > 0 && (
          <section className="glass glass-lit rounded-3xl2 p-5 sm:p-6">
            <h2 className="text-h3 text-slate-900 dark:text-white">Жіберілген сұраныстар</h2>
            <div className="mt-4">
              <OutgoingRequests links={outgoing} onChanged={reload} emptyText="Сұраныс жоқ." />
            </div>
          </section>
        )}

        {user && <PeopleSearch me={user} wantRole="teacher" onChanged={reload} />}
      </div>
    </DashboardShell>
  );
}
