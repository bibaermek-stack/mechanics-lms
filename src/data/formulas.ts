// The formula bank, and the arithmetic that goes with it.
//
// Written out by hand rather than asked of the model, and deliberately so. A
// language model that mistypes F = m·v in a reference table is worse than no
// table at all: the student has no way to tell, and the error propagates into
// every problem they solve afterwards. So the formulas and their inverses are
// data, checked by a round-trip test, and the AI is only ever asked to explain
// what is already here.
//
// Angles are in degrees throughout, because that is what the problems are
// written in; the conversion happens inside the solver, never in the UI.

export interface FormulaVar {
  /** Symbol as it appears in the expression. */
  sym: string;
  name: string;
  /** SI unit, or "°" / "%" where that is what the course uses. */
  unit: string;
  /** True where zero or a negative value has no physical meaning. */
  positive?: boolean;
}

export interface Formula {
  id: string;
  /**
   * The lessons this belongs to, 1…10.
   *
   * A list rather than one id, because several formulas genuinely sit in two
   * places at once: F = m·a is introduced in Динамика and is the whole subject
   * of Ньютон заңдары, and a student looking under either should find it.
   */
  moduleIds: number[];
  title: string;
  /** The equation as it is written on the board. */
  expr: string;
  vars: FormulaVar[];
  /**
   * How to get each variable from the others.
   *
   * A variable with no entry cannot be isolated in closed form — the time in
   * s = v₀t + at²/2 needs the quadratic formula and has two roots — and the
   * page simply does not offer it as an unknown rather than guessing.
   */
  solve: Record<string, (v: Record<string, number>) => number>;
  /** One line on what it is for. */
  note: string;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Standard gravity, used where a formula names g but the student did not. */
export const G = 9.81;

export const FORMULAS: Formula[] = [
  // — Кинематика ————————————————————————————————————————————————
  {
    id: "avg-speed",
    moduleIds: [2],
    title: "Орташа жылдамдық",
    expr: "v = s / t",
    note: "Бірқалыпты қозғалыстағы жылдамдық: жүрілген жолдың уақытқа қатынасы.",
    vars: [
      { sym: "v", name: "Жылдамдық", unit: "м/с" },
      { sym: "s", name: "Жол", unit: "м" },
      { sym: "t", name: "Уақыт", unit: "с", positive: true },
    ],
    solve: {
      v: (x) => x.s / x.t,
      s: (x) => x.v * x.t,
      t: (x) => x.s / x.v,
    },
  },
  {
    id: "velocity-accel",
    moduleIds: [2],
    title: "Бірқалыпты үдемелі қозғалыстағы жылдамдық",
    expr: "v = v₀ + a · t",
    note: "Уақыт өткен соңғы жылдамдық. Тежелгенде a теріс мәнмен алынады.",
    vars: [
      { sym: "v", name: "Соңғы жылдамдық", unit: "м/с" },
      { sym: "v0", name: "Бастапқы жылдамдық", unit: "м/с" },
      { sym: "a", name: "Үдеу", unit: "м/с²" },
      { sym: "t", name: "Уақыт", unit: "с", positive: true },
    ],
    solve: {
      v: (x) => x.v0 + x.a * x.t,
      v0: (x) => x.v - x.a * x.t,
      a: (x) => (x.v - x.v0) / x.t,
      t: (x) => (x.v - x.v0) / x.a,
    },
  },
  {
    id: "path-accel",
    moduleIds: [2],
    title: "Бірқалыпты үдемелі қозғалыстағы жол",
    expr: "s = v₀ · t + a · t² / 2",
    note: "Уақыт бойынша жүрілген жол. Уақытты табу үшін квадрат теңдеу керек, сондықтан ол мұнда белгісіз ретінде ұсынылмайды.",
    vars: [
      { sym: "s", name: "Жол", unit: "м" },
      { sym: "v0", name: "Бастапқы жылдамдық", unit: "м/с" },
      { sym: "a", name: "Үдеу", unit: "м/с²" },
      { sym: "t", name: "Уақыт", unit: "с", positive: true },
    ],
    solve: {
      s: (x) => x.v0 * x.t + (x.a * x.t * x.t) / 2,
      v0: (x) => (x.s - (x.a * x.t * x.t) / 2) / x.t,
      a: (x) => (2 * (x.s - x.v0 * x.t)) / (x.t * x.t),
    },
  },
  {
    id: "torricelli",
    moduleIds: [2],
    title: "Уақытсыз жылдамдық формуласы",
    expr: "v² = v₀² + 2 · a · s",
    note: "Уақыт белгісіз болғанда қолданылады.",
    vars: [
      { sym: "v", name: "Соңғы жылдамдық", unit: "м/с" },
      { sym: "v0", name: "Бастапқы жылдамдық", unit: "м/с" },
      { sym: "a", name: "Үдеу", unit: "м/с²" },
      { sym: "s", name: "Жол", unit: "м" },
    ],
    solve: {
      v: (x) => Math.sqrt(x.v0 * x.v0 + 2 * x.a * x.s),
      v0: (x) => Math.sqrt(x.v * x.v - 2 * x.a * x.s),
      a: (x) => (x.v * x.v - x.v0 * x.v0) / (2 * x.s),
      s: (x) => (x.v * x.v - x.v0 * x.v0) / (2 * x.a),
    },
  },
  {
    id: "free-fall-height",
    moduleIds: [2],
    title: "Еркін түсу биіктігі",
    expr: "h = g · t² / 2",
    note: "Тыныштықтан еркін түскен дененің жүрген биіктігі.",
    vars: [
      { sym: "h", name: "Биіктік", unit: "м", positive: true },
      { sym: "g", name: "Еркін түсу үдеуі", unit: "м/с²", positive: true },
      { sym: "t", name: "Түсу уақыты", unit: "с", positive: true },
    ],
    solve: {
      h: (x) => (x.g * x.t * x.t) / 2,
      g: (x) => (2 * x.h) / (x.t * x.t),
      t: (x) => Math.sqrt((2 * x.h) / x.g),
    },
  },
  {
    id: "free-fall-speed",
    moduleIds: [2],
    title: "Еркін түсудегі жылдамдық",
    expr: "v = g · t",
    note: "Тыныштықтан түскен дененің t секундтан кейінгі жылдамдығы.",
    vars: [
      { sym: "v", name: "Жылдамдық", unit: "м/с" },
      { sym: "g", name: "Еркін түсу үдеуі", unit: "м/с²", positive: true },
      { sym: "t", name: "Уақыт", unit: "с", positive: true },
    ],
    solve: {
      v: (x) => x.g * x.t,
      g: (x) => x.v / x.t,
      t: (x) => x.v / x.g,
    },
  },

  // — Динамика және Ньютон заңдары ————————————————————————————————
  {
    id: "newton-second",
    moduleIds: [3, 4],
    title: "Ньютонның екінші заңы",
    expr: "F = m · a",
    note: "Денеге әсер ететін тең әсерлі күш массаны үдеуге көбейткенге тең.",
    vars: [
      { sym: "F", name: "Күш", unit: "Н" },
      { sym: "m", name: "Масса", unit: "кг", positive: true },
      { sym: "a", name: "Үдеу", unit: "м/с²" },
    ],
    solve: {
      F: (x) => x.m * x.a,
      m: (x) => x.F / x.a,
      a: (x) => x.F / x.m,
    },
  },
  {
    id: "weight",
    moduleIds: [3, 4],
    title: "Ауырлық күші",
    expr: "F = m · g",
    note: "Көлденең тірекке түсетін салмақ та осыған тең.",
    vars: [
      { sym: "F", name: "Ауырлық күші", unit: "Н" },
      { sym: "m", name: "Масса", unit: "кг", positive: true },
      { sym: "g", name: "Еркін түсу үдеуі", unit: "м/с²", positive: true },
    ],
    solve: {
      F: (x) => x.m * x.g,
      m: (x) => x.F / x.g,
      g: (x) => x.F / x.m,
    },
  },
  {
    id: "friction",
    moduleIds: [3, 4],
    title: "Сырғанау үйкеліс күші",
    expr: "Fүйк = μ · N",
    note: "Үйкеліс күші тек нормаль қысым күшіне және бет жұбына тәуелді, жанасу ауданына емес.",
    vars: [
      { sym: "Ff", name: "Үйкеліс күші", unit: "Н" },
      { sym: "mu", name: "Үйкеліс коэффициенті", unit: "", positive: true },
      { sym: "N", name: "Нормаль реакция күші", unit: "Н", positive: true },
    ],
    solve: {
      Ff: (x) => x.mu * x.N,
      mu: (x) => x.Ff / x.N,
      N: (x) => x.Ff / x.mu,
    },
  },
  {
    id: "incline",
    moduleIds: [3],
    title: "Көлбеу жазықтықтағы үдеу",
    expr: "a = g · (sin α − μ · cos α)",
    note: "Үйкелісі бар көлбеу жазықтықпен төмен сырғанаған дененің үдеуі.",
    vars: [
      { sym: "a", name: "Үдеу", unit: "м/с²" },
      { sym: "g", name: "Еркін түсу үдеуі", unit: "м/с²", positive: true },
      { sym: "alpha", name: "Көлбеу бұрышы", unit: "°" },
      { sym: "mu", name: "Үйкеліс коэффициенті", unit: "" },
    ],
    solve: {
      a: (x) => x.g * (Math.sin(rad(x.alpha)) - x.mu * Math.cos(rad(x.alpha))),
      mu: (x) => (x.g * Math.sin(rad(x.alpha)) - x.a) / (x.g * Math.cos(rad(x.alpha))),
      g: (x) => x.a / (Math.sin(rad(x.alpha)) - x.mu * Math.cos(rad(x.alpha))),
    },
  },

  // — Жұмыс және энергия ————————————————————————————————————————
  {
    id: "work",
    moduleIds: [5],
    title: "Механикалық жұмыс",
    expr: "A = F · s · cos α",
    note: "α — күш пен орын ауыстыру арасындағы бұрыш. Күш қозғалысқа перпендикуляр болса, жұмыс нөлге тең.",
    vars: [
      { sym: "A", name: "Жұмыс", unit: "Дж" },
      { sym: "F", name: "Күш", unit: "Н" },
      { sym: "s", name: "Орын ауыстыру", unit: "м" },
      { sym: "alpha", name: "Бұрыш", unit: "°" },
    ],
    solve: {
      A: (x) => x.F * x.s * Math.cos(rad(x.alpha)),
      F: (x) => x.A / (x.s * Math.cos(rad(x.alpha))),
      s: (x) => x.A / (x.F * Math.cos(rad(x.alpha))),
      // arccos has one value on 0…180°, which is the whole range an angle
      // between a force and a displacement can take. No branch to guess.
      alpha: (x) => deg(Math.acos(x.A / (x.F * x.s))),
    },
  },
  {
    id: "kinetic",
    moduleIds: [5],
    title: "Кинетикалық энергия",
    expr: "Eₖ = m · v² / 2",
    note: "Жылдамдық екі есе артса, кинетикалық энергия төрт есе артады.",
    vars: [
      { sym: "Ek", name: "Кинетикалық энергия", unit: "Дж", positive: true },
      { sym: "m", name: "Масса", unit: "кг", positive: true },
      { sym: "v", name: "Жылдамдық", unit: "м/с" },
    ],
    solve: {
      Ek: (x) => (x.m * x.v * x.v) / 2,
      m: (x) => (2 * x.Ek) / (x.v * x.v),
      v: (x) => Math.sqrt((2 * x.Ek) / x.m),
    },
  },
  {
    id: "potential",
    moduleIds: [5],
    title: "Потенциалдық энергия",
    expr: "Eₚ = m · g · h",
    note: "Биіктік таңдалған нөлдік деңгейден есептеледі.",
    vars: [
      { sym: "Ep", name: "Потенциалдық энергия", unit: "Дж" },
      { sym: "m", name: "Масса", unit: "кг", positive: true },
      { sym: "g", name: "Еркін түсу үдеуі", unit: "м/с²", positive: true },
      { sym: "h", name: "Биіктік", unit: "м" },
    ],
    solve: {
      Ep: (x) => x.m * x.g * x.h,
      m: (x) => x.Ep / (x.g * x.h),
      h: (x) => x.Ep / (x.m * x.g),
      g: (x) => x.Ep / (x.m * x.h),
    },
  },
  {
    id: "power",
    moduleIds: [5],
    title: "Қуат",
    expr: "N = A / t",
    note: "Бірлік уақытта атқарылған жұмыс.",
    vars: [
      { sym: "N", name: "Қуат", unit: "Вт" },
      { sym: "A", name: "Жұмыс", unit: "Дж" },
      { sym: "t", name: "Уақыт", unit: "с", positive: true },
    ],
    solve: {
      N: (x) => x.A / x.t,
      A: (x) => x.N * x.t,
      t: (x) => x.A / x.N,
    },
  },
  {
    id: "efficiency",
    moduleIds: [5],
    title: "Пайдалы әсер коэффициенті",
    expr: "η = (Aпайд / Aтолық) · 100 %",
    note: "Үйкеліс болғандықтан ПӘК ешқашан 100 %-ға жетпейді.",
    vars: [
      { sym: "eta", name: "ПӘК", unit: "%", positive: true },
      { sym: "Au", name: "Пайдалы жұмыс", unit: "Дж", positive: true },
      { sym: "At", name: "Толық жұмыс", unit: "Дж", positive: true },
    ],
    solve: {
      eta: (x) => (x.Au / x.At) * 100,
      Au: (x) => (x.eta * x.At) / 100,
      At: (x) => (x.Au * 100) / x.eta,
    },
  },

  // — Импульс ————————————————————————————————————————————————————
  {
    id: "momentum",
    moduleIds: [6],
    title: "Дене импульсі",
    expr: "p = m · v",
    note: "Импульс — вектор шама, бағыты жылдамдықпен бірдей.",
    vars: [
      { sym: "p", name: "Импульс", unit: "кг·м/с" },
      { sym: "m", name: "Масса", unit: "кг", positive: true },
      { sym: "v", name: "Жылдамдық", unit: "м/с" },
    ],
    solve: {
      p: (x) => x.m * x.v,
      m: (x) => x.p / x.v,
      v: (x) => x.p / x.m,
    },
  },
  {
    id: "impulse",
    moduleIds: [6],
    title: "Күш импульсі",
    expr: "F · Δt = Δp",
    note: "Соқтығыс неғұрлым ұзақ болса, күш соғұрлым аз — қауіпсіздік жастықшасының қағидасы осы.",
    vars: [
      { sym: "F", name: "Күш", unit: "Н" },
      { sym: "dt", name: "Әсер ету уақыты", unit: "с", positive: true },
      { sym: "dp", name: "Импульс өзгерісі", unit: "кг·м/с" },
    ],
    solve: {
      F: (x) => x.dp / x.dt,
      dt: (x) => x.dp / x.F,
      dp: (x) => x.F * x.dt,
    },
  },

  // — Айналмалы қозғалыс ————————————————————————————————————————
  {
    id: "angular-velocity",
    moduleIds: [7],
    title: "Бұрыштық жылдамдық",
    expr: "ω = 2π / T",
    note: "Толық бір айналымға кеткен уақыт — период T.",
    vars: [
      { sym: "omega", name: "Бұрыштық жылдамдық", unit: "рад/с", positive: true },
      { sym: "T", name: "Период", unit: "с", positive: true },
    ],
    solve: {
      omega: (x) => (2 * Math.PI) / x.T,
      T: (x) => (2 * Math.PI) / x.omega,
    },
  },
  {
    id: "linear-angular",
    moduleIds: [7],
    title: "Сызықтық және бұрыштық жылдамдық",
    expr: "v = ω · R",
    note: "Айналу осінен алыс нүкте жылдамырақ қозғалады.",
    vars: [
      { sym: "v", name: "Сызықтық жылдамдық", unit: "м/с" },
      { sym: "omega", name: "Бұрыштық жылдамдық", unit: "рад/с" },
      { sym: "R", name: "Радиус", unit: "м", positive: true },
    ],
    solve: {
      v: (x) => x.omega * x.R,
      omega: (x) => x.v / x.R,
      R: (x) => x.v / x.omega,
    },
  },
  {
    id: "torque",
    moduleIds: [7],
    title: "Күш моменті",
    expr: "M = F · d",
    note: "d — айналу осінен күш сызығына дейінгі қашықтық (иін).",
    vars: [
      { sym: "M", name: "Момент", unit: "Н·м" },
      { sym: "F", name: "Күш", unit: "Н" },
      { sym: "d", name: "Иін", unit: "м", positive: true },
    ],
    solve: {
      M: (x) => x.F * x.d,
      F: (x) => x.M / x.d,
      d: (x) => x.M / x.F,
    },
  },
  {
    id: "rot-newton",
    moduleIds: [7],
    title: "Айналмалы қозғалыс динамикасының теңдеуі",
    expr: "M = I · ε",
    note: "Ньютонның екінші заңының айналмалы қозғалысқа арналған түрі.",
    vars: [
      { sym: "M", name: "Момент", unit: "Н·м" },
      { sym: "I", name: "Инерция моменті", unit: "кг·м²", positive: true },
      { sym: "eps", name: "Бұрыштық үдеу", unit: "рад/с²" },
    ],
    solve: {
      M: (x) => x.I * x.eps,
      I: (x) => x.M / x.eps,
      eps: (x) => x.M / x.I,
    },
  },
  {
    id: "rot-kinetic",
    moduleIds: [7],
    title: "Айналмалы қозғалыстың кинетикалық энергиясы",
    expr: "Eₖ = I · ω² / 2",
    note: "Массаның орнына инерция моменті, жылдамдықтың орнына бұрыштық жылдамдық тұрады.",
    vars: [
      { sym: "Ek", name: "Кинетикалық энергия", unit: "Дж", positive: true },
      { sym: "I", name: "Инерция моменті", unit: "кг·м²", positive: true },
      { sym: "omega", name: "Бұрыштық жылдамдық", unit: "рад/с" },
    ],
    solve: {
      Ek: (x) => (x.I * x.omega * x.omega) / 2,
      I: (x) => (2 * x.Ek) / (x.omega * x.omega),
      omega: (x) => Math.sqrt((2 * x.Ek) / x.I),
    },
  },

  // — Тербелістер ————————————————————————————————————————————————
  {
    id: "pendulum",
    moduleIds: [8],
    title: "Математикалық маятниктің периоды",
    expr: "T = 2π · √(l / g)",
    note: "Период маятниктің массасына да, амплитудасына да тәуелді емес — тек ұзындығына.",
    vars: [
      { sym: "T", name: "Период", unit: "с", positive: true },
      { sym: "l", name: "Жіп ұзындығы", unit: "м", positive: true },
      { sym: "g", name: "Еркін түсу үдеуі", unit: "м/с²", positive: true },
    ],
    solve: {
      T: (x) => 2 * Math.PI * Math.sqrt(x.l / x.g),
      l: (x) => (x.g * x.T * x.T) / (4 * Math.PI * Math.PI),
      g: (x) => (4 * Math.PI * Math.PI * x.l) / (x.T * x.T),
    },
  },
  {
    id: "spring-pendulum",
    moduleIds: [8],
    title: "Серіппелі маятниктің периоды",
    expr: "T = 2π · √(m / k)",
    note: "Мұнда, керісінше, период массаға тәуелді.",
    vars: [
      { sym: "T", name: "Период", unit: "с", positive: true },
      { sym: "m", name: "Масса", unit: "кг", positive: true },
      { sym: "k", name: "Серіппе қатаңдығы", unit: "Н/м", positive: true },
    ],
    solve: {
      T: (x) => 2 * Math.PI * Math.sqrt(x.m / x.k),
      m: (x) => (x.k * x.T * x.T) / (4 * Math.PI * Math.PI),
      k: (x) => (4 * Math.PI * Math.PI * x.m) / (x.T * x.T),
    },
  },
  {
    id: "hooke",
    moduleIds: [8],
    title: "Гук заңы",
    expr: "F = k · x",
    note: "Серпімділік күші деформацияға тура пропорционал (серпімділік шегінде).",
    vars: [
      { sym: "F", name: "Серпімділік күші", unit: "Н" },
      { sym: "k", name: "Қатаңдық", unit: "Н/м", positive: true },
      { sym: "x", name: "Деформация", unit: "м" },
    ],
    solve: {
      F: (x) => x.k * x.x,
      k: (x) => x.F / x.x,
      x: (x) => x.F / x.k,
    },
  },

  // — Сұйықтар механикасы ————————————————————————————————————————
  {
    id: "density",
    moduleIds: [9],
    title: "Тығыздық",
    expr: "ρ = m / V",
    note: "Судың тығыздығы 1000 кг/м³.",
    vars: [
      { sym: "rho", name: "Тығыздық", unit: "кг/м³", positive: true },
      { sym: "m", name: "Масса", unit: "кг", positive: true },
      { sym: "V", name: "Көлем", unit: "м³", positive: true },
    ],
    solve: {
      rho: (x) => x.m / x.V,
      m: (x) => x.rho * x.V,
      V: (x) => x.m / x.rho,
    },
  },
  {
    id: "hydrostatic",
    moduleIds: [9],
    title: "Гидростатикалық қысым",
    expr: "p = ρ · g · h",
    note: "Қысым тек тереңдікке тәуелді, ыдыстың пішініне емес.",
    vars: [
      { sym: "p", name: "Қысым", unit: "Па" },
      { sym: "rho", name: "Сұйық тығыздығы", unit: "кг/м³", positive: true },
      { sym: "g", name: "Еркін түсу үдеуі", unit: "м/с²", positive: true },
      { sym: "h", name: "Тереңдік", unit: "м" },
    ],
    solve: {
      p: (x) => x.rho * x.g * x.h,
      rho: (x) => x.p / (x.g * x.h),
      h: (x) => x.p / (x.rho * x.g),
      g: (x) => x.p / (x.rho * x.h),
    },
  },
  {
    id: "archimedes",
    moduleIds: [9],
    title: "Архимед күші",
    expr: "Fₐ = ρ · g · V",
    note: "V — дененің батқан бөлігінің көлемі, дененің толық көлемі емес.",
    vars: [
      { sym: "Fa", name: "Кері итеруші күш", unit: "Н" },
      { sym: "rho", name: "Сұйық тығыздығы", unit: "кг/м³", positive: true },
      { sym: "g", name: "Еркін түсу үдеуі", unit: "м/с²", positive: true },
      { sym: "V", name: "Батқан көлем", unit: "м³", positive: true },
    ],
    solve: {
      Fa: (x) => x.rho * x.g * x.V,
      rho: (x) => x.Fa / (x.g * x.V),
      V: (x) => x.Fa / (x.rho * x.g),
      g: (x) => x.Fa / (x.rho * x.V),
    },
  },
  {
    id: "continuity",
    moduleIds: [9],
    title: "Ағынның үзіліссіздік теңдеуі",
    expr: "S₁ · v₁ = S₂ · v₂",
    note: "Құбыр тарылса, сұйық жылдамдайды.",
    vars: [
      { sym: "S1", name: "1-қиманың ауданы", unit: "м²", positive: true },
      { sym: "v1", name: "1-қимадағы жылдамдық", unit: "м/с" },
      { sym: "S2", name: "2-қиманың ауданы", unit: "м²", positive: true },
      { sym: "v2", name: "2-қимадағы жылдамдық", unit: "м/с" },
    ],
    solve: {
      S1: (x) => (x.S2 * x.v2) / x.v1,
      v1: (x) => (x.S2 * x.v2) / x.S1,
      S2: (x) => (x.S1 * x.v1) / x.v2,
      v2: (x) => (x.S1 * x.v1) / x.S2,
    },
  },

  // — Инженерлік механика ————————————————————————————————————————
  {
    id: "stress",
    moduleIds: [10],
    title: "Механикалық кернеу",
    expr: "σ = F / S",
    note: "Бір күш жіңішке шыбықта үлкен кернеу, жуан шыбықта аз кернеу тудырады.",
    vars: [
      { sym: "sigma", name: "Кернеу", unit: "Па" },
      { sym: "F", name: "Ішкі күш", unit: "Н" },
      { sym: "S", name: "Қиманың ауданы", unit: "м²", positive: true },
    ],
    solve: {
      sigma: (x) => x.F / x.S,
      F: (x) => x.sigma * x.S,
      S: (x) => x.F / x.sigma,
    },
  },
  {
    id: "strain",
    moduleIds: [10],
    title: "Салыстырмалы деформация",
    expr: "ε = Δl / l",
    note: "Өлшемсіз шама: ұзару бастапқы ұзындықтың қандай үлесін құрайды.",
    vars: [
      { sym: "eps", name: "Салыстырмалы деформация", unit: "" },
      { sym: "dl", name: "Ұзару", unit: "м" },
      { sym: "l", name: "Бастапқы ұзындық", unit: "м", positive: true },
    ],
    solve: {
      eps: (x) => x.dl / x.l,
      dl: (x) => x.eps * x.l,
      l: (x) => x.dl / x.eps,
    },
  },
  {
    id: "young",
    moduleIds: [10],
    title: "Гук заңы (материал үшін)",
    expr: "σ = E · ε",
    note: "E — Юнг модулі, материалдың қаттылығын сипаттайды. Болат үшін ≈ 2·10¹¹ Па.",
    vars: [
      { sym: "sigma", name: "Кернеу", unit: "Па" },
      { sym: "E", name: "Юнг модулі", unit: "Па", positive: true },
      { sym: "eps", name: "Салыстырмалы деформация", unit: "" },
    ],
    solve: {
      sigma: (x) => x.E * x.eps,
      E: (x) => x.sigma / x.eps,
      eps: (x) => x.sigma / x.E,
    },
  },
];

export function formulasForModule(moduleId: number): Formula[] {
  return FORMULAS.filter((f) => f.moduleIds.includes(moduleId));
}

/** The lessons that actually have formulas, in order. */
export function modulesWithFormulas(): number[] {
  return [...new Set(FORMULAS.flatMap((f) => f.moduleIds))].sort((a, b) => a - b);
}
