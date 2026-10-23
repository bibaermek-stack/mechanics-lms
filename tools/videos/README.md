# Lesson films

The ten lecture videos are not recordings. Each one is the lesson's 3D scene
(`src/components/lesson3d/scenes/LessonNN.tsx`) played by a clock and
photographed frame by frame, so the same code produces

- `public/videos/lesson-NN.mp4` — the film, 1280×720, 24 fps, H.264,
  Kazakh captions burned in;
- `public/videos/lesson-NN.vtt` — the same captions as a WebVTT file
  (screen readers; the player keeps this track off by default so captions are
  not shown twice);
- `public/videos/lesson-NN.jpg` — the poster frame.

The same scenes also run live in the lesson page (tab **3D сахна**), where a
student can pause, scrub and drag the camera around the apparatus.

## What is where

| What | Where |
|---|---|
| Script — chapter times and the Kazakh caption of each | `src/data/lessonVideos.ts` (`LESSON_SCRIPTS`) |
| Scene — 3D world, graphs/readouts drawn on top, camera path | `src/components/lesson3d/scenes/` |
| Objects — the apparatus, cars, bridges, … | `src/components/lesson3d/objects/` (sources: `docs/3d-references.md`) |
| Studio — stage, clock, overlay widgets, live player | `src/components/studio/`, `src/lib/studio/` |
| Render tool | `tools/videos/` |

A scene is a pure function of time `t`: seeking to second 37.2 draws exactly
the same frame whether it is reached by playing or by jumping. That is what
makes the render reproducible and independent of machine speed.

## Rendering

Needs Node, `ffmpeg` (or `FFMPEG=/path/to/ffmpeg`) and a Chromium
(`CHROMIUM_PATH`, or `npx playwright install chromium`).

```bash
npm run videos:render -- --lesson 2         # build + render (arguments after -- go to render.mjs)

node tools/videos/build.mjs                 # bundle the studio page into tools/videos/dist
node tools/videos/render.mjs --lesson 2     # one lesson
node tools/videos/render.mjs --lesson 1,3,4 # several
node tools/videos/render.mjs --lesson all   # all ten
```

Useful options:

| Option | Meaning |
|---|---|
| `--dpr 1` | Render at 1280×720 directly. The default, 1.5, draws at 1920×1080 and scales down for crisper edges, and is much slower |
| `--workers 4` | Parallel browser processes (default 4; one per CPU core is right) |
| `--times 3,12,40 --preview-dir DIR` | Photograph only these seconds — a quick look while editing a scene |
| `--frames 0-47 --no-encode` | Render a few frames and stop |
| `--encode-only` | Skip the frame pass and encode the frames already in `tools/videos/.frames` (after an interrupted encode) |
| `--dist DIR` | Use another bundle, so a render can keep going while you rebuild `dist` |
| `--fps`, `--width`, `--crf` | Output frame rate, width (height follows 16:9) and quality |

Without a GPU, Chromium draws with software WebGL and a lesson takes roughly
15–30 minutes. Output sizes are 5–15 MB per film.

After changing a script or a scene, re-run the render for that lesson; commit
the new files in `public/videos/`. If you change a lesson's length, the
duration shown on lesson cards follows automatically (`lessonVideoSeconds`).

## Adding a voice-over

The captions are written to be read aloud, one caption per chapter. To voice a
lesson:

1. Make one audio clip per caption (the text is in `public/videos/lesson-NN.vtt`)
   and save it as `tools/videos/narration/lesson-NN/cue-KK.mp3`, where `KK` is
   the caption's number from 01. A text-to-speech service with a cloned or
   library voice works; ElevenLabs `eleven_v3` speaks Kazakh.
2. Run `npm run videos:narrate -- --lesson 4` (or `--lesson all`; add `--dry`
   to only print the schedule).

`narrate.mjs` puts each clip where its caption appears, speeds a long clip up
by at most 1.25×, makes the next clip wait if one still overruns, levels the
loudness, and adds the track to the existing MP4 **without touching the video
stream** — it takes seconds and can be repeated with a different voice.

Alternatively, drop a whole-lesson recording at
`tools/videos/narration/lesson-NN.mp3` (or `.m4a`, `.wav`) and re-render: the
render tool muxes it in.

## Replacing a film with your own

A teacher can point a lesson at any MP4/WebM in **Оқытушы → Сабақтар → Бейне
сілтемесі** (a site-relative path or an `https://` URL). The poster and caption
files exist only for the bundled `/videos/lesson-NN.mp4`.

## Troubleshooting

- *Text shows as boxes* — Chromium needs a font with Kazakh letters (Ә Ғ Қ Ң Ө Ұ Ү Һ І). `fonts-dejavu` is enough.
- *"Target page … has been closed"* — the browser was killed (usually out of memory, or a stray `pkill`); lower `--workers` and run the lesson again.
- Do not rebuild `tools/videos/dist` while a render that uses it is running; build to another folder and pass `--dist`.
