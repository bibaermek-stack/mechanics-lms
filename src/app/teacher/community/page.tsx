"use client";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ModerationQueue } from "@/components/community/ModerationQueue";

/** Everything the students have written for each other waits here for the teacher. */
export default function TeacherCommunityPage() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <SectionHeader
          as="h1"
          title="Модерация"
          description="Оқушылар жіберген тәжірибелер мен сұрақтар. Мақұлдағаның ғана сыныптастарына көрінеді; мақұлдауды кейін өзгертуге болады."
        />
        <ModerationQueue />
      </div>
    </DashboardShell>
  );
}
