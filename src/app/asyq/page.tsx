"use client";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { AsyqApp } from "@/components/asyq/AsyqApp";

export default function AsyqPage() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <SectionHeader
          as="h1"
          title="Асық ату — 3D"
          description="Қазақтың ұлттық асық ойыны нақты физикамен: сақаны лақтыр, асықтарды шеңберден шығар. Асықтың қай қырымен түскенін (алшы, тәйке, бүк, шік) ойын өзі анықтайды. Ережесін өзің баптай аласың."
        />
        <AsyqApp />
      </div>
    </DashboardShell>
  );
}
