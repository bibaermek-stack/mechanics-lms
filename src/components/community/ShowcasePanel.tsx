"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart, Trash2 } from "lucide-react";
import { useLessons } from "@/components/providers/LessonsProvider";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuthStore } from "@/lib/authStore";
import { SHOWCASE_LIMITS, type FeedCard, type ShowcasePost } from "@/lib/community";
import { deleteShowcase, listMyShowcase, loadFeed, setLike, submitShowcase } from "@/lib/communityData";
import { Count, FIELD, StatusBadge, lessonLabel } from "./shared";

/** What classmates built at home — and a form to add your own, which the teacher looks at first. */
export function ShowcasePanel() {
  const user = useAuthStore((s) => s.user);
  const { modules } = useLessons();
  const [feed, setFeed] = useState<FeedCard[] | null>(null);
  const [mine, setMine] = useState<ShowcasePost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ lessonId: 5, title: "", what: "", physics: "", materials: "" });

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      const [f, m] = await Promise.all([loadFeed(user), listMyShowcase(user.uid)]);
      setFeed(f);
      setMine(m);
    } catch {
      setFeed([]);
    }
  }, [user]);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (!user) return null;
  const isStudent = user.role === "student";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      await submitShowcase(user, form);
      setForm({ ...form, title: "", what: "", physics: "", materials: "" });
      setSent(true);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Жіберілмеді");
    } finally {
      setBusy(false);
    }
  }

  async function like(card: FeedCard) {
    if (!user) return;
    // optimistic: the heart answers at once
    setFeed((f) => f && f.map((c) => (c.id === card.id ? { ...c, likedByMe: !c.likedByMe, likes: c.likes + (c.likedByMe ? -1 : 1) } : c)));
    try {
      await setLike(user, card.id, !card.likedByMe);
    } catch {
      await reload();
    }
  }

  return (
    <div className="space-y-6">
      {isStudent && (
        <Card>
          <h2 className="text-h3 text-slate-900 dark:text-white">Үйдегі тәжірибеңді көрсет</h2>
          <p className="mt-1 text-body text-slate-600 dark:text-slate-400">
            Не жасадың, физиканың қай заңын көрсетеді? Мәтін ғана жазылады (сурет пен сілтеме жоқ). Мұғалімің мақұлдағаннан кейін сыныптастарың көреді.
          </p>
          <form onSubmit={send} className="mt-4 space-y-3">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white">
              Сабақ
              <select className={FIELD} value={form.lessonId} onChange={(e) => setForm({ ...form, lessonId: Number(e.target.value) })}>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>{lessonLabel(modules, m.id)}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-900 dark:text-white">
              <span className="flex justify-between">Атауы <Count value={form.title} min={SHOWCASE_LIMITS.title.min} max={SHOWCASE_LIMITS.title.max} /></span>
              <input className={FIELD} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Мысалы: Резеңке зымыран" maxLength={200} />
            </label>
            <label className="block text-sm font-semibold text-slate-900 dark:text-white">
              <span className="flex justify-between">Не жасадың? <Count value={form.what} min={SHOWCASE_LIMITS.what.min} max={SHOWCASE_LIMITS.what.max} /></span>
              <textarea className={FIELD} rows={3} value={form.what} onChange={(e) => setForm({ ...form, what: e.target.value })} />
            </label>
            <label className="block text-sm font-semibold text-slate-900 dark:text-white">
              <span className="flex justify-between">Қай физика заңын көрсетеді? <Count value={form.physics} min={SHOWCASE_LIMITS.physics.min} max={SHOWCASE_LIMITS.physics.max} /></span>
              <textarea className={FIELD} rows={2} value={form.physics} onChange={(e) => setForm({ ...form, physics: e.target.value })} />
            </label>
            <label className="block text-sm font-semibold text-slate-900 dark:text-white">
              <span className="flex justify-between">Материалдар (міндетті емес) <Count value={form.materials} max={SHOWCASE_LIMITS.materials.max} /></span>
              <input className={FIELD} value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} placeholder="шар, жіп, скотч" />
            </label>
            {error && <p role="alert" className="text-body text-rose-500">{error}</p>}
            {sent && <p role="status" className="text-body text-emerald-600 dark:text-emerald-300" data-testid="sent">Жіберілді! Мұғалімің қарап шыққанша күт.</p>}
            <button type="submit" disabled={busy} className="btn-primary min-h-[44px]">{busy ? "Жіберілуде…" : "Мұғалімге жіберу"}</button>
          </form>
        </Card>
      )}

      {mine.length > 0 && (
        <section aria-label="Менің жұмыстарым" className="space-y-2">
          <h2 className="text-h3 text-slate-900 dark:text-white">Менің жұмыстарым</h2>
          <ul className="space-y-2" data-testid="my-posts">
            {mine.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 p-3 dark:border-white/10">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-body font-semibold text-slate-900 dark:text-white">{p.title}</p>
                  <p className="text-micro text-slate-500 dark:text-slate-400">{lessonLabel(modules, p.lessonId)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={p.status} />
                  <button
                    aria-label={`«${p.title}» жұмысын жою`}
                    onClick={async () => { await deleteShowcase(user, p.id); await reload(); }}
                    className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Сынып галереясы" className="space-y-3">
        <h2 className="text-h3 text-slate-900 dark:text-white">Сынып галереясы</h2>
        {feed === null ? (
          <p className="text-body text-slate-500 dark:text-slate-400">Жүктелуде…</p>
        ) : feed.length === 0 ? (
          <EmptyState title="Галерея әзірге бос" hint="Алғашқы жұмысты сен жібер: мұғалімің мақұлдағаннан кейін мұнда пайда болады." compact />
        ) : (
          <ul className="space-y-3" data-testid="feed">
            {feed.map((c) => (
              <li key={c.id} className="space-y-2 rounded-2xl border border-slate-200/70 p-4 dark:border-white/10" data-testid="card">
                <p className="text-micro text-slate-500 dark:text-slate-400">{lessonLabel(modules, c.lessonId)} · {c.isMine ? "сенің жұмысың" : c.author}</p>
                <h3 className="text-h3 text-slate-900 dark:text-white">{c.title}</h3>
                <p className="text-body text-slate-700 dark:text-slate-300">{c.what}</p>
                <p className="text-body text-slate-700 dark:text-slate-300"><strong>Физика:</strong> {c.physics}</p>
                {c.materials && <p className="text-micro text-slate-500 dark:text-slate-400">Материалдар: {c.materials}</p>}
                <button
                  onClick={() => like(c)}
                  disabled={c.isMine}
                  aria-pressed={c.likedByMe}
                  aria-label={`Ұнады: ${c.likes}`}
                  className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3 text-sm font-semibold disabled:opacity-60 ${c.likedByMe ? "border-rose-400 bg-rose-500/10 text-rose-600 dark:text-rose-300" : "border-slate-200 text-slate-600 dark:border-white/15 dark:text-slate-300"}`}
                >
                  <Heart size={16} aria-hidden className={c.likedByMe ? "fill-current" : ""} /> <span className="data-num">{c.likes}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
