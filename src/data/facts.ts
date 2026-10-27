// Things that make a student say "wait, really?" — the myths of films and the
// internet, and a physics fact for each day.
//
// Every number in a sentence below is *computed* from the physics, not typed in:
// the text is a function of what calc() returns, and src/data/facts.test.ts checks
// each of those against a value worked out separately. So a claim like "a coin
// from 300 m is not lethal" can only be as wrong as its formula, never because a
// figure in a paragraph went stale.

import { hashSeed, seededRandom, seededShuffle } from "@/lib/rng";
import { fmt } from "./quizBank";
import type { TrueFalseBoard, TrueFalseCard } from "./moreGames";

// Constants (SI). The planets' g are in src/lib/projectile.ts; these are Earth's.
export const G = 9.81; // m/s²
export const R_EARTH = 6.371e6; // mean radius, m
export const R_EQUATOR = 6.378137e6; // equatorial radius, m
/** One turn relative to the stars: 23 h 56 min 4,09 s. */
export const OMEGA_EARTH = (2 * Math.PI) / 86164.0905; // rad/s
export const G_MOON = 1.62;
export const G_JUPITER = 24.79;

type Calc = Record<string, number>;

// ---------------------------------------------------------------------------
// Myth or truth
// ---------------------------------------------------------------------------

export interface Myth {
  id: string;
  /** The lesson it belongs to, 1–10. */
  lesson: number;
  /** Where a student has met the claim. */
  source: string;
  /** The statement to judge. */
  claim: string;
  isTrue: boolean;
  /** The numbers the explanation quotes. */
  calc: () => Calc;
  why: (c: Calc) => string;
}

const none = () => ({});

