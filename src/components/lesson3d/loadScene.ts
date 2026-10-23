import type { LessonScene } from "@/components/studio/types";

/**
 * One lesson film, fetched on demand. The registry next to this file imports
 * all ten at once, which the render tool wants; the lesson page wants only the
 * one a student opened, so each scene becomes its own chunk here.
 */
export async function loadScene(moduleId: number): Promise<LessonScene | null> {
  switch (moduleId) {
    case 1: return (await import("./scenes/Lesson01")).lesson01;
    case 2: return (await import("./scenes/Lesson02")).lesson02;
    case 3: return (await import("./scenes/Lesson03")).lesson03;
    case 4: return (await import("./scenes/Lesson04")).lesson04;
    case 5: return (await import("./scenes/Lesson05")).lesson05;
    case 6: return (await import("./scenes/Lesson06")).lesson06;
    case 7: return (await import("./scenes/Lesson07")).lesson07;
    case 8: return (await import("./scenes/Lesson08")).lesson08;
    case 9: return (await import("./scenes/Lesson09")).lesson09;
    case 10: return (await import("./scenes/Lesson10")).lesson10;
    default: return null;
  }
}
