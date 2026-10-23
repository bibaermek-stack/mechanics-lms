-- =============================================================================
-- Дәріс бейнесі: YouTube → өз бейнефайлымыз
-- =============================================================================
-- Run after 0009. Dashboard → SQL Editor → paste → Run.
--
-- The ten lessons now play a film rendered from their own 3D scene (see
-- tools/videos/README.md) instead of embedding a YouTube video. A lesson
-- override therefore carries `videoSrc` (a path or https URL to an MP4/WebM)
-- and `videoDurationSeconds`, in place of `youtubeId` and
-- `videoDurationMinutes`.
--
-- Order matters. The trigger is replaced first so the new keys are accepted,
-- then the retired keys are stripped from stored overrides — a YouTube id is
-- not something the new player can play, so the lesson falls back to its
-- bundled film rather than showing a broken one.
-- =============================================================================

create or replace function public.validate_lesson_override()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bad text;
begin
  if public.role_of(new.teacher_id) is distinct from 'teacher' then
    raise exception 'only a teacher may own a lesson override';
  end if;

  select k into bad
  from jsonb_object_keys(new.patch) k
  where k not in (
    'title', 'shortDescription', 'videoSrc', 'videoDurationSeconds',
    'objectives', 'lectureSummary', 'keyConcepts',
    'glossary', 'quiz', 'gamePairs'
  )
  limit 1;

  if bad is not null then
    raise exception 'unknown lesson field: %', bad;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- Rows saved before this migration may still hold the old keys; the update
-- below passes the new validation because it removes exactly those keys.
update public.lesson_overrides
set patch = patch - 'youtubeId' - 'videoDurationMinutes'
where patch ? 'youtubeId' or patch ? 'videoDurationMinutes';
