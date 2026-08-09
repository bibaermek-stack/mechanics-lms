"use client";

// Where Google sends people back.
//
// The Supabase browser client exchanges the `?code=` for a session on its own
// (PKCE, detectSessionInUrl), so this page's job is the part Supabase cannot
// know: which role this account is. An email signup answered that on the form;
// an OAuth signup never saw one, so its profile arrives provisional
// (role_locked = false) and is settled here — once.

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, Users } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { supabase } from "@/lib/supabase/client";
import { claimRole, fetchProfile } from "@/lib/supabase/accounts";
import type { AppUser } from "@/lib/types";

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

function home(role: string) {
  return role === "teacher" ? "/teacher" : "/dashboard";
}

/** Reject rather than hang: a stuck auth client must still reach an error UI. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Google жауабын күту уақыты бітті.")), ms)
    ),
  ]);
}

function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);

  const [profile, setProfile] = useState<AppUser | null>(null);
  const [needsRole, setNeedsRole] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The role the person picked before being sent to Google, carried on the
  // redirect URL. Read once on mount: supabase-js rewrites the URL after it
  // consumes the auth code.
  const intent = useRef(params.get("role"));

  // Snapshot the query string once. `useSearchParams()` hands back a fresh
  // object on re-render, and this effect must not re-run and cancel its own
  // in-flight exchange every time state moves.
  const oauthError = useRef(params.get("error_description") ?? params.get("error"));

  useEffect(() => {
    if (!supabase) {
      router.replace("/login");
      return;
    }
    const sb = supabase;
    let cancelled = false;

    // Google's failure comes back on the URL, not as a thrown exception.
    if (oauthError.current) {
      setError(oauthError.current);
      return;
    }

    (async () => {
      // Wait for the client to finish the code exchange. getSession resolves
      // after detectSessionInUrl has run, so one call is enough — but if the
      // client ever stalls, a spinner with no way out is the worst outcome.
      const { data } = await withTimeout(sb.auth.getSession(), 12_000);
      const userId = data.session?.user.id;
      if (!userId) {
        if (!cancelled) setError("Сессия құрылмады. Қайта кіріп көріңіз.");
        return;
      }

      let me = await fetchProfile(userId);
      if (!me) {
        if (!cancelled) setError("Профиль табылмады. Дерекқор схемасы қолданылды ма?");
        return;
      }

      if (me.roleLocked === false) {
        const wanted = intent.current;
        if (wanted === "student" || wanted === "teacher") {
          me = (await claimRole(wanted)) ?? me;
        } else {
          // Signed in with Google without ever choosing — ask now.
          if (!cancelled) {
            setProfile(me);
            setNeedsRole(true);
          }
          return;
        }
      }

      if (cancelled) return;
      setUser(me);
      router.replace(home(me.role));
    })().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Кіру сәтсіз аяқталды");
    });

    return () => {
      cancelled = true;
    };
    // Deliberately runs once: re-running would abandon a code exchange midway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pick(role: Role) {
    setBusy(true);
    setError(null);
    try {
      const me = await claimRole(role);
      if (me) {
        setUser(me);
        router.replace(home(me.role));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Рөлді сақтау сәтсіз аяқталды");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="glass glass-lit edge-glow w-full max-w-md rounded-3xl2 p-7 sm:p-9">
        {error ? (
          <>
            <h1 className="text-h2 text-slate-900 dark:text-white">Кіру аяқталмады</h1>
            <p role="alert" className="mt-3 text-body text-rose-300">
              {error}
            </p>
            <button onClick={() => router.replace("/login")} className="btn-primary mt-6 w-full">
              Кіру бетіне оралу
            </button>
          </>
        ) : needsRole ? (
          <>
            <h1 className="text-h2 text-slate-900 dark:text-white">Сіз кімсіз?</h1>
            <p className="mt-1.5 text-label text-slate-600 dark:text-slate-400">
              {profile?.fullName ? `${profile.fullName}, ` : ""}рөліңізді таңдаңыз. Бұл{" "}
              <strong className="text-slate-800 dark:text-slate-200">бір рет</strong> қана
              таңдалады және кейін өзгертілмейді.
            </p>
            <div className="mt-6 grid gap-2">
              {ROLES.map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.value}
                    onClick={() => pick(r.value)}
                    disabled={busy}
                    className="flex items-start gap-3 rounded-2xl border border-slate-200/70 p-3.5 text-left transition-colors hover:border-brand-400 disabled:opacity-60 dark:border-white/10"
                  >
                    <Icon size={19} className="mt-0.5 shrink-0 text-brand-300" />
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
          </>
        ) : (
          <div className="text-center" aria-busy="true">
            <h1 className="text-h3 text-slate-900 dark:text-white">Кіру аяқталуда…</h1>
            <p className="mt-2 text-label text-slate-600 dark:text-slate-400">
              Google жауабы өңделуде.
            </p>
            <div className="mt-6 space-y-2">
              <div className="h-3 rounded-full bg-slate-200/60 dark:bg-white/10" />
              <div className="h-3 w-2/3 rounded-full bg-slate-200/40 dark:bg-white/5" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <Callback />
    </Suspense>
  );
}
