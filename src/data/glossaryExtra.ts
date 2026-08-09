// Additional glossary terms per lesson.
//
// The bundled lessons carry three or four terms each, which is enough for a
// definitions tab but not enough to build a crossword, a word search and a
// sorting board from — five games out of three words is not a game, it is the
// same three words three times. Measured across the ten lessons, only four of
// them could produce more than one derived game.
//
// These are kept beside the modules rather than merged into them so the
// addition stays reviewable in one place: `lessonGlossary()` is the single
// accessor both the Глоссарий tab and the game builders read, so there is
// still one effective source of truth.
//
// Terms are the standard Kazakh mechanics vocabulary for each topic, chosen so
// every lesson reaches seven to nine entries.

import type { GlossaryTerm, LessonModule } from "@/lib/types";

const EXTRA: Record<number, GlossaryTerm[]> = {
  1: [
    { term: "Кинематика", definition: "Қозғалысты оның себептерін қарастырмай сипаттайтын бөлім." },
    { term: "Қатты дене", definition: "Нүктелерінің ара қашықтығы өзгермейтін дене моделі." },
    { term: "Уақыт", definition: "Оқиғалардың реттілігі мен ұзақтығын өлшейтін негізгі шама." },
    { term: "Ұзындық", definition: "Кеңістіктегі қашықтықты сипаттайтын негізгі шама." },
  ],
  2: [
    { term: "Жол", definition: "Дене жүріп өткен траекторияның толық ұзындығы." },
    { term: "Лездік жылдамдық", definition: "Уақыттың нақты бір сәтіндегі жылдамдық." },
  ],
  3: [
    { term: "Ауырлық күші", definition: "Жердің денеге әсер ететін тартылыс күші, F = mg." },
    { term: "Үйкеліс күші", definition: "Жанасқан беттердің салыстырмалы қозғалысына кедергі жасайтын күш." },
    { term: "Серпімділік күші", definition: "Деформацияланған дененің қалпына келуге ұмтылысынан туатын күш." },
    { term: "Тірек реакциясы", definition: "Тіректің денеге бетке перпендикуляр әсер ететін күші." },
    { term: "Динамометр", definition: "Күшті серіппенің созылуы арқылы өлшейтін құрал." },
  ],
  4: [
    { term: "Инерттілік", definition: "Дененің жылдамдығының өзгеруіне қарсыласу қасиеті." },
    { term: "Күштердің тепе-теңдігі", definition: "Денеге әсер етуші күштердің қосындысы нөлге тең болатын жағдай." },
    { term: "Ньютонның екінші заңы", definition: "Дененің үдеуі әсер етуші күшке тура, массасына кері пропорционал: a = F/m." },
    { term: "Еркін дене диаграммасы", definition: "Денеге әсер ететін барлық күштерді бөлек көрсететін сызба." },
    { term: "Көлбеу жазықтық", definition: "Ауырлық күшін екі құраушыға жіктеуге мүмкіндік беретін тірек." },
  ],
  5: [
    { term: "Механикалық энергия", definition: "Кинетикалық және потенциалдық энергиялардың қосындысы." },
    { term: "Энергияның сақталу заңы", definition: "Тұйық жүйеде толық механикалық энергия тұрақты болып қалады." },
    { term: "Пайдалы әсер коэффициенті", definition: "Пайдалы жұмыстың жұмсалған жұмысқа қатынасы." },
    { term: "Джоуль", definition: "Жұмыс пен энергияның СИ жүйесіндегі бірлігі." },
    { term: "Консервативті күш", definition: "Жұмысы жүрілген жолға емес, тек бастапқы және соңғы күйге тәуелді күш." },
  ],
  6: [
    { term: "Күш импульсі", definition: "Күштің оның әсер ету уақытына көбейтіндісі, F·Δt." },
    { term: "Тұйық жүйе", definition: "Сыртқы күштер әсер етпейтін денелер жиынтығы." },
    { term: "Серпімсіз соққы", definition: "Соққыдан кейін денелер бірге қозғалатын, кинетикалық энергия сақталмайтын соққы." },
    { term: "Реактивті қозғалыс", definition: "Дененің бір бөлігі бөлініп ұшуы есебінен пайда болатын қозғалыс." },
    { term: "Массалар центрі", definition: "Жүйенің массасы шоғырланған деп қарастырылатын нүкте." },
  ],
  7: [
    { term: "Күш моменті", definition: "Күштің айналдырушы әсері, M = F·d." },
    { term: "Бұрыштық үдеу", definition: "Бұрыштық жылдамдықтың уақыт бойынша өзгеру жылдамдығы." },
    { term: "Айналу периоды", definition: "Дене бір толық айналым жасайтын уақыт." },
    { term: "Импульс моменті", definition: "Айналмалы қозғалыстағы импульстің баламасы, L = Iω." },
    { term: "Центрден тепкіш күш", definition: "Айналушы санақ жүйесінде байқалатын инерция күші." },
    { term: "Радиан", definition: "Доға ұзындығы радиусқа тең болатын бұрыш өлшемі." },
    { term: "Импульс моментінің сақталу заңы", definition: "Сыртқы күш моменті болмаса, жүйенің импульс моменті тұрақты қалады." },
  ],
  8: [
    { term: "Гармониялық тербеліс", definition: "Ығысуы синус заңы бойынша өзгеретін тербеліс." },
    { term: "Фаза", definition: "Тербеліс процесінің берілген уақыт сәтіндегі күйі." },
    { term: "Резонанс", definition: "Мәжбүрлеуші жиілік меншікті жиілікке жақындағанда амплитуданың күрт өсуі." },
    { term: "Серіппелі маятник", definition: "Серіппеге ілінген жүктің тербелмелі жүйесі." },
    { term: "Өшетін тербеліс", definition: "Үйкеліс салдарынан амплитудасы бірте-бірте кемитін тербеліс." },
  ],
  9: [
    { term: "Тығыздық", definition: "Дене массасының оның көлеміне қатынасы, ρ = m/V." },
    { term: "Гидростатикалық қысым", definition: "Сұйық бағанасының тереңдікке байланысты қысымы, p = ρgh." },
    { term: "Кері итеруші күш", definition: "Сұйыққа батырылған денеге жоғары бағытта әсер ететін күш." },
    { term: "Бернулли теңдеуі", definition: "Ағын жылдамдығы мен қысымын байланыстыратын теңдеу." },
    { term: "Ағын үздіксіздігі", definition: "Түтіктің әр қимасынан бірдей көлемдік ағын өтетінін білдіретін шарт." },
  ],
  10: [
    { term: "Гук заңы", definition: "Серпімділік шегінде деформация кернеуге тура пропорционал." },
    { term: "Серпімділік модулі", definition: "Материалдың деформацияға қарсыласуын сипаттайтын шама (Юнг модулі)." },
    { term: "Беріктік қоры", definition: "Шекті кернеудің жұмыс кернеуіне қатынасы." },
    { term: "Созылу", definition: "Дене ұзындығының сыртқы күш әсерінен ұлғаюы." },
    { term: "Инерция радиусы", definition: "Қиманың иілуге қарсыласуын сипаттайтын геометриялық шама." },
  ],
};

/**
 * The lesson's full vocabulary: what the module declares, plus the additions
 * above. Duplicates are dropped by term, with the module's own wording winning
 * — a lesson that defines a term itself is the authority on it.
 */
export function lessonGlossary(mod: LessonModule): GlossaryTerm[] {
  const seen = new Set(mod.glossary.map((g) => g.term));
  const extra = (EXTRA[mod.id] ?? []).filter((g) => !seen.has(g.term));
  return [...mod.glossary, ...extra];
}
