// Reads the vertex positions of public/models/asyk.glb in the orientation the game shows them
// (node rotation applied), in the model's own units. Pure Node, no dependencies.
import { readFileSync } from "node:fs";

export function readAsyqVertices(path = "public/models/asyk.glb") {
  const buf = readFileSync(path);
  if (buf.toString("ascii", 0, 4) !== "glTF") throw new Error("not a GLB");
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + jsonLen));
  const binOffset = 20 + jsonLen + 8;
  const prim = json.meshes[0].primitives[0];
  const acc = json.accessors[prim.attributes.POSITION];
  const view = json.bufferViews[acc.bufferView];
  const start = binOffset + (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const pts = [];
  for (let i = 0; i < acc.count; i++) {
    const o = start + i * 12;
    pts.push([buf.readFloatLE(o), buf.readFloatLE(o + 4), buf.readFloatLE(o + 8)]);
  }
  // node rotation (quaternion x,y,z,w) — a half turn about x in this file
  const [qx, qy, qz, qw] = json.nodes[0].rotation ?? [0, 0, 0, 1];
  const rot = (p) => {
    const [x, y, z] = p;
    // v' = v + 2w(q×v) + 2 q×(q×v)
    const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
    return [x + qw * tx + (qy * tz - qz * ty), y + qw * ty + (qz * tx - qx * tz), z + qw * tz + (qx * ty - qy * tx)];
  };
  const index = json.accessors[prim.indices];
  const iview = json.bufferViews[index.bufferView];
  const istart = binOffset + (iview.byteOffset ?? 0) + (index.byteOffset ?? 0);
  const tris = [];
  for (let i = 0; i < index.count; i++) tris.push(buf.readUInt16LE(istart + i * 2));
  return { vertices: pts.map(rot), indices: tris };
}
