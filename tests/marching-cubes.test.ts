import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { MarchingCubes } from "../src/addons/objects/MarchingCubes";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";

test("marching cubes interpolates a single-cell surface and resets its field", () => {
  const material = new MeshBasicMaterial();
  const cubes = new MarchingCubes(4, material, true, true, 10);
  cubes.isolation = 0.5;
  cubes.setCell(1, 1, 1, 1);
  assert.equal(cubes.getCell(1, 1, 1), 1);
  cubes.update();
  assert.equal(cubes.count, 3);
  assert.equal(cubes.geometry.drawRange.count, 3);
  assert.deepEqual(
    Array.from(cubes.positionArray.slice(0, 9)),
    [-0.25, -0.5, -0.5, -0.5, -0.25, -0.5, -0.5, -0.5, -0.25],
  );
  assert.deepEqual(Array.from(cubes.uvArray.slice(0, 6)), [-0.25, -0.5, -0.5, -0.5, -0.5, -0.25]);
  cubes.reset();
  cubes.update();
  assert.equal(cubes.count, 0);
  assert.equal(cubes.getCell(1, 1, 1), 0);
  let disposals = 0;
  cubes.geometry.addEventListener("dispose", () => disposals++);
  cubes.enableUvs = cubes.enableColors = false;
  cubes.init(5);
  assert.equal(disposals, 1);
  cubes.enableUvs = cubes.enableColors = true;
  cubes.update();
  assert.ok(cubes.geometry.getAttribute("uv"));
  assert.ok(cubes.geometry.getAttribute("color"));
  cubes.geometry.dispose();
  material.dispose();
});

test("metaballs and planes contribute to the scalar field", () => {
  const material = new MeshBasicMaterial();
  const cubes = new MarchingCubes(8, material);
  cubes.addBall(0.5, 0.5, 0.5, 1, 12, [1, 0, 0]);
  assert.ok(cubes.getCell(4, 4, 4) > 900000);
  const center = (4 * 64 + 4 * 8 + 4) * 3;
  assert.deepEqual(Array.from(cubes.palette.slice(center, center + 3)), [1, 0, 0]);
  cubes.reset();
  cubes.addPlaneX(2, 12);
  cubes.addPlaneY(2, 12);
  cubes.addPlaneZ(2, 12);
  assert.equal(cubes.getCell(0, 0, 0), 3 * (2 / 0.0001 - 12));
  cubes.geometry.dispose();
  material.dispose();
});
