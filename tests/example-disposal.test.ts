import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { disposeMaterial, disposeObject } from "../examples/dispose-object";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { MeshStandardMaterial } from "../src/materials/MeshStandardMaterial";
import { Group } from "../src/objects/Group";
import { Mesh } from "../src/objects/Mesh";
import { Texture } from "../src/textures/Texture";

test("example disposal releases shared graph resources and replaced variant maps exactly once", () => {
  const texture = new Texture();
  const replacedTexture = new Texture();
  const material = new MeshStandardMaterial({ map: texture, normalMap: texture });
  const replaced = new MeshStandardMaterial({ map: replacedTexture, emissiveMap: texture });
  const geometry = new BoxGeometry();
  const group = new Group();
  group.add(new Mesh(geometry, material), new Mesh(geometry, [material, material]));
  const resources = [texture, replacedTexture, material, replaced, geometry];
  const counts = resources.map(() => 0);
  resources.forEach((resource, index) => resource.addEventListener("dispose", () => counts[index]++));
  disposeObject(group, [material, replaced, replaced]);
  assert.deepEqual(counts, [1, 1, 1, 1, 1]);
});

test("example disposal releases maps from a material resolved after page teardown", () => {
  const texture = new Texture();
  const material = new MeshStandardMaterial({ map: texture, normalMap: texture });
  let textureDisposals = 0;
  let materialDisposals = 0;
  texture.addEventListener("dispose", () => textureDisposals++);
  material.addEventListener("dispose", () => materialDisposals++);
  disposeMaterial(material);
  assert.equal(textureDisposals, 1);
  assert.equal(materialDisposals, 1);
});
