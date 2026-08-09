// One 3D simulation per module. The heavy scene component is loaded on demand
// (see SimulationPanel), this file only carries the metadata the module page
// needs before the canvas mounts.

export interface SimulationMeta {
  moduleId: number;
  title: string;
  subtitle: string;
  /** Scanned PASCO devices that appear in the scene. */
  devices: string[];
  /** Roughly how long a full run takes, in minutes. */
  minutes: number;
}

export const SIMULATIONS: SimulationMeta[] = [
  {
    moduleId: 1,
    title: "Санақ жүйесі және материалдық нүкте",
    subtitle:
      "Smart Cart рельс бойымен қозғалады. Санақ жүйесін ауыстырып, «жол» мен «орын ауыстыруды» салыстыр.",
    devices: ["Smart Cart", "Motion Sensor"],
    minutes: 8,
  },
  {
    moduleId: 2,
    title: "Бірқалыпты және үдемелі қозғалыс",
    subtitle:
      "v₀ мен a-ны өзгертіп, Motion Sensor деректерінен x–t, v–t, a–t графиктерін тұрғыз.",
    devices: ["Smart Cart", "Motion Sensor"],
    minutes: 12,
  },
  {
    moduleId: 3,
    title: "Ньютонның ІІ заңы: арба мен ілінген жүк",
    subtitle:
      "Шкив арқылы тартылған арбаның үдеуін болжа, үйкелісті қосып шекті жағдайды тап.",
    devices: ["Smart Cart", "Smart Gate"],
    minutes: 12,
  },
  {
    moduleId: 4,
    title: "Ньютонның үш заңы бір рельсте",
    subtitle:
      "Инерция, F = ma және әсер–кері әсер: үш тәжірибені ауыстырып тексер.",
    devices: ["Smart Cart", "Smart Gate"],
    minutes: 14,
  },
  {
    moduleId: 5,
    title: "Көлбеу жазықтықтағы энергия айналымы",
    subtitle:
      "Eₚ → Eₖ айналуын және үйкеліске кеткен жылуды нақты уақытта диаграммадан бақыла.",
    devices: ["Smart Cart", "Smart Gate"],
    minutes: 12,
  },
  {
    moduleId: 6,
    title: "Серпімді және серпімсіз соққы",
    subtitle:
      "Екі арбаны Smart Gate арқылы өлшеп, импульс пен кинетикалық энергияның сақталуын салыстыр.",
    devices: ["Smart Cart", "Smart Gate"],
    minutes: 14,
  },
  {
    moduleId: 7,
    title: "Инерция моменті: жүкпен айналдырылатын маховик",
    subtitle:
      "Диск, сақина және айқас өзекті ауыстырып, бірдей масса мен радиуста α-ның қалай өзгеретінін көр: τ = Iα.",
    devices: ["Smart Gate"],
    minutes: 14,
  },
  {
    moduleId: 8,
    title: "Серіппелі және математикалық маятник",
    subtitle:
      "Периодты өлшеп, T = 2π√(m/k) мен T = 2π√(L/g) формулаларының дәлдігін тексер.",
    devices: ["Smart Cart", "Smart Gate"],
    minutes: 15,
  },
  {
    moduleId: 9,
    title: "Архимед күші және қалқу шарты",
    subtitle:
      "Денені сұйыққа батырып, ығыстырылған көлем мен итергіш күш арасындағы байланысты өлше.",
    devices: [],  // тек өз модельдеріміз
    minutes: 12,
  },
  {
    moduleId: 10,
    title: "Көпір арқалығының иілуі мен беріктігі",
    subtitle:
      "Жүріп өтетін жүк астындағы моментті, кернеуді және беріктік қорын инженер ретінде бағала.",
    devices: ["Smart Cart"],
    minutes: 15,
  },
  // 11–13 belong to prescribed lab works whose lesson already had a scene of
  // its own, so they are numbered past the ten lessons. See src/data/labWorks.ts.
  {
    moduleId: 11,
    title: "Үйкеліс коэффициентін анықтау",
    subtitle:
      "Тартушы күшті баяу арттырып, күш датчигінің қисығынан μₛ мен μₖ-ны оқы. Төрт бетті салыстыр.",
    devices: ["Smart Cart"],
    minutes: 12,
  },
  {
    moduleId: 12,
    title: "Еркін түсу үдеуін анықтау",
    subtitle:
      "Екі фотоқақпа арқылы шардың екі нүктедегі жылдамдығын өлшеп, g = (v₂²−v₁²)/2d есепте.",
    devices: ["Smart Gate"],
    minutes: 10,
  },
  {
    moduleId: 13,
    title: "Айналмалы қозғалысты зерттеу",
    subtitle:
      "Rotary Motion Sensor θ, ω, α шамаларын бір мезгілде тіркейді. Үш графиктің байланысын аш.",
    devices: ["Rotary Motion Sensor"],
    minutes: 12,
  },
];

export function getSimulation(moduleId: number): SimulationMeta | undefined {
  return SIMULATIONS.find((s) => s.moduleId === moduleId);
}
