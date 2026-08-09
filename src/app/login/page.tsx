"use client";

// Sign in / sign up.
//
// The role choice belongs here and nowhere else: it is written into the auth
// user's metadata at signup, a database trigger copies it into `profiles`, and
// another trigger freezes it. There is deliberately no "switch role" control
// anywhere in the app — a teacher account is an identity, not a view mode.

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, LogIn, Mail, UserPlus, Users } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { signIn, signInAsDemo, signInWithGoogle, signUp } from "@/lib/supabase/accounts";

/** Google's mark. Inline because a strict CSP blocks a remote asset. */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.8-2 5.1-4.4 6.7v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.4z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.2 15.5 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.8 28.3c-.4-1.3-.7-2.7-.7-4.3s.2-2.9.7-4.3v-5.7H4.5C2.9 17.1 2 20.4 2 24s.9 6.9 2.5 10l7.3-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.5 2 8.1 6.8 4.5 14l7.3 5.7c1.7-5.2 6.5-9 12.2-9z"
      />
    </svg>
  );
}

type Mode = "signin" | "signup";
type Role = "student" | "teacher";

const ROLES: { value: Role; label: string; blurb: string; icon: typeof Users }[] = [
  {
    value: "student",
    label: "Студент",
    blurb: "Сабақтарды өтемін, тәжірибе жасаймын, оқытушыға қосыламын",
    icon: GraduationCap,
  },
  {
    value: "teacher",
    label: "Оқытушы",
    blurb: "Студенттерімді жинаймын, тапсырмаларын тексеремін",
    icon: Users,
  },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);

  const [mode, setMode] = useState<Mode>("signin");
  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [studyGroup, setStudyGroup] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * Where to land after a successful sign-in.
   *
   * `next` comes from the guard that bounced the person here, so it has to be
   * checked against the role they actually signed in as — otherwise a teacher
   * who was sent to /login from /dashboard lands on the student dashboard.
   */
  function destination(userRole: Role) {
    const home = userRole === "teacher" ? "/teacher" : "/dashboard";
    const next = params.get("next");
    if (!next || !next.startsWith("/")) return home;
    const isTeacherArea = next.startsWith("/teacher");
    if (isTeacherArea !== (userRole === "teacher")) return home;
    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const res = await signUp({
          email,
          password,
          fullName: fullName.trim(),
          role,
          studyGroup: role === "student" ? studyGroup.trim() || undefined : undefined,
        });
        if (res.needsEmailConfirmation) {
          setNotice(
            "Тіркелдіңіз. Поштаңызға растау сілтемесі жіберілді — оны ашқан соң кіре аласыз."
          );
          setMode("signin");
          return;
        }
        if (res.user) {
          setUser(res.user);
          router.push(destination(res.user.role as Role));
        }
      } else {
        const res = await signIn(email, password);
        if (res.user) {
          setUser(res.user);
          router.push(destination(res.user.role as Role));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Белгісіз қате");
    } finally {
      setBusy(false);
    }
  }

  function handleDemo(demoRole: Role) {
    const user = signInAsDemo(demoRole);
    setUser(user);
    router.push(destination(demoRole));
  }

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    try {
      // On the signup tab the picked role rides along to /auth/callback; on the
      // sign-in tab it is left out, because an existing profile's role is fixed.
      await signInWithGoogle(mode === "signup" ? role : undefined);
      // The browser navigates to Google from here; nothing after this runs.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google арқылы кіру сәтсіз аяқталды");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="glass glass-lit edge-glow w-full max-w-md rounded-3xl2 p-7 sm:p-9">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-h2 font-bold text-white">
            М
          </div>
          <h1 className="text-h2 text-slate-900 dark:text-white">
            {mode === "signin" ? "Платформаға кіру" : "Жаңа тіркелгі"}
          </h1>
          <p className="mt-1.5 text-label text-slate-600 dark:text-slate-400">
            {mode === "signin"
              ? "Email және құпия сөзіңізбен кіріңіз"
              : "Рөліңізді таңдап, деректеріңізді толтырыңыз"}
          </p>
        </div>

        {/* Mode switch */}
        <div className="mt-6 flex rounded-2xl border border-slate-200/70 bg-slate-100/60 p-1 dark:border-white/10 dark:bg-white/5">
          {(["signin", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
                setNotice(null);
              }}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
                mode === m
                  ? "bg-white text-slate-900 dark:bg-white/10 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {m === "signin" ? "Кіру" : "Тіркелу"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <fieldset>
              <legend className="mb-2 text-micro uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Мен кіммін?
              </legend>
              <div className="grid gap-2">
                {ROLES.map((r) => {
                  const Icon = r.icon;
                  const active = role === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      aria-pressed={active}
                      className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                        active
                          ? "border-brand-400 bg-brand-500/10"
                          : "border-slate-200/70 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20"
                      }`}
                    >
                      <Icon
                        size={19}
                        className={`mt-0.5 shrink-0 ${
                          active ? "text-brand-300" : "text-slate-400"
                        }`}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                          {r.label}
                        </span>
                        <span className="mt-0.5 block text-micro text-slate-500 dark:text-slate-400">
                          {r.blurb}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {mode === "signup" && (
            <label className="block">
              <span className="mb-1.5 block text-micro uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Аты-жөні
              </span>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Айгерім Болатқызы"
                className="input-glow w-full"
                autoComplete="name"
              />
            </label>
          )}

          {mode === "signup" && role === "student" && (
            <label className="block">
              <span className="mb-1.5 block text-micro uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Тобы <span className="normal-case tracking-normal">(міндетті емес)</span>
              </span>
              <input
                value={studyGroup}
                onChange={(e) => setStudyGroup(e.target.value)}
                placeholder="МТ-21"
                className="input-glow w-full"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-micro uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Email
            </span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aigerim@ayu.edu.kz"
              className="input-glow w-full"
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-micro uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Құпия сөз
            </span>
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Кемінде 6 таңба"
              className="input-glow w-full"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3.5 py-2.5 text-label text-rose-200"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3.5 py-2.5 text-label text-emerald-200"
            >
              <Mail size={16} className="mt-0.5 shrink-0" />
              {notice}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
            {mode === "signin" ? <LogIn size={16} /> : <UserPlus size={16} />}
            {busy ? "Күте тұрыңыз…" : mode === "signin" ? "Кіру" : "Тіркелу"}
          </button>
        </form>

        {isSupabaseConfigured && (
          <>
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200/70 dark:bg-white/10" />
              <span className="text-micro uppercase tracking-wider text-slate-500">немесе</span>
              <span className="h-px flex-1 bg-slate-200/70 dark:bg-white/10" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="btn-secondary w-full disabled:opacity-60"
            >
              <GoogleMark />
              Google арқылы {mode === "signin" ? "кіру" : "тіркелу"}
            </button>

            {mode === "signup" && (
              <p className="mt-2.5 text-center text-micro text-slate-500 dark:text-slate-400">
                Google-мен тіркелсеңіз, жоғарыда таңдалған «
                {role === "teacher" ? "Оқытушы" : "Студент"}» рөлі бекітіледі.
              </p>
            )}
          </>
        )}

        {!isSupabaseConfigured && (
          <div className="mt-7 border-t border-slate-200/60 pt-5 dark:border-white/10">
            {/* Why Google is missing, stated plainly. An absent button with no
                explanation reads as a broken feature rather than a config gap. */}
            <p className="text-micro text-slate-500 dark:text-slate-400">
              Дерекқор қосылмаған — демо режим, сондықтан Google арқылы кіру де жоқ.
              <code className="mx-1 rounded bg-slate-200/60 px-1 dark:bg-white/10">
                .env.local
              </code>
              файлында Supabase кілттерін тексеріп, dev серверді қайта қосыңыз. Әзірге
              рөлді дайын тіркелгімен сынап көріңіз.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => handleDemo("student")} className="btn-secondary text-sm">
                Демо студент
              </button>
              <button onClick={() => handleDemo("teacher")} className="btn-secondary text-sm">
                Демо оқытушы
              </button>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-micro text-slate-500 dark:text-slate-500">
          <Link href="/" className="hover:text-slate-300">
            ← Басты бетке оралу
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams needs a suspense boundary under the app router.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
