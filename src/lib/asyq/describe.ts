// The rules of a game in a few plain Kazakh lines, for the screen, so everyone at the table knows what is being played.

import { FACE_IDS, FACE_INFO } from "./faces";
import { SURFACES } from "./physics";
import type { RuleConfig } from "./rules";

const fmt = (x: number, d = 1) => x.toFixed(d).replace(".", ",");

export function describeRules(c: RuleConfig): string[] {
  const lines = [
    `Ойыншылар: ${c.players.length}. Нысанада ${c.targetCount} асық ${c.layout === "line" ? "қатарға" : "шеңберге"} тігіледі (${FACE_INFO[c.setupFace].name} қырымен тұрады).`,
    `Шеңбер: диаметрі ${fmt(c.ringRadius * 2)} м. Асықтың ${c.leaveRule === "centre" ? "ортасы" : "бүкіл денесі"} шеңберден шықса — асық лақтырушыға. Жер беті: ${SURFACES[c.surface].name.toLowerCase()}.`,
    `Ұпай: әр асыққа ${c.pointsPerAsyq}.`,
  ];
  const bonus = FACE_IDS.filter((f) => c.faceBonus[f] !== 0).map((f) => `${FACE_INFO[f].name} ${c.faceBonus[f] > 0 ? "+" : ""}${c.faceBonus[f]}`);
  if (bonus.length) lines[2] += ` Қырына қарай қосымша: ${bonus.join(", ")}.`;
  lines.push(
    c.turnRule === "continue" ? `Асық ұтқан ойыншы қатарынан ${c.maxStreak} реттен артық болмай, тағы лақтырады.` : "Әр лақтырудан кейін кезек келесі ойыншыға өтеді."
  );
  lines.push(
    c.end.kind === "cleared"
      ? "Нысанадағы асықтар таусылғанда ойын аяқталады."
      : c.end.kind === "points"
        ? `${c.end.target} ұпайға бірінші жеткен жеңеді${c.refillWhenCleared ? " (асықтар таусылса, жаңадан тігіледі)" : ""}.`
        : `Әр ойыншы ${c.end.perPlayer} реттен лақтырады; ең көп ұпай жинаған жеңеді.`
  );
  lines.push(c.turnOrder === "toss" ? "Кім бірінші лақтыратыны сақаны иіру арқылы анықталады (алшы, тәйке, бүк, шік тәртібімен)." : "Кезек ойыншылардың тізімі бойынша жүреді.");
  return lines;
}
