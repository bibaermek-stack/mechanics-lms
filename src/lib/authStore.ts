// Lightweight client auth/session store. In mock mode it simulates a signed
// in demo user; when Supabase is configured it is populated from the Supabase
// session instead (wired in AppProviders).
"use client";
import { create } from "zustand";
import type { AppUser } from "./types";

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  darkMode: boolean;
  setUser: (u: AppUser | null) => void;
  setLoading: (b: boolean) => void;
  toggleDarkMode: () => void;
}

export const DEMO_STUDENT: AppUser = {
  uid: "demo-student-1",
  fullName: "Айгерім Болатқызы",
  email: "aigerim.student@ayu.edu.kz",
  role: "student",
  group: "МТ-21",
  createdAt: new Date().toISOString(),
  competencyScore: 74,
  badges: ["Алғашқы қадам", "Белсенді студент"],
  xp: 1280,
};

export const DEMO_TEACHER: AppUser = {
  uid: "demo-teacher-1",
  fullName: "Серік Полатұлы",
  email: "serik.polatuly@ayu.edu.kz",
  role: "teacher",
  createdAt: new Date().toISOString(),
  xp: 0,
};

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  loading: true,
  darkMode: false,
  setUser: (u) => set({ user: u, loading: false }),
  setLoading: (b) => set({ loading: b }),
  toggleDarkMode: () =>
    set((s) => {
      const next = !s.darkMode;
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", next);
        // Persisted, so the choice survives a reload — AppProviders reads it.
        window.localStorage.setItem("mechanics-lms:darkMode", String(next));
      }
      return { darkMode: next };
    }),
}));
