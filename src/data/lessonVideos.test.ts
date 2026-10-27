import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The base URL is read from the environment, so each case loads a fresh copy of
// the module with the variable set the way a deployment would set it.
async function withBase(base: string | undefined) {
  vi.resetModules();
  if (base === undefined) vi.unstubAllEnvs();
  else vi.stubEnv("NEXT_PUBLIC_VIDEO_BASE_URL", base);
  return import("./lessonVideos");
}

const BUCKET = "https://abc.supabase.co/storage/v1/object/public/lesson-videos";

beforeEach(() => vi.unstubAllEnvs());
afterEach(() => vi.unstubAllEnvs());

describe("with nothing configured (a plain clone)", () => {
  it("serves the films from this site's own /videos", async () => {
    const v = await withBase(undefined);
    expect(v.videoBaseUrl()).toBe("/videos");
    expect(v.lessonVideoSrc(1)).toBe("/videos/lesson-01.mp4");
    expect(v.lessonVideoSrc(10)).toBe("/videos/lesson-10.mp4");
  });

  it("derives the poster and captions beside the film", async () => {
    const v = await withBase(undefined);
    expect(v.videoSidecars("/videos/lesson-03.mp4")).toEqual({
      poster: "/videos/lesson-03.jpg",
      captions: "/videos/lesson-03.vtt",
    });
  });

  it("gives a teacher's own link a plain player, with no poster, captions or CORS", async () => {
    const v = await withBase(undefined);
    for (const src of ["https://example.com/clip.mp4", "/media/other.mp4", "https://example.com/videos/lesson-01.mp4"]) {
      expect(v.videoSidecars(src)).toEqual({});
      expect(v.videoNeedsCors(src)).toBe(false);
    }
  });

  it("an empty variable is the same as none", async () => {
    expect((await withBase("")).videoBaseUrl()).toBe("/videos");
    expect((await withBase("   ")).videoBaseUrl()).toBe("/videos");
  });
});

describe("with NEXT_PUBLIC_VIDEO_BASE_URL set to a storage bucket", () => {
  it("builds every URL from the bucket and ignores a trailing slash", async () => {
    for (const base of [BUCKET, `${BUCKET}/`, `${BUCKET}///`]) {
      const v = await withBase(base);
      expect(v.videoBaseUrl()).toBe(BUCKET);
      expect(v.lessonVideoSrc(2)).toBe(`${BUCKET}/lesson-02.mp4`);
    }
  });

  it("finds the poster and captions in the bucket too", async () => {
    const v = await withBase(BUCKET);
    expect(v.videoSidecars(`${BUCKET}/lesson-07.mp4`)).toEqual({
      poster: `${BUCKET}/lesson-07.jpg`,
      captions: `${BUCKET}/lesson-07.vtt`,
    });
  });

  it("asks for CORS only for films in our own bucket, never for someone else's link", async () => {
    const v = await withBase(BUCKET);
    expect(v.videoNeedsCors(`${BUCKET}/lesson-07.mp4`)).toBe(true);
    expect(v.videoNeedsCors("https://example.com/clip.mp4")).toBe(false);
    expect(v.videoNeedsCors("/videos/lesson-07.mp4")).toBe(false);
  });

  it("does not mistake a sibling host that merely starts with the same text for the bucket", async () => {
    const v = await withBase("https://abc.supabase.co/storage/v1/object/public/lesson-videos");
    expect(v.videoNeedsCors("https://abc.supabase.co/storage/v1/object/public/lesson-videos-evil/lesson-01.mp4")).toBe(false);
    expect(v.videoSidecars("https://abc.supabase.co/storage/v1/object/public/lesson-videos-evil/lesson-01.mp4")).toEqual({});
  });

  it("the ten lessons all read from it", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_VIDEO_BASE_URL", BUCKET);
    const { ALL_MODULES } = await import("./modules");
    expect(ALL_MODULES).toHaveLength(10);
    for (const m of ALL_MODULES) expect(m.videoSrc).toBe(`${BUCKET}/lesson-${String(m.id).padStart(2, "0")}.mp4`);
  });

  it("accepts a root-relative path, which a reverse proxy might serve", async () => {
    const v = await withBase("/media/films/");
    expect(v.lessonVideoSrc(4)).toBe("/media/films/lesson-04.mp4");
    expect(v.videoSidecars("/media/films/lesson-04.mp4").poster).toBe("/media/films/lesson-04.jpg");
    expect(v.videoNeedsCors("/media/films/lesson-04.mp4")).toBe(false); // same origin
  });
});

describe("a malformed value never produces a broken link", () => {
  it.each(["javascript:alert(1)", "http://insecure.example.com/v", "//evil.example.com/v", "videos", "ftp://x/y", "https://has space.example.com"])(
    "%s falls back to /videos",
    async (bad) => {
      const v = await withBase(bad);
      expect(v.videoBaseUrl()).toBe("/videos");
      expect(v.lessonVideoSrc(1)).toBe("/videos/lesson-01.mp4");
    }
  );
});
