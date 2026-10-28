import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { RectAreaLightHelper } from "../src/addons/helpers/RectAreaLightHelper";
import { RectAreaLight } from "../src/lights/RectAreaLight";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Mesh } from "../src/objects/Mesh";

test("rect area helper follows its light, colors its face, and disposes resources", () => {
  const light = new RectAreaLight(0xff0000, 5, 4, 10);
  light.position.set(3, 4, 5);
  light.scale.set(2, 3, 4);
  light.updateMatrixWorld();
  const helper = new RectAreaLightHelper(light);
  const face = helper.children[0] as Mesh<MeshBasicMaterial>;
  helper.updateMatrixWorld();
  assert.deepEqual(helper.scale.toArray(), [2, 5, 1]);
  assert.deepEqual(helper.matrixWorld.elements.slice(12, 15), [3, 4, 5]);
  assert.equal(helper.matrixWorld.elements[0], 2);
  assert.equal(helper.matrixWorld.elements[5], 5);
  assert.deepEqual(helper.material.color.toArray(), [1, 0, 0]);
  assert.deepEqual(face.material.color.toArray(), [1, 0, 0]);
  assert.deepEqual(face.matrixWorld.elements, helper.matrixWorld.elements);
  helper.color = 0x00ff00;
  helper.updateMatrixWorld();
  assert.deepEqual(helper.material.color.toArray(), [0, 1, 0]);
  assert.deepEqual(face.material.color.toArray(), [0, 1, 0]);
  let disposed = 0;
  for (const resource of [helper.geometry, helper.material, face.geometry, face.material]) {
    resource.addEventListener("dispose", () => disposed++);
  }
  helper.dispose();
  assert.equal(disposed, 4);
});
