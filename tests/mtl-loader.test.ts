import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { MTLLoader } from "../src/addons/loaders/MTLLoader";
import { OBJLoader } from "../src/addons/loaders/OBJLoader";
import type { MeshPhongMaterialParameters } from "../src/materials/MeshPhongMaterial";
import { Mesh } from "../src/objects/Mesh";

test("MTL normalizes colors, preserves emissive values and applies opacity precedence to OBJ groups", () => {
  const creator = new MTLLoader()
    .setMaterialOptions({ normalizeRGB: true, ignoreZeroRGBs: true })
    .parse(
      "# material\r\nnewmtl red\nKd 255 0 0\nKs 0 0 0\nKe 0 1 0\nNs 75\nd 0.8\nTr 0.25\nnewmtl blue\nKd 0 0 255\n",
      "",
    );
  creator.preload();
  const red = creator.create("red");
  assert.equal(red.color.r, 1);
  assert.equal(red.color.g, 0);
  assert.equal(red.emissive.g, 1);
  assert.equal(creator.materialsInfo.red.ks, undefined);
  assert.equal(red.shininess, 75);
  assert.equal(red.opacity, 0.75);
  assert.equal(red.transparent, true);
  const object = new OBJLoader()
    .setMaterials(creator)
    .parse("v 0 0 0\nv 1 0 0\nv 0 1 0\nv 0 0 1\nusemtl red\nf 1 2 3\nusemtl blue\nf 1 3 4");
  const mesh = object.children[0];
  assert.ok(mesh instanceof Mesh);
  assert.ok(Array.isArray(mesh.material));
  assert.equal(mesh.material[0], red);
  assert.equal(mesh.material[1], creator.create("blue"));
  assert.deepEqual(mesh.geometry.groups, [
    { start: 0, count: 3, materialIndex: 0 },
    { start: 3, count: 3, materialIndex: 1 },
  ]);
  mesh.geometry.dispose();
  for (const material of creator.getAsArray()) material.dispose();
});

test("MTL texture options preserve filenames with spaces and independent bump/displacement transforms", () => {
  const creator = new MTLLoader().setMaterialOptions({ invertTrProperty: true }).parse("newmtl glass\nTr 0.2", "");
  assert.ok(Math.abs(creator.create("glass").opacity - 0.2) < 1e-12);
  const params: MeshPhongMaterialParameters = {};
  const texture = creator.getTextureParams("-s 2 3 1 -o 0.25 0.5 0 -bm 0.4 -mm -1 2 diffuse image.png", params);
  assert.equal(texture.url, "diffuse image.png");
  assert.deepEqual(texture.scale.toArray(), [2, 3]);
  assert.deepEqual(texture.offset.toArray(), [0.25, 0.5]);
  assert.equal(params.bumpScale, 0.4);
  assert.equal(params.displacementBias, -1);
  assert.equal(params.displacementScale, 2);
  creator.create("glass").dispose();
});
