import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { ProgressiveLightMap } from "../src/addons/misc/ProgressiveLightMap";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { PlaneGeometry } from "../src/geometries/PlaneGeometry";
import { MeshPhongMaterial } from "../src/materials/MeshPhongMaterial";
import { Mesh } from "../src/objects/Mesh";
import type { WebGLRenderer } from "../src/renderers/WebGLRenderer";

test("lightmap packs padded UVs into the injected atlas", () => {
  const renderer = {} as WebGLRenderer;
  const map = new ProgressiveLightMap(
    renderer,
    (boxes) => {
      boxes.forEach((box, i) => {
        box.x = i * box.w;
        box.y = 0;
      });
      return { w: boxes[0].w * boxes.length, h: boxes[0].h };
    },
    12,
  );
  const a = new Mesh<MeshPhongMaterial>(new PlaneGeometry(), new MeshPhongMaterial());
  const b = new Mesh<MeshPhongMaterial>(new PlaneGeometry(), new MeshPhongMaterial());
  map.addObjectsToLightMap([a, b]);
  const uvA = a.geometry.getAttribute("uv1");
  const uvB = b.geometry.getAttribute("uv1");
  assert.ok(uvA instanceof BufferAttribute && uvB instanceof BufferAttribute);
  assert.ok(Math.abs(uvB.getX(0) - uvA.getX(0) - 0.5) < 1e-6);
  assert.equal(a.material.lightMap, map.progressiveLightMap2.texture);
  assert.equal(map.progressiveLightMap2.texture.channel, 1);
  const shader = { vertexShader: "void main() {\n}\n", fragmentShader: "void main() {\n}\n", uniforms: {} };
  map.uvMat.onBeforeCompile(shader, renderer);
  assert.match(shader.vertexShader, /gl_Position = vec4/);
  assert.match(shader.fragmentShader, /mix\(texelOld/);
  assert.equal((shader.vertexShader.match(/}/g) ?? []).length, 1);
  assert.equal((shader.fragmentShader.match(/}/g) ?? []).length, 1);
  map.dispose();
  a.geometry.dispose();
  a.material.dispose();
  b.geometry.dispose();
  b.material.dispose();
});
