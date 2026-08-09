"use client";

// Teacher side of the graph.
//
// The roster is no longer a fixed cohort constant: it is whoever has actually
// been accepted into this teacher's group. Progress columns are joined in from
// the analytics dataset by student id, and any student without a row there
// shows dashes rather than inventing numbers.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Check, UserMinus } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ALL_MODULES } from "@/data/modules";
import { COHORT, studentAverage, studentProgress, type StudentRow } from "@/data/cohort";
import { useAuthStore } from "@/lib/authStore";
import { useLinks } from "@/components/connections/useLinks";
import { PeopleSearch } from "@/components/connections/PeopleSearch";
import { IncomingRequests, OutgoingRequests } from "@/components/connections/RequestLists";
import { removeLink } from "@/lib/supabase/links";
import type { TeacherLink } from "@/lib/types";

/** One row of the roster: the link plus whatever analytics we hold for them. */
interface RosterRow {
  link: TeacherLink;
  stats: StudentRow | null;
}

/** Same rule the analytics recommendations use, so the two pages never disagree. */
function status(r: RosterRow) {
  if (!r.stats) return { label: "Деректер жоқ", variant: "neutral" as const };
  const p = studentProgress(r.stats);
  const a = studentAverage(r.stats);
  if (p < 50 && a < 65) return { label: "Қауіп тобы", variant: "danger" as const };
  if (r.stats.daysSinceActive >= 7) return { label: "Белсенді емес", variant: "warning" as const };
  return { label: "Белсенді", variant: "success" as const };
}

function TeacherCode({ code }: { code: string }) {
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
      title="Студенттер осы код арқылы сізді табады"
    >
      <span className="data-num font-semibold text-slate-900 dark:text-white">{code}</span>
      {copied ? (
        <Check size={15} className="text-emerald-400" />
      ) : (
        <Copy size={15} className="text-slate-400" />
      )}
    </button>
  );
}

type Tab = "roster" | "requests" | "search";