export const MYTHS: Myth[] = [
  {
    id: "apollo-feather",
    lesson: 2,
    source: "NASA, 1971",
    claim: "Айда балға мен қауырсын бір биіктіктен бір мезгілде жерге түседі.",
    isTrue: true,
    calc: none,
    why: () =>
      "1971 жылы «Аполлон-15» экспедициясында ғарышкер Дэвид Скотт Айда балға мен қауырсынды бірге жіберді — екеуі бір мезгілде түсті. Айда ауа жоқ, ал еркін түсу үдеуі дененің массасына байланысты емес. Жердегі ауада қауырсын тек ауа кедергісінен баяу түседі.",
  },
  {
    id: "heavy-faster",
    lesson: 2,
    source: "Күнделікті өмір",
    claim: "Ауыр зат әрқашан жеңіл заттан тезірек түседі.",
    isTrue: false,
    calc: none,
    why: () =>
      "Ауасыз кеңістікте барлық дене бірдей g үдеумен түседі — тіпті 1 т жүк пен 1 г шарик те. Күнделікті өмірде жеңіл заттар (қауырсын, қағаз) ауа кедергісінен ғана баяу түседі. Екі металл шарды бір биіктіктен тастасаң, олар бірге жерге тиеді.",
  },
  {
    id: "horizontal-bullet",
    lesson: 2,
    source: "Танымал тәжірибе",
    claim: "Горизонталь атылған оқ пен сол биіктіктен жай тасталған оқ жерге бір мезгілде түседі (ауа кедергісін ескермегенде).",
    isTrue: true,
    calc: () => ({ t: Math.sqrt((2 * 1.5) / G) }),
    why: (c) =>
      `Қозғалыс екі тәуелсіз бөліктен тұрады: горизонталь бойымен — тұрақты жылдамдық, тік бойымен — еркін түсу. Тік қозғалыс горизонталь жылдамдыққа байланысты емес, сондықтан 1,5 м биіктіктен екеуі де t = √(2h/g) = ${fmt(c.t)} с-тан кейін түседі.`,
  },
  {
    id: "coin-skyscraper",
    lesson: 2,
    source: "Интернет мифі",
    claim: "Зәулім ғимараттың төбесінен тасталған тиын төменде тұрған адамды өлтіре алады.",
    isTrue: false,
    calc: () => ({ v: Math.sqrt(2 * G * 300) }),
    why: (c) =>
      `Ауасыз кеңістікте 300 м биіктіктен түскен дене v = √(2gh) ≈ ${fmt(c.v, 0)} м/с жылдамдыққа жетер еді. Бірақ ауа кедергісі шағын жеңіл тиынды тез тежейді: ол домалап, шамамен тұрақты (шектік) жылдамдықпен түседі, ал ол әлдеқайда аз. Нәтижесінде тиын адамды тек ауырсындырады.`,
  },
  {
    id: "force-needed-to-move",
    lesson: 4,
    source: "Ежелгі көзқарас",
    claim: "Дене қозғала беруі үшін оған үнемі күш әсер етіп тұруы керек.",
    isTrue: false,
    calc: none,
    why: () =>
      "Ньютонның бірінші заңы бойынша күштер әсер етпесе (немесе теңгерілсе), дене тыныштықта немесе бірқалыпты түзу сызықты қозғалыста қала береді. Күш жылдамдықты ұстап тұру үшін емес, оны өзгерту (үдету) үшін керек. Жолдағы доп үйкеліс күшінен тоқтайды; үйкеліссіз ол мәңгі домалар еді.",
  },
  {
    id: "horse-cart",
    lesson: 4,
    source: "Ньютонның III заңы",
    claim: "Ат арбаны қанша күшпен тартса, арба да атты сонша күшпен тартады, сондықтан арба қозғала алмайды.",
    isTrue: false,
    calc: none,
    why: () =>
      "Күштердің шамасы шынымен тең, бірақ олар әртүрлі денелерге түсірілген, сондықтан бір-бірін теңгермейді. Арба қозғалады, өйткені оған әсер ететін қорытқы күш (аттың тарту күші минус арбаның үйкелісі) нөлге тең емес. Ат үшін басты нәрсе — тұяғымен жерді итеру: жер оны алға итереді.",
  },
  {
    id: "seatbelt",
    lesson: 6,
    source: "Жол қауіпсіздігі",
    claim: "Қауіпсіздік белдігі апат кезінде адамға түсетін күшті азайтады, өйткені тоқтау уақытын ұзартады.",
    isTrue: true,
    calc: () => {
      const p = 70 * (50 / 3.6);
      return { p, f1: p / 0.05 / 1000, f2: p / 0.15 / 1000 };
    },
    why: (c) =>
      `Импульстің өзгерісі: F·Δt = Δp. 70 кг адамның 50 км/сағ жылдамдықтағы импульсі ≈ ${fmt(c.p, 0)} кг·м/с. Қатты затқа 0,05 с-та соқтығысса, күш ≈ ${fmt(c.f1, 1)} кН; белдік пен ауа жастығы тоқтау уақытын 0,15 с-қа дейін ұзартса, күш ≈ ${fmt(c.f2, 1)} кН — үш есе аз.`,
  },
  {
    id: "stop-car-by-hand",
    lesson: 6,
    source: "Кино",
    claim: "Күшті адам жүгіріп келе жатқан жеңіл көлікті қолымен тоқтата алады (киноларда солай көрсетіледі).",
    isTrue: false,
    calc: () => {
      const p = 1200 * 10;
      return { p, f: p / 0.2 / 1000, tonnes: p / 0.2 / G / 1000 };
    },
    why: (c) =>
      `1200 кг көлік небәрі 10 м/с (36 км/сағ) жылдамдықпен келе жатса да, оның импульсі ${fmt(c.p, 0)} кг·м/с. Оны 0,2 с-та тоқтату үшін ≈ ${fmt(c.f, 0)} кН (шамамен ${fmt(c.tonnes, 0)} тонна салмағына тең) күш керек. Адам мұндай күш түсіре алмайды: фильмдегі көрініс — монтаж.`,
  },
  {
    id: "recoil",
    lesson: 6,
    source: "Атыс құралдары",
    claim: "Мылтықтан оқ атылғанда мылтық та артқа тебеді: оқ пен мылтықтың импульстері шамасы бойынша тең.",
    isTrue: true,
    calc: () => ({ v: (0.01 * 800) / 4 }),
    why: (c) =>
      `Атар алдында жүйе тыныш, сондықтан жалпы импульс нөл, ал атылғаннан кейін де нөл болып қалады: m_оқ·v_оқ = M·v_мылтық, бағыттары қарама-қарсы. 10 г оқ 800 м/с жылдамдықпен ұшса, 4 кг мылтық ${fmt(c.v)} м/с жылдамдықпен артқа тебеді.`,
  },
  {
    id: "rocket-needs-air",
    lesson: 6,
    source: "Фильмдер мен ойындар",
    claim: "Ракета ғарышта қозғала алмайды, өйткені онда итерілетін ауа жоқ.",
    isTrue: false,
    calc: none,
    why: () =>
      "Ракета ауадан емес, өзінен лақтырылған жанған газдан итеріледі: газ артқа кетсе, ракета алға кетеді (импульстің сақталуы және Ньютонның III заңы). Сондықтан вакуумда ракета жақсы жұмыс істейді, тіпті тиімдірек — кедергі жоқ.",
  },
  {
    id: "baikonur",
    lesson: 6,
    source: "Қазақстан",
    claim: "Адамның ғарышқа алғашқы ұшуы Қазақстан жерінен басталды.",
    isTrue: true,
    calc: () => ({ v: Math.sqrt(G * R_EARTH) / 1000, T: (2 * Math.PI * Math.sqrt(R_EARTH / G)) / 60 }),
    why: (c) =>
      `1961 жылы 12 сәуірде Юрий Гагарин «Восток-1» кемесімен Байқоңыр ғарыш айлағынан ұшты. Жерді жанай айналу үшін серіктің жылдамдығы v = √(gR) ≈ ${fmt(c.v, 1)} км/с болуы керек, ал айналым периоды шамамен ${fmt(c.T, 0)} минут (орбита биіктеген сайын период ұлғаяды).`,
  },
  {
    id: "iss-no-gravity",
    lesson: 3,
    source: "Ғарыш туралы фильмдер",
    claim: "Халықаралық ғарыш станциясындағы ғарышкерлер салмақсыз, өйткені сол биіктікте Жердің тартылысы жоқ.",
    isTrue: false,
    calc: () => {
      const k = (R_EARTH / (R_EARTH + 4e5)) ** 2;
      return { pct: k * 100, g: G * k };
    },
    why: (c) =>
      `400 км биіктікте тартылыс күші жер бетіндегінің ≈ ${fmt(c.pct, 0)} %-ы (g ≈ ${fmt(c.g, 1)} м/с²): ол жоқ емес, аздап қана кемиді. Ғарышкерлер салмақсыздықты сезінеді, өйткені станция да, олар да Жерді айнала бірге еркін құлап келеді — тірек реакциясы жоқ.`,
  },
  {
    id: "kinetic-energy-v",
    lesson: 5,
    source: "Күнделікті өмір",
    claim: "Көліктің жылдамдығы екі есе артса, оның кинетикалық энергиясы да екі есе артады.",
    isTrue: false,
    calc: none,
    why: () =>
      "E = mv²/2, яғни энергия жылдамдықтың квадратына пропорционал: v екі есе артса, E төрт есе артады. Сондықтан 100 км/сағ жылдамдықпен соғылу 50 км/сағ-пен соғылудан төрт есе қатты.",
  },
  {
    id: "stopping-distance",
    lesson: 5,
    source: "Жол қауіпсіздігі",
    claim: "Жылдамдық екі есе артса, көліктің тоқтау жолы шамамен төрт есе ұзарады.",
    isTrue: true,
    calc: () => {
      const s = (kmh: number) => (kmh / 3.6) ** 2 / (2 * 0.7 * G);
      return { s1: s(50), s2: s(100) };
    },
    why: (c) =>
      `Тежегенде кинетикалық энергия үйкеліс жұмысына айналады: mv²/2 = μmg·s, яғни s = v²/(2μg). Құрғақ асфальтта (μ ≈ 0,7) 50 км/сағ-тан тоқтау жолы ≈ ${fmt(c.s1, 0)} м, ал 100 км/сағ-тан ≈ ${fmt(c.s2, 0)} м — төрт есе ұзақ.`,
  },
  {
    id: "friction-area",
    lesson: 3,
    source: "Күнделікті өмір",
    claim: "Үйкеліс күші жанасу ауданына тәуелді: дөңгелек кең болған сайын үйкеліс көп.",
    isTrue: false,
    calc: none,
    why: () =>
      "Құрғақ беттер үшін сырғанау үйкелісінің күші F = μN, ал формулада жанасу ауданы жоқ: аудан екі есе артса, қысым екі есе азаяды, ал жалпы күш өзгермейді. Бұл — Амонтон заңы, қатты құрғақ беттер үшін жақсы орындалады.",
  },
  {
    id: "steel-ship",
    lesson: 9,
    source: "Күнделікті өмір",
    claim: "Болат судан шамамен сегіз есе тығыз, сондықтан болаттан жасалған кеме міндетті түрде батады.",
    isTrue: false,
    calc: () => ({ ratio: 7800 / 1000 }),
    why: (c) =>
      `Кеменің жүзуін материалдың емес, оның орташа тығыздығы анықтайды. Кеме қуыс: корпустың ішінде ауа көп. Архимед күші ығыстырылған судың салмағына тең, сондықтан орташа тығыздығы 1000 кг/м³-ден аз кеме жүзеді. Болат (≈ 7800 кг/м³) судан ${fmt(c.ratio, 1)} есе тығыз, бірақ қуыс корпус арқасында кеме батпайды.`,
  },
  {
    id: "skater",
    lesson: 7,
    source: "Мұз айдыны",
    claim: "Мәнерлеп сырғанаушы айналып тұрып қолын денесіне қысса, тезірек айнала бастайды.",
    isTrue: true,
    calc: () => ({ k: 3.0 / 1.0 }),
    why: (c) =>
      `Сыртқы күш моменті болмаса, импульс моменті L = Iω сақталады. Қолды қысқанда инерция моменті азаяды, сондықтан бұрыштық жылдамдық артады. Мысалы, I = 3,0 кг·м²-ден 1,0 кг·м²-ге кемісе, ω ${fmt(c.k, 0)} есе артады.`,
  },
  {
    id: "equator-weight",
    lesson: 7,
    source: "Жер туралы",
    claim: "Экваторда тұрған адам Солтүстік полюстегіден сәл жеңіл.",
    isTrue: true,
    calc: () => {
      const a = OMEGA_EARTH ** 2 * R_EQUATOR;
      return { a, pct: (a / G) * 100 };
    },
    why: (c) =>
      `Жер айналады, ал экваторда нүкте ең үлкен шеңбермен қозғалады: оның центрге тартқыш үдеуі a = ω²R ≈ ${fmt(c.a, 3)} м/с² (g-нің ≈ ${fmt(c.pct, 2)} %-ы). Сондықтан тартылыстың аз бөлігі осыған жұмсалады. Жердің сәл қысыңқылығы да әсер етеді: g экваторда ≈ 9,78, полюсте ≈ 9,83 м/с².`,
  },
  {
    id: "pendulum",
    lesson: 8,
    source: "Галилей тәжірибесі",
    claim: "Ұзындығы 1 м жіптегі маятниктің толық тербелісі шамамен 2 секундқа созылады және шағын бұрышта амплитудаға байланысты емес.",
    isTrue: true,
    calc: () => ({ T: 2 * Math.PI * Math.sqrt(1 / G) }),
    why: (c) =>
      `T = 2π√(l/g) = 2π√(1/9,81) ≈ ${fmt(c.T)} с. Формулада амплитуда да, масса да жоқ — тек ұзындық пен g бар (бұрыш аз болғанда). Мұны алғаш Галилей байқаған.`,
  },
];

