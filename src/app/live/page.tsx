"use client";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PlayerPanel } from "@/components/live/PlayerPanel";

/** Join the teacher's live quiz with the code on the board. */
export default function LivePage() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-md space-y-6">
        <SectionHeader as="h1" title="Тікелей викторина" description="Мұғалім көрсеткен кодты жаз да, сұрақтарға тез әрі дұрыс жауап бер." />
        <PlayerPanel />
      </div>
    </DashboardShell>
  );
}
