// JSX typings for the A-Frame custom elements used by the VR/AR laboratory.
//
// A-Frame is a set of custom elements, so React renders it by passing every
// prop through as a DOM attribute — which is exactly what A-Frame's own
// attribute parser expects. TypeScript, however, refuses unknown intrinsic
// elements, so the tags this project uses are declared here.
//
// Every A-Frame component is configured through a single string attribute
// ("geometry", "position", "lab-rig", …), so the props are typed loosely: a
// string for anything, plus the handful of React attributes we actually set.

import type { DetailedHTMLProps, HTMLAttributes } from "react";

type AFrameAttributes = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  [attribute: string]: unknown;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "a-scene": AFrameAttributes;
      "a-entity": AFrameAttributes;
      "a-assets": AFrameAttributes;
      "a-camera": AFrameAttributes;
      "a-sky": AFrameAttributes;
      "a-light": AFrameAttributes;
      "a-plane": AFrameAttributes;
      "a-box": AFrameAttributes;
      "a-sphere": AFrameAttributes;
      "a-cylinder": AFrameAttributes;
      "a-ring": AFrameAttributes;
    }
  }

  interface Window {
    /** Set by A-Frame once its bundle has run. */
    AFRAME?: {
      THREE: typeof import("three");
      registerComponent: (name: string, definition: Record<string, unknown>) => void;
      components: Record<string, unknown>;
      utils: Record<string, unknown>;
    };
  }
}

export {};
