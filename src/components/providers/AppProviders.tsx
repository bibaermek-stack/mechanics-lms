"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/authStore";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { fetchProfile, readMockSession } from "@/lib/supabase/accounts";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    // The redesign is dark-first, so dark is the default rather than an
    // opt-in; only an explicit "false" from a previous session turns it off.
    const stored = window.localStorage.getItem("mechanics-lms:darkMode");
    const dark = stored === null ? true : stored === "true";
    document.documentElement.classList.toggle("dark", dark);
    useAuthStore.setState({ darkMode: dark });
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      const sb = supabase;
      let cancelled = false;

      // Resolve the session that already exists (a reload), then keep following
      // it. The profile row is the source of truth for the role, not the JWT:
      // the role lives in `profiles` where a trigger keeps it immutable.
      const load = async (userId: string | undefined) => {
        if (!userId) {
          if (!cancelled) setUser(null);
          return;
        }
        try {
          const profile = await fetchProfile(userId);
          if (!cancelled) setUser(profile);
        } catch {
          if (!cancelled) setUser(null);
        }
      };

      sb.auth.getSession().then(({ data }) => load(data.session?.user.id));

      const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
        load(session?.user.id);
      });

      return () => {
        cancelled = true;
        sub.subscription.unsubscribe();
      };
    }

    // No backend configured: restore whichever demo identity was last chosen on
    // the login screen. Nobody is signed in until they pick one, so the role
    // selection is exercised in demo mode too.
    setUser(readMockSession());
  }, [setUser]);

  return <>{children}</>;
}
