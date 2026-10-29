import { test, vi } from "vite-plus/test";
import assert from "node:assert/strict";
import { Reflector } from "../src/addons/objects/Reflector";
import { ReflectorForSSRPass } from "../src/addons/objects/ReflectorForSSRPass";
import { Refractor } from "../src/addons/objects/Refractor";
import { Water } from "../src/addons/objects/Water";
import { Water as Water2 } from "../src/addons/objects/Water2";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { PlaneGeometry } from "../src/geometries/PlaneGeometry";
import { Matrix4 } from "../src/math/Matrix4";
import { Vector3 } from "../src/math/Vector3";
import { Vector4 } from "../src/math/Vector4";
import { Texture } from "../src/textures/Texture";
import { Scene } from "../src/scenes/Scene";
import type { Camera } from "../src/cameras/Camera";
import type { Object3D } from "../src/core/Object3D";
import { WebGLRenderTarget } from "../src/renderers/WebGLRenderTarget";
import type { WebGLRenderer } from "../src/renderers/WebGLRenderer";

/**
 * Records the renderer interactions a reflector-style addon performs, without a GPU.
 *
 * The addons only rely on the documented renderer surface (current target, render target
 * switching, depth mask, shadow auto update and viewport restore), so a recorder keeps the
 * state-restoration assertions deterministic.
 */
class RendererRecorder {
  renderedCameras: Camera[] = [];
  targets: Array<WebGLRenderTarget | null> = [];
  depthMasks: boolean[] = [];
  viewports: Vector4[] = [];
  clearCount: number = 0;
  autoClear: boolean = true;
  currentTarget: WebGLRenderTarget | null = null;
  shadowMap: { autoUpdate: boolean } | null = { autoUpdate: true };
  failure: Error | null = null;
  state: {
    buffers: { depth: { setMask: (value: boolean) => void } };
    viewport: (value: Vector4) => void;
  };

  constructor() {
    this.state = {
      buffers: {
        depth: {
          setMask: (value: boolean) => {
            this.depthMasks.push(value);
          },
        },
      },
      viewport: (value: Vector4) => {
        this.viewports.push(value.clone());
      },
    };
  }

  getRenderTarget(): WebGLRenderTarget | null {
    return this.currentTarget;
  }

  setRenderTarget(target: WebGLRenderTarget | null): void {
    this.currentTarget = target;
    this.targets.push(target);
  }

  render(_scene: Object3D, camera: Camera): void {
    this.renderedCameras.push(camera);
    if (this.failure !== null) throw this.failure;
  }

  clear(): void {
    this.clearCount++;
  }
}

function asRenderer(recorder: RendererRecorder): WebGLRenderer {
  return recorder as unknown as WebGLRenderer;
}

test("SSR reflectors keep independent material uniforms and depth targets", () => {
  vi.stubGlobal("window", { innerWidth: 800, innerHeight: 600 });
  const geometry = new PlaneGeometry(10, 10);
  try {
    const first = new ReflectorForSSRPass(geometry, { useDepthTexture: true });
    const second = new ReflectorForSSRPass(geometry);
    try {
      assert.equal(first.geometry, geometry);
      assert.notEqual(first.material, second.material);
      first.material.uniforms.opacity.value = 0.25;
      assert.equal(second.material.uniforms.opacity.value, 0.5);
      assert.equal(first.material.uniforms.tDepth.value, first.getRenderTarget().depthTexture);
      assert.notEqual(first.getRenderTarget().depthTexture, null);
      assert.equal(second.getRenderTarget().depthTexture, null);
    } finally {
      first.dispose();
      second.dispose();
    }
  } finally {
    geometry.dispose();
    vi.unstubAllGlobals();
  }
});

test("Reflector keeps an independent cached camera for each source camera", () => {
  const reflector = new Reflector(new PlaneGeometry(10, 10));
  try {
    const camera = new PerspectiveCamera();
    const first = reflector.getReflectionCamera(camera);
    assert.notEqual(first, camera);
    assert.equal(reflector.getReflectionCamera(camera), first);
    assert.notEqual(reflector.getReflectionCamera(new PerspectiveCamera()), first);
  } finally {
    reflector.geometry.dispose();
    reflector.dispose();
  }
});

