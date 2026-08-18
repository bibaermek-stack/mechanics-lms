// The experiments a student can walk into with a headset or a phone.
//
// Four of the ten prescribed laboratory works were chosen for VR/AR, on one
// criterion: whether standing next to the apparatus at real scale teaches
// something a flat screen cannot. Kinematics and Newton's second law read very
// differently when the track is 1,2 m of aluminium in front of you and the
// hanging weight really is below the bench top; the pendulum's period is
// something you feel. Works that are pure graph reading stay on the desktop
// simulations, which do them better.

import type { VrExperiment } from "./types";

export const CHART_COLORS = {
  x: "#60a5fa",
  v: "#34d399",
  a: "#fbbf24",
  f: "#f87171",
  e: "#c084fc",
  q: "#fb7185",
};

export const VR_EXPERIMENTS: VrExperiment[] = [
  {
    id: "kinematics",
    title: "Бірқалыпты және бірқалыпты үдемелі қозғалыс",
    subtitle:
      "Smart Cart 1,2 м рельс бойымен жүреді, Motion Sensor оны ультрадыбыспен «көреді». Рельстің қасында тұрып, v₀ мен a-ны өзгертіп көр.",
    goal:
      "Виртуалды зертханада тұрып, бірқалыпты және үдемелі қозғалысты ажырату, x–t пен v–t графиктерінің көлбеуін өз көзіңмен байланыстыру.",
    formulas: ["v = v₀ + a·t", "x = x₀ + v₀t + at²/2", "a = Δv/Δt"],
    devices: ["smartCart", "motionSensor"],
    built: ["1,2 м динамикалық рельс", "зертханалық үстел", "өлшеу шкаласы"],
    labIds: [1, 2],
    lessonId: 2,
    minutes: 10,
    duration: 20,
    params: [
      {
        key: "x0",
        label: "Бастапқы координата x₀",
        unit: "м",
        min: 0.15,
        max: 0.6,
        step: 0.01,
        value: 0.18,
        decimals: 2,
      },
      {
        key: "v0",
        label: "Бастапқы жылдамдық v₀",
        unit: "м/с",
        min: 0,
        max: 0.8,
        step: 0.01,
        value: 0.25,
        decimals: 2,
        inVr: true,
      },
      {
        key: "a",
        label: "Үдеу a",
        unit: "м/с²",
        min: -0.6,
        max: 0.6,
        step: 0.01,
        value: 0.3,
        decimals: 2,
        hint: "a = 0 болса — қозғалыс бірқалыпты.",
        inVr: true,
      },
    ],
    readouts: [
      { key: "x", label: "Координата x", unit: "м", decimals: 3, color: CHART_COLORS.x },
      { key: "v", label: "Жылдамдық v", unit: "м/с", decimals: 3, color: CHART_COLORS.v },
      { key: "a", label: "Үдеу a", unit: "м/с²", decimals: 2, color: CHART_COLORS.a },
      { key: "path", label: "Жүрілген жол s", unit: "м", decimals: 3 },
    ],
    chart: [
      { key: "x", label: "x, м", color: CHART_COLORS.x },
      { key: "v", label: "v, м/с", color: CHART_COLORS.v },
    ],
    tasks: [
      "a = 0 қойып, x–t графигінің неге түзу сызық болатынын түсіндір.",
      "a-ны екі есе арттырғанда v–t графигінің көлбеуі қалай өзгереді?",
      "Рельстің қасына жақындап тұрып, арбаның бір секундта жүрген жолын шамала да, өлшеумен салыстыр.",
    ],
  },
  {
    id: "dynamics",
    title: "Ньютонның ІІ заңы: арба және ілінген жүк",
    subtitle:
      "Жіп шкив арқылы ілінген жүкке жалғанған. Массаларды және үйкеліс коэффициентін өзгертіп, F = ma-ны тексер.",
    goal:
      "Тартушы күш, масса және үдеу арасындағы байланысты эксперимент арқылы тексеру, үйкелістің үдеуге әсерін көру.",
    formulas: ["a = (m₂g − μm₁g)/(m₁+m₂)", "T = m₂(g − a)", "Fүйк = μm₁g"],
    devices: ["smartCart", "smartGate"],
    built: ["динамикалық рельс", "үстел шкиві", "жүк ілгіші", "күш векторлары"],
    labIds: [3, 4],
    lessonId: 4,
    minutes: 12,
    duration: 12,
    params: [
      {
        key: "mCart",
        label: "Арбаның массасы m₁",
        unit: "кг",
        min: 0.2,
        max: 1.0,
        step: 0.01,
        value: 0.25,
        decimals: 2,
        inVr: true,
      },
      {
        key: "mHang",
        label: "Ілінген жүк m₂",
        unit: "кг",
        min: 0.02,
        max: 0.25,
        step: 0.005,
        value: 0.05,
        decimals: 3,
        inVr: true,
      },
      {
        key: "mu",
        label: "Үйкеліс коэффициенті μ",
        min: 0,
        max: 0.4,
        step: 0.01,
        value: 0.05,
        decimals: 2,
        hint: "μ тым үлкен болса, арба орнынан қозғалмайды.",
        inVr: true,
      },
    ],
    readouts: [
      { key: "a", label: "Үдеу a", unit: "м/с²", decimals: 3, color: CHART_COLORS.a },
      { key: "v", label: "Жылдамдық v", unit: "м/с", decimals: 3, color: CHART_COLORS.v },
      { key: "T", label: "Жіптің керілуі T", unit: "Н", decimals: 3, color: CHART_COLORS.f },
      { key: "Ffr", label: "Үйкеліс күші", unit: "Н", decimals: 3 },
    ],
    chart: [
      { key: "v", label: "v, м/с", color: CHART_COLORS.v },
      { key: "a", label: "a, м/с²", color: CHART_COLORS.a },
    ],
    tasks: [
      "m₂ тұрақты болып, m₁ екі есе өссе, үдеу қалай өзгереді? Өлшеп тексер.",
      "μ-ді біртіндеп арттыра отырып, арба қозғалмай қалатын шекті мәнді тап.",
      "Жіптің керілуі неге m₂g-дан кіші екенін түсіндір.",
    ],
  },
  {
    id: "energy",
    title: "Көлбеу жазықтықтағы энергияның сақталуы",
    subtitle:
      "Арбаны көлбеу рельстен жіберіп, Eₚ → Eₖ айналуын және үйкеліске кеткен жылуды бақыла.",
    goal:
      "Механикалық энергияның сақталу заңын тексеру және үйкеліс болғанда энергияның қайда кететінін көрсету.",
    formulas: ["Eₚ = mgh", "Eₖ = mv²/2", "Eₚ + Eₖ + Q = const"],
    devices: ["smartCart", "motionSensor"],
    built: ["көлбеу жазықтық", "бұрыш өлшегіш", "энергия бағандары"],
    labIds: [6],
    lessonId: 5,
    minutes: 12,
    duration: 14,
    params: [
      {
        key: "angle",
        label: "Көлбеу бұрышы α",
        unit: "°",
        min: 5,
        max: 30,
        step: 1,
        value: 15,
        decimals: 0,
        inVr: true,
      },
      {
        key: "mass",
        label: "Арбаның массасы m",
        unit: "кг",
        min: 0.2,
        max: 1.0,
        step: 0.05,
        value: 0.25,
        decimals: 2,
      },
      {
        key: "mu",
        label: "Үйкеліс коэффициенті μ",
        min: 0,
        max: 0.3,
        step: 0.01,
        value: 0.04,
        decimals: 2,
        inVr: true,
      },
    ],
    readouts: [
      { key: "h", label: "Биіктік h", unit: "м", decimals: 3 },
      { key: "v", label: "Жылдамдық v", unit: "м/с", decimals: 3, color: CHART_COLORS.v },
      { key: "Ep", label: "Потенциалдық Eₚ", unit: "Дж", decimals: 3, color: CHART_COLORS.e },
      { key: "Ek", label: "Кинетикалық Eₖ", unit: "Дж", decimals: 3, color: CHART_COLORS.v },
      { key: "Q", label: "Үйкеліс жылуы Q", unit: "Дж", decimals: 3, color: CHART_COLORS.q },
    ],
    chart: [
      { key: "Ep", label: "Eₚ, Дж", color: CHART_COLORS.e },
      { key: "Ek", label: "Eₖ, Дж", color: CHART_COLORS.v },
      { key: "Q", label: "Q, Дж", color: CHART_COLORS.q },
    ],
    tasks: [
      "μ = 0 кезінде Eₚ + Eₖ қосындысы тұрақты ма? Графиктен тексер.",
      "Бұрышты өзгерткенде толық энергия өзгере ме, әлде тек оның таралуы ма?",
      "Үйкеліс болғанда энергия «жоғалды» деу неге дұрыс емес?",
    ],
  },
  {
    id: "pendulum",
    title: "Математикалық маятник және оның периоды",
    subtitle:
      "Жіптің ұзындығын өзгертіп, Smart Gate фотоқақпасы өлшеген периодты T = 2π√(L/g) формуласымен салыстыр.",
    goal:
      "Маятник периодының неден тәуелді (және неден тәуелді емес) екенін эксперимент арқылы анықтау.",
    formulas: ["T = 2π√(L/g)", "θ(t) = θ₀cos(ωt)", "ω = √(g/L)"],
    devices: ["smartGate", "motionSensor"],
    built: ["штатив", "жіп пен жүк", "бұрыш шкаласы"],
    labIds: [7],
    lessonId: 8,
    minutes: 10,
    duration: 24,
    params: [
      {
        key: "length",
        label: "Жіптің ұзындығы L",
        unit: "м",
        min: 0.2,
        max: 0.9,
        step: 0.01,
        value: 0.5,
        decimals: 2,
        inVr: true,
      },
      {
        key: "amplitude",
        label: "Бастапқы бұрыш θ₀",
        unit: "°",
        min: 3,
        max: 35,
        step: 1,
        value: 15,
        decimals: 0,
        inVr: true,
      },
      {
        key: "mass",
        label: "Жүктің массасы m",
        unit: "кг",
        min: 0.05,
        max: 0.5,
        step: 0.05,
        value: 0.1,
        decimals: 2,
        hint: "Периодқа әсер ете ме? Тексеріп көр.",
      },
    ],
    readouts: [
      { key: "theta", label: "Бұрыш θ", unit: "°", decimals: 1, color: CHART_COLORS.x },
      { key: "omega", label: "Бұрыштық жылдамдық ω", unit: "рад/с", decimals: 2, color: CHART_COLORS.v },
      { key: "Ttheory", label: "Теориялық период T", unit: "с", decimals: 3 },
      { key: "Tmeasured", label: "Өлшенген период T", unit: "с", decimals: 3, color: CHART_COLORS.a },
    ],
    chart: [{ key: "theta", label: "θ, °", color: CHART_COLORS.x }],
    tasks: [
      "Массаны өзгертіп, периодтың өзгеретін-өзгермейтінін тексер.",
      "L-ді төрт есе арттырсаң, период неше есе өседі? Болжап, содан кейін өлше.",
      "θ₀ = 35° кезінде өлшенген период теориялық мәннен неге сәл үлкен болатынын түсіндір.",
    ],
  },
];

export function getVrExperiment(id: string): VrExperiment | undefined {
  return VR_EXPERIMENTS.find((e) => e.id === id);
}

/** The VR experiment that carries a given laboratory work, if there is one. */
export function vrExperimentForLab(labId: number): VrExperiment | undefined {
  return VR_EXPERIMENTS.find((e) => e.labIds.includes(labId));
}

/** The VR experiment attached to a lesson, if that lesson has one. */
export function vrExperimentForLesson(lessonId: number): VrExperiment | undefined {
  return VR_EXPERIMENTS.find((e) => e.lessonId === lessonId);
}

/** Slider defaults as a plain params object. */
export function defaultParams(experiment: VrExperiment): Record<string, number> {
  return Object.fromEntries(experiment.params.map((p) => [p.key, p.value]));
}
