"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { CertificateCard } from "@/components/certificate/CertificateCard";
import { useAuthStore } from "@/lib/authStore";
import { getCertificates, issueCertificate, generateId } from "@/lib/dataStore";
import type { Certificate } from "@/lib/types";
import { Award, ShieldCheck, Sparkles, Printer, X, CheckCircle2, Download, ExternalLink } from "lucide-react";

export default function CertificatesPage() {
  const user = useAuthStore((s) => s.user);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [activeModalCert, setActiveModalCert] = useState<Certificate | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);

  useEffect(() => {
    if (!user) return;
    getCertificates(user.uid).then(setCerts);
  }, [user]);

  async function handleIssue() {
    if (!user) return;
    setIsIssuing(true);
    const id = generateId("cert");
    const cert: Certificate = {
      id,
      userId: user.uid,
      courseName: "Механика және Инженерлік Физика Курсы",
      issuedAt: new Date().toISOString(),
      qrData: id,
      verifyUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/verify/${id}`,
    };
    await issueCertificate(cert);
    setCerts((c) => [cert, ...c]);
    setIsIssuing(false);
  }

  const studentName = user?.fullName ?? "Ермек Әлібек";

  return (
    <DashboardShell role="student">
      <div className="space-y-6">
        {/* Page Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <Award size={20} />
              </div>
              <h1 className="text-h1">Сертификаттарым</h1>
            </div>
            <p className="text-body text-slate-600 dark:text-slate-400">
              QR-код және бірегей хаштаг арқылы расталатын ресми электронды сертификаттар.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleIssue}
              disabled={isIssuing}
              className="btn-primary flex items-center gap-2 shadow-lg shadow-brand-500/20"
            >
              <Sparkles size={18} />
              {isIssuing ? "Дайындалуда..." : "Демо сертификат алу"}
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="surface-card flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-micro font-medium text-slate-500 dark:text-slate-400">Сертификат мәртебесі</p>

              <p className="text-body font-bold text-slate-900 dark:text-white">Жарамды & Тексерілген</p>
            </div>
          </div>

          <div className="surface-card flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <p className="text-micro font-medium text-slate-500 dark:text-slate-400">Курс орындалуы</p>
              <p className="text-body font-bold text-emerald-600 dark:text-emerald-400">100% Аяқталды</p>
            </div>
          </div>

          <div className="surface-card flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <Award size={22} />
            </div>
            <div>
              <p className="text-micro font-medium text-slate-500 dark:text-slate-400">Берілген сертификат</p>
              <p className="text-body font-bold text-slate-900 dark:text-white">{certs.length} дана</p>
            </div>
          </div>
        </div>

        {/* Main Certificate List / Empty state */}
        {certs.length === 0 ? (
          <div className="surface-card text-center p-12 space-y-4 rounded-2xl border border-dashed border-slate-300 dark:border-white/10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 ring-8 ring-amber-500/5">
              <Award size={36} />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h2 className="text-h2">Әзірге сертификатың жоқ</h2>
              <p className="text-body text-slate-600 dark:text-slate-400">
                Курсты аяқтап сертификат алыңыз немесе жүйені тексеру үшін 1-кликтен демо сертификат жасаңыз.
              </p>
            </div>
            <button onClick={handleIssue} className="btn-primary inline-flex items-center gap-2">
              <Sparkles size={16} /> Қаразір сертификат жасау
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {certs.map((c) => (
              <CertificateCard
                key={c.id}
                certificate={c}
                studentName={studentName}
                onOpenModal={(cert) => setActiveModalCert(cert)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Diploma Full View & Print Modal */}
      {activeModalCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border-4 border-amber-400/80 bg-slate-900 p-8 text-white shadow-2xl">
            <button
              onClick={() => setActiveModalCert(null)}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-slate-400 hover:bg-white/20 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div id="printable-diploma" className="space-y-6 text-center p-6 border-2 border-amber-400/40 rounded-xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
              <div className="flex justify-between items-center border-b border-amber-400/30 pb-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">МЕХАНИКА AI LMS — РЕСМИ ДИПЛОМ</span>
                <span className="font-mono text-[10px] text-slate-400">ID: {activeModalCert.id}</span>
              </div>

              <Award className="mx-auto text-amber-400" size={56} />
              
              <div>
                <h1 className="text-3xl font-black text-amber-300 font-serif tracking-wider">СЕРТИФИКАТ</h1>
                <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">Академиялық оқу аяқтау куәлігі</p>
              </div>

              <div className="space-y-2 py-4">
                <p className="text-xs text-slate-400">Бұл сертификат:</p>
                <h2 className="text-3xl font-bold text-white font-serif text-amber-200">{studentName}</h2>
                <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                  «<strong>{activeModalCert.courseName}</strong>» бағдарламасын 100% үздік баллмен тамамдағаны үшін тапсырылды.
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-amber-400/30 pt-6 text-left">
                <div className="text-micro text-slate-400">
                  <p>Берілді: <strong className="text-slate-200">{new Date(activeModalCert.issuedAt).toLocaleDateString("kk-KZ")}</strong></p>
                  <p>Мәртебе: <strong className="text-emerald-400">Расталған (Valid)</strong></p>
                </div>

                <div className="text-right text-micro text-slate-400">
                  <p className="font-serif italic text-amber-300">Профессор Е. Еділбаев</p>
                  <p>Курс авторы & Зерттеуші</p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => window.print()}
                className="btn-primary flex items-center gap-2"
              >
                <Printer size={16} /> Дипломды басып шығару (PDF)
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