export interface MythBoard extends TrueFalseBoard {
  /** One line per card for the screen reader and the results page. */
  meta: Record<string, { lesson: number; source: string }>;
}

export const MYTH_CARDS = 8;

/** Four true and four false, in an order the seed decides. */
export function buildMythBoard(seed: number, myths: readonly Myth[] = MYTHS): MythBoard {
  const rnd = seededRandom(seed);
  const half = MYTH_CARDS / 2;
  const trues = seededShuffle(myths.filter((m) => m.isTrue), rnd).slice(0, half);
  const falses = seededShuffle(myths.filter((m) => !m.isTrue), rnd).slice(0, half);
  const picked = seededShuffle([...trues, ...falses], rnd);
  const meta: MythBoard["meta"] = {};
  const cards = picked.map((m): TrueFalseCard => {
    meta[m.id] = { lesson: m.lesson, source: m.source };
    return {
      id: m.id,
      prompt: `${m.source} · ${m.lesson}-сабақ`,
      claim: m.claim,
      isTrue: m.isTrue,
      explanation: m.why(m.calc()),
    };
  });
  return { cards, perCard: 25, meta };
}

// ---------------------------------------------------------------------------
// Fact of the day
// ---------------------------------------------------------------------------

export interface Fact {
  id: string;
  lesson: number;
  /** A question a child might ask. */
  question: string;
  calc: () => Calc;
  answer: (c: Calc) => string;
}

