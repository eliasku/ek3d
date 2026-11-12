import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { MorphBlendMesh } from "../src/addons/misc/MorphBlendMesh";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";
import { MeshLambertMaterial } from "../src/materials/MeshLambertMaterial";

function geometry(): BufferGeometry {
  const result = new BufferGeometry();
  result.setAttribute("position", new Float32BufferAttribute([0, -2, 0], 3));
  result.morphAttributes.position = ["stand01", "stand02", "run01", "run02"].map((name) => {
    const attribute = new Float32BufferAttribute([0, 0, 0], 3);
    attribute.name = name;
    return attribute;
  });
  return result;
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
