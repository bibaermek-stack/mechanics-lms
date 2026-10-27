"use client";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CampaignMap } from "@/components/campaign/CampaignMap";

/** The course as a journey from lesson to lesson. */
export default function MapPage() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <SectionHeader
          as="h1"
          title="Сапар картасы"
          description="Байқоңырдан ғарышқа: әр сабақ — бір тарау. Викторинаны тапсырсаң, тараудың әңгімесі ашылады және жұлдыз аласың; сабақ ойыны мен жоғары нәтиже қосымша жұлдыз береді."
        />
        <CampaignMap />
      </div>
    </DashboardShell>
  );
}
