"use client";

// What the class gets wrong, and how sure it was.
//
// Built from each student's FIRST prediction on an item — what they believed before
// the measurement told them (src/lib/misconceptions.ts). A confident wrong answer is
// the number to watch: a guess that missed is a gap, a certainty that missed is a
// misconception, and the harder of the two to move.

import { useEffect, useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/Skeleton";
import { useAuthStore } from "@/lib/authStore";
import { getPredictions } from "@/lib/dataStore";
import { downloadCsv } from "@/lib/csv";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { listLinks, partitionLinks } from "@/lib/supabase/links";
import {
  calibration,
  firstAttempts,
  itemStats,
  misconceptionStats,
  predictionRows,
  type ItemStat,
  type MisconceptionStat,
} from "@/lib/misconceptions";
import { MISCONCEPTIONS, PREDICT_ITEMS } from "@/data/predictions";
import type { PredictionAttempt } from "@/lib/types";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

export default function MisconceptionsPage() {
  return (
    <DashboardShell role="teacher">
      <Body />
    </DashboardShell>
  );
}

function Body() {
  const user = useAuthStore((s) => s.user);
  const [rows, setRows] = useState<PredictionAttempt[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [students, setStudents] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [preds, links] = await Promise.all([getPredictions(), listLinks(user)]);
        if (cancelled) return;
        const mine = partitionLinks(links).accepted;
        setNames(Object.fromEntries(mine.map((l) => [l.person.id, l.person.fullName])));
        setStudents(mine.length);
        setRows(preds);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Деректер жүктелмеді");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const firsts = useMemo(() => (rows ? firstAttempts(rows) : []), [rows]);
  const items = useMemo(() => (rows ? itemStats(rows, PREDICT_ITEMS) : []), [rows]);
  const mis = useMemo(() => (rows ? misconceptionStats(rows) : []), [rows]);
  const cal = useMemo(() => (rows ? calibration(rows) : null), [rows]);
  const participants = new Set(firsts.map((r) => r.userId)).size;
  const right = firsts.filter((r) => r.correct).length;
  const confidentWrong = firsts.filter((r) => !r.correct && r.confidence === 3).length;

  if (error) return <p role="alert" className="text-rose-300">{error}</p>;
  if (rows === null) {
    return (
      <div className="space-y-4">
        <SectionHeader as="h1" title="Қате түсініктер" />
        <LoadingBlock label="Болжамдар жүктелуде…" lines={4} />
      </div>
    );
  }

  const misColumns: Column<MisconceptionStat>[] = [
    {
      key: "title",
      header: "Түсінік",
      render: (m) => (
        <div>
          <span className="font-medium">{MISCONCEPTIONS[m.id]?.title ?? m.id}</span>
          <p className="text-micro text-slate-500 dark:text-slate-400">{m.items.length} болжамда</p>
        </div>
      ),
    },
    { key: "students", header: "Студент", numeric: true, render: (m) => `${m.students}${participants ? ` (${pct(m.students / participants)})` : ""}` },
    { key: "confident", header: "Сенімді", numeric: true, render: (m) => m.confident },
  ];

  const itemColumns: Column<ItemStat>[] = [
    {
      key: "item",
      header: "Болжам",
      render: (s) => {
        const it = PREDICT_ITEMS.find((i) => i.id === s.itemId)!;
        return (
          <div>
            <span className="text-sm font-medium">{it.title}</span>
            <p className="text-micro text-slate-500 dark:text-slate-400">
              {it.lesson}-сабақ{s.topWrong?.misconception ? ` · жиі қате: ${MISCONCEPTIONS[s.topWrong.misconception]?.title}` : ""}
            </p>
          </div>
        );
      },
    },
    { key: "n", header: "Қатысты", numeric: true, render: (s) => s.n },
    { key: "ok", header: "Дұрыс", numeric: true, render: (s) => pct(s.correctShare) },
    { key: "cw", header: "Сенімді қате", numeric: true, render: (s) => s.confidentWrong },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title="Қате түсініктер"
        description="Студенттер эксперимент нәтижесін көрмес бұрын не болжағанын көрсетеді. Тек бірінші болжам есептеледі — қайталау жауапты білгеннен кейін жасалады."
        action={
          firsts.length > 0 ? (
            <button onClick={() => downloadCsv("bolzhamdar", predictionRows(rows, names))} className="btn-secondary px-4 py-2 text-sm">
              <FileDown size={16} /> CSV жүктеу
            </button>
          ) : undefined
        }
      />

      {!isSupabaseConfigured && (
        <p className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm text-slate-800 dark:text-slate-100" role="note">
          Демо режим: тек осы браузерде жасалған болжамдар көрсетіледі — бұл студенттер тобы емес.
        </p>
      )}

      {firsts.length === 0 ? (
        <EmptyState
          title="Әлі болжам жоқ"
          hint="Студент сабақтың «Болжам» табын немесе «Болжам» бетін ашып, бірінші болжамын жасағанда, нәтиже осында шығады."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Қатысқан студент" value={students ? `${participants}/${students}` : String(participants)} context="кемінде бір болжам" tone="brand" />
            <StatCard label="Бірінші болжам" value={String(firsts.length)} context="барлық студенттер, барлық болжам" tone="brand" />
            <StatCard label="Дұрыс болжам" value={pct(right / firsts.length)} context="бірінші рет" tone="emerald" />
            <StatCard label="Сенімді қате" value={String(confidentWrong)} context="«Сенімдімін» деп қателескен" tone="amber" />
          </div>

          <section className="space-y-3" aria-labelledby="mis-title">
            <h2 id="mis-title" className="text-h3">Ең көп таралған қате түсініктер</h2>
            {mis.length === 0 ? (
              <p className="text-body text-slate-600 dark:text-slate-400">Әзірге қателер жоқ — барлық бірінші болжам дұрыс.</p>
            ) : (
              <DataTable columns={misColumns} rows={mis} rowKey={(m) => m.id} />
            )}
          </section>

          {cal && (
            <Card className="space-y-2">
              <h2 className="text-h3">Сенім мен дәлдік</h2>
              <p className="text-micro text-slate-500 dark:text-slate-400">Жақсы бағдарланған студентте дәлдік «Білмеймін»-нен «Сенімдімін»-ге қарай өседі.</p>
              <ul className="grid grid-cols-3 gap-3 text-center">
                {([1, 2, 3] as const).map((l) => (
                  <li key={l} className="rounded-xl bg-slate-100 p-3 dark:bg-white/5">
                    <p className="text-micro text-slate-500 dark:text-slate-400">{["Білмеймін", "Шамамен", "Сенімдімін"][l - 1]}</p>
                    <p className="data-num text-h3 text-slate-900 dark:text-white">{pct(cal.accuracy[l])}</p>
                    <p className="data-num text-micro text-slate-500 dark:text-slate-400">{cal.n[l]} болжам</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <section className="space-y-3" aria-labelledby="items-title">
            <h2 id="items-title" className="text-h3">Әр болжам бойынша</h2>
            <DataTable columns={itemColumns} rows={items.filter((s) => s.n > 0)} rowKey={(s) => s.itemId} />
          </section>
        </>
      )}
    </div>
  );
}
