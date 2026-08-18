"use client";

// The A-Frame layer: loads the library once and registers the components that
// bridge it to the three.js laboratory rigs.
//
// The split is deliberate. A-Frame owns everything that is about *being* in the
// room — the XR session, the camera rig, the controllers, the AR hit-test — and
// nothing about the physics or the apparatus, which stays in `src/lib/vr`. That
// keeps the rigs testable and lets the same models be mounted anywhere.
//
// A-Frame must never be imported at module scope: it touches `window` and
// `document` as it loads, which would break the server render. Every entry
// point here is async and client-only.

import {
  createPanel,
  drawCaption,
  drawChart,
  drawReadout,
  drawText,
  type CanvasPanel,
  type ChartSample,
} from "@/lib/vr/canvas-panel";
import { getVrExperiment } from "@/lib/vr/experiments";
import { buildRoom } from "@/lib/vr/three-models";
import { preloadPascoDevices } from "@/lib/vr/pasco-loader";
import { RIGS } from "@/lib/vr/rigs";
import type { LabRig, RigParams, VrExperiment } from "@/lib/vr/types";
import type { ThreeNS } from "@/lib/vr/three-models";
import type * as THREE_NS from "three";

/** Physics step. Matches the desktop engine so both give the same numbers. */
const FIXED_H = 1 / 500;
/** Readings / chart sampling rate. */
const SAMPLE_HZ = 20;
const MAX_SAMPLES = 600;

export interface AframeGlobal {
  THREE: ThreeNS;
  registerComponent: (name: string, definition: Record<string, unknown>) => void;
  components: Record<string, unknown>;
}

let loading: Promise<AframeGlobal> | null = null;

/** Loads A-Frame (once) and registers this project's components (once). */
export function ensureAframe(): Promise<AframeGlobal> {
  if (loading) return loading;
  loading = (async () => {
    await import("aframe");
    const AFRAME = window.AFRAME as unknown as AframeGlobal;
    if (!AFRAME) throw new Error("A-Frame жүктелмеді");
    registerComponents(AFRAME);
    return AFRAME;
  })();
  return loading;
}

let registered = false;

