import * as THREE from "three";

export const ASYQ_MODEL_URL = "/models/asyk.glb";

/** A private copy of the scanned bone: geometry and texture shared, material its own, tinted if asked. */
export function cloneBone(template: THREE.Object3D, tint: string | null): THREE.Object3D {
  const copy = template.clone(true);
  copy.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
    mat.metalness = 0;
    mat.roughness = Math.max(mat.roughness, 0.55);
    if (tint) mat.color.set(tint);
    mesh.material = mat;
  });
  return copy;
}

export function disposeBone(bone: THREE.Object3D): void {
  bone.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) (mesh.material as THREE.Material).dispose();
  });
}
