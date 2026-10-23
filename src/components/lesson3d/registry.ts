import type { LessonScene } from "@/components/studio/types";
import { lesson01 } from "./scenes/Lesson01";
import { lesson02 } from "./scenes/Lesson02";
import { lesson03 } from "./scenes/Lesson03";
import { lesson04 } from "./scenes/Lesson04";
import { lesson05 } from "./scenes/Lesson05";
import { lesson06 } from "./scenes/Lesson06";
import { lesson07 } from "./scenes/Lesson07";
import { lesson08 } from "./scenes/Lesson08";
import { lesson09 } from "./scenes/Lesson09";
import { lesson10 } from "./scenes/Lesson10";

/** Every lesson film, keyed by lesson number. */
export const SCENES: Record<number, LessonScene> = {
  1: lesson01,
  2: lesson02,
  3: lesson03,
  4: lesson04,
  5: lesson05,
  6: lesson06,
  7: lesson07,
  8: lesson08,
  9: lesson09,
  10: lesson10,
};