/** Latitudes, degrees north. */
export const LAT_BAIKONUR = 45.92;
export const LAT_ASTANA = 51.13;

const eastSpeed = (latDeg: number) => OMEGA_EARTH * R_EQUATOR * Math.cos((latDeg * Math.PI) / 180);

export const FACTS: Fact[] = [
  {
    id: "orbit",
    lesson: 3,
    question: "Жасанды серік Жерге неге құламайды?",
    calc: () => ({ v: Math.sqrt(G * R_EARTH) / 1000 }),
    answer: (c) =>
      `Ол құлап келеді! Бірақ жылдамдығы сондай үлкен (Жер бетін жанай айналса, v = √(gR) ≈ ${fmt(c.v, 1)} км/с), сондықтан Жер беті оның астынан «қашып» отырады.`,
  },
  {
    id: "escape",
    lesson: 5,
    question: "Ракета Жерді тастап кету үшін қандай жылдамдық керек?",
    calc: () => ({ v: Math.sqrt(2 * G * R_EARTH) / 1000 }),
    answer: (c) =>
      `Екінші ғарыштық жылдамдық v = √(2gR) ≈ ${fmt(c.v, 1)} км/с. Бұл — бірінші ғарыштық жылдамдықтан √2 есе көп.`,
  },
  {
    id: "moon-jump",
    lesson: 2,
    question: "Айда қанша биік секіруге болады?",
    calc: () => ({ h: (0.5 * G) / G_MOON, k: G / G_MOON }),
    answer: (c) =>
      `Секіру биіктігі h = v²/(2g), ал Айда g ${fmt(c.k, 1)} есе аз. Жерде 0,5 м секіретін адам Айда ≈ ${fmt(c.h, 1)} м секірер еді.`,
  },
  {
    id: "jupiter-weight",
    lesson: 3,
    question: "Юпитерде салмағың қанша болар еді?",
    calc: () => ({ earth: 60 * G, jupiter: 60 * G_JUPITER, k: G_JUPITER / G }),
    answer: (c) =>
      `Массасы 60 кг студенттің салмағы Жерде ${fmt(c.earth, 0)} Н, ал Юпитерде ${fmt(c.jupiter, 0)} Н — ${fmt(c.k, 1)} есе артық. Масса өзгермейді, тек тартылыс күші өзгереді.`,
  },
  {
    id: "pilot-g",
    lesson: 7,
    question: "Жойғыш ұшақ бұрылғанда ұшқышқа қанша g түседі?",
    calc: () => {
      const a = 250 ** 2 / 1500;
      return { a, g: a / G };
    },
    answer: (c) =>
      `Центрге тартқыш үдеу a = v²/r. 250 м/с (900 км/сағ) жылдамдықпен 1,5 км радиуспен бұрылса, a ≈ ${fmt(c.a, 0)} м/с² ≈ ${fmt(c.g, 1)}g. Ұшқыш өз салмағынан 4 еседен астам ауыр болады.`,
  },
  {
    id: "wrench",
    lesson: 7,
    question: "Дөңгелек гайкасын бұрау үшін неге ұзын кілт ыңғайлы?",
    calc: () => ({ f1: 120 / 0.25, f2: 120 / 0.6 }),
    answer: (c) =>
      `Гайканы бұрау үшін 120 Н·м момент керек делік. M = F·r: 0,25 м кілтпен ${fmt(c.f1, 0)} Н, ал 0,6 м кілтпен тек ${fmt(c.f2, 0)} Н күш жеткілікті. Иін ұзарса, күш азаяды.`,
  },
  {
    id: "stairs-power",
    lesson: 5,
    question: "Баспалдақпен жүгіргенде қуатың қандай?",
    calc: () => ({ p: (70 * G * 3) / 5 }),
    answer: (c) =>
      `Массасы 70 кг адам 3 м биіктікке 5 секундта көтерілсе, P = mgh/t ≈ ${fmt(c.p, 0)} Вт. Бұл — қыздырғыш шамның қуатындай, бірақ ұзақ ұстап тұру мүмкін емес.`,
  },
  {
    id: "water-pressure",
    lesson: 9,
    question: "Суға 10 метр сүңгігенде қысым қанша артады?",
    calc: () => ({ p: (1000 * G * 10) / 1000 }),
    answer: (c) =>
      `Су бағанасының қысымы p = ρgh = 1000 · 9,81 · 10 ≈ ${fmt(c.p, 0)} кПа — бір атмосфераға жуық. Оған жер бетіндегі атмосфера қысымы қосылады, сондықтан 10 м тереңдікте абсолют қысым шамамен екі есе артады.`,
  },
  {
    id: "dead-sea",
    lesson: 9,
    question: "Өлі теңізде адам неге батпайды?",
    calc: () => ({ rho: 1240 }),
    answer: (c) =>
      `Онда су өте тұзды, тығыздығы ≈ ${fmt(c.rho, 0)} кг/м³, ал адам денесінің орташа тығыздығы шамамен 1000 кг/м³. Архимед күші дене салмағынан артық, сондықтан адам жүзіп жүреді.`,
  },
  {
    id: "spring-period",
    lesson: 8,
    question: "Серіппедегі жүктің тербеліс периоды неден тәуелді?",
    calc: () => ({ T: 2 * Math.PI * Math.sqrt(0.25 / 100) }),
    answer: (c) =>
      `T = 2π√(m/k) — тек масса мен қатаңдыққа байланысты. 0,25 кг жүк, k = 100 Н/м серіппеде T ≈ ${fmt(c.T, 2)} с. Амплитуда периодты өзгертпейді.`,
  },
  {
    id: "earth-speed",
    lesson: 7,
    question: "Біз отырған жерде Жер қандай жылдамдықпен айналады?",
    calc: () => ({ eq: OMEGA_EARTH * R_EQUATOR, baikonur: eastSpeed(LAT_BAIKONUR), astana: eastSpeed(LAT_ASTANA) }),
    answer: (c) =>
      `Экваторда Жер беті ≈ ${fmt(c.eq, 0)} м/с жылдамдықпен шығысқа қарай қозғалады. Байқоңыр ендігінде ол ≈ ${fmt(c.baikonur, 0)} м/с, Астанада ≈ ${fmt(c.astana, 0)} м/с: ендік артқан сайын v = ωR·cosφ азаяды.`,
  },
  {
    id: "abs",
    lesson: 3,
    question: "Көліктің ABS жүйесі не үшін керек?",
    calc: () => {
      const s = (mu: number) => (100 / 3.6) ** 2 / (2 * mu * G);
      return { rolling: s(0.9), skidding: s(0.7) };
    },
    answer: (c) =>
      `Домалап келе жатқан дөңгелек пен жолдың арасында статикалық үйкеліс (типтік μ ≈ 0,9) әсер етеді, ал сырғанағанда — сырғанау үйкелісі (μ ≈ 0,7), ол аздау. 100 км/сағ-тан тоқтау жолы: ≈ ${fmt(c.rolling, 0)} м және ≈ ${fmt(c.skidding, 0)} м. ABS дөңгелекті құлыптатпай, үйкелісті жоғары ұстайды.`,
  },
  {
    id: "raindrop",
    lesson: 2,
    question: "Жаңбыр тамшысы бұлттан түскенде неге ауыртпайды?",
    calc: () => ({ v: Math.sqrt(2 * G * 1500) }),
    answer: (c) =>
      `Ауа болмаса, 1,5 км биіктіктен түскен тамшы v = √(2gh) ≈ ${fmt(c.v, 0)} м/с жылдамдыққа жетер еді — оқтың жылдамдығына жуық. Шын мәнінде ауа кедергісі оны шектейді, ірі тамшылардың жылдамдығы көбіне 9 м/с-тан аспайды.`,
  },
  {
    id: "cat",
    lesson: 7,
    question: "Мысық құлағанда неге әрқашан аяғымен түседі?",
    calc: none,
    answer: () =>
      "Ауада сыртқы күш моменті жоқ, сондықтан жалпы импульс моменті нөлде қалады. Мысық денесінің алдыңғы және артқы бөліктерін қарама-қарсы бағытта бұрап, бірінен кейін бірін аударады — жалпы айналу болмай-ақ, бағытын өзгертеді.",
  },
  {
    id: "recoil-fact",
    lesson: 6,
    question: "Қайықтан секіргенде қайық неге артқа кетеді?",
    calc: () => ({ v: (60 * 3) / 120 }),
    answer: (c) =>
      `Импульс сақталады: адам алға, қайық артқа кетеді. 60 кг адам жағаға қатысты 3 м/с жылдамдықпен секірсе, 120 кг қайық ${fmt(c.v)} м/с жылдамдықпен кері кетеді (су кедергісін ескермегенде).`,
  },
];

/** Whole days since 1970 for a YYYY-MM-DD key, by the calendar alone. */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/**
 * The fact for a day: every fact once in each run of FACTS.length days, in an
 * order that changes from run to run, and never the same one two days running.
 */
export function factOfTheDay(day: string, facts: readonly Fact[] = FACTS): Fact {
  const n = facts.length;
  const num = dayNumber(day);
  const cycle = Math.floor(num / n);
  const order = (c: number) => seededShuffle(Array.from({ length: n }, (_, i) => i), seededRandom(hashSeed(`fact:${c}`)));

  const today = order(cycle);
  // The seam between two runs: do not let a fact be last in one and first in the next.
  if (n > 1 && order(cycle - 1)[n - 1] === today[0]) [today[0], today[1]] = [today[1], today[0]];
  // …and the swap above must not recreate a repeat with the day before it (it cannot: position 1 is new).
  return facts[today[((num % n) + n) % n]];
}
