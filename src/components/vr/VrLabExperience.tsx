"use client";

// One VR/AR experiment, with everything around it.
//
// The same controls exist twice on purpose: as sliders on the page and as 3D
// buttons on the console inside the room. A student at a desk should not have
// to put a headset on, and a student wearing one should not have to take it off
// to change a mass. Both write to the same state here.

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  Clock,
  Gauge,
  Headset,
  Pause,
  Play,
  RotateCcw,
  Smartphone,
  Monitor,
} from "lucide-react";
import clsx from "clsx";
import { LiveChart } from "@/components/simulation/core/LiveChart";
import { SimLayout } from "@/components/simulation/core/SimLayout";
import { Panel, Readout, Slider, fmt } from "@/components/simulation/core/ui";
import { PASCO } from "@/components/simulation/core/pascoCatalog";
import type { Sample } from "@/components/simulation/core/useSimEngine";
import { defaultParams } from "@/lib/vr/experiments";
import type { VrExperiment } from "@/lib/vr/types";
import { VrScene } from "./VrScene";
import { useXrSupport } from "./useXrSupport";

const SPEEDS = [0.25, 0.5, 1, 2];
const MAX_SAMPLES = 600;

export function VrLabExperience({ experiment }: { experiment: VrExperiment }) {
  const [params, setParams] = useState<Record<string, number>>(() => defaultParams(experiment));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [epoch, setEpoch] = useState(0);
  const [readings, setReadings] = useState<Record<string, number>>({});
  const [series, setSeries] = useState<Sample[]>([]);
  const seriesRef = useRef<Sample[]>([]);
  const support = useXrSupport();

  const restart = useCallback(() => {
    seriesRef.current = [];
    setSeries([]);
    setReadings({});
    setEpoch((e) => e + 1);
  }, []);

  const setParam = useCallback(
    (key: string, value: number) => {
      setParams((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
      // Changing a parameter invalidates the run that is on the chart, exactly
      // as it does in the desktop simulations.
      restart();
    },
    [restart]
  );

  const handleReadings = useCallback((values: Record<string, number>, t: number) => {
    setReadings(values);
    const next = [...seriesRef.current, { t, ...values }];
    if (next.length > MAX_SAMPLES) next.splice(0, next.length - MAX_SAMPLES);
    seriesRef.current = next;
    setSeries(next);
  }, []);

  const handleAction = useCallback(
    (action: string) => {
      if (action === "toggle") {
        setPlaying((p) => !p);
        return;
      }
      if (action === "reset") {
        setPlaying(false);
        restart();
        return;
      }
      const match = /^param:([^:]+):([+-])$/.exec(action);
      if (!match) return;
      const [, key, sign] = match;
      const spec = experiment.params.find((p) => p.key === key);
      if (!spec) return;
      setParams((prev) => {
        const step = spec.step * (sign === "+" ? 1 : -1);
        const raw = (prev[key] ?? spec.value) + step;
        const clamped = Math.min(spec.max, Math.max(spec.min, Number(raw.toFixed(6))));
        return prev[key] === clamped ? prev : { ...prev, [key]: clamped };
      });
      restart();
    },
    [experiment.params, restart]
  );

  const handleFinished = useCallback(() => setPlaying(false), []);

  const readoutItems = useMemo(
    () =>
      experiment.readouts.map((r) => ({
        label: r.label,
        value: fmt(readings[r.key] ?? 0, r.decimals),
        unit: r.unit,
        tone: toneFor(r.key),
      })),
    [experiment.readouts, readings]
  );

  return (
    <div className="space-y-5">
      {/* Header ----------------------------------------------------------- */}
      <div className="rounded-xl2 border border-slate-800 bg-slate-900 p-5 text-white sm:p-6">
        <Link
          href="/vr-lab"
          className="mb-3 inline-flex items-center gap-1.5 text-micro text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={13} /> VR/AR зертханаға оралу
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-label uppercase text-brand-300">VR/AR зертханалық орта</span>
          <span className="data-num flex items-center gap-1 text-micro text-slate-400">
            <Clock size={12} /> ≈{experiment.minutes} мин
          </span>
          <span className="data-num text-micro text-slate-400">
            {experiment.labIds.map((id) => `№${id}`).join(", ")} зертханалық жұмыс ·{" "}
            {experiment.lessonId}-сабақ
          </span>
        </div>
        <h1 className="mt-1.5 text-h2 sm:text-h1">{experiment.title}</h1>
        <p className="mt-2 max-w-3xl text-body text-slate-300">{experiment.subtitle}</p>
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
          {experiment.devices.map((key) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-micro font-medium text-slate-200"
            >
              <Boxes size={11} className="text-brand-300" />
              {PASCO[key].label}
            </span>
          ))}
        </div>
      </div>

      <XrBanner support={support} />

      <SimLayout
        goal={experiment.goal}
        formulas={experiment.formulas}
        pasco={experiment.devices.map((k) => PASCO[k])}
        built={experiment.built}
        tasks={experiment.tasks}
        stage={
          <VrScene
            experiment={experiment}
            playing={playing}
            speed={speed}
            params={params}
            epoch={epoch}
            onReadings={handleReadings}
            onAction={handleAction}
            onFinished={handleFinished}
          />
        }
        controls={
          <>
            <Panel title="Басқару">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPlaying((p) => !p)}
                    className={clsx(
                      "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors",
                      playing ? "bg-slate-700 hover:bg-slate-800" : "bg-brand-500 hover:bg-brand-600"
                    )}
                  >
                    {playing ? <Pause size={15} /> : <Play size={15} />}
                    {playing ? "Кідірту" : "Бастау"}
                  </button>
                  <button
                    onClick={() => {
                      setPlaying(false);
                      restart();
                    }}
                    title="Қайта бастау"
                    aria-label="Қайта бастау"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white/80 p-2.5 text-slate-600 transition-colors hover:bg-slate-50 hover:text-brand-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-slate-100/80 p-1 dark:bg-white/5">
                  <Gauge size={13} className="ml-1.5 mr-0.5 shrink-0 text-slate-500" />
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={clsx(
                        "flex-1 rounded-lg px-2 py-1 text-xs font-semibold transition-colors",
                        speed === s
                          ? "bg-white text-brand-600 shadow-sm dark:bg-brand-500 dark:text-white"
                          : "text-slate-500 hover:bg-white/70 dark:text-slate-400 dark:hover:bg-white/10"
                      )}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="Параметрлер">
              <div className="space-y-4">
                {experiment.params.map((p) => (
                  <Slider
                    key={p.key}
                    label={p.label}
                    unit={p.unit}
                    value={params[p.key] ?? p.value}
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    decimals={p.decimals}
                    hint={p.hint}
                    onChange={(v) => setParam(p.key, v)}
                  />
                ))}
                <p className="text-[10px] leading-snug text-slate-500">
                  Гарнитурадағы үстел пультінде де осы параметрлердің «−» және «+»
                  батырмалары бар — көзілдірікті шешудің қажеті жоқ.
                </p>
              </div>
            </Panel>
          </>
        }
        data={
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Panel title="Өлшеу нәтижелері">
              <Readout items={readoutItems} />
            </Panel>
            <Panel title="Графиктер">
              <LiveChart
                series={series}
                lines={experiment.chart.map((c) => ({
                  key: c.key,
                  label: c.label,
                  color: c.color,
                }))}
                yLabel={experiment.chart.map((c) => c.label).join(" / ")}
              />
              <p className="mt-2 text-[10px] leading-snug text-slate-500">
                Дәл осы график зертхананың ішінде, үстелдің арт жағындағы экранда да
                салынады.
              </p>
            </Panel>
          </div>
        }
      />
    </div>
  );
}

