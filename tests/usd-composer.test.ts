import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { USDComposer } from "../src/addons/loaders/usd/USDComposer";
import { LoadingManager } from "../src/loaders/LoadingManager";

test("USD composer builds hierarchy, authored transforms, and stage units", () => {
  const composer = new USDComposer(new LoadingManager());
  const scene = composer.compose({
    specsByPath: {
      "/": { specType: 7, fields: { metersPerUnit: 0.01, upAxis: "Z" } },
      "/World": { specType: 6, fields: { typeName: "Xform" } },
      "/World.xformOp:translate": { specType: 1, fields: { default: [1, 2, 3] } },
      "/World/Child": { specType: 6, fields: { typeName: "Xform" } },
    },
  });

  assert.equal(scene.children.length, 1);
  assert.equal(scene.children[0].name, "World");
  assert.deepEqual(scene.children[0].position.toArray(), [1, 2, 3]);
  assert.equal(scene.children[0].children[0].name, "Child");
  assert.deepEqual(scene.scale.toArray(), [0.01, 0.01, 0.01]);
  assert.equal(scene.rotation.x, -Math.PI / 2);
});

test("USD composer tracks asynchronous texture completion", async () => {
  const composer = new USDComposer(new LoadingManager());
  const image = {} as HTMLImageElement;
  let finish: () => void = () => {
    throw new Error("Image load was not started");
  };
  composer.imageLoader.load = (_url, onLoad) => {
    finish = () => onLoad?.(image);
    return image;
  };
  const texture = composer._createTextureFromData("texture.png", null, null);
  assert.ok(texture);
  assert.equal(composer.texturePromises.length, 1);
  finish();
  await Promise.all(composer.texturePromises);
  assert.equal(texture.image, image);
});
