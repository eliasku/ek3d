import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { Sculptor } from "../src/addons/misc/Sculptor";
import { GLTFExporter } from "../src/addons/exporters/GLTFExporter";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { IcosahedronGeometry } from "../src/geometries/IcosahedronGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Ray } from "../src/math/Ray";
import { Vector3 } from "../src/math/Vector3";
import { Mesh } from "../src/objects/Mesh";

function fixture() {
  const geometry = new IcosahedronGeometry(1, 4);
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  const sculptor = new Sculptor(mesh, new PerspectiveCamera());
  return { geometry, mesh, sculptor };
}

test("ray strokes deform a replacement mesh and complete their event lifecycle", () => {
  const { geometry, mesh, sculptor } = fixture();
  assert.notEqual(mesh.geometry, geometry);
  const positions = sculptor.getGeometry().getAttribute("position");
  assert.ok(positions instanceof BufferAttribute);
  const before = Array.from(positions.array);
  const events: string[] = [];
  sculptor.addEventListener("start", () => events.push("start"));
  sculptor.addEventListener("change", () => events.push("change"));
  sculptor.addEventListener("end", () => events.push("end"));
  sculptor.setTool("inflate").setDetail(0).setStrength(0.5);
  const ray = new Ray(new Vector3(0, 0, 3), new Vector3(0, 0, -1));
  assert.equal(sculptor.strokeFromRay(ray, 0.7), true);
  assert.equal(sculptor.isSculpting(), true);
  sculptor.endStroke();
  assert.equal(sculptor.isSculpting(), false);
  assert.deepEqual(events, ["start", "change", "end"]);
  const updated = sculptor.getGeometry().getAttribute("position");
  assert.ok(updated instanceof BufferAttribute);
  assert.notDeepEqual(Array.from(updated.array), before);
  assert.ok(mesh.geometry.boundingSphere);
  sculptor.dispose();
});

test("tool settings persist per tool and ray picking rejects unsupported inputs", () => {
  const { sculptor } = fixture();
  sculptor.setTool("brush").setSize(80).setStrength(0.4).setNegative(true);
  sculptor.setTool("inflate").setSize(30);
  sculptor.setTool("brush");
  assert.equal(sculptor.getSize(), 80);
  assert.equal(sculptor.getStrength(), 0.4);
  assert.equal(sculptor.getNegative(), true);
  assert.throws(() => sculptor.setSize(0), RangeError);
  assert.throws(() => sculptor.setDetail(2), RangeError);
  const ray = new Ray(new Vector3(0, 0, 3), new Vector3(0, 0, -1));
  assert.equal(sculptor.pickFromRay(ray, 0.5), true);
  assert.equal(sculptor.hasHit(), true);
  assert.equal(sculptor.pickFromRay(new Ray(new Vector3(0, 0, 3), new Vector3(0, 1, 0)), 0.5), false);
  assert.equal(sculptor.hasHit(), false);
  sculptor.setTool("drag");
  assert.throws(() => sculptor.strokeFromRay(ray, 0.5));
  sculptor.dispose();
});

test("sculpt snapshots export their compact deformed geometry as GLB", async () => {
  const { mesh, sculptor } = fixture();
  sculptor.setTool("inflate").setDetail(0).setStrength(0.5);
  assert.equal(sculptor.strokeFromRay(new Ray(new Vector3(0, 0, 3), new Vector3(0, 0, -1)), 0.7), true);
  sculptor.endStroke();
  const snapshot = mesh.clone();
  snapshot.geometry = sculptor.getGeometry();
  const result = await new GLTFExporter().parseAsync(snapshot, { binary: true });
  assert.ok(result instanceof ArrayBuffer);
  const view = new DataView(result);
  assert.equal(view.getUint32(0, true), 0x46546c67);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(result, 20, jsonLength))) as {
    meshes: { primitives: { attributes: { POSITION: number } }[] }[];
    accessors: { count: number }[];
  };
  const position = json.meshes[0].primitives[0].attributes.POSITION;
  const positions = snapshot.geometry.getAttribute("position");
  assert.ok(positions);
  assert.equal(json.accessors[position].count, positions.count);
  assert.notEqual(snapshot.geometry, mesh.geometry);
  snapshot.geometry.dispose();
  sculptor.dispose();
});
