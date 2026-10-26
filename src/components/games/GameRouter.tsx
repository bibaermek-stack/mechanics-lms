"use client";

// The games over one lesson.
//
// Some are driven by the lesson's authored `game.pairs` and quiz; the rest are
// derived from its glossary, quiz bank, film chapters and formulas by
// src/data/gameContent.ts and src/data/moreGames.ts. Everything the derived half
// needs is a pure function of (module, seed), which is what lets a duel hand a
// friend the identical board — see the `seed` prop.
//
// A mode is only offered when its board could actually be built. Showing a
// tenth tab that opens an empty grid would be worse than showing nine.

import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import type { LessonModule } from "@/lib/types";
import { useAuthStore } from "@/lib/authStore";
import { saveGameResult, generateId } from "@/lib/dataStore";
import { lessonGlossary } from "@/data/glossaryExtra";
import {
  buildBlanks,
  buildCrossword,
  buildSorting,
  buildSpeedQuiz,
  buildWordSearch,
} from "@/data/gameContent";
import { buildBlitz, buildOrder, buildTrueFalse } from "@/data/moreGames";
import { MatchingGame } from "./MatchingGame";
import { DragDropGame } from "./DragDropGame";
import { MemoryGame } from "./MemoryGame";
import { FlashCardsGame } from "./FlashCardsGame";
import { SpinWheelGame } from "./SpinWheelGame";
import { CrosswordGame } from "./CrosswordGame";
import { WordSearchGame } from "./WordSearchGame";
import { FillBlankGame } from "./FillBlankGame";
import { SortingGame } from "./SortingGame";
import { SpeedQuizGame } from "./SpeedQuizGame";
import { TrueFalseGame } from "./TrueFalseGame";
import { OrderGame } from "./OrderGame";
import { BlitzGame } from "./BlitzGame";
import { ProjectileGame } from "./ProjectileGame";
import { CoasterGame } from "./CoasterGame";
import { FolkGame } from "./FolkGame";
import { FOLK_LESSONS, type FolkKind } from "@/lib/folk";
import { COASTER_LESSONS } from "@/lib/coasterLevels";
import { PROJECTILE_LESSONS, buildProjectile } from "@/lib/projectile";
import { ARENA_LESSONS, ArenaGame } from "@/components/arena/ArenaGame";

export type GameMode =
  | "matching"
  | "memory"
  | "flashcards"
  | "dragdrop"
  | "spinwheel"
  | "crossword"
  | "wordsearch"
  | "fillblank"
  | "sorting"
  | "speedquiz"
  | "truefalse"
  | "order"
  | "blitz"
  | "projectile"
  | "coaster"
  | "bow"
  | "asyq"
  | "tug"
  | "rocket"
  | "arena";

export const GAME_LABELS: Record<GameMode, string> = {
  matching: "Сәйкестендіру",
  memory: "Жады карточкалары",
  flashcards: "Флэш-карточкалар",
  dragdrop: "Сүйреп апару",
  spinwheel: "Айналмалы дөңгелек",
  crossword: "Кроссворд",
  wordsearch: "Сөз табу",
  fillblank: "Бос орынды толтыр",
  sorting: "Сұрыптау",
  speedquiz: "Жылдам жауап",
  truefalse: "Шын ба, өтірік пе?",
  order: "Ретке келтір",
  blitz: "Есеп-блиц",
  projectile: "Снаряд атысы",
  coaster: "Роллер-коастер",
  bow: "Садақ ату",
  asyq: "Асық ату",
  tug: "Арқан тарту",
  rocket: "Байқоңыр: ұшыру",
  arena: "Арена — физикалық футбол",
};

