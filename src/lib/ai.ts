// Server-side AI gateway. Supports OpenAI (GPT) and Google Gemini, selected
// via NEXT_PUBLIC_AI_PROVIDER. When no API key is configured, falls back to
// a deterministic Kazakh-language mock so every AI feature in the LMS keeps
// working out of the box for demos.
import OpenAI from "openai";

export type AiTaskType =
  | "explain"
  | "summarize"
  | "example"
  | "practice-questions"
  | "check-assignment"
  | "improve-suggestions"
  | "qa"
  | "formula"
  | "formula-explain"
  | "extra-problems"
  | "motivate"
  | "misconception"
  | "simplify"
  | "recommendation";

export interface AiRequest {
  task: AiTaskType;
  topic?: string;
  userMessage?: string;
  context?: string;
}

const SYSTEM_PROMPT = `Сен "Механика AI LMS" платформасының жасанды интеллект тьюторысың.
Тек қазақ тілінде, қарапайым әрі түсінікті түрде жауап бер.
Сен механика пәні (кинематика, динамика, Ньютон заңдары, жұмыс пен энергия,
импульс, айналмалы қозғалыс, тербелістер, сұйықтар механикасы, инженерлік
механика) бойынша көмектесесің. Формулаларды қадам-қадаммен түсіндір,
мысалдар келтір, студентті қолдап, ынталандыр.`;

function mockResponse(req: AiRequest): string {
  const topic = req.topic ?? "механика тақырыбы";
  switch (req.task) {
    case "explain":
      return `"${topic}" тақырыбын түсіндірейін: бұл құбылысты негізгі үш қадаммен қарастырамыз — 1) құбылыстың анықтамасы, 2) оған әсер ететін физикалық шамалар, 3) практикалық мысал. Егер белгілі бір бөлігі түсініксіз болса, нақтылап сұра — толығырақ түсіндіремін.`;
    case "summarize":
      return `Дәріс қысқаша мазмұны: "${topic}" тақырыбында негізгі ұғымдар, формулалар және олардың нақты өмірдегі қолданылуы қарастырылды. Ең маңызды үш тұжырым: 1) негізгі заңдылықты есте сақта, 2) формула бірліктеріне мұқият бол, 3) есеп шығарғанда суретін салып ал.`;
    case "example":
      return `Мысал: "${topic}" бойынша есеп — жүк тиелген жүк көлігі еңіске көтеріліп барады. Оған әсер ететін күштерді (ауырлық күші, үйкеліс күші, реакция күші) анықтап, Ньютонның екінші заңы арқылы үдеуді есептейміз.`;
    case "practice-questions":
      return `Қосымша жаттығу сұрақтары:\n1) Дене массасы 5 кг, үдеуі 2 м/с² болса, оған әсер етуші күш неге тең?\n2) Үйкеліс коэффициенті 0.3 болғанда, үйкеліс күшін қалай есептейсің?\n3) Энергияның сақталу заңын осы жағдайға қолдан.`;
    case "check-assignment":
      return `Тапсырманы қарап шықтым. Жалпы құрылым дұрыс, бірақ күштер балансын салған кезде реакция күшінің бағытын тексеріп ал. Формулаңдағы бірліктерді (Н, кг, м/с²) де қайта тексер. Жалпы баға: жақсы деңгей, аздаған нақтылау қажет.`;
    case "improve-suggestions":
      return `Жұмысыңды жақсарту үшін: 1) есептеулерге бірлік қос, 2) сызбада күш векторларын анық көрсет, 3) қорытындыда нәтижені түсіндіріп жаз.`;
    case "qa":
      return `Сұрағыңа жауап: ${req.userMessage ? `"${req.userMessage}" бойынша — ` : ""}бұл құбылыс механиканың негізгі заңдарына сүйенеді. Нақты формула немесе мысал керек болса, жаз, толығырақ көрсетемін.`;
    case "formula":
      return `Негізгі формула: F = m·a (Ньютонның екінші заңы), мұндағы F — күш (Н), m — масса (кг), a — үдеу (м/с²).`;
    case "formula-explain":
      return `Формуланы қадам-қадаммен түсіндірейін: F = m·a. 1) m — дененің массасы, өзгермейді. 2) a — үдеу, жылдамдықтың уақыт бойынша өзгеру жылдамдығы. 3) Осы екеуін көбейтіп, денеге әсер ететін тең әсерлі күшті табамыз.`;
    case "extra-problems":
      return `Қосымша есептер: 1) 10 кг жүк 3 м/с² үдеумен қозғалса, күш қандай? 2) Автомобиль 20 м/с жылдамдықпен қозғалып, 5 секундта тоқтаса, тежеу үдеуін тап.`;
    case "motivate":
      return `Тамаша жұмыс жасап жатырсың! Механика — қиын болып көрінгенімен, әр есеп сені жаңа түсінікке жақындатады. Жалғастыра бер, сен жасай аласың!`;
    case "misconception":
      return `Жиі кездесетін қате түсінік: көптеген студенттер "күш болмаса, дене тоқтайды" деп ойлайды. Шындығында, Ньютонның бірінші заңы бойынша, күш болмаса дене өз қозғалысын (немесе тыныштығын) сақтайды.`;
    case "simplify":
      return `Қарапайым тілмен айтқанда: ${topic} — заттардың қалай және неге қозғалатынын түсіндіретін ереже. Күш итеріп немесе тартып, затты жылдамдатады немесе баяулатады.`;
    case "recommendation":
      return `Жеке ұсыныс: соңғы нәтижелеріңе қарағанда, "Динамика" және "Импульс" тақырыптарын қайталап шыққан жөн. Сосын тиісті сабақтың ойынын қайта ойнап, білімді бекіт.`;
    default:
      return `Сұрағыңды түсіндім, бірақ нақтылай алмадым. Қайта тұжырымдап жазып көрші.`;
  }
}

export async function runAiTask(req: AiRequest): Promise<string> {
  const provider = process.env.NEXT_PUBLIC_AI_PROVIDER ?? "mock";

  try {
    if (provider === "openai" && process.env.OPENAI_API_KEY) {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-5.5",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: buildUserPrompt(req),
          },
        ],
        temperature: 0.6,
      });
      return completion.choices[0]?.message?.content ?? mockResponse(req);
    }

    if (provider === "gemini" && process.env.GEMINI_API_KEY) {
      const model = process.env.GEMINI_MODEL || "gemini-2.0-pro";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(req)}` }],
              },
            ],
          }),
        }
      );
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      return text ?? mockResponse(req);
    }
  } catch (err) {
    console.error("AI provider error, falling back to mock:", err);
  }

  // Default / fallback path — deterministic Kazakh mock responses.
  return mockResponse(req);
}

function buildUserPrompt(req: AiRequest): string {
  const parts = [`Тапсырма түрі: ${req.task}`];
  if (req.topic) parts.push(`Тақырып: ${req.topic}`);
  if (req.context) parts.push(`Контекст: ${req.context}`);
  if (req.userMessage) parts.push(`Студент сұрағы: ${req.userMessage}`);
  return parts.join("\n");
}
