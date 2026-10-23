"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Clock, Orbit, VideoOff } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatVideoLength, videoSidecars } from "@/data/lessonVideos";

/** A lesson counts as watched once this share of the film has played. */
const WATCHED_AT = 0.9;

export function VideoPlayer({
  src,
  title,
  description,
  durationSeconds,
  onOpenScene,
}: {
  /** Path or URL of an MP4/WebM. The bundled films have a poster and caption file beside them. */
  src: string;
  title: string;
  description: string;
  durationSeconds: number;
  /** Offers a shortcut to the live 3D scene of the same lesson, when there is one. */
  onOpenScene?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const furthest = useRef(0);
  const [watched, setWatched] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const { poster, captions } = videoSidecars(src);

  const markWatched = () => {
    furthest.current = 1;
    setProgress(100);
    setWatched(true);
  };

  // Progress follows the furthest point reached, not the playhead, so scrubbing
  // back to re-watch a part does not make the bar run backwards.
  const onTime = () => {
    const v = ref.current;
    if (!v || !v.duration || !Number.isFinite(v.duration)) return;
    furthest.current = Math.max(furthest.current, v.currentTime / v.duration);
    setProgress(Math.round(furthest.current * 100));
    if (furthest.current >= WATCHED_AT) setWatched(true);
  };

  return (
    <div className="overflow-hidden rounded-xl2 border border-slate-200/60 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/40">
      <div className="relative aspect-video w-full bg-black">
        {failed ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-slate-300">
            <div className="space-y-2">
              <VideoOff className="mx-auto" size={28} />
              <p>Бейнені жүктеу мүмкін болмады. Интернет байланысын тексеріп, бетті жаңартыңыз.</p>
            </div>
          </div>
        ) : (
          <video
            ref={ref}
            className="h-full w-full"
            controls
            playsInline
            preload="metadata"
            poster={poster}
            aria-label={title}
            onTimeUpdate={onTime}
            onEnded={markWatched}
            // <source> errors bubble up to the video in React; a missing caption file must not count.
            onError={(e) => (e.target as HTMLElement).tagName !== "TRACK" && setFailed(true)}
          >
            <source src={src} />
            {/* The captions are already burned into the bundled films; this track is for screen readers and is off by default. */}
            {captions && <track kind="captions" src={captions} srcLang="kk" label="Қазақша (мәтін)" />}
          </video>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-body text-slate-600 dark:text-slate-400">{description}</p>
          </div>
          {watched && (
            <span className="badge shrink-0 !bg-emerald-100 !text-emerald-700 dark:!bg-emerald-900/40 dark:!text-emerald-200">
              <CheckCircle2 size={14} /> Аяқталды
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-micro text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-2">
            <Clock size={14} />
            Ұзақтығы: {formatVideoLength(durationSeconds)}
          </span>
          {onOpenScene && (
            <button
              type="button"
              onClick={onOpenScene}
              className="flex items-center gap-1.5 font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              <Orbit size={14} /> 3D сахнаны өзің айналдырып көр
            </button>
          )}
        </div>
        <ProgressBar value={progress} label="Дәрісті көру барысы" />
        {!watched && (
          <button className="btn-secondary text-sm" onClick={markWatched}>
            Дәрісті аяқталды деп белгілеу
          </button>
        )}
      </div>
    </div>
  );
}