/** Short "what am I doing here" line, shown above the board. */
const GAME_HINTS: Record<GameMode, string> = {
  matching: "Терминді дұрыс анықтамасымен сәйкестендір.",
  memory: "Карточкаларды ашып, жұптарын тап.",
  flashcards: "Карточканы аударып, өзіңді тексер.",
  dragdrop: "Элементтерді дұрыс орнына апар.",
  spinwheel: "Дөңгелекті айналдырып, түскен сұраққа жауап бер.",
  crossword: "Анықтамалар бойынша торды толтыр.",
  wordsearch: "Тордан жасырылған терминдерді тап.",
  fillblank: "Анықтамадағы жетіспейтін терминді таңда.",
  sorting: "Әр терминді өз санатына орналастыр.",
  speedquiz: "Уақыт біткенше жауап бер — жылдамдық та ұпай әкеледі.",
  truefalse: "Сұраққа берілген жауап дұрыс па? Шешім қабылдауға 12 секунд.",
  order: "Бейнедәрістің оқиғаларын айтылу ретімен орналастыр.",
  blitz: "Формула бойынша есепті жылдам шығар: 8 есеп, әрқайсысына 40 секунд.",
  projectile: "Бұрыш пен жылдамдықты таңда: Жерде, Айда, Марста және Юпитерде нысанаға ат. Әр раундта 4 атыс.",
  coaster: "Роллер-коастер рельсін жаса: энергия биіктіктен жылдамдыққа және жылуға қалай айналатынын көр. Алты деңгей және еркін режим.",
  bow: "Ұлттық ойын: садақтың серпімділік энергиясы жебенің жылдамдығына айналады. Тарту ұзындығы мен бұрышты таңдап, нысанаға ат.",
  asyq: "Ұлттық ойын: сақа үйкелістен тоқтайды, d = v²/(2μg). Асықтардың қасына дәл тоқтат.",
  tug: "Ұлттық ойын: арқанды тарту күші аяқтың үйкелісімен шектеледі, F = μMg. Күштерді теңестір.",
  rocket: "Байқоңыр: Циолковский формуласы бойынша зымыранның жылдамдығын есепте. Керек болса, екі сатылы жаса.",
  arena: "Боттарға қарсы ойна: әр соқтығыстың импульсі мен энергиясы экранда есептеледі.",
};

