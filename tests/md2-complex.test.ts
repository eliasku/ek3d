import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import { MD2Geometry, MD2Loader } from "../src/addons/loaders/MD2Loader";
import { MD2CharacterComplex, type MD2CharacterControls } from "../src/addons/misc/MD2CharacterComplex";
import { MorphBlendMesh } from "../src/addons/misc/MorphBlendMesh";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";
import { TextureLoader } from "../src/loaders/TextureLoader";
import { MeshLambertMaterial } from "../src/materials/MeshLambertMaterial";
import { Texture } from "../src/textures/Texture";

function geometry(): MD2Geometry {
  const result = new MD2Geometry();
  result.setAttribute("position", new Float32BufferAttribute([0, -2, 0], 3));
  result.morphAttributes.position = ["stand01", "stand02", "run01", "run02"].map((name) => {
    const attribute = new Float32BufferAttribute([0, 0, 0], 3);
    attribute.name = name;
    return attribute;
  });
  return result;
}
function controls(): MD2CharacterControls {
  return {
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    crouch: false,
    jump: false,
    attack: false,
  };
}

test("morph animations blend frames, wrap, reverse and mirror", () => {
  const geo = geometry();
  const material = new MeshLambertMaterial();
  const mesh = new MorphBlendMesh(geo, material);
  mesh.autoCreateAnimations(2);
  assert.equal(mesh.firstAnimation, "stand");
  assert.equal(mesh.getAnimationDuration("run"), 0.5);
  mesh.setAnimationWeight("run", 0.8);
  mesh.playAnimation("run");
  mesh.update(0.375);
  assert.equal(mesh.morphTargetInfluences![3], 0.4);
  assert.equal(mesh.morphTargetInfluences![0], 0.4);
  mesh.setAnimationDirectionBackward("run");
  mesh.update(0.125);
  assert.equal(mesh.getAnimationTime("run"), 0.25);
  mesh.animationsMap.run.mirroredLoop = true;
  mesh.update(0.5);
  assert.equal(mesh.animationsMap.run.time, 0);
  assert.equal(mesh.animationsMap.run.direction, 1);
  assert.equal(mesh.animationsMap.run.directionBackwards, false);
  mesh.stopAnimation("run");
  mesh.update(1);
  assert.equal(mesh.getAnimationTime("run"), 0);
  geo.dispose();
  material.dispose();
});

test("character transitions, weapon synchronization, shared parts and movement", () => {
  const body = geometry();
  const weapon = geometry();
  const base = new MD2CharacterComplex();
  base.animations = { move: "run", idle: "stand", crouchMove: "run", crouchIdle: "stand", attack: "run" };
  base.meshBody = base._createPart(body, undefined);
  base.meshes.push(base.meshBody);
  base.root.add(base.meshBody);
  const first = base._createPart(weapon, undefined);
  const second = base._createPart(weapon, undefined);
  base.weapons.push(first, second);
  base.meshes.push(first, second);
  base.root.add(first, second);
  base.setWeapon(0);
  base.controls = controls();
  base.update(0.1);
  assert.equal(base.activeAnimation, "stand");
  base.controls.moveForward = true;
  base.update(0.1);
  assert.equal(base.speed, 60);
  assert.equal(base.root.position.z, 6);
  assert.equal(base.activeAnimation, "run");
  assert.equal(base.oldAnimation, "stand");
  assert.equal(base.meshBody.animationsMap.run.weight, 0);
  base.update(0.1);
  assert.equal(base.meshBody.animationsMap.run.weight, 1 / 15);
  base.setWeapon(1);
  assert.equal(first.visible, false);
  assert.equal(second.visible, true);
  assert.equal(second.getAnimationTime("run"), base.meshBody.getAnimationTime("run"));
  base.controls.moveForward = false;
  base.controls.moveBackward = true;
  base.update(0.1);
  assert.equal(base.meshBody.animationsMap.run.direction, -1);
  assert.equal(second.animationsMap.run.direction, -1);
  base.controls.moveBackward = false;
  base.controls.moveLeft = true;
  base.controls.crouch = true;
  base.update(0.1);
  assert.equal(base.maxSpeed, base.crouchSpeed);
  assert.equal(base.root.rotation.y, 0.25);
  const clone = new MD2CharacterComplex();
  clone.shareParts(base);
  assert.equal(clone.meshBody!.geometry, body);
  assert.notEqual(clone.meshBody!.material, base.meshBody.material);
  let disposed = 0;
  body.addEventListener("dispose", () => disposed++);
  clone.dispose();
  assert.equal(disposed, 0);
  base.dispose();
  body.dispose();
  weapon.dispose();
});

test("loading reports errors and discards late assets after disposal", () => {
  const pendingGeometry: ((geometry: MD2Geometry) => void)[] = [];
  const pendingTextures: (() => void)[] = [];
  const errors: ((error: unknown) => void)[] = [];
  const loader = vi.spyOn(MD2Loader.prototype, "load").mockImplementation((_url, onLoad, _progress, onError) => {
    if (onLoad) pendingGeometry.push(onLoad);
    if (onError) errors.push(onError);
  });
  const textures = vi.spyOn(TextureLoader.prototype, "load").mockImplementation((_url, onLoad) => {
    const texture = new Texture();
    pendingTextures.push(() => onLoad?.(texture));
    return texture;
  });
  try {
    const character = new MD2CharacterComplex();
    let completed = 0;
    let reported = 0;
    character.onLoadComplete = () => completed++;
    character.onError = () => reported++;
    character.loadParts({
      baseUrl: "/",
      body: "body",
      skins: ["skin"],
      weapons: [["weapon", "weapon.png"]],
      animations: {},
      walkSpeed: 1,
      crouchSpeed: 0.5,
    });
    errors[0](new Error("failed"));
    errors[1](new Error("failed again"));
    assert.equal(reported, 1);
    character.dispose();
    const late = geometry();
    let discarded = 0;
    late.addEventListener("dispose", () => discarded++);
    pendingGeometry[0](late);
    pendingTextures.forEach((callback) => callback());
    assert.equal(discarded, 1);
    assert.equal(completed, 0);
    assert.equal(character.root.children.length, 0);
  } finally {
    loader.mockRestore();
    textures.mockRestore();
  }
});

test("loading completes only after all body, weapon and texture callbacks", () => {
  const geometries: ((geometry: MD2Geometry) => void)[] = [];
  const texturesReady: (() => void)[] = [];
  const loader = vi.spyOn(MD2Loader.prototype, "load").mockImplementation((_url, onLoad) => {
    if (onLoad) geometries.push(onLoad);
  });
  const textures = vi.spyOn(TextureLoader.prototype, "load").mockImplementation((_url, onLoad) => {
    const texture = new Texture();
    texturesReady.push(() => onLoad?.(texture));
    return texture;
  });
  try {
    const character = new MD2CharacterComplex();
    character.scale = 3;
    let completed = 0;
    character.onLoadComplete = () => completed++;
    character.loadParts({
      baseUrl: "/",
      body: "body",
      skins: ["skin"],
      weapons: [["weapon", "weapon.png"]],
      animations: {},
      walkSpeed: 1,
      crouchSpeed: 0.5,
    });
    geometries[1](geometry());
    texturesReady[0]();
    geometries[0](geometry());
    assert.equal(completed, 0);
    assert.equal(character.root.position.y, 6);
    texturesReady[1]();
    assert.equal(completed, 1);
    character.dispose();
  } finally {
    loader.mockRestore();
    textures.mockRestore();
  }
});
