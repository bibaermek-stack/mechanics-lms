import { describe, expect, it } from "vitest";
import { ALL_MODULES, QUIZ_LENGTH, drawQuiz, quizLength, randomizeQuiz } from "./modules";
import { EXTRA_QUIZ_SEEDS, fmt } from "./quizBank";
import { DIAGNOSTIC_QUESTIONS } from "./diagnostic";
import { seededRandom } from "@/lib/rng";

const NBSP = " ";

describe("fmt: numbers the way Kazakh writes them", () => {
  it("uses a decimal comma and drops trailing zeros", () => {
    expect(fmt(3.14159)).toBe("3,14".replace(".", ","));
    expect(fmt(2.5)).toBe("2,5");
    expect(fmt(2)).toBe("2");
    expect(fmt(0.628)).toBe("0,63");
    expect(fmt(0.0020, 4)).toBe("0,002");
  });

  it("groups thousands from five digits with a no-break space, leaves four digits alone", () => {
    expect(fmt(1800)).toBe("1800");
    expect(fmt(75000)).toBe(`75${NBSP}000`);
    expect(fmt(20000000)).toBe(`20${NBSP}000${NBSP}000`);
  });

  it("keeps the sign, and does not turn 100 into 1", () => {
    expect(fmt(-4.5)).toBe("−4,5");
    expect(fmt(100)).toBe("100");
    expect(fmt(100, 0)).toBe("100");
  });
});

