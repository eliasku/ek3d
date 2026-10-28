import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import { MD2Character } from "../src/addons/misc/MD2Character";
import { MD2Geometry, MD2Loader } from "../src/addons/loaders/MD2Loader";
import { AnimationClip } from "../src/animation/AnimationClip";
import { NumberKeyframeTrack } from "../src/animation/tracks/NumberKeyframeTrack";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";
import { TextureLoader } from "../src/loaders/TextureLoader";
import { Texture } from "../src/textures/Texture";

function geometry(): MD2Geometry {
  const result = new MD2Geometry();
  result.setAttribute("position", new Float32BufferAttribute([0, -2, 0], 3));
  result.animations = [new AnimationClip("run", 2, [new NumberKeyframeTrack(".position[x]", [0, 2], [0, 2])])];
  return result;
}

test("MD2 character synchronizes switched weapons and controls playback and materials", () => {
  const geometryCallbacks: ((value: MD2Geometry) => void)[] = [];
  const textureCallbacks: (() => void)[] = [];
  const loader = vi.spyOn(MD2Loader.prototype, "load").mockImplementation((_url, onLoad) => {
    if (onLoad) geometryCallbacks.push(onLoad);
  });
  const textures = vi.spyOn(TextureLoader.prototype, "load").mockImplementation((_url, onLoad) => {
    const texture = new Texture();
    textureCallbacks.push(() => onLoad?.(texture));
    return texture;
  });
  try {
    const character = new MD2Character();
    let completed = 0;
    character.onLoadComplete = () => {
      completed++;
    };
    character.loadParts({
      baseUrl: "/",
      body: "body.md2",
      skins: ["a.png", "b.png"],
      weapons: [
        ["a.md2", "wa.png"],
        ["b.md2", "wb.png"],
      ],
    });
    geometryCallbacks[2](geometry());
    geometryCallbacks[0](geometry());
    geometryCallbacks[1](geometry());
    for (const callback of textureCallbacks) callback();
    assert.equal(completed, 1);
    assert.equal(character.root.position.y, 2);
    character.setAnimation("run");
    character.update(0.5);
    character.setWeapon(1);
    assert.equal(character.weapons[0].visible, false);
    assert.equal(character.weapons[1].visible, true);
    assert.equal(character.meshWeapon?.activeAction?.time, character.meshBody?.activeAction?.time);
    character.update(0.25);
    assert.equal(character.meshWeapon?.activeAction?.time, character.meshBody?.activeAction?.time);
    character.setPlaybackRate(2);
    character.update(0.5);
    assert.equal(character.meshBody?.activeAction?.time, 1);
    character.setPlaybackRate(0);
    character.update(1);
    assert.equal(character.meshBody?.activeAction?.time, 1);
    character.setSkin(1);
    assert.equal(character.meshBody?.material.map, character.skinsBody[1]);
    character.setWireframe(true);
    assert.equal(character.meshBody?.material.wireframe, true);
    assert.equal(character.meshWeapon?.material.wireframe, true);
    character.setWireframe(false);
    assert.equal(character.meshBody?.material.map, character.skinsBody[1]);
    character.dispose();
    assert.equal(character.root.children.length, 0);
  } finally {
    loader.mockRestore();
    textures.mockRestore();
  }
});

test("MD2 character reports one error and disposes late geometry after teardown", () => {
  const geometryCallbacks: ((value: MD2Geometry) => void)[] = [];
  const errors: ((error: unknown) => void)[] = [];
  const loader = vi.spyOn(MD2Loader.prototype, "load").mockImplementation((_url, onLoad, _progress, onError) => {
    if (onLoad) geometryCallbacks.push(onLoad);
    if (onError) errors.push(onError);
  });
  const pendingTextures: (() => void)[] = [];
  const texture = new Texture();
  const textureDispose = vi.spyOn(texture, "dispose");
  const textures = vi.spyOn(TextureLoader.prototype, "load").mockImplementation((_url, onLoad) => {
    pendingTextures.push(() => onLoad?.(texture));
    return texture;
  });
  try {
    const character = new MD2Character();
    let completed = 0;
    let reported = 0;
    character.onLoadComplete = () => {
      completed++;
    };
    character.onError = () => {
      reported++;
    };
    character.loadParts({ baseUrl: "", body: "body", skins: [], weapons: [["weapon", "skin"]] });
    errors[0](new Error("failed"));
    errors[1](new Error("failed again"));
    character.dispose();
    const late = geometry();
    const dispose = vi.spyOn(late, "dispose");
    geometryCallbacks[0](late);
    assert.equal(dispose.mock.calls.length, 1);
    assert.equal(reported, 1);
    pendingTextures[0]();
    assert.equal(textureDispose.mock.calls.length, 1);
    assert.equal(completed, 0);
    assert.equal(character.root.children.length, 0);
  } finally {
    loader.mockRestore();
    textures.mockRestore();
  }
});
