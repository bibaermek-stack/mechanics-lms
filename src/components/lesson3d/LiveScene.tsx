"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { StudioPlayer } from "@/components/studio/StudioPlayer";
import type { LessonScene } from "@/components/studio/types";
import { loadScene } from "./loadScene";

/**
 * The lesson's film, played live in the page: the same 3D scene and graphics
 * as the video, but the student can pause, scrub, and drag the camera around
 * the apparatus.
 */
export function LiveScene({ moduleId }: { moduleId: number }) {
  const [scene, setScene] = useState<LessonScene | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    setScene(undefined);
    loadScene(moduleId)
      .then((s) => alive && setScene(s))
      .catch(() => alive && setScene(null));
    return () => {
      alive = false;
    };
  }, [moduleId]);

  if (scene === undefined) {
    return (
      <div className="grid aspect-video w-full place-items-center rounded-xl2 bg-slate-100 text-slate-500 dark:bg-white/5">
        <span className="flex items-center gap-2 text-sm">
          <Loader2 className="animate-spin" size={16} /> 3D сахна жүктелуде…
        </span>
      </div>
    );
  }
  if (!scene) {
    return <p className="text-body text-slate-600 dark:text-slate-400">Бұл сабаққа 3D сахна әлі қосылмаған.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl2 border border-slate-200/60 shadow-sm dark:border-white/10">
        <StudioPlayer scene={scene} mode="live" autoPlay={false} />
      </div>
      <p className="text-micro text-slate-600 dark:text-slate-400">
        Сахнаны ойнатыңыз немесе жолақты жылжытыңыз. «3D айналдыру» батырмасын басып, тышқанмен (немесе саусақпен)
        камераны еркін бұрып, құрал-жабдықты әр жағынан қарауға болады.
      </p>
    </div>
  );
}
