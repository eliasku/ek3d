import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { CSM } from "../src/addons/csm/CSM";
import { CSMFrustum } from "../src/addons/csm/CSMFrustum";
import { CSMHelper } from "../src/addons/csm/CSMHelper";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { OrthographicCamera } from "../src/cameras/OrthographicCamera";
import { MeshPhongMaterial } from "../src/materials/MeshPhongMaterial";
import { Matrix4 } from "../src/math/Matrix4";
import { Vector2 } from "../src/math/Vector2";
import { phongShader } from "../src/renderers/shaders/PhongShader";
import type { WebGLRenderer, WebGLShaderDescriptor } from "../src/renderers/WebGLRenderer";
import { Scene } from "../src/scenes/Scene";

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("frusta split and transform for perspective and orthographic cameras", () => {
  for (const camera of [new PerspectiveCamera(90, 1, 1, 100), new OrthographicCamera(-2, 2, 2, -2, 1, 100)]) {
    camera.updateProjectionMatrix();
    const frustum = new CSMFrustum({ webGL: true, projectionMatrix: camera.projectionMatrix, maxFar: 40 });
    close(frustum.vertices.near[0].z, -1);
    close(frustum.vertices.far[0].z, -40);
    const cascades: CSMFrustum[] = [];
    frustum.split([0.25, 0.5, 1], cascades);
    close(cascades[0].vertices.far[0].z, -10);
    close(cascades[1].vertices.near[0].z, -10);
    close(cascades[1].vertices.far[0].z, -20);
    const transformed = new CSMFrustum();
    cascades[1].toSpace(new Matrix4().makeTranslation(2, 3, 4), transformed);
    close(transformed.vertices.near[0].z, -6);
    close(transformed.vertices.near[0].x, cascades[1].vertices.near[0].x + 2);
  }
});

test("CSM updates splits, material uniforms, helper and resources", () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera(60, 1, 1, 100);
  camera.updateMatrixWorld();
  const csm = new CSM({ camera, parent: scene, cascades: 2, mode: "uniform", maxFar: 100 });
  close(csm.breaks[0], 0.505);
  assert.equal(csm.lights.length, 2);
  assert.equal(scene.children.length, 4);
  const material = new MeshPhongMaterial();
  csm.setupMaterial(material);
  const shader: WebGLShaderDescriptor = {
    vertexShader: phongShader.vertexShader,
    fragmentShader: phongShader.fragmentShader,
    uniforms: {},
  };
  material.onBeforeCompile(shader, {} as WebGLRenderer);
  const breaks = shader.uniforms.CSM_cascades.value as Vector2[];
  close(breaks[0].y, 0.505);
  csm.mode = "logarithmic";
  csm.fade = true;
  csm.updateFrustums();
  csm.update();
  close(csm.breaks[0], 0.1);
  close(breaks[0].y, 0.1);
  assert.equal((material as MeshPhongMaterial & { defines: Record<string, unknown> }).defines.CSM_FADE, "");
  const helper = new CSMHelper(csm);
  helper.update();
  assert.equal(helper.cascadeLines.length, 2);
  helper.displayFrustum = false;
  helper.updateVisibility();
  assert.equal(helper.cascadePlanes[0].visible, false);
  helper.dispose();
  csm.remove();
  csm.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(shader.uniforms.CSM_cascades, undefined);
  for (const light of csm.lights) light.dispose();
  material.dispose();
});

test("CSM disposal restores a caller hook but does not overwrite a later replacement", () => {
  const scene = new Scene();
  const csm = new CSM({ camera: new PerspectiveCamera(60, 1, 1, 100), parent: scene });
  const material = new MeshPhongMaterial();
  const original: MeshPhongMaterial["onBeforeCompile"] = (shader) => {
    shader.uniforms.caller = { value: 1 };
  };
  material.onBeforeCompile = original;
  csm.setupMaterial(material);
  csm.setupMaterial(material);
  csm.dispose();
  assert.equal(Object.getOwnPropertyDescriptor(material, "onBeforeCompile")?.value, original);
  csm.setupMaterial(material);
  const replacement: MeshPhongMaterial["onBeforeCompile"] = (shader) => {
    shader.uniforms.caller = { value: 2 };
  };
  material.onBeforeCompile = replacement;
  csm.dispose();
  assert.equal(Object.getOwnPropertyDescriptor(material, "onBeforeCompile")?.value, replacement);
  csm.remove();
  for (const light of csm.lights) light.dispose();
  material.dispose();
});