describe("every lesson has a bank to draw from", () => {
  it("has fifteen questions per lesson, the original ones first and unchanged", () => {
    expect(ALL_MODULES).toHaveLength(10);
    for (const m of ALL_MODULES) {
      expect(m.quiz.length, `lesson ${m.id}`).toBe(15);
      expect(m.quiz[0].id).toBe(`m${m.id}q1`);
    }
    // The five definition questions lesson 3 shipped with are still the first five.
    expect(ALL_MODULES[2].quiz[0].question).toBe("Күштің өлшем бірлігі қандай?");
  });

  it("numbers questions uniquely across the whole course", () => {
    const ids = ALL_MODULES.flatMap((m) => m.quiz.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of ALL_MODULES) m.quiz.forEach((q, i) => expect(q.id).toBe(`m${m.id}q${i + 1}`));
  });

  it("never asks the same question twice", () => {
    const texts = ALL_MODULES.flatMap((m) => m.quiz.map((q) => q.question.trim().toLowerCase()));
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("does not reuse a diagnostic item (the pre/post test must stay unseen)", () => {
    const diag = new Set(DIAGNOSTIC_QUESTIONS.map((d) => d.question.trim().toLowerCase()));
    for (const m of ALL_MODULES) for (const q of m.quiz) expect(diag.has(q.question.trim().toLowerCase()), q.id).toBe(false);
  });
});

describe("every question is well formed", () => {
  const all = ALL_MODULES.flatMap((m) => m.quiz.map((q) => ({ lesson: m.id, q })));

  it("has four different options and a valid key", () => {
    for (const { q } of all) {
      expect(q.options, q.id).toHaveLength(4);
      expect(new Set(q.options).size, `${q.id} repeats an option`).toBe(4);
      expect(q.correctIndex).toBe(0); // the engine shuffles at draw time
      for (const o of q.options) expect(o.trim().length, q.id).toBeGreaterThan(0);
    }
  });

  it("explains the answer", () => {
    for (const { q } of all) expect(q.explanation.trim().length, q.id).toBeGreaterThan(15);
  });

  it("has no unfilled placeholder or numeric garbage left in any text", () => {
    for (const { q } of all) {
      for (const text of [q.question, q.explanation, ...q.options]) {
        expect(text, q.id).not.toMatch(/[{}]|undefined|NaN|Infinity/);
      }
    }
  });

  it("has no Latin 'i' typed inside a Kazakh word (a copy-paste slip that looks fine on screen)", () => {
    const slip = /[Ѐ-ӿ]i|i[Ѐ-ӿ]/;
    for (const { q } of all) for (const text of [q.question, q.explanation, ...q.options]) expect(text, q.id).not.toMatch(slip);
  });

  it("does not give the answer away by being the longest option every time", () => {
    // A well-known flaw: students learn to pick the longest option. Judged over
    // the questions added here, where the options were written to be similar.
    let longest = 0;
    let total = 0;
    for (const m of ALL_MODULES) {
      for (const q of m.quiz.slice(-EXTRA_QUIZ_SEEDS[m.id].length)) {
        total++;
        const correct = q.options[q.correctIndex].length;
        if (q.options.every((o, i) => i === q.correctIndex || o.length < correct)) longest++;
      }
    }
    expect(longest / total).toBeLessThan(0.45);
  });
});

describe("the numerical questions have the right answer (worked by hand, independently of the code)", () => {
  // phrase unique to the question → the option that must be marked correct.
  const EXPECTED: [string, string][] = [
    ["Велосипедші 150 м", "6 м/с"],
    ["Автомобиль тыныштықтан бастап 2,5 м/с²", "20 м/с"],
    ["Дене тыныштықтан бастап 3 м/с² үдеумен қозғалады. 6 с", "54 м"],
    ["21 м жолда 4 м/с-тан 10 м/с-қа", "2 м/с²"],
    ["Тас биік жардан еркін құлап, 3 с", "45 м"],
    ["Массасы 8 кг арбаға 20 Н", "2,5 м/с²"],
    ["Массасы 1200 кг автомобиль 1,5 м/с²", "1800 Н"],
    ["Денеге 60 Н күш әсер еткенде", "15 кг"],
    ["Массасы 45 кг бала", "450 Н"],
    ["Көлденең еденде массасы 20 кг жәшік", "60 Н"],
    ["оңға қарай 30 Н, солға қарай 18 Н", "3 м/с²"],
    ["36 Н күш денеге 4,5 м/с²", "12 Н"],
    ["Массасы 1500 кг автомобиль тыныштықтан 6 с", "3000 Н"],
    ["Массасы 3 кг жүк жіпке", "30 Н"],
    ["шанаға 40 Н күшпен", "160 Дж"],
    ["Массасы 6 кг дене 5 м/с", "75 Дж"],
    ["Массасы 1,5 кг кітап", "30 Дж"],
    ["Кран ", "1500 Вт"],
    ["Қозғалтқыш 500 Дж", "70 %"],
    ["Массасы 0,4 кг доп", "10 кг·м/с"],
    ["Футболшы допқа 600 Н", "30 кг·м/с"],
    ["Массасы 2 кг арба 3 м/с", "2 м/с"],
    ["Массасы 4 кг мылтықтан", "1 м/с"],
    ["Дөңгелек 2 с ішінде бір толық", "3,14 рад/с"],
    ["10 рад/с, радиусы 0,3 м", "3 м/с"],
    ["Гайка кілтін 0,25 м", "20 Н·м"],
    ["Инерция моменті 3 кг·м² дөңгелекке", "4 рад/с²"],
    ["Инерция моменті 0,5 кг·м² маховик", "9 Дж"],
    ["жіп ұзындығы 2,5 м", "3,14 с"],
    ["Массасы 1 кг жүк қатаңдығы 100 Н/м", "0,63 с"],
    ["Қатаңдығы 250 Н/м серіппені", "10 Н"],
    ["20 рет көтеріп-түсірді", "2 Гц"],
    ["Алюминий бөлшегінің массасы 5,4 кг", "2700 кг/м³"],
    ["Су астында 7,5 м тереңдікте", `75${NBSP}000 Па`],
    ["Көлемі 0,004 м³ дене", "40 Н"],
    ["кең бөлігінің қимасы 20 см²", "12 м/с"],
    ["Ауданы 0,03 м² тірекке", `20${NBSP}000 Па`],
    ["Ауданы 0,0006 м² болат өзекті", "20 МПа"],
    ["Ұзындығы 1,5 м өзек", "0,002"],
    ["Болаттың Юнг модулі 200 ГПа", "100 МПа"],
    ["үзілу кернеуі 400 МПа", "2,5"],
  ];

  const questions = ALL_MODULES.flatMap((m) => m.quiz);

  it.each(EXPECTED)("%s → %s", (phrase, correct) => {
    const hits = questions.filter((q) => q.question.includes(phrase));
    expect(hits, `phrase "${phrase}" must match exactly one question`).toHaveLength(1);
    expect(hits[0].options[hits[0].correctIndex]).toBe(correct);
  });

  it("covers every numerical question that was added", () => {
    const built = Object.values(EXTRA_QUIZ_SEEDS).flat().filter((s) => s.kind === "numeric");
    expect(built.length).toBe(EXPECTED.length);
  });

  it("prints the numbers it was given exactly, not rounded to the precision of the answer", () => {
    const text = (phrase: string) => questions.find((q) => q.question.includes(phrase))!.question;
    expect(text("Алюминий бөлшегінің")).toContain("көлемі 0,002 м³");
    expect(text("Көлемі 0,004")).toContain("0,004 м³");
    expect(text("Ауданы 0,0006")).toContain("0,0006 м²");
    expect(text("Юнг модулі")).toContain("0,0005 салыстырмалы");
  });

  it("states every number the answer was computed from", () => {
    // 0,0005 · 200 ГПа = 0,1 ГПa = 100 МПа — the explanation must show the same strain.
    const young = questions.find((q) => q.question.includes("Юнг модулі"))!;
    expect(young.explanation).toContain("0,0005");
    expect(young.explanation).toContain("0,1 ГПа");
  });

  it("offers wrong answers that are plausible: of the same kind, never the right one", () => {
    for (const [phrase, correct] of EXPECTED) {
      const q = questions.find((x) => x.question.includes(phrase))!;
      const unit = correct.replace(/^[\d ,−-]+\s?/, "");
      for (const o of q.options) if (unit) expect(o.endsWith(unit), `${q.id}: "${o}" lacks unit "${unit}"`).toBe(true);
    }
  });
});

describe("drawQuiz: one sitting of a quiz", () => {
  const bank = ALL_MODULES[4].quiz;

  it("draws ten distinct questions from a bank of fifteen", () => {
    const sitting = drawQuiz(bank, QUIZ_LENGTH, seededRandom(1));
    expect(sitting).toHaveLength(10);
    expect(new Set(sitting.map((q) => q.id)).size).toBe(10);
    for (const q of sitting) expect(bank.some((b) => b.id === q.id)).toBe(true);
  });

  it("shuffles the options but keeps pointing at the same right answer", () => {
    for (let seed = 0; seed < 60; seed++) {
      for (const q of drawQuiz(bank, 15, seededRandom(seed))) {
        const original = bank.find((b) => b.id === q.id)!;
        expect([...q.options].sort()).toEqual([...original.options].sort());
        expect(q.options[q.correctIndex]).toBe(original.options[original.correctIndex]);
      }
    }
  });

  it("is different every time, so a retry is a new quiz", () => {
    const sets = new Set<string>();
    for (let seed = 0; seed < 30; seed++) sets.add(drawQuiz(bank, 10, seededRandom(seed)).map((q) => q.id).sort().join());
    expect(sets.size).toBeGreaterThan(10);
  });

  it("is reproducible with the same generator", () => {
    expect(drawQuiz(bank, 10, seededRandom(7))).toEqual(drawQuiz(bank, 10, seededRandom(7)));
  });

  it("uses a short bank whole (a lesson a teacher rewrote with five questions)", () => {
    const five = bank.slice(0, 5);
    expect(drawQuiz(five)).toHaveLength(5);
    expect(quizLength(five)).toBe(5);
    expect(quizLength(bank)).toBe(10);
  });

  it("does not modify the bank it draws from", () => {
    const before = JSON.stringify(bank);
    drawQuiz(bank, 10, seededRandom(3));
    expect(JSON.stringify(bank)).toBe(before);
  });

  it("randomizeQuiz still gives a sitting of a shipped lesson", () => {
    expect(randomizeQuiz(3)).toHaveLength(10);
    expect(randomizeQuiz(999)).toEqual([]);
  });
});
