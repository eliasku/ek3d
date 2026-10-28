import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import { ShadowMesh } from "../src/addons/objects/ShadowMesh";
import { ShadowMapViewer } from "../src/addons/utils/ShadowMapViewer";
import { EqualStencilFunc, IncrementStencilOp } from "../src/constants";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { DirectionalLight } from "../src/lights/DirectionalLight";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Plane } from "../src/math/Plane";
import { Vector3 } from "../src/math/Vector3";
import { Vector4 } from "../src/math/Vector4";
import { Mesh } from "../src/objects/Mesh";
import { WebGLRenderTarget } from "../src/renderers/WebGLRenderTarget";
import type { WebGLRenderer } from "../src/renderers/WebGLRenderer";
import type { Scene } from "../src/scenes/Scene";
import type { OrthographicCamera } from "../src/cameras/OrthographicCamera";
import type { ShaderMaterial } from "../src/materials/ShaderMaterial";

test("shadow mesh projects the source world transform for directional and point lights", () => {
  const geometry = new BoxGeometry(1, 1, 1);
  const source = new Mesh<MeshBasicMaterial>(geometry, new MeshBasicMaterial());
  source.position.set(2, 3, 4);
  source.updateMatrixWorld(true);
  const shadow = new ShadowMesh(source);
  assert.equal(shadow.geometry, geometry);
  assert.equal(shadow.meshMatrix, source.matrixWorld);
  assert.equal(shadow.material.stencilFunc, EqualStencilFunc);
  assert.equal(shadow.material.stencilZPass, IncrementStencilOp);
  assert.equal(shadow.matrixAutoUpdate, false);
  assert.equal(shadow.frustumCulled, false);
  const plane = new Plane(new Vector3(0, 1, 0), 0.01);
  for (const light of [new Vector4(5, 7, -1, 0.001), new Vector4(0, 6, -2, 0.9)]) {
    shadow.update(plane, light);
    const projected = new Vector3(0, 0, 0).applyMatrix4(shadow.matrix);
    assert.ok(Math.abs(projected.y - 0.01) < 1e-10);
    assert.ok(Number.isFinite(projected.x) && Number.isFinite(projected.z));
  }
  source.position.x = 4;
  source.updateMatrixWorld(true);
  shadow.update(plane, new Vector4(5, 7, -1, 0.001));
  assert.ok(new Vector3().applyMatrix4(shadow.matrix).x > 0);
  shadow.material.dispose();
  source.material.dispose();
  geometry.dispose();
});

test("viewer positions and resizes its overlay, restores renderer state, and disposes resources", () => {
  vi.stubGlobal("window", { innerWidth: 800, innerHeight: 600 });
  const context = { font: "", fillStyle: "", measureText: () => ({ width: 40 }), fillText: () => {} };
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  try {
    const light = new DirectionalLight();
    light.name = "Sun";
    light.shadow.map = new WebGLRenderTarget(8, 8);
    const viewer = new ShadowMapViewer(light);
    viewer.size.set(200, 100);
    viewer.position.set(20, 30);
    const captured: { scene?: Scene; camera?: OrthographicCamera } = {};
    let clears = 0;
    const renderer = {
      autoClear: true,
      clearDepth: () => {
        clears++;
      },
      render: (s: Scene, c: OrthographicCamera) => {
        captured.scene = s;
        captured.camera = c;
        assert.equal(renderer.autoClear, false);
      },
    };
    viewer.render(renderer as unknown as WebGLRenderer);
    assert.equal(renderer.autoClear, true);
    assert.equal(clears, 1);
    const { scene, camera } = captured;
    assert.ok(scene && camera);
    const mesh = scene.children[0] as Mesh<ShaderMaterial>;
    assert.equal(mesh.position.x, -280);
    assert.equal(mesh.position.y, 220);
    assert.equal(mesh.scale.x, 200 / 256);
    assert.equal(mesh.material.uniforms.tDiffuse.value, light.shadow.map.texture);
    viewer.enabled = false;
    viewer.render(renderer as unknown as WebGLRenderer);
    assert.equal(clears, 1);
    viewer.enabled = true;
    window.innerWidth = 1000;
    viewer.updateForWindowResize();
    assert.equal(camera.left, -500);
    assert.equal(mesh.position.x, -380);
    let disposed = 0;
    mesh.geometry.addEventListener("dispose", () => disposed++);
    mesh.material.addEventListener("dispose", () => disposed++);
    const label = scene.children[1] as Mesh<MeshBasicMaterial>;
    label.geometry.addEventListener("dispose", () => disposed++);
    label.material.addEventListener("dispose", () => disposed++);
    label.material.map!.addEventListener("dispose", () => disposed++);
    viewer.dispose();
    assert.equal(disposed, 5);
    light.dispose();
  } finally {
    vi.unstubAllGlobals();
  }
});
