# Firestore Schema

Collection names are centralized in `src/lib/firebase.ts` (`COLLECTIONS`). All read/write access goes through `src/lib/dataStore.ts`, which falls back to `localStorage` when Firebase isn't configured — the shapes below match both.

## `users`
```
users/{uid}
  uid: string
  fullName: string
  email: string
  role: "student" | "teacher" | "admin"
  avatarUrl?: string
  group?: string
  createdAt: string (ISO)
  competencyScore?: number   // 0-100
  badges?: string[]
  xp?: number
```

## `courses`
```
courses/{courseId}
  title: string
  description: string
  moduleIds: number[]
```

## `lessons` (mirrors src/data/modules.ts, editable by teachers)
```
lessons/{moduleId}
  title, shortDescription, objectives[], bloom{}, lectureSummary[],
  keyConcepts[], glossary[], reflectionQuestions[]
```

## `videos`
```
videos/{moduleId}
  src: string            // /videos/lesson-NN.mp4 or an https URL; admin-editable, see /teacher/lessons
  durationSeconds: number
```

## `quizzes` / `questions`
```
quizzes/{moduleId}
  questionIds: string[]

questions/{questionId}
  moduleId: number
  question: string
  options: string[]
  correctIndex: number
  explanation: string
```

## `assignments` (BOZh submissions)
```
assignments/{submissionId}
  moduleId: number
  userId: string
  type: "text" | "image" | "pdf" | "video" | "voice"
  content: string
  submittedAt: string
  teacherFeedback?: string
  grade?: number
  status: "pending" | "reviewed"
```

## `games`
```
games/{resultId}
  moduleId: number
  userId: string
  gameType: string
  score: number      // 0-100
  completedAt: string
```

## `progress` (quiz attempts + general activity log)
```
progress/{attemptId}
  kind: "quiz"
  moduleId: number
  userId: string
  score: number
  total: number
  answers: { questionId, chosenIndex, correct }[]
  takenAt: string
```

## `competencies`
```
competencies/{assessmentId}
  userId: string
  moduleId: number
  scores: { criterion: string, level: 1-5 }[]
  averageLevel: number
  percent: number
  assessedAt: string
  assessorType: "self" | "ai" | "teacher"
```

## `certificates`
```
certificates/{certId}
  userId: string
  courseName: string
  issuedAt: string
  qrData: string
  verifyUrl: string
```

## `leaderboard` (materialized view, updated by a Cloud Function trigger on `progress`/`games` writes)
```
leaderboard/{userId}
  fullName: string
  avatarUrl?: string
  xp: number
  competencyScore: number
  rank: number
```

## `analytics` (per-user snapshot, recomputed daily by a scheduled Cloud Function)
```
analytics/{userId}
  weeklyActivityMinutes: number[7]
  monthlyActivityMinutes: number[30]
  quizAverages: number[10]
  competencyRadar: { criterion: string, value: number }[]
  timeSpentTotalMinutes: number
```

## Suggested indexes

- `progress`: composite index on `(userId ASC, kind ASC, takenAt DESC)` — used by `getQuizAttempts`.
- `games`: composite index on `(userId ASC)`.
- `leaderboard`: single-field index on `xp DESC`.
