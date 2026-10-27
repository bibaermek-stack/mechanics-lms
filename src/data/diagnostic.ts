// The diagnostic test: the same 20 items before the course (pre) and after it
// (post), two per lesson topic.
//
// Why these are not the lesson quiz questions: a student can retake a lesson
// quiz until it is right and is shown the explanation after each answer, so
// reusing those items would measure memory of the course material rather than
// understanding of mechanics. These items are never shown anywhere else, have
// no explanations, and are presented in exactly this order and wording both
// times — the paired comparison is only meaningful if the instrument is
// identical.
//
// Every item is a single-best-answer question with four options. Numerical
// ones use values that come out whole, so a calculator is not part of what is
// being measured, and state g explicitly where it matters.
//
// To adjust the test, edit this file — and do it *before* the first student sits
// the pre-test: changing an item afterwards makes earlier pre-scores
// incomparable to later post-scores.

export interface DiagnosticQuestion {
  id: string;
  /** The lesson whose topic the item belongs to (1–10). */
  topic: number;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  // 1 · Механикаға кіріспе
  {
    id: "d01",
    topic: 1,
    question: "Қандай жағдайда денені материалдық нүкте деп қарастыруға болады?",
    options: [
      "Дене өте ауыр болғанда",
      "Дененің өлшемдері оның жүрген жолымен салыстырғанда елеусіз аз болғанда",
      "Дене тыныштықта тұрғанда",
      "Дене өте жылдам қозғалғанда",
    ],
    correctIndex: 1,
  },
  {
    id: "d02",
    topic: 1,
    question: "Механикалық қозғалыстың салыстырмалылығы нені білдіреді?",
    options: [
      "Қозғалыс тек уақытқа байланысты",
      "Дененің массасы жылдамдығына байланысты",
      "Қозғалыстың сипаты (жылдамдық, траектория) санақ жүйесін таңдауға байланысты",
      "Қозғалыс әрқашан түзу сызықты болады",
    ],
    correctIndex: 2,
  },

  // 2 · Кинематика
  {
    id: "d03",
    topic: 2,
    question: "Дене 5 м/с жылдамдықпен бірқалыпты түзу сызықты қозғалып, 12 с жүрді. Жүрген жолы қанша?",
    options: ["17 м", "2,4 м", "30 м", "60 м"],
    correctIndex: 3,
  },
  {
    id: "d04",
    topic: 2,
    question:
      "Дененің жылдамдығы тыныштық күйден бастап 4 с ішінде 20 м/с-қа дейін бірқалыпты өсті. Үдеуі қандай?",
    options: ["5 м/с²", "80 м/с²", "0,2 м/с²", "16 м/с²"],
    correctIndex: 0,
  },

  // 3 · Динамика
  {
    id: "d05",
    topic: 3,
    question:
      "Массасы 2 кг денеге 6 Н тең әсерлі күш әсер етеді. Дененің үдеуі қандай?",
    options: ["12 м/с²", "0,33 м/с²", "3 м/с²", "8 м/с²"],
    correctIndex: 2,
  },
  {
    id: "d06",
    topic: 3,
    question: "Дененің массасы мен салмағы туралы қай тұжырым дұрыс?",
    options: [
      "Масса ньютонмен, салмақ килограммен өлшенеді",
      "Масса мен салмақ — бірдей шама",
      "Салмақ массаға байланыссыз, әрқашан бірдей болады",
      "Масса килограммен, салмақ ньютонмен өлшенеді және тіректе тұрған дене үшін P = mg",
    ],
    correctIndex: 3,
  },

  // 4 · Ньютон заңдары
  {
    id: "d07",
    topic: 4,
    question:
      "Жер кітапты өзіне тартады. Ньютонның үшінші заңы бойынша кітап Жерді қалай тартады?",
    options: [
      "Дәл сондай шамамен, бірақ қарама-қарсы бағытта",
      "Тартпайды, өйткені Жер өте үлкен",
      "Әлдеқайда аз күшпен",
      "Тек кітап құлап келе жатқанда ғана",
    ],
    correctIndex: 0,
  },
  {
    id: "d08",
    topic: 4,
    question: "Денеге әсер ететін барлық күштердің тең әсерлі күші нөлге тең болса, дене…",
    options: [
      "міндетті түрде тоқтайды",
      "үдей қозғалады",
      "шеңбер бойымен қозғалады",
      "тыныштықта немесе бірқалыпты түзу сызықты қозғалыста болады",
    ],
    correctIndex: 3,
  },

