"use client";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CommunityTabs } from "@/components/community/CommunityTabs";

/** What the class makes for itself: a gallery of home experiments, and questions written by students. */
export default function CommunityPage() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <SectionHeader
          as="h1"
          title="Сынып қауымдастығы"
          description="Үйде жасаған тәжірибеңді көрсет, сыныптастарыңа сұрақ жаз, олардың сұрақтарымен жаттық. Бәрін алдымен мұғалімің қарайды."
        />
        <CommunityTabs />
      </div>
    </DashboardShell>
  );
}
