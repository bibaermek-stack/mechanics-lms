# Механика AI LMS

Магистрлік диссертацияға арналған, жасанды интеллект негізіндегі қашықтықтан оқыту платформасы.

**Тақырып:** «Механиканы қашықтықтан оқыту жағдайында студенттердің ақпараттық-коммуникативтік құзыреттілігін қалыптастыруға арналған жасанды интеллект негізіндегі білім беру платформасы»

Бүкіл интерфейс — батырмалар, мәзірлер, хабарламалар, дашбордтар, викториналар, ойындар, сертификаттар — толығымен **қазақ тілінде**. Бастапқы код пен түсініктемелер ағылшын тілінде жазылған (халықаралық әзірлеу тәжірибесіне сай).

## Мазмұны

- [Технологиялар](#технологиялар)
- [Жобаны іске қосу](#жобаны-іске-қосу)
- [Мок режим vs. нақты сервистер](#мок-режим-vs-нақты-сервистер)
- [Педагогикалық негіз](#педагогикалық-негіз)
- [Функционал картасы](#функционал-картасы)
- [Жоба құрылымы](#жоба-құрылымы)
- [Деректер қоры](#деректер-қоры)
- [Пайдалану нұсқаулықтары](#пайдалану-нұсқаулықтары)
- [Авторлар мен Жобаға үлес қосушылар](#авторлар-мен-жобаға-үлес-қосушылар)

## Технологиялар

| Қабат | Технология |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Стиль | TailwindCSS, glassmorphism дизайн жүйесі, Dark Mode |
| Дерекқор | Firebase Firestore (мок fallback-пен) |
| Аутентификация | Firebase Auth + Google OAuth (мок fallback-пен) |
| Файл сақтау | Firebase Storage / Google Drive API |
| Жасанды интеллект | OpenAI GPT-5.5 немесе Google Gemini (детерминистік қазақша мок fallback-пен) |
| Google Workspace | Google Forms, Google Sheets, Google Drive, Google Calendar |
| Графиктер | Chart.js / react-chartjs-2 (радар, столбиктік, шеңберлік) |
| Күй басқару | Zustand |
| PWA | manifest.json, responsive дизайн |

## Жобаны іске қосу

```bash
cd mechanics-lms
npm install
cp .env.local.example .env.local   # қажет болса, кілттерді толтырыңыз
npm run dev
```

`http://localhost:3000` мекенжайын ашыңыз. `.env.local` файлын толтырмасаңыз да, платформа **толық жұмыс істейді** — барлық деректер localStorage-те мок түрінде сақталады, ал AI тьютор дайын қазақша жауаптар қайтарады.

> **Кеңес:** егер `npm run build` кезінде түсініксіз қатеге (мыс., "Bus error" немесе бос output) тап болсаңыз, бұл әдетте желі/диск проблемасынан кейбір пакеттің (жиі `@next/swc-*`) жартылай жүктелуінен туындайды. Шешімі: `rm -rf node_modules package-lock.json && npm install` арқылы толық қайта орнатыңыз.

Өндірістік құрастыру (жоба Next.js 14 + React 18 + TypeScript негізінде толық тексеріліп, сәтті құрастырылғанын растадық — барлық 20 маршрут қатесіз компиляцияланады):

```bash
npm run build
npm run start
```

## Мок режим vs. нақты сервистер

Жоба **"нақты SDK кодтары + мок fallback"** тәсілімен құрылған (`src/lib/firebase.ts`, `src/lib/dataStore.ts`, `src/lib/ai.ts`, `src/lib/googleWorkspace.ts`):

- **Firebase:** `NEXT_PUBLIC_FIREBASE_*` айнымалылары толтырылып, `NEXT_PUBLIC_USE_MOCK_BACKEND=false` қойылса, барлық CRUD операциялары Firestore-ға жазылады. Әйтпесе — браузердің `localStorage`-іне.
- **AI:** `NEXT_PUBLIC_AI_PROVIDER=openai` немесе `gemini` қойып, тиісті API кілтін (`OPENAI_API_KEY` / `GEMINI_API_KEY`) толтырсаңыз, сұраулар нақты моделге жіберіледі. Кілт жоқ болса немесе провайдер қатесі болса, жүйе автоматты түрде дайын қазақша жауаптарға (mock) ауысады — демо ешқашан "бұзылмайды".
- **Google Workspace:** `GOOGLE_CLIENT_ID`/`SECRET` толтырылса, OAuth логин, Sheets оқу және Drive тізімдеу нақты жұмыс істейді (`src/lib/googleWorkspace.ts`, `/api/auth/google/callback`, `/api/google/sheets`). Кілттер жоқ болса — мок жолдар қайтарылады.

Толығырақ орнату қадамдары `DEPLOYMENT.md` файлында.

## Педагогикалық негіз

- **ADDIE моделі:** Analysis (қажеттілікті талдау) → Design (Блум таксономиясы бойынша нәтижелер, рубрика) → Development (10 сабақ, AI, ойындар) → Implementation (Next.js платформа) → Evaluation (құзыреттілік бағалау, аналитика).
- **Блум таксономиясы:** әр сабақта алты деңгей де (`Есте сақтау → Түсіну → Қолдану → Талдау → Бағалау → Жасау`) `src/data/modules.ts` файлындағы `bloom` өрісінде беріледі және сабақ бетінде көрсетіледі.
- **Ақпараттық-коммуникативтік құзыреттілік моделі:** 10 критерийлі рубрика (`src/lib/competency.ts` → `RUBRIC_CRITERIA`), 5 деңгей (Бастапқы → Сарапшы).
- **Қорытынды баға формуласы:** салмақталған 10 компонент (`src/lib/competency.ts` → `GRADE_WEIGHTS`): бейне 10%, викторина 20%, ойындар 10%, БӨЖ 20%, Google Forms 15%, AI белсенділігі 10%, форум 5%, портфолио 5%, жоба 5%, рефлексия 5%.

## Функционал картасы

| Талап | Іске асырылған жері |
|---|---|
| 10 сабақ (YouTube, глоссарий, викторина, ойын, БӨЖ, AI, бағалау) | `src/data/modules.ts`, `src/app/modules/[id]/page.tsx` |
| Сабақ 1–2 толық тереңдікте, 3–10 — жеңіл үлгі (оқытушы кеңейте алады) | `src/data/modules.ts` (`MODULES` vs `TEMPLATE_SEEDS`) |
| Рандомизацияланған викторина, автобаға, түсіндірме | `src/components/quiz/QuizEngine.tsx`, `randomizeQuiz()` |
| 5 интерактивті ойын түрі (сәйкестендіру, жады, флэш-карточка, сүйреп апару, дөңгелек) | `src/components/games/*` |
| AI тьютор (14 тапсырма түрі, тек қазақша) | `src/lib/ai.ts`, `src/components/ai/AiTutorWidget.tsx` |
| Google Workspace интеграциясы | `src/lib/googleWorkspace.ts`, `/api/google/sheets`, `/api/auth/google/callback` |
| Құзыреттілік рубрикасы + автобағалау | `src/lib/competency.ts`, `src/components/assessment/RubricAssessment.tsx` |
| Аналитика (радар, столбиктік, шеңберлік, экспорт) | `src/app/analytics/page.tsx`, `src/components/charts/*` |
| Сертификат + QR верификация | `src/components/certificate/CertificateCard.tsx`, `/verify/[id]` |
| Көшбасшылар кестесі, бейджтер, XP | `src/app/leaderboard/page.tsx`, `src/lib/authStore.ts` |
| Студент/оқытушы дашбордтары | `src/app/dashboard`, `src/app/teacher/*` |
| Dark Mode, PWA, responsive | `globals.css`, `public/manifest.json`, Tailwind `dark:` кластары |

## Жоба құрылымы

```
mechanics-lms/
├── src/
│   ├── app/                  # Next.js App Router беттері + API route-тар
│   │   ├── api/ai/           # AI шлюзі (OpenAI/Gemini/mock)
│   │   ├── api/google/       # Google Sheets оқу
│   │   ├── api/auth/google/  # OAuth callback
│   │   ├── modules/[id]/     # Сабақ беті (7 табы бар)
│   │   ├── teacher/          # Оқытушы дашборды
│   │   └── ...
│   ├── components/           # Қайта пайдаланылатын UI компоненттер
│   ├── data/modules.ts       # 10 сабақтың толық контенті
│   └── lib/                  # Firebase, AI, Google, competency, dataStore
├── docs/firestore-schema.md
├── README.md / DEPLOYMENT.md
└── .env.local.example
```

## Деректер қоры

Firestore коллекциялары толық сипатталған: `docs/firestore-schema.md`.

## Пайдалану нұсқаулықтары

- **Студент:** `/login` бетінен "Студент" рөлін таңдап кіріңіз → `/dashboard` → сабақтарды оқыңыз → викторина/ойын/БӨЖ орындаңыз → `/analytics` пен `/certificates` арқылы нәтижені бақылаңыз.
- **Оқытушы:** `/login` бетінен "Оқытушы" рөлін таңдаңыз → `/teacher` → студенттер тізімі, YouTube сілтемелерін өзгерту, тапсырмаларды тексеру, топ аналитикасы.

Демо режимде екі рөл де нақты тіркелгісіз, бір батырма басу арқылы қолжетімді.

## Авторлар мен Жобаға үлес қосушылар

- 👨‍💻 **Ержан Едилбаев** ([@yerzhanyedilbayev-prog](https://github.com/yerzhanyedilbayev-prog)) — *Жоба авторы & Негізгі әзірлеуші*
- 👨‍💻 **bibaermek-stack** ([@bibaermek-stack](https://github.com/bibaermek-stack)) — *Негізгі әзірлеуші & Үлес қосушы*

[![Contributors](https://img.shields.io/github/contributors/yerzhanyedilbayev-prog/mechanics-lms?style=for-the-badge&color=blue)](CONTRIBUTORS.md)
[![Contributing Guide](https://img.shields.io/badge/Contributing-Guide-green?style=for-the-badge)](CONTRIBUTING.md)

Жобаға үлес қосқыңыз келсе немесе барлық үлес қосушылар тізімін көргіңіз келсе, төмендегі құжаттарды қараңыз:
- 📜 **[CONTRIBUTORS.md](CONTRIBUTORS.md)** — Авторлар мен үлес қосушылардың толық тізімі.
- 🤝 **[CONTRIBUTING.md](CONTRIBUTING.md)** — Жобаға үлес қосу және PR жіберу нұсқаулығы.