test("Reflector builds a mirrored camera with an oblique clipped projection", () => {
  const recorder = new RendererRecorder();
  const geometry = new PlaneGeometry(10, 10);
  const reflector = new Reflector(geometry, { clipBias: 0.5, multisample: 0 });
  reflector.position.set(0, 0, -5);
  reflector.updateMatrixWorld();

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 1, 500);
  camera.position.set(0, 0, 10);
  camera.updateMatrixWorld();
  camera.setViewOffset(200, 100, 10, 0, 200, 100);
  camera.updateProjectionMatrix();

  const sourceProjection = camera.projectionMatrix.clone();
  assert.notEqual(sourceProjection.elements[8], 0, "a view offset makes the mirrored terms observable");

  reflector.onBeforeRender(asRenderer(recorder), scene, camera);

  assert.equal(recorder.renderedCameras.length, 1, "renders one reflection pass");
  const reflectionCamera = recorder.renderedCameras[0];
  assert.equal(recorder.targets[0], reflector.getRenderTarget(), "renders into the reflection target");
  assert.equal(recorder.currentTarget, null, "restores the previous render target");

  assert.equal(reflectionCamera.projectionMatrix.elements[8], -sourceProjection.elements[8]);
  assert.equal(reflectionCamera.projectionMatrix.elements[12], -sourceProjection.elements[12]);
  assert.notEqual(
    reflectionCamera.projectionMatrix.elements[10],
    sourceProjection.elements[10],
    "oblique clip plane replaces the z coefficient",
  );
  assert.equal(reflector.visible, true, "the reflector is visible again after the pass");

  assert.deepEqual(recorder.depthMasks, [true], "depth writes are re-enabled before clearing");
});

test("Reflector skips the pass while facing away unless forceUpdate is set", () => {
  const recorder = new RendererRecorder();
  const reflector = new Reflector(new PlaneGeometry(10, 10));
  reflector.updateMatrixWorld();

  const scene = new Scene();
  const camera = new PerspectiveCamera();
  camera.position.set(0, 0, -10);
  camera.updateMatrixWorld();

  reflector.onBeforeRender(asRenderer(recorder), scene, camera);
  assert.equal(recorder.renderedCameras.length, 0, "a back-facing reflector does not render");

  reflector.forceUpdate = true;
  reflector.onBeforeRender(asRenderer(recorder), scene, camera);
  assert.equal(recorder.renderedCameras.length, 1, "forceUpdate bypasses the facing test");
  assert.equal(reflector.forceUpdate, false, "the forced flag resets after the pass");
});

test("Refractor keeps the virtual camera in sync with an oblique frustum", () => {
  const recorder = new RendererRecorder();
  const refractor = new Refractor(new PlaneGeometry(10, 10), { clipBias: 0.25 });
  refractor.rotation.x = -Math.PI / 2;
  refractor.updateMatrixWorld();

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 1, 250);
  camera.position.set(0, 10, 0);
  camera.updateMatrixWorld();

  refractor.onBeforeRender(asRenderer(recorder), scene, camera);

  assert.equal(recorder.renderedCameras[0], refractor.camera);
  assert.equal(recorder.targets[0], refractor.getRenderTarget());
  assert.equal(recorder.currentTarget, null, "restores the previous render target");
  assert.equal(refractor.visible, true);

  const virtualCamera = refractor.camera;
  assert.notEqual(
    virtualCamera.projectionMatrix.elements[10],
    camera.projectionMatrix.elements[10],
    "oblique clipping rewrites the projection",
  );

  const before = recorder.renderedCameras.length;
  refractor.onBeforeRender(asRenderer(recorder), scene, virtualCamera);
  assert.equal(recorder.renderedCameras.length, before, "nested refractor cameras do not recurse");
});

