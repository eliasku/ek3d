import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import { AnimationClipCreator } from "../src/addons/animation/AnimationClipCreator";
import { BoxLineGeometry } from "../src/addons/geometries/BoxLineGeometry";
import { ColorConverter } from "../src/addons/math/ColorConverter";
import { AnimationMixer } from "../src/animation/AnimationMixer";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { Object3D } from "../src/core/Object3D";
import { Color } from "../src/math/Color";
import { Vector3 } from "../src/math/Vector3";

// Exercise interpolation through the actual mixer, not only generated track arrays.
test("clip factories animate scale and discrete visibility and restore state on stop", () => {
  const root = new Object3D();
  const mixer = new AnimationMixer(root);
  const scale = mixer.clipAction(AnimationClipCreator.CreateScaleAxisAnimation(2, "z")).play();
  const visibility = mixer.clipAction(AnimationClipCreator.CreateVisibilityAnimation(2)).play();
  mixer.update(0.5);
  assert.equal(root.scale.z, 0.25);
  assert.equal(root.visible, true);
  mixer.update(0.75);
  assert.equal(root.scale.z, 0.625);
  assert.equal(root.visible, false);
  scale.stop();
  visibility.stop();
  assert.deepEqual(root.scale.toArray(), [1, 1, 1]);
  assert.equal(root.visible, true);
  mixer.uncacheRoot(root);
});

test("random animation factories preserve component scaling and uniform pulses", () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0.75);
  try {
    const shakeRoot = new Object3D(),
      pulseRoot = new Object3D();
    const shakeMixer = new AnimationMixer(shakeRoot),
      pulseMixer = new AnimationMixer(pulseRoot);
    const shake = shakeMixer.clipAction(AnimationClipCreator.CreateShakeAnimation(1, new Vector3(2, 4, 6))).play();
    const pulse = pulseMixer.clipAction(AnimationClipCreator.CreatePulsationAnimation(1, 4)).play();
    shakeMixer.update(0.35);
    pulseMixer.update(0.35);
    assert.deepEqual(shakeRoot.position.toArray(), [1, 2, 3]);
    assert.deepEqual(pulseRoot.scale.toArray(), [3, 3, 3]);
    shake.stop();
    pulse.stop();
    shakeMixer.uncacheRoot(shakeRoot);
    pulseMixer.uncacheRoot(pulseRoot);
  } finally {
    random.mockRestore();
  }
});

test("HSV conversion handles achromatic boundaries and wraps hue", () => {
  const color = new Color();
  const target = { h: 0, s: 0, v: 0 };
  for (const v of [0, 0.25, 1]) {
    ColorConverter.setHSV(color, 0.6, 0, v);
    assert.deepEqual([color.r, color.g, color.b], [v, v, v]);
    assert.equal(ColorConverter.getHSV(color, target).s, 0);
    assert.equal(target.v, v);
  }
  ColorConverter.setHSV(color, -2 / 3, 2, 2);
  assert.ok(Math.abs(color.r) < 1e-12 && Math.abs(color.g - 1) < 1e-12 && Math.abs(color.b) < 1e-12);
  for (const [h, s, v] of [
    [0.1, 0.2, 0.3],
    [0.8, 0.9, 1],
  ]) {
    ColorConverter.getHSV(ColorConverter.setHSV(color, h, s, v), target);
    assert.ok(Math.abs(target.h - h) < 1e-12);
    assert.ok(Math.abs(target.s - s) < 1e-12);
    assert.ok(Math.abs(target.v - v) < 1e-12);
  }
});

test("box line subdivisions stay on box faces and preserve requested extents", () => {
  const geometry = new BoxLineGeometry(4, 6, 8, 2.9, 3.1, 4.8);
  const positions = geometry.getAttribute("position");
  assert.ok(positions instanceof BufferAttribute);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    assert.ok(Math.abs(x) <= 2 && Math.abs(y) <= 3 && Math.abs(z) <= 4);
    assert.ok(Number(Math.abs(x) === 2) + Number(Math.abs(y) === 3) + Number(Math.abs(z) === 4) >= 2);
  }
  geometry.computeBoundingBox();
  assert.deepEqual(geometry.boundingBox!.min.toArray(), [-2, -3, -4]);
  assert.deepEqual(geometry.boundingBox!.max.toArray(), [2, 3, 4]);
  geometry.dispose();
});
