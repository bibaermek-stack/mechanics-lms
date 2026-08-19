// A-Frame ships no type declarations, and it is only ever imported for its side
// effect — loading the bundle registers the custom elements on `window` and
// exposes `window.AFRAME`. An opaque module declaration is therefore enough.
//
// This lives in its own file because an ambient module declaration is only
// valid in a script, and `aframe.d.ts` is a module (it imports React's types).

declare module "aframe";