export default function TeacherStudentsPage() {
  const user = useAuthStore((s) => s.user);
  const { accepted, incoming, outgoing, loading, error, reload } = useLinks(user);
  const [tab, setTab] = useState<Tab>("roster");
  const [removing, setRemoving] = useState<string | null>(null);

  const roster: RosterRow[] = useMemo(
    () =>
      accepted.map((link) => ({
        link,
        stats: COHORT.find((c) => c.id === link.person.id) ?? null,
      })),
    [accepted]
  );

  const withStats = roster.filter((r) => r.stats);
  const atRisk = roster.filter((r) => status(r).label === "Қауіп тобы").length;
  const inactive = roster.filter((r) => status(r).label === "Белсенді емес").length;
  const avgProgress = withStats.length
    ? Math.round(withStats.reduce((s, r) => s + studentProgress(r.stats!), 0) / withStats.length)
    : 0;

  async function detach(id: string) {
    setRemoving(id);
    try {
      await removeLink(id);
      await reload();
    } finally {
      setRemoving(null);
    }
  }

  const columns: Column<RosterRow>[] = [
    { key: "name", header: "Студент", render: (r) => r.link.person.fullName },
    {
      key: "code",
      header: "Код",
      width: "110px",
      render: (r) => <span className="data-num text-slate-500">{r.link.person.userCode}</span>,
    },
    {
      key: "group",
      header: "Топ",
      width: "80px",
      render: (r) => r.link.person.studyGroup ?? "—",
    },
    {
      key: "progress",
      header: "Прогресс",
      width: "180px",
      render: (r) =>
        r.stats ? (
          <ProgressBar
            value={studentProgress(r.stats)}
            segments={ALL_MODULES.length}
            tone={studentProgress(r.stats) < 50 ? "amber" : "emerald"}
          />
        ) : (
          <span className="text-slate-500">—</span>
        ),
    },
    {
      key: "avg",
      header: "Орташа ұпай",
      numeric: true,
      render: (r) => (r.stats ? `${studentAverage(r.stats)}%` : "—"),
    },
    {
      key: "ungraded",
      header: "Тексерілмеген",
      numeric: true,
      render: (r) => (r.stats && r.stats.ungraded > 0 ? r.stats.ungraded : "—"),
    },
    {
      key: "active",
      header: "Соңғы кіру",
      numeric: true,
      render: (r) =>
        r.stats
          ? r.stats.daysSinceActive === 0
            ? "бүгін"
            : `${r.stats.daysSinceActive} күн`
          : "—",
    },
    {
      key: "status",
      header: "Мәртебе",
      width: "150px",
      render: (r) => {
        const s = status(r);
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      render: (r) => (
        <button
          onClick={() => detach(r.link.id)}
          disabled={removing === r.link.id}
          className="btn-ghost text-slate-400 hover:text-rose-300 disabled:opacity-50"
          aria-label={`${r.link.person.fullName} — топтан шығару`}
          title="Топтан шығару"
        >
          <UserMinus size={16} />
        </button>
      ),
    },
  ];

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "roster", label: "Менің студенттерім", count: accepted.length },
    { id: "requests", label: "Сұраныстар", count: incoming.length + outgoing.length },
    { id: "search", label: "Студент іздеу" },
  ];

  return (
    <DashboardShell role="teacher">
      <div className="space-y-6">
        <SectionHeader
          as="h1"
          title="Студенттерді басқару"
          description="Қабылданған студенттеріңіз, кіріс сұраныстар және жаңа студент іздеу."
          action={
            <div className="flex items-center gap-2">
              {user?.userCode && <TeacherCode code={user.userCode} />}
              <Link href="/teacher/analytics" className="btn-secondary px-4 py-2 text-sm">
                Аналитика
              </Link>
            </div>
          }
        />

        {error && (
          <p role="alert" className="text-label text-rose-300">
            {error}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Менің студенттерім" value={accepted.length} tone="brand" />
          <StatCard
            label="Жауап күтіп тұрған сұраныс"
            value={incoming.length}
            context={incoming.length ? "«Сұраныстар» бөлімінен қараңыз" : undefined}
            tone={incoming.length > 0 ? "amber" : "default"}
          />
          <StatCard
            label="Қауіп тобында"
            value={atRisk}
            context="Прогресі 50%-дан және ұпайы 65%-дан төмен"
            tone={atRisk > 0 ? "rose" : "default"}
          />
          <StatCard label="Орташа прогресс" value={avgProgress} unit="%" tone="emerald" />
        </div>

        <div
          role="tablist"
          aria-label="Студенттер бөлімдері"
          className="flex flex-wrap gap-1 rounded-2xl border border-slate-200/70 bg-slate-100/60 p-1 dark:border-white/10 dark:bg-white/5"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "bg-white text-slate-900 dark:bg-white/10 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="data-num rounded-full bg-brand-500/20 px-1.5 text-[11px] text-brand-200">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "roster" &&
          (loading ? (
            <div className="h-48 rounded-3xl2 bg-slate-200/40 dark:bg-white/5" aria-busy="true" />
          ) : roster.length === 0 ? (
            <p className="rounded-3xl2 border border-dashed border-slate-300/60 p-10 text-center text-label text-slate-500 dark:border-white/10 dark:text-slate-400">
              Әзірге сіздің тобыңызда студент жоқ. «Студент іздеу» бөлімінен шақыру жіберіңіз
              немесе кодыңызды{user?.userCode ? ` (${user.userCode})` : ""} студенттерге беріңіз.
            </p>
          ) : (
            <DataTable
              columns={columns}
              rows={roster}
              rowKey={(r) => r.link.id}
              highlight={(r) => status(r).label === "Қауіп тобы"}
            />
          ))}

        {tab === "requests" && (
          <div className="space-y-6">
            <section className="glass glass-lit rounded-3xl2 p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-h3 text-slate-900 dark:text-white">Кіріс сұраныстар</h2>
                {incoming.length > 0 && (
                  <Badge variant="warning" marker={String(incoming.length)}>
                    жауап күтуде
                  </Badge>
                )}
              </div>
              <IncomingRequests
                links={incoming}
                onChanged={reload}
                emptyText="Жаңа сұраныс жоқ. Студенттер сізді кодыңыз арқылы таба алады."
              />
            </section>

            <section className="glass glass-lit rounded-3xl2 p-5 sm:p-6">
              <h2 className="text-h3 text-slate-900 dark:text-white">Мен жіберген шақырулар</h2>
              <div className="mt-4">
                <OutgoingRequests
                  links={outgoing}
                  onChanged={reload}
                  emptyText="Жіберілген шақыру жоқ."
                />
              </div>
            </section>

            {inactive > 0 && (
              <p className="text-micro text-slate-500 dark:text-slate-400">
                Ескерту: тобыңыздағы {inactive} студент бір аптадан бері кірмеген.
              </p>
            )}
          </div>
        )}

        {tab === "search" && user && (
          <PeopleSearch me={user} wantRole="student" onChanged={reload} />
        )}
      </div>
    </DashboardShell>
  );
}
