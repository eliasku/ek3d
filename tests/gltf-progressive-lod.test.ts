import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import { calculateProgressiveLOD } from "../src/addons/loaders/GLTFProgressiveLOD";
import { OrthographicCamera } from "../src/cameras/OrthographicCamera";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Box3 } from "../src/math/Box3";
import { Vector3 } from "../src/math/Vector3";
import { Mesh } from "../src/objects/Mesh";
import type { WebGLRenderer } from "../src/renderers/WebGLRenderer";

const renderer = { domElement: { clientHeight: 100, height: 100 }, xr: { enabled: false } } as unknown as WebGLRenderer;
const textures = [
  [
    { width: 512, height: 512 },
    { width: 256, height: 256 },
    { width: 128, height: 128 },
  ],
];
const lods = [{ densities: [100, 200] }, { density: 50 }, { density: 20 }];

function makeMesh(): Mesh {
  const geometry = new BufferGeometry();
  geometry.boundingBox = new Box3(new Vector3(-1, -1, 0), new Vector3(1, 1, 0));
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  mesh.updateMatrixWorld();
  return mesh;
}

test("projected coverage selects mesh density and texture resolution", () => {
  vi.stubGlobal("screen", { availHeight: 100 });
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  try {
    const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    camera.position.z = 5;
    camera.updateMatrixWorld();
    const mesh = makeMesh();
    assert.deepEqual(calculateProgressiveLOD(renderer, camera, mesh, lods, 0, textures, 150), {
      mesh_lod: 1,
      texture_lod: 1,
    });
    assert.deepEqual(calculateProgressiveLOD(renderer, camera, mesh, lods, 1, textures, 450), {
      mesh_lod: 0,
      texture_lod: 1,
    });
    mesh.scale.setScalar(0.5);
    mesh.updateMatrixWorld();
    assert.deepEqual(calculateProgressiveLOD(renderer, camera, mesh, lods, 0, textures, 150), {
      mesh_lod: 2,
      texture_lod: 2,
    });
    assert.deepEqual(calculateProgressiveLOD(renderer, camera, mesh, undefined, 0, [], 150), {
      mesh_lod: 0,
      texture_lod: 0,
    });
  } finally {
    vi.unstubAllGlobals();
  }
});

test("perspective near-plane intersection requests highest quality", () => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.updateMatrixWorld();
  const mesh = makeMesh();
  mesh.position.z = -0.05;
  mesh.updateMatrixWorld();
  assert.deepEqual(calculateProgressiveLOD(renderer, camera, mesh, lods, 0, textures, 150), {
    mesh_lod: 0,
    texture_lod: 0,
  });
});

test("unavailable density and missing bounds do not request a mesh level", () => {
  const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
  camera.updateMatrixWorld();
  const mesh = makeMesh();
  mesh.geometry.boundingBox = null;
  assert.equal(calculateProgressiveLOD(renderer, camera, mesh, lods, 0, [], 150).mesh_lod, -1);
});

test("texture selection aggregates slots and honors data saving", () => {
  vi.stubGlobal("screen", { availHeight: 100 });
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  vi.stubGlobal("navigator", { userAgent: "desktop", saveData: true });
  try {
    const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    camera.position.z = 5;
    camera.updateMatrixWorld();
    const mesh = makeMesh();
    const levels = [
      [
        { width: 4096, height: 4096 },
        { width: 1024, height: 1024 },
      ],
      [
        { width: 8192, height: 8192 },
        { width: 512, height: 512 },
      ],
    ];
    assert.deepEqual(calculateProgressiveLOD(renderer, camera, mesh, undefined, 0, levels, 150), {
      mesh_lod: 0,
      texture_lod: 1,
    });
    mesh.scale.setScalar(10);
    mesh.updateMatrixWorld();
    assert.deepEqual(calculateProgressiveLOD(renderer, camera, mesh, undefined, 0, levels, 150), {
      mesh_lod: 0,
      texture_lod: -1,
    });
  } finally {
    vi.unstubAllGlobals();
  }
});
