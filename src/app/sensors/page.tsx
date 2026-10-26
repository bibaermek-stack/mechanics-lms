"use client";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SensorLab } from "@/components/sensors/SensorLab";

/** Experiments with the phone's own accelerometer. */
export default function SensorsPage() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <SectionHeader
          as="h1"
          title="Телефон зертханасы"
          description="Телефоныңдағы үдеу сенсоры — нағыз құрал. Онымен g-ны өлшейсің, секіру биіктігін табасың, маятник пен лифтті зерттейсің. Нәтижелерің теориямен сәйкес келе ме — өзің тексер."
        />
        <SensorLab />
        <p className="text-micro text-slate-500 dark:text-slate-400">
          Қауіпсіздік: секіргенде ашық, тайғақ емес жерді таңда; телефонды қалтаға берік сал. Маятникке қымбат телефонды емес, қапшыққа салынған ескі телефонды ілу дұрыс. Лифтте басқа адамдарға кедергі жасама.
        </p>
      </div>
    </DashboardShell>
  );
}
