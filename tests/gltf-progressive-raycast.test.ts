import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { getRaycastMesh, registerRaycastMesh, useRaycastMeshes } from "../src/addons/loaders/GLTFProgressiveRaycast";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { Object3D } from "../src/core/Object3D";
import { Raycaster } from "../src/core/Raycaster";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Vector3 } from "../src/math/Vector3";
import { Mesh } from "../src/objects/Mesh";
import { SkinnedMesh } from "../src/objects/SkinnedMesh";

function triangle(z: number): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([-1, -1, z, 1, -1, z, 0, 1, z], 3));
  geometry.setIndex([0, 1, 2]);
  return geometry;
}

function raycastMethod(): typeof Mesh.prototype.raycast {
  return Object.getOwnPropertyDescriptor(Mesh.prototype, "raycast")!.value as typeof Mesh.prototype.raycast;
}

test("registration retains the first shallow proxy only for meshes", () => {
  const low = triangle(0);
  low.userData = { lods: [1] };
  const mesh = new Mesh(triangle(-1), new MeshBasicMaterial());
  const skinned = new SkinnedMesh(triangle(-1), new MeshBasicMaterial());
  const other = new Object3D();
  assert.equal(getRaycastMesh(mesh), null);
  registerRaycastMesh(other, low);
  assert.equal(getRaycastMesh(other), null);
  registerRaycastMesh(mesh, low);
  registerRaycastMesh(skinned, low);
  const proxy = getRaycastMesh(mesh);
  assert.ok(proxy);
  assert.notEqual(proxy, low);
  assert.equal(proxy.getAttribute("position"), low.getAttribute("position"));
  assert.equal(proxy.getIndex(), low.getIndex());
  assert.deepEqual(proxy.userData, { isRaycastMesh: true });
  assert.ok(getRaycastMesh(skinned));
  registerRaycastMesh(mesh, triangle(2));
  assert.equal(getRaycastMesh(mesh), proxy);
});

test("enabled raycasts use the proxy and disabling restores the original method", () => {
  const high = triangle(-1);
  const mesh = new Mesh(high, new MeshBasicMaterial());
  const plain = new Mesh(high, new MeshBasicMaterial());
  registerRaycastMesh(mesh, triangle(0));
  const raycaster = new Raycaster(new Vector3(0, 0, 2), new Vector3(0, 0, -1));
  const original = raycastMethod();
  try {
    assert.equal(raycaster.intersectObject(mesh)[0].distance, 3);
    useRaycastMeshes();
    const patched = raycastMethod();
    useRaycastMeshes();
    assert.equal(raycastMethod(), patched);
    const hit = raycaster.intersectObject(mesh)[0];
    assert.equal(hit.distance, 2);
    assert.equal(hit.object, mesh);
    assert.equal(mesh.geometry, high);
    assert.equal(raycaster.intersectObject(plain)[0].distance, 3);
    useRaycastMeshes(false);
    useRaycastMeshes(false);
    assert.equal(raycastMethod(), original);
    assert.equal(raycaster.intersectObject(mesh)[0].distance, 3);
  } finally {
    useRaycastMeshes(false);
  }
});

test("geometry is restored when the original raycast throws", () => {
  const original = raycastMethod();
  const high = triangle(-1);
  const mesh = new Mesh(high, new MeshBasicMaterial());
  registerRaycastMesh(mesh, triangle(0));
  Mesh.prototype.raycast = function () {
    assert.equal(this.geometry, getRaycastMesh(this));
    throw new Error("raycast failed");
  };
  try {
    useRaycastMeshes();
    assert.throws(() => mesh.raycast(new Raycaster(), []), /raycast failed/);
    assert.equal(mesh.geometry, high);
  } finally {
    useRaycastMeshes(false);
    Mesh.prototype.raycast = original;
  }
});
