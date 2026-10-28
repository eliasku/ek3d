import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { STLExporter } from "../src/addons/exporters/STLExporter";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { Object3D } from "../src/core/Object3D";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Bone } from "../src/objects/Bone";
import { Mesh } from "../src/objects/Mesh";
import { Skeleton } from "../src/objects/Skeleton";
import { SkinnedMesh } from "../src/objects/SkinnedMesh";

function triangle(indexed: boolean): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  if (indexed) geometry.setIndex([0, 1, 2]);
  return geometry;
}

test("exports indexed and non-indexed descendants in world coordinates as ASCII and binary", () => {
  const root = new Object3D();
  const material = new MeshBasicMaterial();
  const indexed = new Mesh(triangle(true), material);
  const plain = new Mesh(triangle(false), material);
  root.position.x = 2;
  plain.position.z = 3;
  root.add(indexed, plain, new Object3D());
  root.updateMatrixWorld(true);
  const exporter = new STLExporter();
  const facet = (z: number) =>
    `\tfacet normal 0 0 1\n\t\touter loop\n\t\t\tvertex 2 0 ${z}\n\t\t\tvertex 3 0 ${z}\n\t\t\tvertex 2 1 ${z}\n\t\tendloop\n\tendfacet\n`;
  assert.equal(exporter.parse(root), `solid exported\n${facet(0)}${facet(3)}endsolid exported\n`);
  const binary = exporter.parse(root, { binary: true });
  assert.equal(binary.byteLength, 184);
  assert.deepEqual(Array.from(new Uint8Array(binary.buffer, binary.byteOffset, 80)), Array(80).fill(0));
  assert.equal(binary.getUint32(80, true), 2);
  for (let face = 0; face < 2; face++) {
    const offset = 84 + face * 50;
    const values = [0, 0, 1, 2, 0, face * 3, 3, 0, face * 3, 2, 1, face * 3];
    assert.deepEqual(
      values.map((_, i) => binary.getFloat32(offset + i * 4, true)),
      values,
    );
    assert.equal(binary.getUint16(offset + 48, true), 0);
  }
  indexed.geometry.dispose();
  plain.geometry.dispose();
  material.dispose();
});

test("exports posed skin vertices and handles an empty scene", () => {
  const exporter = new STLExporter();
  const empty = new Object3D();
  assert.equal(exporter.parse(empty), "solid exported\nendsolid exported\n");
  assert.equal(exporter.parse(empty, { binary: true }).getUint32(80, true), 0);
  const geometry = triangle(false);
  geometry.setAttribute("skinIndex", new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const material = new MeshBasicMaterial();
  const mesh = new SkinnedMesh(geometry, material);
  const bone = new Bone();
  mesh.add(bone);
  mesh.updateMatrixWorld(true);
  const skeleton = new Skeleton([bone]);
  mesh.bind(skeleton);
  bone.position.y = 2;
  mesh.position.x = 4;
  mesh.updateMatrixWorld(true);
  const output = exporter.parse(mesh);
  assert.match(output, /vertex 4 2 0\n\s*vertex 5 2 0\n\s*vertex 4 3 0/);
  geometry.dispose();
  material.dispose();
  skeleton.dispose();
});
