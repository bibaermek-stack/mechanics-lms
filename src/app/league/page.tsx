"use client";

// The weekly league: group against group.
//
// Scored on taking part, not on marks (src/lib/league.ts), so the page can show
// every classmate's week without showing anyone's results. Groups are ranked on
// the mean of their members, quiet members included.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Crown, Flag, Info } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/Skeleton";
import { useAuthStore } from "@/lib/authStore";
import { loadLeagueWeek } from "@/lib/leagueData";
import {
  DAY_CAP,
  LEAGUE_POINTS,
  MIN_GROUP_SIZE,
  champions,
  groupStandings,
  individualStandings,
  myShare,
  shiftWeek,
  weekLabel,
  weekStartOf,
  type GroupStanding,
  type LeagueMember,
  type RankedMember,
} from "@/lib/league";

/** Kazakh number format: a decimal comma, and no ",0" on whole numbers. */
const num = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace(".", ","));

export default function LeaguePage() {
  const user = useAuthStore((s) => s.user);
  const [now] = useState(() => new Date());
  const thisWeek = useMemo(() => weekStartOf(now), [now]);
  const lastWeek = useMemo(() => shiftWeek(thisWeek, -1), [thisWeek]);
  const [current, setCurrent] = useState<LeagueMember[] | null>(null);
  const [previous, setPrevious] = useState<LeagueMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([loadLeagueWeek(user, thisWeek), loadLeagueWeek(user, lastWeek)])
      .then(([a, b]) => {
        if (cancelled) return;
        setCurrent(a);
        setPrevious(b);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Лига жүктелмеді"));
    return () => {
      cancelled = true;
    };
  }, [user, thisWeek, lastWeek]);

  const groups = useMemo(() => (current ? groupStandings(current) : []), [current]);
  const people = useMemo(() => (current ? individualStandings(current) : []), [current]);
  const lastChampions = useMemo(() => (previous ? champions(groupStandings(previous)) : []), [previous]);
  const me = current?.find((m) => m.isMe) ?? null;
  const share = current ? myShare(current) : 0;
  const alone = current !== null && current.length <= 1;
  const daysLeft = 7 - Math.floor((now.getTime() - thisWeek.getTime()) / 86_400_000);

  const groupColumns: Column<GroupStanding>[] = [
    {
      key: "rank",
      header: "Орын",
      width: "72px",
      render: (g) => (
        <span className={g.rank === 1 ? "data-num text-data-sm text-amber-500" : "data-num text-slate-500 dark:text-slate-400"}>
          {g.rank ?? "—"}
        </span>
      ),
    },
    {
      key: "group",
      header: "Топ",
      render: (g) => (
        <div>
          <span className="font-medium">
            {g.name}
            {g.hasMe && <span className="ml-2 rounded-full bg-brand-500/15 px-2 py-0.5 text-micro text-brand-600 dark:text-brand-300">менің тобым</span>}
          </span>
          {g.rank === null && (
            <p className="text-micro text-slate-500 dark:text-slate-400">Рейтингке кемінде {MIN_GROUP_SIZE} студент керек</p>
          )}
          <p className="text-micro text-slate-500 dark:text-slate-400">
            Қатысты: {g.active}/{g.members}
            {g.top && ` · үздік: ${g.top.fullName} (${g.top.points})`}
          </p>
        </div>
      ),
    },
    { key: "mean", header: "Орташа", numeric: true, render: (g) => num(g.mean) },
  ];

  const personColumns: Column<RankedMember>[] = [
    { key: "rank", header: "Орын", width: "72px", render: (m) => <span className="data-num text-slate-500 dark:text-slate-400">{m.rank}</span> },
    {
      key: "name",
      header: "Студент",
      render: (m) => (
        <div>
          <span>{m.fullName}</span>
          <p className="text-micro text-slate-500 dark:text-slate-400">
            {m.group ? `${m.group} · ` : ""}
            {m.activeDays}/7 күн
          </p>
        </div>
      ),
    },
    { key: "points", header: "Ұпай", numeric: true, render: (m) => m.points },
  ];

  return (
    <DashboardShell>
      <div className="space-y-6">
        <SectionHeader
          as="h1"
          title="Топтар лигасы"
          description={`${weekLabel(thisWeek)} · аптаның аяғына ${daysLeft} күн қалды. Топтар қатысу бойынша жарысады: баға емес, оқу белсенділігі есептеледі.`}
        />

        {error && (
          <p role="alert" className="text-label text-rose-300">
            {error}
          </p>
        )}

        {current === null && !error ? (
          <LoadingBlock lines={5} />
        ) : alone ? (
          <EmptyState
            title="Лига әлі құралмаған"
            hint="Лига бір оқытушыға қосылған студенттерден жиналады. Оқытушыңызды тауып, қосылу сұранысын жіберіңіз."
            href="/connections"
            cta="Оқытушы табу"
          />
        ) : (
          <>
            {lastChampions.length > 0 && (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-400/50 bg-amber-500/10 px-4 py-3" role="status">
                <Crown className="shrink-0 text-amber-500" size={22} aria-hidden />
                <p className="text-sm text-slate-800 dark:text-slate-100">
                  <strong>Өткен апта чемпионы:</strong> {lastChampions.map((g) => g.name).join(" және ")} (орташа{" "}
                  <span className="data-num">{num(lastChampions[0].mean)}</span> ұпай)
                </p>
              </div>
            )}

            {me && (
              <Card className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-micro text-slate-500 dark:text-slate-400">Менің ұпайым</p>
                  <p className="data-num text-h2 text-slate-900 dark:text-white">{me.points}</p>
                </div>
                <div>
                  <p className="text-micro text-slate-500 dark:text-slate-400">Белсенді күн</p>
                  <p className="data-num text-h2 text-slate-900 dark:text-white">{me.activeDays} / 7</p>
                </div>
                <div>
                  <p className="text-micro text-slate-500 dark:text-slate-400">Тобымдағы үлесім</p>
                  <p className="data-num text-h2 text-slate-900 dark:text-white">{me.group ? `${Math.round(share * 100)}%` : "—"}</p>
                </div>
              </Card>
            )}

            <section className="space-y-3" aria-labelledby="league-groups">
              <h2 id="league-groups" className="flex items-center gap-2 text-h3">
                <Flag size={18} aria-hidden /> Топтар
              </h2>
              {groups.length === 0 ? (
                <EmptyState
                  compact
                  title="Топтар көрсетілмеген"
                  hint="Лига студенттің тіркелгенде көрсеткен тобы бойынша құралады. Топ көрсетілмесе, студент тек жеке кестеде шығады."
                />
              ) : (
                <DataTable columns={groupColumns} rows={groups} rowKey={(g) => g.name} highlight={(g) => g.hasMe} />
              )}
            </section>

            <section className="space-y-3" aria-labelledby="league-people">
              <h2 id="league-people" className="text-h3">
                Студенттер
              </h2>
              <DataTable columns={personColumns} rows={people} rowKey={(m) => m.userId} highlight={(m) => m.isMe} />
            </section>

            <details className="rounded-2xl border border-slate-200/70 p-4 text-sm text-slate-700 dark:border-white/10 dark:text-slate-300">
              <summary className="flex cursor-pointer items-center gap-2 font-medium">
                <Info size={16} aria-hidden /> Ұпай қалай есептеледі?
              </summary>
              <ul className="mt-3 list-inside list-disc space-y-1">
                <li>Викторина — {LEAGUE_POINTS.quiz}, ойын — {LEAGUE_POINTS.game}, күнделікті сынақ — {LEAGUE_POINTS.daily}, БӨЖ жіберу — {LEAGUE_POINTS.submission}, құзыреттілікті бағалау — {LEAGUE_POINTS.assessment}, диагностика — {LEAGUE_POINTS.diagnostic}.</li>
                <li>Ұпай нәтижеге байланысты емес: бастаушы да, үздік те топқа бірдей үлес қосады.</li>
                <li>Бір күнде ең көбі {DAY_CAP} ұпай — сондықтан бір кеште ойнап жеңуге болмайды, апта бойы жүйелі оқу керек.</li>
                <li>Топтың көрсеткіші — мүшелерінің орташа ұпайы (қатыспағандар да есептеледі), сондықтан шағын топ та жеңе алады.</li>
                <li>Аптаның басы — дүйсенбі 00:00 (өз уақытыңыз бойынша).</li>
              </ul>
              <p className="mt-3">
                Тұрақты қатысу сериясы туралы — <Link href="/daily" className="text-brand-600 underline dark:text-brand-300">Күнделікті сынақ</Link>.
              </p>
            </details>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
