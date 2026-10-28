import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { Lensflare, LensflareElement } from "../src/addons/objects/Lensflare";
import { Texture } from "../src/textures/Texture";

test("lensflare elements and resources follow the public contract", () => {
  const texture = new Texture();
  const element = new LensflareElement(texture);
  assert.equal(element.size, 1);
  assert.equal(element.distance, 0);
  assert.equal(element.color.getHex(), 0xffffff);
  const flare = new Lensflare();
  assert.equal(flare.isLensflare, true);
  assert.equal(flare.frustumCulled, false);
  assert.equal(flare.renderOrder, Infinity);
  assert.equal(flare.geometry, Lensflare.Geometry);
  assert.equal(flare.geometry.index?.count, 6);
  assert.equal(flare.geometry.attributes.position.count, 4);
  let textureDisposals = 0,
    materialDisposals = 0;
  texture.addEventListener("dispose", () => {
    textureDisposals++;
  });
  flare.material.addEventListener("dispose", () => {
    materialDisposals++;
  });
  flare.addElement(element);
  flare.dispose();
  assert.equal(textureDisposals, 1);
  assert.equal(materialDisposals, 1);
});
