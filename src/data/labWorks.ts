// The ten laboratory works of the course, exactly as specified.
//
// This is a *lab* list, not a lesson list, and the two do not line up one to
// one: lesson 2 (Кинематика) carries three of the works, while lessons 1, 9
// and 10 carry none. Forcing them into the lesson numbering would have meant
// either renaming lessons to match labs or quietly dropping the works that did
// not fit, so labs get their own identity and point at the lesson they belong
// to.
//
// `sceneModuleId` is which 3D scene runs the work. Several works share a scene
// because they are the same apparatus read for a different quantity — the
// free-body setup that demonstrates F = ma is the one you vary to measure μ.

export interface LabWork {
  /** 1–10 as numbered in the course documentation. */
  id: number;
  title: string;
  /** PASCO hardware, named as in the lab manual. */
  devices: string[];
  /** What the work is actually measuring. */
  concept: string;
  /** How it is carried out at a distance. */
  remote: string;
  /** The lesson whose theory covers it. */
  lessonId: number;
  /**
   * The simulation that runs it, keyed by the existing scene registry.
   * `null` while the scene is still being built.
   */
  sceneModuleId: number | null;
}

export const LAB_WORKS: LabWork[] = [
  {
    id: 1,
    title: "Бірқалыпты түзу сызықты қозғалысты зерттеу",
    devices: ["Wireless Motion Sensor", "Smart Cart"],
    concept: "Орын ауыстыру, жылдамдық",
    remote: "SPARKvue графиктерін онлайн талдау",
    lessonId: 2,
    sceneModuleId: 2,
  },
  {
    id: 2,
    title: "Бірқалыпты үдемелі қозғалысты зерттеу",
    devices: ["Wireless Motion Sensor", "Smart Cart"],
    concept: "Үдеу, қозғалыс теңдеулері",
    remote: "Онлайн эксперимент және графиктерді талдау",
    lessonId: 2,
    sceneModuleId: 2,
  },
  {
    id: 3,
    title: "Ньютонның II заңын эксперименттік тексеру",
    // The separate PS-3202 force sensor was not scanned; the Smart Cart has a
    // force sensor and a 3-axis accelerometer built in, so the work is done
    // with the cart alone rather than with a stand-in for hardware we do not
    // have.
    devices: ["Smart Cart (кірістірілген күш датчигі)"],
    concept: "Күш пен үдеудің тәуелділігі (F = ma)",
    remote: "Қашықтан F–a графигін зерттеу",
    lessonId: 4,
    sceneModuleId: 3,
  },
  {
    id: 4,
    title: "Үйкеліс коэффициентін анықтау",
    devices: ["Smart Cart (кірістірілген күш датчигі)"],
    concept: "Үйкеліс күші, үйкеліс коэффициенті",
    remote: "Әртүрлі беттерді салыстыру",
    lessonId: 3,
    sceneModuleId: 11,
  },
  {
    id: 5,
    title: "Импульстің сақталу заңын зерттеу",
    devices: ["Wireless Smart Cart"],
    concept: "Серпімді және серпімсіз соқтығысулар",
    remote: "Қозғалыс бейнесі мен деректерін талдау",
    lessonId: 6,
    sceneModuleId: 6,
  },
  {
    id: 6,
    title: "Механикалық энергияның сақталу заңын зерттеу",
    devices: ["Wireless Motion Sensor", "Smart Cart"],
    concept: "Потенциалдық және кинетикалық энергия",
    remote: "Энергия графиктерін талдау",
    lessonId: 5,
    sceneModuleId: 5,
  },
  {
    id: 7,
    title: "Серіппелі маятниктің тербелісін зерттеу",
    devices: ["Wireless Motion Sensor"],
    concept: "Гармониялық тербеліс, период, жиілік",
    remote: "x–t, v–t, a–t графиктерін қашықтан талдау",
    lessonId: 8,
    sceneModuleId: 8,
  },
  {
    id: 8,
    title: "Еркін түсу үдеуін анықтау",
    devices: ["Wireless Smart Gate"],
    concept: "Еркін түсу, g үдеуі",
    remote: "Фотоқақпа арқылы алынған уақытты өңдеу",
    lessonId: 2,
    sceneModuleId: 12,
  },
  {
    id: 9,
    title: "Айналмалы қозғалысты зерттеу",
    devices: ["Rotary Motion Sensor"],
    concept: "Бұрыштық орын ауыстыру, бұрыштық жылдамдық, бұрыштық үдеу",
    remote: "θ–t, ω–t, α–t графиктерін талдау",
    lessonId: 7,
    sceneModuleId: 13,
  },
  {
    id: 10,
    title: "Айналу моменті және инерция моментін анықтау",
    devices: ["Rotary Motion Sensor", "Smart Cart (күш датчигі)"],
    concept: "Айналу моменті (τ), инерция моменті (I)",
    remote: "Айналу динамикасын қашықтан зерттеу",
    lessonId: 7,
    sceneModuleId: 7,
  },
];

export function labsForLesson(lessonId: number): LabWork[] {
  return LAB_WORKS.filter((l) => l.lessonId === lessonId);
}

export function getLabWork(id: number): LabWork | undefined {
  return LAB_WORKS.find((l) => l.id === id);
}

/**
 * Scenes that exist but are not one of the ten prescribed works — reference
 * frames, the three laws together, buoyancy and beam bending. They stay
 * available on their lessons; they are simply not part of the assessed list.
 */
export const EXTRA_SCENE_MODULES = [1, 4, 9, 10];
