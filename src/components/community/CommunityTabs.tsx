"use client";

import { useState } from "react";
import { PeerQuiz } from "./PeerQuiz";
import { QuestionWriter } from "./QuestionWriter";
import { ShowcasePanel } from "./ShowcasePanel";

const TABS = [
  { id: "gallery", label: "Галерея" },
  { id: "write", label: "Сұрақ жазу" },
  { id: "practice", label: "Сыныптастар сұрағы" },
] as const;

export function CommunityTabs() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("gallery");
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Қауымдастық бөлімдері">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-[44px] rounded-xl px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${
              tab === t.id ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "gallery" && <ShowcasePanel />}
      {tab === "write" && <QuestionWriter />}
      {tab === "practice" && <PeerQuiz />}
    </div>
  );
}