function toneFor(key: string): "brand" | "amber" | "emerald" | "rose" | "slate" {
  if (key === "v" || key === "Ek" || key === "omega") return "emerald";
  if (key === "a" || key === "Tmeasured") return "amber";
  if (key === "T" || key === "Q") return "rose";
  if (key === "x" || key === "theta" || key === "Ep") return "brand";
  return "slate";
}

/** Tells the student, in one line, what this device will actually give them. */
function XrBanner({ support }: { support: ReturnType<typeof useXrSupport> }) {
  if (support.checking) return null;

  const items = [
    {
      icon: Headset,
      ok: support.vr,
      title: "VR режимі",
      text: support.vr
        ? "Гарнитура қосылған — оң жақ төмендегі батырма арқылы зертханаға кіріңіз."
        : support.insecure
          ? "WebXR тек https арқылы ашылған бетте жұмыс істейді. Мазмұн экранда толық қолжетімді."
          : "Бұл құрылғыда иммерсивті VR қолжетімсіз. Мазмұн экранда толық жұмыс істейді.",
    },
    {
      icon: Smartphone,
      ok: support.ar,
      title: "AR режимі",
      text: support.ar
        ? "Зертхананы нақты үстеліңізге қойып көріңіз: AR батырмасын басып, бетті түртіңіз."
        : support.hasWebXR
          ? "Бұл құрылғының браузері WebXR-ді біледі, бірақ AR сессиясын аша алмайды."
          : "AR үшін Android телефондағы Chrome немесе Quest браузері қажет.",
    },
    {
      icon: Monitor,
      ok: true,
      title: "Кәдімгі экран",
      text: "Тінтуірмен айналдырыңыз, W/A/S/D пернелерімен жүріңіз, батырмаларды шертіңіз.",
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div
            key={it.title}
            className={clsx(
              "flex gap-2.5 rounded-xl border p-3",
              it.ok
                ? "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-900/15"
                : "border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-white/[0.03]"
            )}
          >
            <Icon
              size={16}
              className={clsx(
                "mt-0.5 shrink-0",
                it.ok ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
              )}
            />
            <div className="min-w-0">
              <p className="text-label font-semibold text-slate-800 dark:text-slate-100">
                {it.title}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                {it.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default VrLabExperience;
