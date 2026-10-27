"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Lock, Rocket } from "lucide-react";
import { useLessons } from "@/components/providers/LessonsProvider";
import { useEngagement } from "@/components/engagement/useEngagement";
import { computeCampaign, waitingFor, type CampaignNode } from "@/lib/campaign";
import { MASTERY_PERCENT, PASS_PERCENT } from "@/lib/engagement";
import { FINALE, chapterFor } from "@/data/campaign";

const ROW = 104; // px between two nodes
const TOP = 52;

const xOf = (i: number) => (i % 2 === 0 ? 27 : 73);
const yOf = (i: number) => TOP + i * ROW;

function StarRow({ count, size = 14 }: { count: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${count} жұлдыз 3-тен`}>
      {[1, 2, 3].map((k) => (
        <svg key={k} width={size} height={size} viewBox="0 0 24 24" aria-hidden className={k <= count ? "fill-amber-400" : "fill-slate-300 dark:fill-white/20"}>
          <path d="M12 2l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 18l-6.4 3.6L7 14.5 1.7 9.5l7.2-.9z" />
        </svg>
      ))}
    </span>
  );
}

function OneStar({ on, size = 14 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={on ? "алынды" : "әлі жоқ"} role="img" className={on ? "fill-amber-400" : "fill-slate-300 dark:fill-white/20"}>
      <path d="M12 2l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 18l-6.4 3.6L7 14.5 1.7 9.5l7.2-.9z" />
    </svg>
  );
}

const nodeClasses = (n: CampaignNode, selected: boolean) => {
  const base = "absolute grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 text-lg font-bold shadow-lg transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-400/60";
  const tone =
    n.state === "done"
      ? "border-amber-300 bg-emerald-600 text-white"
      : n.state === "open"
        ? "border-brand-400 bg-brand-500 text-white"
        : "border-slate-300 bg-slate-200 text-slate-500 dark:border-white/15 dark:bg-slate-800 dark:text-slate-400";
  return `${base} ${tone} ${selected ? "scale-110 ring-4 ring-white/70 dark:ring-white/40" : "hover:scale-105"}`;
};

/** The journey as a winding road. Each lesson is a stop; the chapter's story is told once its quiz is passed. */
export function CampaignMap() {
  const { modules } = useLessons();
  const { records } = useEngagement();
  const campaign = useMemo(() => (records ? computeCampaign(records, modules.map((m) => m.id)) : null), [records, modules]);
  const [picked, setPicked] = useState<number | null>(null);

  if (!campaign) return <p className="text-body text-slate-500 dark:text-slate-400">Жүктелуде…</p>;
  if (campaign.nodes.length === 0) return <p className="text-body text-slate-500 dark:text-slate-400">Сабақтар әлі жоқ.</p>;

  const currentNode = campaign.nodes.find((n) => n.current) ?? campaign.nodes[campaign.nodes.length - 1];
  const selected = campaign.nodes.find((n) => n.lessonId === picked) ?? currentNode;
  const height = yOf(campaign.nodes.length - 1) + TOP;
  const titleOf = (id: number) => modules.find((m) => m.id === id)?.title ?? `${id}-сабақ`;
  const chapter = chapterFor(selected.lessonId);
  const wait = waitingFor(campaign, selected);

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3" aria-label="Сапар көрсеткіштері">
        <div className="surface-card !p-4">
          <dt className="text-micro text-slate-500 dark:text-slate-400">Жұлдыз</dt>
          <dd className="data-num mt-1 text-h2 text-slate-900 dark:text-white" data-testid="map-stars">{campaign.stars} / {campaign.maxStars}</dd>
        </div>
        <div className="surface-card !p-4">
          <dt className="text-micro text-slate-500 dark:text-slate-400">Аяқталған тарау</dt>
          <dd className="data-num mt-1 text-h2 text-slate-900 dark:text-white" data-testid="map-done">{campaign.chaptersDone} / {campaign.nodes.length}</dd>
        </div>
      </dl>

      {campaign.launchReady && (
        <div role="status" className="space-y-1 rounded-2xl border border-amber-300/70 bg-amber-400/10 p-4" data-testid="finale">
          <p className="flex items-center gap-2 text-h3 text-slate-900 dark:text-white"><Rocket size={20} className="text-amber-500" aria-hidden /> {FINALE.title}</p>
          <p className="text-body text-slate-700 dark:text-slate-300">{FINALE.story}</p>
        </div>
      )}

      <div className="relative mx-auto w-full max-w-md" style={{ height }} data-testid="road">
        <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          {campaign.nodes.slice(0, -1).map((n, i) => {
            const x0 = xOf(i), y0 = yOf(i), x1 = xOf(i + 1), y1 = yOf(i + 1);
            const done = n.state === "done";
            return (
              <path
                key={n.lessonId}
                d={`M${x0} ${y0} C${x0} ${y0 + ROW * 0.55} ${x1} ${y1 - ROW * 0.55} ${x1} ${y1}`}
                fill="none"
                vectorEffect="non-scaling-stroke"
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={done ? undefined : "2 9"}
                className={done ? "stroke-amber-400" : "stroke-slate-300 dark:stroke-white/20"}
              />
            );
          })}
        </svg>

        {campaign.nodes.map((n, i) => {
          const left = xOf(i);
          const onRight = left > 50;
          return (
            <div key={n.lessonId}>
              <button
                onClick={() => setPicked(n.lessonId)}
                aria-label={`${n.chapter}-тарау: ${titleOf(n.lessonId)}${n.state === "locked" ? " (әлі жабық)" : ""}, ${n.stars} жұлдыз`}
                aria-current={selected.lessonId === n.lessonId ? "true" : undefined}
                className={nodeClasses(n, selected.lessonId === n.lessonId)}
                style={{ left: `${left}%`, top: yOf(i) }}
                data-testid={`node-${n.lessonId}`}
                data-state={n.state}
              >
                {n.state === "done" ? <Check size={24} aria-hidden /> : n.state === "locked" ? <Lock size={20} aria-hidden /> : n.chapter}
                {n.current && <Rocket size={18} aria-hidden className="absolute -right-3 -top-3 rotate-45 text-amber-400 drop-shadow motion-safe:animate-bounce" />}
              </button>
              <div
                className={`pointer-events-none absolute w-[38%] -translate-y-1/2 ${onRight ? "text-right" : "text-left"}`}
                style={{ top: yOf(i), ...(onRight ? { right: `${100 - left + 11}%` } : { left: `${left + 11}%` }) }}
              >
                <p className="line-clamp-2 text-xs font-semibold leading-tight text-slate-800 dark:text-slate-100">{titleOf(n.lessonId)}</p>
                <StarRow count={n.stars} size={13} />
              </div>
            </div>
          );
        })}
      </div>

      <section className="space-y-3 rounded-2xl border border-slate-200/70 p-4 dark:border-white/10" aria-live="polite" data-testid="chapter-panel">
        <p className="text-micro text-slate-500 dark:text-slate-400">{selected.chapter}-тарау · {titleOf(selected.lessonId)}</p>
        {selected.storyUnlocked ? (
          <>
            <h2 className="text-h3 text-slate-900 dark:text-white">{chapter.title}</h2>
            <p className="text-body text-slate-700 dark:text-slate-300">{chapter.story}</p>
            {selected.state === "done" ? (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-micro font-semibold text-amber-700 dark:text-amber-300" data-testid="badge">
                <Check size={14} aria-hidden /> Белгі: {chapter.badge}
              </p>
            ) : (
              <p className="text-body text-slate-600 dark:text-slate-400">Бұл тарау әңгімесі жалғасады: сабақтың викторинасын {PASS_PERCENT} %-дан жоғары тапсыр.</p>
            )}
          </>
        ) : selected.state === "open" ? (
          <>
            <h2 className="text-h3 text-slate-900 dark:text-white">{chapter.title}</h2>
            <p className="text-body text-slate-600 dark:text-slate-400" data-testid="open-note">
              Келесі тарау. Әңгімесі мен «{chapter.badge}» белгісі сабақтың викторинасын {PASS_PERCENT} %-дан жоғары тапсырғанда ашылады.
            </p>
          </>
        ) : (
          <p className="text-body text-slate-600 dark:text-slate-400" data-testid="locked-note">
            Бұл тараудың әңгімесі жабық: алдымен {wait}-тарауды аяқта. Сабақты бәрібір ашып оқуға болады.
          </p>
        )}

        <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
          {[
            { k: 1, text: `Викторина ≥ ${PASS_PERCENT} %`, have: selected.quizBest === null ? "әлі тапсырылмаған" : `ең жақсысы ${selected.quizBest} %` },
            { k: 2, text: `Сабақ ойынынан ≥ ${PASS_PERCENT} ұпай`, have: selected.gameBest === null ? "әлі ойналмаған" : `ең жақсысы ${selected.gameBest}` },
            { k: 3, text: `Викторина ≥ ${MASTERY_PERCENT} %`, have: selected.quizBest === null ? "—" : `ең жақсысы ${selected.quizBest} %` },
          ].map((c) => (
            <li key={c.k} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <OneStar on={selected.stars >= c.k} />
                {c.text}
              </span>
              <span className="data-num text-micro text-slate-500 dark:text-slate-400">{c.have}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          <Link href={`/modules/${selected.lessonId}`} className="btn-primary inline-flex min-h-[44px] items-center">Сабаққа өту</Link>
          <Link href={`/games?lesson=${selected.lessonId}`} className="btn-secondary inline-flex min-h-[44px] items-center">Ойындар</Link>
        </div>
      </section>
    </div>
  );
}
