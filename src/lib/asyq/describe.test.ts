import { describe, expect, it } from "vitest";
import { describeRules } from "./describe";
import { getMode } from "./modes";
import { FACE_ZERO } from "./rules";

const base = getMode("asyq-atu").defaults();

describe("describing the rules", () => {
  it("states the ring, the asyqs, the points and the end of a default game", () => {
    const t = describeRules(base).join("\n");
    expect(t).toContain("диаметрі 1,2 м");
    expect(t).toContain("5 асық қатарға");
    expect(t).toContain("әр асыққа 1");
    expect(t).toContain("таусылғанда ойын аяқталады");
    expect(t).toContain("3 реттен");
  });

  it("follows the rules it is given: points, bonuses, turn rule, end and order", () => {
    const t = describeRules({ ...base, pointsPerAsyq: 3, faceBonus: { ...FACE_ZERO, alshy: 2, shik: -1 }, turnRule: "pass", end: { kind: "points", target: 7 }, turnOrder: "toss", layout: "ring", leaveRule: "whole" }).join("\n");
    expect(t).toContain("әр асыққа 3");
    expect(t).toContain("Алшы +2");
    expect(t).toContain("Шік -1");
    expect(t).not.toContain("Бүк");
    expect(t).toContain("кезек келесі ойыншыға өтеді");
    expect(t).toContain("7 ұпайға бірінші жеткен");
    expect(t).toContain("иіру");
    expect(t).toContain("шеңберге");
    expect(t).toContain("бүкіл денесі");
  });

  it("describes a throws-each game", () => {
    expect(describeRules({ ...base, end: { kind: "throws", perPlayer: 4 } }).join("\n")).toContain("4 реттен лақтырады");
  });
});
