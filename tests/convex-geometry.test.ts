import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { ConvexGeometry } from "../src/addons/geometries/ConvexGeometry";
import { ConvexHull, Face, VertexList, VertexNode } from "../src/addons/math/ConvexHull";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { GLBufferAttribute } from "../src/core/GLBufferAttribute";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Ray } from "../src/math/Ray";
import { Vector3 } from "../src/math/Vector3";
import { Mesh } from "../src/objects/Mesh";
import { Group } from "../src/objects/Group";

const cube = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => new Vector3(x, y, z))));

test("convex hull encloses a cube and intersects rays", () => {
  const hull = new ConvexHull().setFromPoints([...cube, new Vector3(0, 0, 0)]);
  assert.equal(hull.faces.length, 12);
  assert.ok(hull.containsPoint(new Vector3(0, 0, 0)));
  assert.ok(hull.containsPoint(new Vector3(1, 1, 1)));
  assert.equal(hull.containsPoint(new Vector3(2, 0, 0)), false);
  const target = new Vector3();
  assert.equal(hull.intersectRay(new Ray(new Vector3(3, 0, 0), new Vector3(-1, 0, 0)), target), target);
  assert.ok(target.distanceTo(new Vector3(1, 0, 0)) < 1e-8);
  assert.equal(hull.intersectsRay(new Ray(new Vector3(3, 0, 0), new Vector3(1, 0, 0))), false);
  for (const face of hull.faces) {
    let edge = face.edge;
    do {
      assert.equal(edge.twin.twin, edge);
      assert.ok(face.distanceToPoint(new Vector3()) <= hull.tolerance);
      edge = edge.next;
    } while (edge !== face.edge);
  }
  hull.makeEmpty();
  assert.equal(hull.faces.length, 0);
});

test("convex geometry emits triangle positions and outward flat normals", () => {
  const geometry = new ConvexGeometry(cube);
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  assert.ok(position instanceof BufferAttribute);
  assert.ok(normal instanceof BufferAttribute);
  assert.equal(position.count, 36);
  assert.equal(normal.count, position.count);
  for (let i = 0; i < position.count; i++) {
    const p = new Vector3().fromBufferAttribute(position, i);
    const n = new Vector3().fromBufferAttribute(normal, i);
    assert.ok(Math.abs(n.length() - 1) < 1e-6);
    assert.ok(Math.abs(p.dot(n) - 1) < 1e-6);
  }
  geometry.dispose();
});

test("object hull applies descendant world transforms", () => {
  const geometry = new BufferGeometry().setFromPoints(cube);
  const material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material);
  mesh.position.set(4, 0, 0);
  const group = new Group();
  group.position.set(2, 0, 0);
  group.add(mesh);
  const hull = new ConvexHull().setFromObject(group);
  assert.ok(hull.containsPoint(new Vector3(6, 0, 0)));
  assert.equal(hull.containsPoint(new Vector3(0, 0, 0)), false);
  geometry.dispose();
  material.dispose();
});

test("object hull rejects GPU-only positions", () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new GLBufferAttribute({}, 0, 3, 4, 4));
  const material = new MeshBasicMaterial();
  assert.throws(() => new ConvexHull().setFromObject(new Mesh(geometry, material)), /CPU-accessible/);
  geometry.dispose();
  material.dispose();
});

test("half edges and vertex lists preserve links", () => {
  const a = new VertexNode(new Vector3());
  const b = new VertexNode(new Vector3(1, 0, 0));
  const c = new VertexNode(new Vector3(0, 1, 0));
  const face = Face.create(a, b, c);
  assert.equal(face.getEdge(0).head(), a);
  assert.equal(face.getEdge(0).tail(), c);
  assert.equal(face.area, 0.5);
  const list = new VertexList();
  list.append(a).append(c).insertBefore(c, b);
  assert.equal(a.next, b);
  assert.equal(c.prev, b);
  list.remove(b);
  assert.equal(a.next, c);
  list.removeSubList(a, c);
  assert.ok(list.isEmpty());
});
