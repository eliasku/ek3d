import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { DecalGeometry, DecalVertex } from "../src/addons/geometries/DecalGeometry";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Euler } from "../src/math/Euler";
import { Vector3 } from "../src/math/Vector3";
import { Mesh } from "../src/objects/Mesh";

function triangle(points: number[], indexed = false, normals = true): Mesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
  if (normals) geometry.setAttribute("normal", new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  if (indexed) geometry.setIndex([0, 1, 2]);
  return new Mesh(geometry, new MeshBasicMaterial());
}

test("clips triangles against the projector and interpolates UVs and normals", () => {
  for (const points of [
    [-2, 0, 0, 0, -0.25, 0, 0, 0.25, 0],
    [0, -0.25, 0, 2, 0, 0, 0, 0.25, 0],
    [0, -0.25, 0, 0, 0.25, 0, 2, 0, 0],
    [0, 0, 0, 2, -0.25, 0, 2, 0.25, 0],
  ]) {
    const decal = new DecalGeometry(triangle(points), new Vector3(), new Euler(), new Vector3(2, 2, 2));
    const p = decal.getAttribute("position");
    const uv = decal.getAttribute("uv");
    const n = decal.getAttribute("normal");
    assert.ok(p instanceof Float32BufferAttribute);
    assert.ok(uv instanceof Float32BufferAttribute);
    assert.ok(n instanceof Float32BufferAttribute);
    assert.ok(p.count >= 3);
    assert.equal(p.count % 3, 0);
    assert.equal(uv.count, p.count);
    assert.equal(n.count, p.count);
    for (let i = 0; i < p.count; i++) {
      assert.ok(Math.abs(p.getX(i)) <= 1 && Math.abs(p.getY(i)) <= 1 && Math.abs(p.getZ(i)) <= 1);
      assert.equal(uv.getX(i), 0.5 + p.getX(i) / 2);
      assert.equal(uv.getY(i), 0.5 + p.getY(i) / 2);
      assert.equal(n.getZ(i), 1);
    }
  }
});

test("handles indexed world transforms, missing normals and empty projections", () => {
  const mesh = triangle([-1, -1, 0, 1, -1, 0, 0, 1, 0], true, false);
  mesh.position.set(3, 4, 5);
  mesh.updateMatrixWorld(true);
  const decal = new DecalGeometry(mesh, new Vector3(3, 4, 5), new Euler(), new Vector3(4, 4, 2));
  const p = decal.getAttribute("position");
  assert.ok(p instanceof Float32BufferAttribute);
  assert.equal(p.count, 3);
  assert.deepEqual([p.getX(0), p.getY(0), p.getZ(0)], [2, 3, 5]);
  assert.equal(decal.getAttribute("normal"), undefined);
  const outside = new DecalGeometry(mesh, new Vector3(), new Euler(), new Vector3(1, 1, 1));
  assert.equal(outside.getAttribute("position")?.count, 0);
  assert.equal(new DecalGeometry().getAttribute("position")?.count, 0);
});

test("decal vertex clones are independent", () => {
  const original = new DecalVertex(new Vector3(1, 2, 3), new Vector3(0, 0, 1));
  const copy = original.clone();
  copy.position.x = 9;
  copy.normal!.z = 0;
  assert.equal(original.position.x, 1);
  assert.equal(original.normal!.z, 1);
  assert.equal(new DecalVertex(new Vector3()).clone().normal, null);
});