  // 5 · Жұмыс және энергия
  {
    id: "d09",
    topic: 5,
    question: "Массасы 2 кг дене 10 м/с жылдамдықпен қозғалады. Оның кинетикалық энергиясы қанша?",
    options: ["20 Дж", "100 Дж", "200 Дж", "40 Дж"],
    correctIndex: 1,
  },
  {
    id: "d10",
    topic: 5,
    question:
      "Ауа кедергісі мен үйкеліс жоқ деп алсақ, еркін құлаған дененің толық механикалық энергиясы құлау кезінде…",
    options: [
      "артады",
      "кемиді",
      "өзгермейді: потенциалдық энергия кинетикалыққа айналады",
      "нөлге айналады",
    ],
    correctIndex: 2,
  },

  // 6 · Импульс
  {
    id: "d11",
    topic: 6,
    question: "Массасы 3 кг дене 4 м/с жылдамдықпен қозғалады. Оның импульсі қандай?",
    options: ["7 кг·м/с", "12 кг·м/с", "0,75 кг·м/с", "24 кг·м/с"],
    correctIndex: 1,
  },
  {
    id: "d12",
    topic: 6,
    question: "Тұйық жүйеде екі дене соқтығысқанда…",
    options: [
      "әр дененің импульсі өзгермейді",
      "жүйенің импульсі міндетті түрде артады",
      "кинетикалық энергия әрқашан сақталады",
      "жүйенің толық импульсі сақталады",
    ],
    correctIndex: 3,
  },

  // 7 · Айналмалы қозғалыс
  {
    id: "d13",
    topic: 7,
    question:
      "Дөңгелектің радиусы 0,5 м, ол 4 рад/с бұрыштық жылдамдықпен айналады. Жиегіндегі нүктенің сызықтық жылдамдығы қанша?",
    options: ["8 м/с", "0,125 м/с", "2 м/с", "4,5 м/с"],
    correctIndex: 2,
  },
  {
    id: "d14",
    topic: 7,
    question: "Шеңбер бойымен бірқалыпты қозғалатын дененің үдеуі қалай бағытталған?",
    options: [
      "Шеңбердің центріне қарай",
      "Жылдамдық бағытымен",
      "Жылдамдыққа қарсы",
      "Шеңберден сыртқа қарай",
    ],
    correctIndex: 0,
  },

  // 8 · Тербелістер
  {
    id: "d15",
    topic: 8,
    question:
      "Математикалық маятниктің ұзындығын 4 есе арттырса, оның тербеліс периоды қалай өзгереді?",
    options: ["4 есе артады", "2 есе артады", "2 есе азаяды", "өзгермейді"],
    correctIndex: 1,
  },
  {
    id: "d16",
    topic: 8,
    question: "Тербеліс периоды 0,5 с болса, тербеліс жиілігі қанша?",
    options: ["0,5 Гц", "0,2 Гц", "4 Гц", "2 Гц"],
    correctIndex: 3,
  },

  // 9 · Сұйықтар механикасы
  {
    id: "d17",
    topic: 9,
    question: "Архимед күші неге тең?",
    options: [
      "Дененің ығыстырған сұйығының салмағына",
      "Дененің өз салмағына",
      "Сұйықтың массасына",
      "Дененің көлеміне",
    ],
    correctIndex: 0,
  },
  {
    id: "d18",
    topic: 9,
    question:
      "Тығыздығы 1000 кг/м³ судың 2 м тереңдіктегі гидростатикалық қысымы қанша? (g = 10 м/с², атмосфералық қысымсыз)",
    options: ["2 кПа", "10 кПа", "200 кПа", "20 кПа"],
    correctIndex: 3,
  },

  // 10 · Инженерлік механика
  {
    id: "d19",
    topic: 10,
    question: "Күш иіні 0,4 м, күш 50 Н болса, күштің моменті қанша?",
    options: ["125 Н·м", "20 Н·м", "0,008 Н·м", "50,4 Н·м"],
    correctIndex: 1,
  },
  {
    id: "d20",
    topic: 10,
    question: "Дененің тепе-теңдікте болуы үшін қандай шарт орындалуы керек?",
    options: [
      "Тек күштердің қосындысы нөлге тең болуы керек",
      "Тек күш моменттерінің қосындысы нөлге тең болуы керек",
      "Күштердің де, күш моменттерінің де қосындысы нөлге тең болуы керек",
      "Денеге тек бір ғана күш әсер етуі керек",
    ],
    correctIndex: 2,
  },
];

/** How many of the ten lessons a student must have taken a quiz in before the post-test opens. */
export const POST_UNLOCK_LESSONS = 8;
