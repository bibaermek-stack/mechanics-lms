"use client";

// Lesson editor.
//
// What is saved is a *difference* from the bundled lesson, not a copy of it —
// see diffPatch. A teacher who opens the form and presses save without typing
// stores an empty patch, and their students keep receiving improvements to the
// default lesson instead of a frozen snapshot of it.
//
// The 3D simulation is not in this form and cannot be. Each one is a physics
// integrator whose numbers were checked against the real PASCO experiment; it
// is course apparatus, not content.

import { useEffect, useMemo, useState } from "react";
import { Boxes, RotateCcw, Save, Check } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Skeleton";
import {
  PairListEditor,
  QuizEditor,
  StringListEditor,
  type EditableQuestion,
} from "@/components/teacher/ListEditor";
import { ALL_MODULES } from "@/data/modules";
import { useAuthStore } from "@/lib/authStore";
import { useLessons } from "@/components/providers/LessonsProvider";
import { diffPatch, patchFromModule, type LessonPatch } from "@/lib/lessonContent";
import { loadTeacherOverrides, resetOverride, saveOverride } from "@/lib/supabase/content";

type Draft = Required<LessonPatch>;

export default function TeacherLessonsPage() {
  const user = useAuthStore((s) => s.user);
  const lessons = useLessons();

  const [moduleId, setModuleId] = useState(1);
  const [overrides, setOverrides] = useState<Record<number, LessonPatch> | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** The untouched lesson — every diff and every reset is measured against it. */
  const base = useMemo(() => ALL_MODULES.find((m) => m.id === moduleId)!, [moduleId]);

  useEffect(() => {
    if (!user || user.role !== "teacher") return;
    loadTeacherOverrides(user)
      .then(setOverrides)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Өзгерістерді жүктеу мүмкін болмады");
        setOverrides({});
      });
  }, [user]);

  // Seed the form from base + this teacher's stored patch.
  useEffect(() => {
    if (overrides === null) return;
    const patch = overrides[moduleId] ?? {};
    const seeded = patchFromModule(base);
    setDraft({ ...seeded, ...patch } as Draft);
    setSaved(false);
  }, [overrides, moduleId, base]);

  const patchNow = draft ? diffPatch(base, draft) : {};
  const changedFields = Object.keys(patchNow).length;

  async function save() {
    if (!user || !draft) return;
    setBusy(true);
    setError(null);
    try {
      const patch = diffPatch(base, draft);
      await saveOverride(user, moduleId, patch);
      setOverrides((o) => ({ ...(o ?? {}), [moduleId]: patch }));
      setSaved(true);
      lessons.reload();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Сақтау сәтсіз аяқталды");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await resetOverride(user, moduleId);
      setOverrides((o) => {
        const next = { ...(o ?? {}) };
        delete next[moduleId];
        return next;
      });
      setDraft(patchFromModule(base) as Draft);
      lessons.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Қалпына келтіру сәтсіз аяқталды");
    } finally {
      setBusy(false);
    }
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <DashboardShell role="teacher">
      <div className="space-y-6">
        <SectionHeader
          as="h1"
          title="Сабақ мазмұнын өңдеу"
          description="Өзгерістеріңіз тек сіз қабылдаған студенттерге көрінеді. Түпнұсқа сабақ өзгермейді — «Қалпына келтіру» кез келген сәтте оны қайтарады."
        />

        {error && (
          <p role="alert" className="text-label text-rose-300">
            {error}
          </p>
        )}

        {/* Lesson picker */}
        <div className="flex flex-wrap gap-2">
          {ALL_MODULES.map((m) => {
            const edited = Object.keys(overrides?.[m.id] ?? {}).length > 0;
            return (
              <button
                key={m.id}
                onClick={() => setModuleId(m.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  moduleId === m.id
                    ? "bg-brand-500 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-brand-50 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                }`}
              >
                {m.id}. {m.title}
                {edited && <span className="ml-1.5 text-amber-300">•</span>}
              </button>
            );
          })}
        </div>

        {/* Simulations are apparatus, not content — say so where a teacher
            would otherwise go looking for the missing tab. */}
        <p className="flex items-start gap-2.5 rounded-2xl border border-slate-200/70 p-4 text-label text-slate-600 dark:border-white/10 dark:text-slate-400">
          <Boxes size={17} className="mt-0.5 shrink-0 text-brand-300" />
          <span>
            Бұл сабақтың <strong className="text-slate-800 dark:text-slate-200">3D
            симуляциясы</strong> өзгертілмейді және жаңасын қосу мүмкін емес. Әр симуляция —
            нақты PASCO тәжірибесімен тексерілген физикалық есептеу; ол оқу құралы,
            редакцияланатын мәтін емес.
          </span>
        </p>

        {draft === null ? (
          <LoadingBlock lines={6} />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="space-y-6"
          >
            <section className="glass glass-lit space-y-4 rounded-3xl2 p-5 sm:p-6">
              <h2 className="text-h3 text-slate-900 dark:text-white">Негізгі</h2>
              <label className="block text-micro uppercase tracking-wider text-slate-500">
                Тақырып
                <input
                  value={draft.title}
                  onChange={(e) => set("title", e.target.value)}
                  className="input-glow mt-1 w-full"
                />
              </label>
              <label className="block text-micro uppercase tracking-wider text-slate-500">
                Қысқа сипаттама
                <textarea
                  value={draft.shortDescription}
                  onChange={(e) => set("shortDescription", e.target.value)}
                  rows={2}
                  className="input-glow mt-1 w-full"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-micro uppercase tracking-wider text-slate-500">
                  YouTube ID
                  <input
                    value={draft.youtubeId}
                    onChange={(e) => set("youtubeId", e.target.value)}
                    placeholder="dQw4w9WgXcQ"
                    className="input-glow mt-1 w-full"
                  />
                </label>
                <label className="block text-micro uppercase tracking-wider text-slate-500">
                  Бейне ұзақтығы (мин)
                  <input
                    type="number"
                    min={1}
                    value={draft.videoDurationMinutes}
                    onChange={(e) => set("videoDurationMinutes", Number(e.target.value))}
                    className="input-glow mt-1 w-full"
                  />
                </label>
              </div>
            </section>

            <section className="glass glass-lit space-y-5 rounded-3xl2 p-5 sm:p-6">
              <h2 className="text-h3 text-slate-900 dark:text-white">Дәріс</h2>
              <StringListEditor
                label="Оқу мақсаттары"
                value={draft.objectives}
                onChange={(v) => set("objectives", v)}
              />
              <StringListEditor
                label="Дәріс мәтіні"
                hint="Әр жол — бөлек абзац."
                multiline
                value={draft.lectureSummary}
                onChange={(v) => set("lectureSummary", v)}
              />
              <StringListEditor
                label="Негізгі ұғымдар"
                value={draft.keyConcepts}
                onChange={(v) => set("keyConcepts", v)}
              />
            </section>

            <section className="glass glass-lit space-y-5 rounded-3xl2 p-5 sm:p-6">
              <h2 className="text-h3 text-slate-900 dark:text-white">Глоссарий</h2>
              <p className="text-label text-slate-600 dark:text-slate-400">
                Глоссарий — кроссворд, сөз табу, бос орын және сұрыптау ойындарының дереккөзі.
                Терминді өзгертсеңіз, төрт ойын да бірге жаңарады.
              </p>
              <PairListEditor
                label="Терминдер"
                leftLabel="Термин"
                rightLabel="Анықтама"
                value={draft.glossary.map((g) => ({ left: g.term, right: g.definition }))}
                onChange={(v) =>
                  set(
                    "glossary",
                    v.map((p) => ({ term: p.left, definition: p.right }))
                  )
                }
              />
            </section>

            <section className="glass glass-lit space-y-5 rounded-3xl2 p-5 sm:p-6">
              <h2 className="text-h3 text-slate-900 dark:text-white">Викторина</h2>
              <QuizEditor
                value={draft.quiz as EditableQuestion[]}
                onChange={(v) => set("quiz", v)}
              />
            </section>

            <section className="glass glass-lit space-y-5 rounded-3xl2 p-5 sm:p-6">
              <h2 className="text-h3 text-slate-900 dark:text-white">Ойын жұптары</h2>
              <PairListEditor
                label="Жұптар"
                hint="Сәйкестендіру, жады және сүйреп апару ойындарында қолданылады."
                leftLabel="Сол жақ"
                rightLabel="Оң жақ"
                value={draft.gamePairs}
                onChange={(v) => set("gamePairs", v)}
              />
            </section>

            {/* Sticky action bar: the form is long enough that a save button at
                the bottom would be a scroll away from most of the fields. */}
            <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/90 p-3 backdrop-blur dark:border-white/10 dark:bg-slate-900/90">
              <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
                <Save size={16} /> {busy ? "Сақталуда…" : "Сақтау"}
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={busy || changedFields === 0}
                className="btn-secondary disabled:opacity-50"
              >
                <RotateCcw size={15} /> Түпнұсқаға қайтару
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-label text-emerald-400">
                  <Check size={15} /> Сақталды
                </span>
              )}
              <span className="ml-auto text-micro text-slate-500 dark:text-slate-400">
                {changedFields === 0 ? (
                  "Түпнұсқадан айырмашылық жоқ"
                ) : (
                  <Badge variant="warning" marker={String(changedFields)}>
                    өзгертілген өріс
                  </Badge>
                )}
              </span>
            </div>
          </form>
        )}
      </div>
    </DashboardShell>
  );
}
