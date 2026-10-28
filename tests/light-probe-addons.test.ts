import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { LightProbeHelper } from "../src/addons/helpers/LightProbeHelper";
import { LightProbeGenerator } from "../src/addons/lights/LightProbeGenerator";
import { TextureType } from "../src/constants";
import { toHalfFloat } from "../src/extras/DataUtils";
import { LightProbe } from "../src/lights/LightProbe";
import { WebGLCubeRenderTarget } from "../src/renderers/WebGLCubeRenderTarget";
import type { WebGLRenderer } from "../src/renderers/WebGLRenderer";
import { CubeTexture } from "../src/textures/CubeTexture";

test("cube readback projects constant radiance and respects pixel types", async () => {
  for (const type of [undefined, TextureType.Float, TextureType.HalfFloat]) {
    const target = new WebGLCubeRenderTarget(1);
    if (type !== undefined) target.texture.type = type;
    const seen: number[] = [];
    const renderer = {
      async readRenderTargetPixelsAsync(
        _target: unknown,
        _x: number,
        _y: number,
        _width: number,
        _height: number,
        data: Uint8Array | Uint16Array | Float32Array,
        face: number,
      ) {
        seen.push(face);
        data.set(
          type === TextureType.Float
            ? [1, 0.5, 0, 1]
            : type === TextureType.HalfFloat
              ? [toHalfFloat(1), toHalfFloat(0.5), 0, toHalfFloat(1)]
              : [255, 128, 0, 255],
        );
      },
    } as unknown as WebGLRenderer;
    const probe = await LightProbeGenerator.fromCubeRenderTarget(renderer, target);
    assert.deepEqual(seen, [0, 1, 2, 3, 4, 5]);
    assert.ok(Math.abs(probe.sh.coefficients[0].x - 0.282095 * 4 * Math.PI) < 1e-5);
    assert.ok(
      Math.abs(probe.sh.coefficients[0].y / probe.sh.coefficients[0].x - (type === undefined ? 128 / 255 : 0.5)) < 1e-6,
    );
    assert.equal(probe.sh.coefficients[0].z, 0);
    for (const coefficient of probe.sh.coefficients.slice(1)) assert.ok(coefficient.length() < 1e-5);
    target.dispose();
  }
});

test("cube texture projection uses face orientation and sRGB conversion", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  let face = 0;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        getContext: () => ({
          drawImage: () => {},
          getImageData: () => ({
            width: 1,
            data: new Uint8ClampedArray(face++ === 0 ? [128, 0, 0, 255] : [0, 0, 0, 255]),
          }),
        }),
      }),
    },
  });
  try {
    const texture = new CubeTexture(Array.from({ length: 6 }, () => ({ width: 1, height: 1 })));
    texture.colorSpace = "srgb";
    const probe = LightProbeGenerator.fromCubeTexture(texture);
    assert.ok(probe.sh.coefficients[0].x > 0);
    assert.ok(probe.sh.coefficients[0].x < ((0.282095 * 4 * Math.PI) / 6) * 0.5);
    assert.ok(probe.sh.coefficients[3].x < 0);
  } finally {
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

test("probe helper tracks the probe and disposes its resources", () => {
  const probe = new LightProbe();
  const helper = new LightProbeHelper(probe, 2);
  assert.equal(helper.material.uniforms.sh.value, probe.sh.coefficients);
  probe.position.set(1, 2, 3);
  probe.intensity = 0.4;
  helper.onBeforeRender();
  assert.deepEqual(helper.position.toArray(), [1, 2, 3]);
  assert.deepEqual(helper.scale.toArray(), [2, 2, 2]);
  assert.equal(helper.material.uniforms.intensity.value, 0.4);
  let geometryDisposed = false,
    materialDisposed = false;
  helper.geometry.addEventListener("dispose", () => {
    geometryDisposed = true;
  });
  helper.material.addEventListener("dispose", () => {
    materialDisposed = true;
  });
  helper.dispose();
  assert.ok(geometryDisposed && materialDisposed);
});
