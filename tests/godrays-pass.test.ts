import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { GodraysPass, GodraysUpsampleQuality } from "../src/addons/postprocessing/GodraysPass";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { DirectionalLight } from "../src/lights/DirectionalLight";
import { PointLight } from "../src/lights/PointLight";
import { Color } from "../src/math/Color";
import { DepthTexture } from "../src/textures/DepthTexture";

test("godrays updates adaptive sampling, blur, resolution and upsample settings", () => {
  const pass = new GodraysPass(new PointLight(), new PerspectiveCamera());
  pass.setSize(101, 51);
  assert.equal(pass.rays.width, 51);
  assert.equal(pass.rays.height, 26);
  const color = new Color(0xff0088);
  pass.setParams({
    color,
    resolutionScale: 0.25,
    adaptiveSteps: { stepSize: 2, minSteps: 4 },
    blur: { kernelSize: 3, variance: 0.2 },
    upsampleQuality: GodraysUpsampleQuality.LOW,
    debugSteps: true,
  });
  assert.equal(pass.rays.width, 26);
  assert.equal(pass.rays.height, 13);
  assert.equal(pass.illumination.uniforms.raymarchStepSize.value, 2);
  assert.equal(pass.illumination.uniforms.minSteps.value, 4);
  assert.equal(pass.blur.defines.KSIZE_ENUM, 3);
  assert.equal(pass.composite.defines.JBU_EXTENT, "0");
  assert.notEqual(pass.params.color, color);
  assert.throws(() => pass.setParams({ raymarchSteps: 10, adaptiveSteps: { stepSize: 1 } }), /Cannot specify both/);
  pass.setParams({ blur: false });
  assert.equal(pass.illumination.uniforms.raymarchStepSize.value, 0);
  assert.equal(pass.illumination.defines.DEBUG_STEPS, undefined);
  pass.dispose();
});

test("godrays selects the shadow layout and accepts only basic scene depth", () => {
  const point = new GodraysPass(new PointLight(), new PerspectiveCamera());
  const directional = new GodraysPass(new DirectionalLight(), new PerspectiveCamera());
  assert.equal(point.illumination.defines.USE_CUBE_SHADOWMAP, "");
  assert.equal(directional.illumination.defines.IS_DIRECTIONAL_LIGHT, "");
  assert.equal(directional.illumination.defines.USE_UNPACKED_DEPTH, "");
  const depth = new DepthTexture(1, 1);
  directional.setDepthTexture(depth);
  let disposed = false;
  depth.addEventListener("dispose", () => {
    disposed = true;
  });
  assert.equal(directional.depthTexture, depth);
  assert.throws(() => directional.setDepthTexture(depth, -1), /BasicDepthPacking/);
  point.dispose();
  directional.dispose();
  assert.equal(disposed, false);
  depth.dispose();
});
