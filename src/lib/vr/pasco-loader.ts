// Loads the scanned PASCO devices into the VR/AR laboratory.
//
// The desktop simulations load the same GLB files through drei's <useGLTF/>;
// inside A-Frame there is no React reconciler to hang a suspense boundary on,
// so the scans are loaded imperatively here and dropped into the scene when
// they arrive. The calibration (rotate → measure → centre → scale to real size)
// is the same one `PascoModel` applies, so a cart is 21 cm long in the headset
// exactly as it is on the desktop stage.
//
// A-Frame's gltf-model component cannot read these files: they are meshopt
// compressed and A-Frame only wires up a Meshopt decoder if you point it at an
// externally hosted script. The decoder is therefore imported from the three.js
// package and handed to the loader directly, which keeps the whole path offline.

import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type * as THREE_NS from "three";
import { PASCO, type PascoKey, type PascoSpec } from "@/components/simulation/core/pascoCatalog";
import type { ThreeNS } from "./three-models";

export { PASCO };
export type { PascoKey, PascoSpec };

/** One in-flight (or finished) load per file, shared by every rig on the page. */
const cache = new Map<string, Promise<THREE_NS.Object3D>>();

function loadScene(THREE: ThreeNS, url: string): Promise<THREE_NS.Object3D> {
  const hit = cache.get(url);
  if (hit) return hit;

  // GLTFLoader is attached to A-Frame's bundled THREE namespace rather than
  // exported from it, so it is read off the namespace we were handed.
  const Loader = (THREE as unknown as { GLTFLoader: new () => any }).GLTFLoader;
  const promise = new Promise<THREE_NS.Object3D>((resolve, reject) => {
    if (!Loader) {
      reject(new Error("GLTFLoader is missing from this three.js build"));
      return;
    }
    const loader = new Loader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      url,
      (gltf: { scene: THREE_NS.Object3D }) => resolve(gltf.scene),
      undefined,
      (err: unknown) => reject(err)
    );
  });
  cache.set(url, promise);
  return promise;
}

/** Rotate → measure → centre → scale, exactly as the desktop scenes do. */
function normalise(THREE: ThreeNS, scene: THREE_NS.Object3D, spec: PascoSpec) {
  const inner = scene.clone(true);
  inner.traverse((o) => {
    const m = o as THREE_NS.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const mat = m.material as THREE_NS.MeshStandardMaterial;
    if (mat) {
      // The scans come back fully metallic, which reads as near-black under a
      // room light. Cap it so aluminium looks like aluminium.
      mat.metalness = Math.min(mat.metalness ?? 1, 0.35);
      mat.roughness = Math.max(mat.roughness ?? 1, 0.45);
    }
  });

  const aligned = new THREE.Group();
  aligned.add(inner);
  aligned.rotation.set(...spec.rotation);
  aligned.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(aligned);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const factor = spec.realSize / Math.max(size.x, size.y, size.z);

  aligned.position.copy(centre).multiplyScalar(-1);

  const outer = new THREE.Group();
  outer.add(aligned);
  outer.scale.setScalar(factor);

  return { outer, size: size.multiplyScalar(factor) };
}

export interface PascoPlaceholder {
  /** Add this to the scene immediately; the scan is dropped in when it loads. */
  object: THREE_NS.Group;
  /** Resolves with the device's real size (m) once the scan is in place. */
  ready: Promise<THREE_NS.Vector3>;
}

/**
 * Returns an empty group straight away and fills it with the scan as soon as
 * the file has been decoded, so a rig can be laid out without awaiting I/O.
 *
 * `groundAlign` sits the device on y = 0 of the returned group instead of
 * centring it on the origin — which is what you want for anything standing on
 * a bench.
 */
export function loadPascoDevice(
  THREE: ThreeNS,
  key: PascoKey,
  { groundAlign = true }: { groundAlign?: boolean } = {}
): PascoPlaceholder {
  const spec = PASCO[key];
  const object = new THREE.Group();
  object.name = `pasco-${key}`;

  const ready = loadScene(THREE, spec.url)
    .then((scene) => {
      const { outer, size } = normalise(THREE, scene, spec);
      const holder = new THREE.Group();
      holder.position.y = groundAlign ? size.y / 2 : 0;
      holder.add(outer);
      object.add(holder);
      return size;
    })
    .catch((err) => {
      // A missing scan must not take the whole laboratory down: the rig keeps
      // working, the student just sees a labelled stand-in box instead.
      console.warn(`[vr-lab] ${spec.label} моделі жүктелмеді`, err);
      const fallback = new THREE.Mesh(
        new THREE.BoxGeometry(spec.realSize, spec.realSize * 0.5, spec.realSize * 0.6),
        new THREE.MeshStandardMaterial({ color: "#1e5aa8", roughness: 0.5, metalness: 0.2 })
      );
      fallback.castShadow = true;
      fallback.position.y = groundAlign ? spec.realSize * 0.25 : 0;
      object.add(fallback);
      return new THREE.Vector3(spec.realSize, spec.realSize * 0.5, spec.realSize * 0.6);
    });

  return { object, ready };
}

/** Warms the cache so the first frame in the headset is not a loading frame. */
export function preloadPascoDevices(THREE: ThreeNS, keys: PascoKey[]) {
  for (const key of keys) void loadScene(THREE, PASCO[key].url).catch(() => undefined);
}