function registerComponents(AFRAME: AframeGlobal) {
  if (registered) return;
  registered = true;
  const THREE = AFRAME.THREE;

  // -------------------------------------------------------------------------
  // lab-rig — the apparatus, the physics clock and the instrument panels
  // -------------------------------------------------------------------------
  AFRAME.registerComponent("lab-rig", {
    schema: {
      experiment: { type: "string" },
      playing: { type: "boolean", default: false },
      speed: { type: "number", default: 1 },
      /** Slider values as JSON — A-Frame has no object property type. */
      params: { type: "string", default: "{}" },
      /** Bumped by the page to force a reset. */
      epoch: { type: "number", default: 0 },
    },

    init(this: LabRigComponent) {
      const meta = getVrExperiment(this.data.experiment);
      const factory = meta ? RIGS[meta.id] : undefined;
      if (!meta || !factory) {
        console.warn(`[vr-lab] «${this.data.experiment}» тәжірибесі табылмады`);
        return;
      }
      this.meta = meta;
      this.params = safeParse(this.data.params);
      preloadPascoDevices(THREE, meta.devices);

      const root = new THREE.Group();
      this.rig = factory({ THREE, params: this.params });
      root.add(this.rig.object);

      // Instrument panels. They belong to the rig rather than to the room, so
      // that in AR they shrink and travel with the apparatus onto the table.
      this.readoutPanel = createPanel(THREE, { width: 0.5, height: 0.62 });
      this.readoutPanel.object.position.set(0.93, 1.28, -0.1);
      this.readoutPanel.object.rotation.y = -0.72;
      root.add(this.readoutPanel.object);

      this.paramPanel = createPanel(THREE, { width: 0.5, height: 0.62 });
      this.paramPanel.object.position.set(-0.93, 1.28, -0.1);
      this.paramPanel.object.rotation.y = 0.72;
      root.add(this.paramPanel.object);

      this.chartPanel = createPanel(THREE, { width: 1.0, height: 0.56 });
      this.chartPanel.object.position.set(0, 1.46, -0.72);
      root.add(this.chartPanel.object);

      this.el.setObject3D("lab-rig", root);

      // Our meshes set castShadow themselves, so the renderer has to be told to
      // draw shadow maps even though no A-Frame entity asked for them.
      const renderer = this.el.sceneEl?.renderer;
      if (renderer) renderer.shadowMap.enabled = true;

      this.acc = 0;
      this.time = 0;
      this.lastSample = -1;
      this.samples = [];
      this.autoStopped = false;
      this.draw();
    },

    update(this: LabRigComponent, oldData: Record<string, unknown>) {
      if (!this.rig || !this.meta) return;
      this.params = safeParse(this.data.params);
      if (oldData && oldData.epoch !== undefined && oldData.epoch !== this.data.epoch) {
        this.resetRun();
      }
      this.draw();
    },

    resetRun(this: LabRigComponent) {
      if (!this.rig) return;
      this.rig.reset(this.params);
      this.time = 0;
      this.acc = 0;
      this.lastSample = -1;
      this.samples = [];
      this.autoStopped = false;
    },

    tick(this: LabRigComponent, _time: number, deltaMs: number) {
      if (!this.rig || !this.meta) return;
      if (!this.data.playing) return;

      // Clamp the frame so a tab that was in the background does not integrate
      // a minute of physics in one go.
      this.acc += Math.min(deltaMs / 1000, 0.1) * this.data.speed;
      let guard = 0;
      while (this.acc >= FIXED_H && guard < 4000) {
        this.rig.step(FIXED_H, this.params);
        this.time += FIXED_H;
        this.acc -= FIXED_H;
        guard += 1;
      }

      if (this.time - this.lastSample >= 1 / SAMPLE_HZ) {
        this.lastSample = this.time;
        const readings = this.rig.read(this.time);
        this.samples.push({ t: this.time, ...readings });
        if (this.samples.length > MAX_SAMPLES) this.samples.shift();
        this.draw();
        this.el.emit("lab-readings", { readings, t: this.time }, true);
      }

      const done =
        (this.meta.duration > 0 && this.time >= this.meta.duration) || this.rig.finished();
      if (done && !this.autoStopped) {
        this.autoStopped = true;
        this.el.emit("lab-finished", { t: this.time }, true);
      }
    },

    /** Repaints the three canvas panels. */
    draw(this: LabRigComponent) {
      if (!this.rig || !this.meta) return;
      const readings = this.rig.read(this.time);

      drawReadout(
        this.readoutPanel!,
        "Өлшеу нәтижелері",
        this.meta.readouts.map((r) => ({
          label: r.label,
          value: `${fmt(readings[r.key] ?? 0, r.decimals)}${r.unit ? ` ${r.unit}` : ""}`,
          color: r.color,
        }))
      );

      drawReadout(
        this.paramPanel!,
        "Параметрлер",
        [
          ...this.meta.params.map((p) => ({
            label: p.label,
            value: `${fmt(this.params[p.key] ?? p.value, p.decimals)}${p.unit ? ` ${p.unit}` : ""}`,
          })),
          {
            label: "Уақыт t",
            value: `${fmt(this.time, 2)} с`,
            color: "#93c5fd",
          },
        ]
      );

      drawChart(this.chartPanel!, this.samples, this.meta.chart, {
        title: this.meta.chart.map((c) => c.label).join(" · "),
      });
    },

    remove(this: LabRigComponent) {
      this.el.removeObject3D("lab-rig");
      this.rig?.dispose();
      this.readoutPanel?.dispose();
      this.paramPanel?.dispose();
      this.chartPanel?.dispose();
    },
  });

  // -------------------------------------------------------------------------
  // lab-room — the walls the student stands between in VR
  // -------------------------------------------------------------------------
  AFRAME.registerComponent("lab-room", {
    schema: {
      width: { type: "number", default: 7 },
      depth: { type: "number", default: 6 },
      height: { type: "number", default: 3 },
    },

    init(this: LabRoomComponent) {
      // The room is centred a little behind the bench so the student has floor
      // to step back onto rather than a wall at their heels.
      const room = buildRoom(THREE, {
        width: this.data.width,
        depth: this.data.depth,
        height: this.data.height,
      });
      room.position.z = 0.9;
      this.el.setObject3D("room", room);
    },

    remove(this: LabRoomComponent) {
      this.el.removeObject3D("room");
    },
  });

  // -------------------------------------------------------------------------
  // vr-button — a 3D control the student can point at with a controller
  // -------------------------------------------------------------------------
  AFRAME.registerComponent("vr-button", {
    schema: {
      label: { type: "string", default: "" },
      action: { type: "string", default: "" },
      width: { type: "number", default: 0.17 },
      height: { type: "number", default: 0.075 },
      variant: { type: "string", default: "default" },
    },

    init(this: VrButtonComponent) {
      const group = new THREE.Group();

      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(this.data.width, this.data.height, 0.012),
        new THREE.MeshStandardMaterial({
          color: plateColor(this.data.variant, false),
          roughness: 0.45,
          metalness: 0.1,
        })
      );
      plate.castShadow = true;
      group.add(plate);
      this.plate = plate;

      this.panel = createPanel(THREE, { width: this.data.width, height: this.data.height });
      this.panel.object.position.z = 0.0065;
      group.add(this.panel.object);

      this.el.setObject3D("mesh", group);
      this.paint();

      // Hover feedback. Without it a controller ray gives no clue that the
      // button under it is live.
      this.el.addEventListener("mouseenter", () => {
        this.hovered = true;
        this.plate!.material.color.set(plateColor(this.data.variant, true));
        this.el.object3D.scale.setScalar(1.06);
      });
      this.el.addEventListener("mouseleave", () => {
        this.hovered = false;
        this.plate!.material.color.set(plateColor(this.data.variant, false));
        this.el.object3D.scale.setScalar(1);
      });
      this.el.addEventListener("click", () => {
        if (!this.data.action) return;
        this.el.emit("lab-action", { action: this.data.action }, true);
      });
    },

    update(this: VrButtonComponent) {
      if (this.panel) this.paint();
      if (this.plate) this.plate.material.color.set(plateColor(this.data.variant, this.hovered));
    },

    paint(this: VrButtonComponent) {
      drawCaption(this.panel!, this.data.label, "#ffffff");
    },

    remove(this: VrButtonComponent) {
      this.el.removeObject3D("mesh");
      this.panel?.dispose();
    },
  });

  // -------------------------------------------------------------------------
  // lab-console — the button cluster, generated from the experiment metadata
  // -------------------------------------------------------------------------
  AFRAME.registerComponent("lab-console", {
    schema: {
      experiment: { type: "string" },
      playing: { type: "boolean", default: false },
    },

    init(this: LabConsoleComponent) {
      const meta = getVrExperiment(this.data.experiment);
      if (!meta) return;
      this.meta = meta;

      // The console is laid out as a grid rather than one row per parameter:
      // a tall stack of rows runs off the bottom of a desktop viewport, and in
      // the headset it puts the last row below comfortable reach.
      const tunable = meta.params.filter((p) => p.inVr);
      const columns = Math.max(tunable.length, 1);
      const columnW = 0.26;
      const width = Math.max(0.62, columns * columnW);
      const height = 0.3;

      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, 0.014),
        new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.5, metalness: 0.15 })
      );
      plate.castShadow = true;
      plate.position.z = -0.012;
      this.el.setObject3D("plate", plate);
      this.captions = [];

      // Transport row.
      this.playButton = makeButton(this.el, {
        label: this.data.playing ? "КІДІРТУ" : "БАСТАУ",
        action: "toggle",
        variant: "primary",
        width: 0.26,
        position: `-0.15 0.095 0`,
      });
      makeButton(this.el, {
        label: "ҚАЙТА",
        action: "reset",
        variant: "default",
        width: 0.2,
        position: `0.16 0.095 0`,
      });

      // One column of ± controls per parameter worth tuning without taking the
      // headset off. The value itself is on the parameters panel, so these stay
      // stateless.
      tunable.forEach((p, i) => {
        const cx = (i - (columns - 1) / 2) * columnW;

        const caption = createPanel(THREE, { width: columnW - 0.02, height: 0.052 });
        drawCaption(caption, p.label);
        caption.object.position.set(cx, -0.005, 0.002);
        this.el.object3D.add(caption.object);
        this.captions.push(caption);

        makeButton(this.el, {
          label: "−",
          action: `param:${p.key}:-`,
          variant: "default",
          width: 0.09,
          height: 0.062,
          position: `${(cx - 0.058).toFixed(3)} -0.078 0`,
        });
        makeButton(this.el, {
          label: "+",
          action: `param:${p.key}:+`,
          variant: "default",
          width: 0.09,
          height: 0.062,
          position: `${(cx + 0.058).toFixed(3)} -0.078 0`,
        });
      });
    },

    update(this: LabConsoleComponent) {
      if (!this.playButton) return;
      this.playButton.setAttribute("vr-button", "label", this.data.playing ? "КІДІРТУ" : "БАСТАУ");
    },

    remove(this: LabConsoleComponent) {
      this.el.removeObject3D("plate");
      for (const c of this.captions ?? []) c.dispose();
    },
  });

  // -------------------------------------------------------------------------
  // info-panel — a static text card standing in the room
  // -------------------------------------------------------------------------
  AFRAME.registerComponent("info-panel", {
    schema: {
      title: { type: "string", default: "" },
      body: { type: "string", default: "[]" },
      width: { type: "number", default: 0.8 },
      height: { type: "number", default: 0.55 },
    },

    init(this: InfoPanelComponent) {
      this.panel = createPanel(THREE, { width: this.data.width, height: this.data.height });
      this.el.setObject3D("mesh", this.panel.object);
      this.paint();
    },

    update(this: InfoPanelComponent) {
      if (this.panel) this.paint();
    },

    paint(this: InfoPanelComponent) {
      let body: string[] = [];
      try {
        const parsed = JSON.parse(this.data.body);
        if (Array.isArray(parsed)) body = parsed.map(String);
      } catch {
        body = [this.data.body];
      }
      drawText(this.panel!, this.data.title, body);
    },

    remove(this: InfoPanelComponent) {
      this.el.removeObject3D("mesh");
      this.panel?.dispose();
    },
  });

  // -------------------------------------------------------------------------
  // initial-gaze — where the camera is pointing when the scene opens
  // -------------------------------------------------------------------------
  AFRAME.registerComponent("initial-gaze", {
    schema: {
      pitch: { type: "number", default: 0 },
      yaw: { type: "number", default: 0 },
    },

    init(this: InitialGazeComponent) {
      // `rotation` on the camera entity does not survive look-controls: it
      // rewrites the entity's rotation every frame from its own pitch/yaw
      // objects, which start at zero. Seeding those is the supported way to
      // open a scene looking at something other than the horizon. Inside XR
      // look-controls defers to the headset pose, so this only affects the
      // flat-screen view — which is exactly what needs the help, since a lab
      // bench is below eye level.
      const apply = () => {
        const look = this.el.components["look-controls"] as
          | { pitchObject: THREE_NS.Object3D; yawObject: THREE_NS.Object3D }
          | undefined;
        if (!look) return;
        look.pitchObject.rotation.x = (this.data.pitch * Math.PI) / 180;
        look.yawObject.rotation.y = (this.data.yaw * Math.PI) / 180;
      };
      if ((this.el as unknown as { hasLoaded?: boolean }).hasLoaded) apply();
      else this.el.addEventListener("loaded", apply);
    },
  });

  // -------------------------------------------------------------------------
  // ar-lab — what changes when the student switches to augmented reality
  // -------------------------------------------------------------------------
  AFRAME.registerComponent("ar-lab", {
    schema: {
      room: { type: "selector" },
      lab: { type: "selector" },
      /** How much the laboratory shrinks to fit on a real table. */
      scale: { type: "number", default: 0.32 },
    },

    init(this: ArLabComponent) {
      const sceneEl = this.el;

      this.onEnter = () => {
        if (!sceneEl.is("ar-mode")) return;
        // The modelled room would sit on top of the real one, so it goes away
        // and the apparatus is shrunk to something that fits on a table.
        if (this.data.room) this.data.room.setAttribute("visible", "false");
        const lab = this.data.lab;
        if (lab) {
          const s = this.data.scale;
          lab.setAttribute("scale", `${s} ${s} ${s}`);
          lab.setAttribute("position", "0 0 -0.9");
          // Tap a real surface to put the bench on it.
          sceneEl.setAttribute("ar-hit-test", { target: lab, enabled: true });
        }
        // Let the camera feed through instead of painting the room colour.
        sceneEl.setAttribute("background", "transparent", true);
      };

      this.onExit = () => {
        sceneEl.setAttribute("background", "transparent", false);
        if (this.data.room) this.data.room.setAttribute("visible", "true");
        const lab = this.data.lab;
        if (lab) {
          lab.setAttribute("scale", "1 1 1");
          lab.setAttribute("position", "0 0 0");
          lab.setAttribute("rotation", "0 0 0");
        }
        if (sceneEl.components["ar-hit-test"]) {
          sceneEl.setAttribute("ar-hit-test", "enabled", false);
        }
      };

      sceneEl.addEventListener("enter-vr", this.onEnter);
      sceneEl.addEventListener("exit-vr", this.onExit);
    },

    remove(this: ArLabComponent) {
      this.el.removeEventListener("enter-vr", this.onEnter!);
      this.el.removeEventListener("exit-vr", this.onExit!);
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeButton(
  parent: AframeEntity,
  opts: {
    label: string;
    action: string;
    variant: string;
    width: number;
    height?: number;
    position: string;
  }
): AframeEntity {
  const el = document.createElement("a-entity") as unknown as AframeEntity;
  el.setAttribute("class", "clickable");
  el.setAttribute("position", opts.position);
  el.setAttribute(
    "vr-button",
    `label: ${opts.label}; action: ${opts.action}; variant: ${opts.variant};` +
      ` width: ${opts.width}; height: ${opts.height ?? 0.075}`
  );
  parent.appendChild(el);
  return el;
}

function plateColor(variant: string, hovered: boolean): string {
  if (variant === "primary") return hovered ? "#4f80ff" : "#3366ff";
  if (variant === "danger") return hovered ? "#f87171" : "#ef4444";
  return hovered ? "#475569" : "#334155";
}

function safeParse(json: string): RigParams {
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as RigParams) : {};
  } catch {
    return {};
  }
}

function fmt(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(decimals);
}

// ---------------------------------------------------------------------------
// Minimal typings for the A-Frame objects we touch
// ---------------------------------------------------------------------------

interface AframeEntity extends HTMLElement {
  object3D: THREE_NS.Object3D;
  sceneEl?: {
    renderer: THREE_NS.WebGLRenderer;
    is: (state: string) => boolean;
    components: Record<string, unknown>;
  };
  components: Record<string, unknown>;
  is: (state: string) => boolean;
  emit: (name: string, detail?: unknown, bubbles?: boolean) => void;
  setObject3D: (name: string, obj: THREE_NS.Object3D) => void;
  removeObject3D: (name: string) => void;
  setAttribute: (name: string, value: unknown, valueTwo?: unknown) => void;
}

interface ComponentBase {
  el: AframeEntity;
}

interface LabRigComponent extends ComponentBase {
  data: { experiment: string; playing: boolean; speed: number; params: string; epoch: number };
  meta?: VrExperiment;
  rig?: LabRig;
  params: RigParams;
  readoutPanel?: CanvasPanel;
  paramPanel?: CanvasPanel;
  chartPanel?: CanvasPanel;
  samples: ChartSample[];
  acc: number;
  time: number;
  lastSample: number;
  autoStopped: boolean;
  draw: () => void;
  resetRun: () => void;
}

interface VrButtonComponent extends ComponentBase {
  data: { label: string; action: string; width: number; height: number; variant: string };
  panel?: CanvasPanel;
  plate?: THREE_NS.Mesh<THREE_NS.BufferGeometry, THREE_NS.MeshStandardMaterial>;
  hovered: boolean;
  paint: () => void;
}

interface LabConsoleComponent extends ComponentBase {
  data: { experiment: string; playing: boolean };
  meta?: VrExperiment;
  playButton?: AframeEntity;
  captions: CanvasPanel[];
}

interface InfoPanelComponent extends ComponentBase {
  data: { title: string; body: string; width: number; height: number };
  panel?: CanvasPanel;
  paint: () => void;
}

interface InitialGazeComponent extends ComponentBase {
  data: { pitch: number; yaw: number };
}

interface LabRoomComponent extends ComponentBase {
  data: { width: number; depth: number; height: number };
}

interface ArLabComponent extends ComponentBase {
  data: { room: AframeEntity | null; lab: AframeEntity | null; scale: number };
  onEnter?: () => void;
  onExit?: () => void;
}