export function GameRouter({
  mod,
  /**
   * Fixes every shuffled board. Defaults to the lesson id so a solo player sees
   * a stable puzzle; a duel passes its own so both sides get the same one.
   */
  seed,
  /** Called with the score in addition to the normal save. Used by duels. */
  onScore,
  /** Restrict the picker to one game — a duel is about a single agreed board. */
  only,
  /** Which tab opens first, if this lesson has it (a deep link from the games hub). */
  initialMode,
  /** Called once the result is stored, so a page showing the totals can refresh them. */
  onSaved,
}: {
  mod: LessonModule;
  seed?: number;
  onScore?: (score: number) => void;
  only?: GameMode;
  initialMode?: GameMode;
  onSaved?: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const boardSeed = seed ?? mod.id * 7919;

  // Boards are rebuilt only when the lesson or the seed changes, never on a
  // re-render — otherwise answering a question would reshuffle the board.
  const boards = useMemo(
    () => ({
      crossword: buildCrossword(mod, boardSeed),
      wordsearch: buildWordSearch(mod, boardSeed),
      fillblank: buildBlanks(mod, boardSeed),
      sorting: buildSorting(mod, boardSeed),
      speedquiz: buildSpeedQuiz(mod, boardSeed),
      truefalse: buildTrueFalse(mod, boardSeed),
      order: buildOrder(mod, boardSeed),
      blitz: buildBlitz(mod, boardSeed),
      projectile: PROJECTILE_LESSONS.includes(mod.id) ? buildProjectile(boardSeed) : null,
    }),
    [mod, boardSeed]
  );

  const available = useMemo<GameMode[]>(() => {
    const list: GameMode[] = [];
    if (mod.game.pairs?.length) list.push("matching", "memory", "dragdrop");
    if (lessonGlossary(mod).length > 0) list.push("flashcards");
    if (mod.quiz.length > 0) list.push("spinwheel");
    if (boards.crossword) list.push("crossword");
    if (boards.wordsearch) list.push("wordsearch");
    if (boards.fillblank) list.push("fillblank");
    if (boards.sorting) list.push("sorting");
    if (boards.speedquiz) list.push("speedquiz");
    if (boards.truefalse) list.push("truefalse");
    if (boards.order) list.push("order");
    if (boards.blitz) list.push("blitz");
    if (boards.projectile) list.push("projectile");
    if (COASTER_LESSONS.includes(mod.id)) list.push("coaster");
    for (const k of ["bow", "asyq", "tug", "rocket"] as const) if (FOLK_LESSONS[k].includes(mod.id)) list.push(k);
    // Only where the collisions are the lesson — see ARENA_LESSONS.
    if (ARENA_LESSONS.includes(mod.id)) list.push("arena");
    return only ? list.filter((m) => m === only) : list;
  }, [mod, boards, only]);

  const [mode, setMode] = useState<GameMode>(
    () => only ?? (initialMode && available.includes(initialMode) ? initialMode : available[0]) ?? "matching"
  );
  const [lastScore, setLastScore] = useState<number | null>(null);

  async function handleComplete(score: number) {
    setLastScore(score);
    onScore?.(score);
    if (!user) return;
    await saveGameResult({
      id: generateId("game"),
      moduleId: mod.id,
      userId: user.uid,
      gameType: mode as never,
      score,
      completedAt: new Date().toISOString(),
    });
    onSaved?.();
  }

  // Remounting on every mode or seed change resets each game's internal state.
  const key = `${mode}-${mod.id}-${boardSeed}`;

  return (
    <div className="space-y-4">
      {!only && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Ойын түрлері">
          {available.map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setLastScore(null);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === m
                  ? "bg-brand-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-brand-50 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              }`}
            >
              {GAME_LABELS[m]}
            </button>
          ))}
        </div>
      )}

      <p className="text-body text-slate-600 dark:text-slate-400">{GAME_HINTS[mode]}</p>

      {mode === "matching" && mod.game.pairs && (
        <MatchingGame key={key} pairs={mod.game.pairs} seed={boardSeed} onComplete={handleComplete} />
      )}
      {mode === "dragdrop" && mod.game.pairs && (
        <DragDropGame key={key} pairs={mod.game.pairs} seed={boardSeed} onComplete={handleComplete} />
      )}
      {mode === "memory" && mod.game.pairs && (
        <MemoryGame key={key} pairs={mod.game.pairs} seed={boardSeed} onComplete={handleComplete} />
      )}
      {mode === "flashcards" && (
        <FlashCardsGame key={key} terms={lessonGlossary(mod)} onComplete={handleComplete} />
      )}
      {mode === "spinwheel" && (
        <SpinWheelGame key={key} questions={mod.quiz.slice(0, 6)} onComplete={handleComplete} />
      )}
      {mode === "crossword" && boards.crossword && (
        <CrosswordGame key={key} board={boards.crossword} onComplete={handleComplete} />
      )}
      {mode === "wordsearch" && boards.wordsearch && (
        <WordSearchGame key={key} board={boards.wordsearch} onComplete={handleComplete} />
      )}
      {mode === "fillblank" && boards.fillblank && (
        <FillBlankGame key={key} items={boards.fillblank} onComplete={handleComplete} />
      )}
      {mode === "sorting" && boards.sorting && (
        <SortingGame key={key} board={boards.sorting} onComplete={handleComplete} />
      )}
      {mode === "speedquiz" && boards.speedquiz && (
        <SpeedQuizGame key={key} board={boards.speedquiz} onComplete={handleComplete} />
      )}
      {mode === "truefalse" && boards.truefalse && (
        <TrueFalseGame key={key} board={boards.truefalse} onComplete={handleComplete} />
      )}
      {mode === "order" && boards.order && (
        <OrderGame key={key} board={boards.order} onComplete={handleComplete} />
      )}
      {mode === "blitz" && boards.blitz && (
        <BlitzGame key={key} board={boards.blitz} onComplete={handleComplete} />
      )}
      {mode === "coaster" && <CoasterGame key={key} onComplete={handleComplete} />}
      {(mode === "bow" || mode === "asyq" || mode === "tug" || mode === "rocket") && (
        <FolkGame key={key} kind={mode as FolkKind} seed={boardSeed} onComplete={handleComplete} />
      )}
      {mode === "projectile" && boards.projectile && (
        <ProjectileGame key={key} board={boards.projectile} onComplete={handleComplete} />
      )}
      {mode === "arena" && <ArenaGame key={key} moduleId={mod.id} onComplete={handleComplete} />}

      {lastScore !== null && (
        <div className="surface-card flex items-center gap-3">
          <Trophy className="text-amber-500" />
          <p className="text-sm font-semibold">
            Ойын нәтижесі: {lastScore} / 100 ұпай. Ұпай құзыреттілік бағасына қосылады.
          </p>
        </div>
      )}
    </div>
  );
}
