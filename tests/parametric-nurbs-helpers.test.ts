import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { NURBSSurface } from "../src/addons/curves/NURBSSurface";
import { NURBSVolume } from "../src/addons/curves/NURBSVolume";
import { ParametricGeometry } from "../src/addons/geometries/ParametricGeometry";
import { plane } from "../src/addons/geometries/ParametricFunctions";
import { VertexNormalsHelper } from "../src/addons/helpers/VertexNormalsHelper";
import { VertexTangentsHelper } from "../src/addons/helpers/VertexTangentsHelper";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Vector3 } from "../src/math/Vector3";
import { Vector4 } from "../src/math/Vector4";
import { Mesh } from "../src/objects/Mesh";

function near(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} != ${expected}`);
}

test("parametric geometry evaluates positions and finite-difference normals", () => {
  const geometry = new ParametricGeometry(plane, 2, 2);
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  assert.ok(position instanceof Float32BufferAttribute);
  assert.ok(normal instanceof Float32BufferAttribute);
  near(position.getX(4), 0.5);
  near(position.getY(4), 0);
  near(position.getZ(4), 0.5);
  near(normal.getX(4), 0);
  near(normal.getY(4), -1);
  near(normal.getZ(4), 0);
  geometry.dispose();
});

test("NURBS surfaces and volumes evaluate normalized coordinates over knot ranges", () => {
  const knots = [2, 2, 4, 4];
  const surfacePoints = [
    [new Vector4(0, 0, 0, 1), new Vector4(0, 2, 0, 1)],
    [new Vector4(4, 0, 0, 1), new Vector4(4, 2, 0, 1)],
  ];
  const surface = new NURBSSurface(1, 1, knots, knots, surfacePoints);
  const target = new Vector3();
  surface.getPoint(0.25, 0.5, target);
  near(target.x, 1);
  near(target.y, 1);
  near(target.z, 0);
  const points = surfacePoints.map((row) => row.map((point) => [point, new Vector4(point.x, point.y, 8, 1)]));
  const volume = new NURBSVolume(1, 1, 1, knots, knots, knots, points);
  volume.getPoint(0.25, 0.5, 0.75, target);
  near(target.x, 1);
  near(target.y, 1);
  near(target.z, 6);
});

test("vertex helpers update transformed vectors and release their resources", () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([1, 0, 0], 3));
  geometry.setAttribute("normal", new Float32BufferAttribute([0, 0, 1], 3));
  geometry.setAttribute("tangent", new Float32BufferAttribute([1, 0, 0, 1], 4));
  const material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material);
  const normals = new VertexNormalsHelper(mesh, 2);
  const tangents = new VertexTangentsHelper(mesh, 2);
  mesh.position.set(5, 6, 7);
  mesh.scale.set(2, 3, 4);
  mesh.rotation.z = Math.PI / 2;
  normals.update();
  tangents.update();
  const normalPosition = normals.geometry.getAttribute("position");
  const tangentPosition = tangents.geometry.getAttribute("position");
  assert.ok(normalPosition instanceof Float32BufferAttribute);
  assert.ok(tangentPosition instanceof Float32BufferAttribute);
  for (const attribute of [normalPosition, tangentPosition]) {
    near(attribute.getX(0), 5);
    near(attribute.getY(0), 8);
    near(attribute.getZ(0), 7);
  }
  near(normalPosition.getX(1), 5);
  near(normalPosition.getY(1), 8);
  near(normalPosition.getZ(1), 9);
  near(tangentPosition.getX(1), 5);
  near(tangentPosition.getY(1), 10);
  near(tangentPosition.getZ(1), 7);
  for (const helper of [normals, tangents]) {
    let disposedGeometry = false;
    let disposedMaterial = false;
    helper.geometry.addEventListener("dispose", () => {
      disposedGeometry = true;
    });
    helper.material.addEventListener("dispose", () => {
      disposedMaterial = true;
    });
    helper.dispose();
    assert.ok(disposedGeometry && disposedMaterial);
  }
  geometry.dispose();
  material.dispose();
});
