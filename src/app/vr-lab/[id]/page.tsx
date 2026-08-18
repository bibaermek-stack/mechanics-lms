"use client";

import Link from "next/link";
import { Boxes } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { VrLabExperience } from "@/components/vr/VrLabExperience";
import { getVrExperiment } from "@/lib/vr/experiments";

export default function VrLabExperimentPage({ params }: { params: { id: string } }) {
  const experiment = getVrExperiment(params.id);

  if (!experiment) {
    return (
      <DashboardShell>
        <div className="surface p-8 text-center">
          <Boxes className="mx-auto mb-2 text-slate-400" />
          <p className="text-body text-slate-600 dark:text-slate-300">
            Мұндай VR тәжірибе табылмады.
          </p>
          <Link href="/vr-lab" className="btn-secondary mt-4 inline-flex px-3 py-1.5 text-sm">
            VR/AR зертханаға оралу
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <VrLabExperience experiment={experiment} />
    </DashboardShell>
  );
}