test("Water2 advances both flow offsets inside one cycle and restores visibility", () => {
  const recorder = new RendererRecorder();
  const geometry = new PlaneGeometry(10, 10);
  const water = new Water2(geometry, {
    normalMap0: new Texture(),
    normalMap1: new Texture(),
    flowSpeed: 0,
    scale: 1,
  });
  water.updateMatrixWorld();

  const scene = new Scene();
  const camera = new PerspectiveCamera();
  camera.position.set(0, 5, 5);
  camera.updateMatrixWorld();

  const config = water.material.uniforms["config"].value as Vector4;
  const cycle = config.z * 2;
  const halfCycle = config.z;

  // second branch: the trailing offset alone wraps back by one cycle
  config.x = 0.14;
  config.y = 0.145;
  water.updateFlow();
  assert.equal(config.x, 0.14, "a still phase leaves the leading offset untouched");
  assert.ok(Math.abs(config.y - (0.14 + halfCycle - cycle)) < 1e-12, "the trailing offset wraps by one cycle");

  // first branch: the leading offset reaching the cycle resets both offsets
  config.x = 0.2;
  water.updateFlow();
  assert.equal(config.x, 0, "the leading offset restarts the cycle");
  assert.equal(config.y, halfCycle, "the trailing offset restarts half a cycle ahead");

  for (let i = 0; i < 4; i++) {
    water.onBeforeRender(asRenderer(recorder), scene, camera);
    assert.ok(config.x >= 0 && config.x <= cycle, "flowMapOffset0 stays inside the cycle");
    assert.ok(config.y >= 0 && config.y <= cycle, "flowMapOffset1 stays inside the cycle");
  }

  assert.equal(water.visible, true, "the water surface is visible again after the passes");
  assert.equal(recorder.renderedCameras.length, 8, "both reflector and refractor render per frame");
  assert.equal(recorder.renderedCameras[0], water.getReflector().getReflectionCamera(camera));
  assert.equal(recorder.renderedCameras[1], water.getRefractor().camera);
  const textureMatrix = water.material.uniforms["textureMatrix"].value as Matrix4;
  assert.notDeepEqual(textureMatrix.elements, new Matrix4().elements, "the projective matrix is refreshed per frame");
});

test("Water reflects the eye below its surface and avoids recursive captures", () => {
  const recorder = new RendererRecorder();
  const water = new Water(new PlaneGeometry(10, 10), { waterColor: 0x001e0f, distortionScale: 3.7 });
  water.rotation.x = -Math.PI / 2;
  water.updateMatrixWorld();

  const scene = new Scene();
  const camera = new PerspectiveCamera();
  camera.position.set(0, 20, 0);
  camera.updateMatrixWorld();

  water.onBeforeRender(asRenderer(recorder), scene, camera);
  assert.equal(recorder.renderedCameras.length, 1, "one mirror pass per frame");
  assert.equal((water.material.uniforms["eye"].value as Vector3).y, 20);

  const below = recorder.renderedCameras[0];
  assert.ok(below.position.y < 0, "the mirror camera is reflected below the surface");

  const before = recorder.renderedCameras.length;
  water.onBeforeRender(asRenderer(recorder), scene, below);
  assert.equal(recorder.renderedCameras.length, before, "the plane is invisible from the mirrored camera");
});

for (const [name, create] of [
  ["Reflector", () => new Reflector(new PlaneGeometry(2, 2))],
  ["Refractor", () => new Refractor(new PlaneGeometry(2, 2))],
  ["Water", () => new Water(new PlaneGeometry(2, 2))],
  ["Water2", () => new Water2(new PlaneGeometry(2, 2), { normalMap0: new Texture(), normalMap1: new Texture() })],
] as const) {
  test(`${name} restores caller state after a failed offscreen render`, () => {
    const surface = create();
    const previous = new WebGLRenderTarget(4, 4);
    const recorder = new RendererRecorder();
    recorder.currentTarget = previous;
    recorder.failure = new Error("capture failed");
    const camera = new PerspectiveCamera();
    camera.position.set(0, 5, 5);
    camera.updateMatrixWorld();
    surface.updateMatrixWorld();
    try {
      assert.throws(() => surface.onBeforeRender(asRenderer(recorder), new Scene(), camera), /capture failed/);
      assert.equal(surface.visible, true, "failed capture must not hide the surface");
      assert.equal(recorder.currentTarget, previous, "the caller can continue rendering into its target");
      assert.equal(recorder.shadowMap?.autoUpdate, true, "subsequent frames must still refresh shadows");
    } finally {
      surface.geometry.dispose();
      surface.dispose();
      previous.dispose();
    }
  });
}
