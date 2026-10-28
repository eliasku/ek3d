import { test, vi } from "vite-plus/test";
import assert from "node:assert/strict";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { InterleavedBuffer } from "../src/core/InterleavedBuffer";
import type { InterleavedBufferCloneData, InterleavedBufferSerializationData } from "../src/core/InterleavedBuffer";
import { InterleavedBufferAttribute } from "../src/core/InterleavedBufferAttribute";
import { InstancedBufferAttribute } from "../src/core/InstancedBufferAttribute";
import { InstancedInterleavedBuffer } from "../src/core/InstancedInterleavedBuffer";
import { InstancedBufferGeometry } from "../src/core/InstancedBufferGeometry";
import { Raycaster } from "../src/core/Raycaster";
import type { Intersection } from "../src/core/Raycaster";
import { Object3D } from "../src/core/Object3D";
import { Mesh } from "../src/objects/Mesh";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { OrthographicCamera } from "../src/cameras/OrthographicCamera";
import { Vector2 } from "../src/math/Vector2";
import { Vector3 } from "../src/math/Vector3";
import { Matrix4 } from "../src/math/Matrix4";
import { Box2 } from "../src/math/Box2";
import { Line3 } from "../src/math/Line3";
import { Matrix2 } from "../src/math/Matrix2";
import { Spherical } from "../src/math/Spherical";
import { Cylindrical } from "../src/math/Cylindrical";
import { DynamicDrawUsage } from "../src/constants";
import { InterleavedBuffer as UpstreamBuffer } from "../upstream/three.js/src/core/InterleavedBuffer.js";
import { InterleavedBufferAttribute as UpstreamAttribute } from "../upstream/three.js/src/core/InterleavedBufferAttribute.js";
import { Raycaster as UpstreamRaycaster } from "../upstream/three.js/src/core/Raycaster.js";
import { PerspectiveCamera as UpstreamPerspective } from "../upstream/three.js/src/cameras/PerspectiveCamera.js";
import { OrthographicCamera as UpstreamOrthographic } from "../upstream/three.js/src/cameras/OrthographicCamera.js";
import { Line3 as UpstreamLine } from "../upstream/three.js/src/math/Line3.js";
import { Spherical as UpstreamSpherical } from "../upstream/three.js/src/math/Spherical.js";
import { Cylindrical as UpstreamCylindrical } from "../upstream/three.js/src/math/Cylindrical.js";
import { Vector3 as UpstreamVector } from "../upstream/three.js/src/math/Vector3.js";
import { Scene } from "../src/scenes/Scene";
import { Fog } from "../src/scenes/Fog";
import { FogExp2 } from "../src/scenes/FogExp2";
import { Timer } from "../src/core/Timer";
import { Clock } from "../src/core/Clock";
import { Uniform } from "../src/core/Uniform";
import { UniformsGroup } from "../src/core/UniformsGroup";
import { ShaderMaterial } from "../src/materials/ShaderMaterial";
import { Fog as UpstreamFog } from "../upstream/three.js/src/scenes/Fog.js";
import { FogExp2 as UpstreamFogExp2 } from "../upstream/three.js/src/scenes/FogExp2.js";

test("typed core fields preserve readonly descriptors and inherited math flags", () => {
  const object = new Object3D();
  const attribute = new BufferAttribute(new Float32Array(3), 3);
  for (const value of [object, attribute, new BufferGeometry(), new UniformsGroup()]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, "id");
    assert.ok(descriptor);
    assert.equal(descriptor.enumerable, false);
    assert.equal(descriptor.configurable, false);
    assert.equal(descriptor.writable, false);
  }
  for (const key of ["position", "rotation", "quaternion", "scale"] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    assert.ok(descriptor);
    assert.equal(descriptor.enumerable, true);
    assert.equal(descriptor.configurable, true);
    assert.equal(descriptor.writable, false);
  }
  for (const key of ["modelViewMatrix", "normalMatrix"] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    assert.ok(descriptor);
    assert.equal(descriptor.enumerable, false);
    assert.equal(descriptor.configurable, false);
    assert.equal(descriptor.writable, false);
  }
  const vector = new Vector3();
  const matrix = new Matrix4();
  assert.equal(vector.isVector3, true);
  assert.equal(matrix.isMatrix4, true);
  assert.equal(Object.hasOwn(vector, "isVector3"), false);
  assert.equal(Object.hasOwn(matrix, "isMatrix4"), false);
  const originalQuaternion = object.quaternion.clone();
  object.rotation.x = 0.5;
  assert.equal(object.quaternion.equals(originalQuaternion), false);
});

test("base cloning preserves concrete subclass contracts", () => {
  class CustomObject extends Object3D {
    marker: string = "object";
  }
  class CustomGeometry extends BufferGeometry {
    marker: string = "geometry";
  }
  class CustomAttribute extends BufferAttribute {
    marker: string = "attribute";
  }
  const object: CustomObject = new CustomObject().clone();
  const geometry: CustomGeometry = new CustomGeometry().clone();
  const attribute: CustomAttribute = new CustomAttribute(new Float32Array([1, 2, 3]), 3).clone();
  assert.equal(object.marker, "object");
  assert.equal(geometry.marker, "geometry");
  assert.equal(attribute.marker, "attribute");
  assert.ok(object instanceof CustomObject);
  assert.ok(geometry instanceof CustomGeometry);
  assert.ok(attribute instanceof CustomAttribute);
});

test("normalized interleaved transforms preserve adjacent data and agree with upstream", () => {
  for (const ArrayType of [Int8Array, Uint8Array, Int16Array, Uint16Array]) {
    const actual = new InterleavedBuffer(new ArrayType(12), 6).setUsage(DynamicDrawUsage);
    const expected = new UpstreamBuffer(new ArrayType(12), 6).setUsage(DynamicDrawUsage);
    const position = new InterleavedBufferAttribute(actual, 3, 0, true);
    const reference = new UpstreamAttribute(expected, 3, 0, true);
    actual.array.set([9, 8, 7], 3);
    expected.array.set([9, 8, 7], 3);
    for (const attribute of [position, reference]) {
      attribute.setXYZ(0, -0.4, 0.2, 0.7);
      attribute.setXYZ(1, 0.1, 0.4, 0.8);
      attribute.applyMatrix4(new Matrix4().makeScale(0.5, 0.5, 0.5));
    }
    assert.deepEqual(actual.array, expected.array);
    assert.deepEqual(Array.from(actual.array.slice(3, 6)), [9, 8, 7]);
    assert.deepEqual(new Vector3().fromBufferAttribute(position, 1).toArray(), [
      reference.getX(1),
      reference.getY(1),
      reference.getZ(1),
    ]);
    actual.addUpdateRange(0, 3);
    actual.addUpdateRange(6, 3);
    position.needsUpdate = false;
    assert.equal(actual.version, 0);
    position.needsUpdate = true;
    assert.equal(actual.version, 1);
    assert.deepEqual(actual.updateRanges, [
      { start: 0, count: 3 },
      { start: 6, count: 3 },
    ]);
    actual.clearUpdateRanges();
    assert.deepEqual(actual.updateRanges, []);
  }
});

test("geometry clone and serialization retain shared interleaved buffers without sharing mutable source data", () => {
  const data = new InterleavedBuffer(new Float32Array([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1]), 6);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new InterleavedBufferAttribute(data, 3, 0));
  geometry.setAttribute("normal", new InterleavedBufferAttribute(data, 3, 3));
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
  const clone = geometry.clone();
  const position = clone.getAttribute("position");
  const normal = clone.getAttribute("normal");
  assert.ok(position instanceof InterleavedBufferAttribute && normal instanceof InterleavedBufferAttribute);
  assert.equal(position.data, normal.data);
  assert.notEqual(position.data, data);
  assert.notEqual(position.array.buffer, data.array.buffer);
  position.setX(0, 9);
  assert.equal(data.array[0], 0);
  assert.equal(normal.getZ(0), 1);
  assert.deepEqual(geometry.boundingBox!.min.toArray(), [0, 0, 0]);
  assert.deepEqual(geometry.boundingBox!.max.toArray(), [1, 1, 0]);
  const json = geometry.toJSON().data;
  assert.equal(json.attributes.position.data, json.attributes.normal.data);
  assert.deepEqual(Object.keys(json.interleavedBuffers), [data.uuid]);
  const serialized = json.interleavedBuffers[data.uuid];
  assert.deepEqual(new Float32Array(new Uint32Array(json.arrayBuffers[serialized.buffer]).buffer), data.array);
});

test("clone and serialization distinguish typed-array views while sharing identical ranges", () => {
  const storage = Float32Array.from({ length: 24 }, (_, i) => i + 1);
  const first = new InterleavedBuffer(new Float32Array(storage.buffer, 8, 6), 3);
  const same = new InterleavedBuffer(new Float32Array(storage.buffer, 8, 6), 3);
  const other = new InterleavedBuffer(new Float32Array(storage.buffer, 32, 6), 3);
  const clones: InterleavedBufferCloneData = {};
  const a = first.clone(clones);
  const b = same.clone(clones);
  const c = other.clone(clones);
  assert.equal(a.array.buffer, b.array.buffer);
  assert.notEqual(a.array.buffer, c.array.buffer);
  assert.deepEqual(Array.from(a.array), [3, 4, 5, 6, 7, 8]);
  assert.deepEqual(Array.from(c.array), [9, 10, 11, 12, 13, 14]);
  const copy = new InterleavedBuffer(new Float32Array(6), 3).copy(first);
  copy.copyAt(1, other, 0);
  assert.deepEqual(Array.from(copy.array), [3, 4, 5, 9, 10, 11]);
  assert.deepEqual(Array.from(first.array), [3, 4, 5, 6, 7, 8]);
  const metadata: InterleavedBufferSerializationData = {};
  const sa = first.toJSON(metadata);
  assert.equal(sa.buffer, same.toJSON(metadata).buffer);
  const sc = other.toJSON(metadata);
  assert.notEqual(sa.buffer, sc.buffer);
  assert.deepEqual(new Float32Array(new Uint32Array(metadata.arrayBuffers![sc.buffer]).buffer), other.array);
});

test("instanced copies retain divisors, instance counts and independent attribute storage", () => {
  const attribute = new InstancedBufferAttribute(new Uint8Array([255, 0, 127, 64]), 2, true, 2);
  const copied = attribute.clone();
  assert.equal(copied.meshPerAttribute, 2);
  assert.equal(copied.normalized, true);
  copied.setX(0, 0);
  assert.equal(attribute.getX(0), 1);
  assert.equal(attribute.toJSON().meshPerAttribute, 2);
  const data = new InstancedInterleavedBuffer(new Float32Array([1, 2, 3, 4]), 2, 3);
  const clone = data.clone({});
  assert.equal(clone.meshPerAttribute, 3);
  clone.array[0] = 9;
  assert.equal(data.array[0], 1);
  assert.equal(data.toJSON({}).meshPerAttribute, 3);
  const geometry = new InstancedBufferGeometry();
  geometry.instanceCount = 4;
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([0, 0, 0]), 3));
  geometry.setAttribute("offset", attribute);
  const geometryClone = geometry.clone();
  assert.equal(geometryClone.instanceCount, 4);
  assert.notEqual(geometryClone.getAttribute("offset"), attribute);
  assert.equal(geometry.toJSON().instanceCount, 4);
});

test("raycasting sorts hits, honors inclusive clipping and layers, and preserves traversal controls", () => {
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial();
  const near = new Mesh(geometry, material);
  const far = new Mesh(geometry, material);
  near.position.z = -3;
  far.position.z = -7;
  const root = new Object3D().add(far, near);
  root.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(0.12, 0.23, 0), new Vector3(0, 0, -1));
  assert.deepEqual(
    ray.intersectObject(root).map((hit) => hit.distance),
    [2.5, 6.5],
  );
  assert.deepEqual(ray.intersectObject(root, false), []);
  const target: Intersection[] = [{ object: root, point: new Vector3(0, 0, -99), distance: 99 }];
  assert.equal(ray.intersectObjects([far, near], false, target), target);
  assert.deepEqual(
    target.map((hit) => hit.distance),
    [2.5, 6.5, 99],
  );
  ray.near = ray.far = 2.5;
  assert.deepEqual(
    ray.intersectObject(root).map((hit) => hit.object),
    [near],
  );
  ray.near = 2.5 + 1e-6;
  ray.far = 6.5 - 1e-6;
  assert.deepEqual(ray.intersectObject(root), []);
  ray.near = 0;
  ray.far = Infinity;
  near.layers.set(1);
  ray.layers.set(1);
  assert.deepEqual(
    ray.intersectObject(root).map((hit) => hit.object),
    [near],
  );
  ray.layers.set(0);
  root.raycast = () => false;
  assert.deepEqual(ray.intersectObject(root), []);
  assert.deepEqual(
    ray.intersectObject(far).map((hit) => hit.object),
    [far],
  );
});

test("camera rays match upstream with zoom, view offsets and normal or reversed depth", () => {
  for (const reversed of [false, true]) {
    for (const [camera, upstream] of [
      [new PerspectiveCamera(57, 1.5, 0.3, 100), new UpstreamPerspective(57, 1.5, 0.3, 100)],
      [new OrthographicCamera(-4, 5, 3, -2, 0.3, 100), new UpstreamOrthographic(-4, 5, 3, -2, 0.3, 100)],
    ] as const) {
      for (const current of [camera, upstream]) {
        current._reversedDepth = reversed;
        current.zoom = 1.4;
        const position: unknown = Reflect.get(current, "position");
        assert.ok(position instanceof Vector3 || position instanceof UpstreamVector);
        position.set(3, 4, 5);
        current.lookAt(0, 0, 0);
        current.setViewOffset(1200, 800, 100, 150, 600, 400);
        current.updateProjectionMatrix();
        current.updateMatrixWorld(true);
      }
      for (const coords of [new Vector2(0, 0), new Vector2(-0.8, 0.6), new Vector2(1, -1)]) {
        const actual = new Raycaster();
        const expected = new UpstreamRaycaster(new UpstreamVector(), new UpstreamVector(0, 0, -1));
        actual.setFromCamera(coords, camera);
        expected.setFromCamera(coords, upstream);
        assert.equal(actual.camera, camera);
        assert.deepEqual(actual.ray.origin.toArray(), expected.ray.origin.toArray());
        assert.deepEqual(actual.ray.direction.toArray(), expected.ray.direction.toArray());
      }
    }
  }
});

test("line segment distances preserve upstream degenerate, parallel and crossing cases", () => {
  for (const [a, b, c, d] of [
    [
      [0, 0, 0],
      [0, 0, 0],
      [1, 2, 3],
      [1, 2, 3],
    ],
    [
      [0, 0, 0],
      [0, 0, 0],
      [-2, 1, 0],
      [2, 1, 0],
    ],
    [
      [-2, 0, 0],
      [2, 0, 0],
      [-2, 1, 0],
      [2, 1, 0],
    ],
    [
      [-2, 0, 0],
      [2, 0, 0],
      [0, -2, 0],
      [0, 2, 0],
    ],
  ]) {
    const actual = new Line3(new Vector3().fromArray(a), new Vector3().fromArray(b));
    const expected = new UpstreamLine(new UpstreamVector().fromArray(a), new UpstreamVector().fromArray(b));
    const p = new Vector3(),
      q = new Vector3(),
      up = new UpstreamVector(),
      uq = new UpstreamVector();
    assert.equal(
      actual.distanceSqToLine3(new Line3(new Vector3().fromArray(c), new Vector3().fromArray(d)), p, q),
      expected.distanceSqToLine3(
        new UpstreamLine(new UpstreamVector().fromArray(c), new UpstreamVector().fromArray(d)),
        up,
        uq,
      ),
    );
    assert.deepEqual(p.toArray(), up.toArray());
    assert.deepEqual(q.toArray(), uq.toArray());
  }
});

test("2D bounds, matrix ordering and spherical conversions retain boundary behavior", () => {
  const box = new Box2().setFromPoints([new Vector2(-2, 3), new Vector2(4, -5)]);
  assert.deepEqual(box.getSize(new Vector2()).toArray(), [6, 8]);
  assert.equal(box.containsPoint(new Vector2(4, 3)), true);
  assert.equal(box.containsPoint(new Vector2(4.001, 3)), false);
  assert.equal(
    box
      .clone()
      .intersect(new Box2(new Vector2(10, 10), new Vector2(20, 20)))
      .isEmpty(),
    true,
  );
  assert.deepEqual(new Matrix2(1, 2, 3, 4).elements, [1, 3, 2, 4]);
  assert.deepEqual(new Matrix2().fromArray([99, 1, 3, 2, 4], 1).elements, [1, 3, 2, 4]);
  for (const [x, y, z] of [
    [0, 0, 0],
    [0, 2, 0],
    [0, -2, 0],
    [-3, 4, -5],
  ]) {
    const spherical = new Spherical().setFromCartesianCoords(x, y, z).makeSafe();
    const expected = new UpstreamSpherical().setFromCartesianCoords(x, y, z).makeSafe();
    assert.deepEqual(
      [spherical.radius, spherical.phi, spherical.theta],
      [expected.radius, expected.phi, expected.theta],
    );
    assert.deepEqual(
      new Vector3().setFromSpherical(spherical).toArray(),
      new UpstreamVector().setFromSpherical(expected).toArray(),
    );
    const cylindrical = new Cylindrical().setFromCartesianCoords(x, y, z);
    const reference = new UpstreamCylindrical().setFromCartesianCoords(x, y, z);
    assert.deepEqual(
      new Vector3().setFromCylindrical(cylindrical).toArray(),
      new UpstreamVector().setFromCylindrical(reference).toArray(),
    );
  }
});

test("fog serialization and scene cloning preserve values without sharing colors", () => {
  for (const [fog, expected] of [
    [new Fog("steelblue", 2, 19), new UpstreamFog(0x4682b4, 2, 19)],
    [new FogExp2(0x456789, 0.03), new UpstreamFogExp2(0x456789, 0.03)],
  ] as const) {
    fog.name = expected.name = "distance";
    assert.deepEqual(fog.toJSON(), expected.toJSON());
    const scene = new Scene();
    scene.fog = fog;
    assert.deepEqual(scene.toJSON().object.fog, expected.toJSON());
    const clone = scene.clone().fog!;
    assert.deepEqual(clone.toJSON(), expected.clone().toJSON());
    assert.notEqual(clone.color, fog.color);
    clone.color.set(0xff0000);
    assert.equal(fog.color.getHex(), expected.color.getHex());
    scene.fog = null;
    assert.equal(scene.clone().fog, null);
    assert.equal(scene.toJSON().object.fog, undefined);
  }
});

test("timer queries are stable per step and visibility, scaling and disconnect retain elapsed time", () => {
  let now = 1000;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  const document = Object.assign(new EventTarget(), { hidden: false });
  const timer = new Timer();
  try {
    timer.connect(document as unknown as Document);
    timer.update(1100);
    assert.equal(timer.getDelta(), 0.1);
    assert.equal(timer.getDelta(), 0.1);
    assert.equal(timer.getElapsed(), 0.1);
    timer.setTimescale(2).update(1150);
    assert.equal(timer.getDelta(), 0.1);
    assert.equal(timer.getElapsed(), 0.2);
    timer.setTimescale(0).update(1200);
    assert.equal(timer.getDelta(), 0);
    assert.equal(timer.getElapsed(), 0.2);
    document.hidden = true;
    timer.setTimescale(1).update(5000);
    assert.equal(timer.getDelta(), 0);
    assert.equal(timer.getElapsed(), 0.2);
    now = 5000;
    document.hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    timer.update(5050);
    assert.equal(timer.getDelta(), 0.05);
    assert.equal(timer.getElapsed(), 0.25);
    timer.dispose();
    now = 6000;
    document.dispatchEvent(new Event("visibilitychange"));
    timer.update();
    assert.equal(timer.getDelta(), 0.95, "Disposed timer must not reset on visibility events");
    now = 7000;
    timer.reset();
    timer.update(7010);
    assert.equal(timer.getDelta(), 0.01);
  } finally {
    timer.dispose();
    clock.mockRestore();
  }
});

test("clock auto-start, stop and restart preserve seconds and reset accumulated time", () => {
  let now = 1000;
  const time = vi.spyOn(performance, "now").mockImplementation(() => now);
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const clock = new Clock();
    assert.equal(clock.getDelta(), 0);
    now += 250;
    assert.equal(clock.getDelta(), 0.25);
    now += 250;
    clock.stop();
    assert.equal(clock.getElapsedTime(), 0.5);
    now += 1000;
    assert.equal(clock.getDelta(), 0);
    clock.start();
    now += 125;
    assert.equal(clock.getElapsedTime(), 0.125);
    const manual = new Clock(false);
    assert.equal(manual.getDelta(), 0);
    manual.start();
    now += 50;
    assert.equal(manual.getDelta(), 0.05);
  } finally {
    warning.mockRestore();
    time.mockRestore();
  }
});

test("uniform and group clones preserve upstream value ownership through shader material copies", () => {
  const vector = new Uniform(new Vector3(1, 2, 3));
  const array = new Uniform([1, 2]);
  const scalar = new Uniform(0.5);
  const elements = [new Uniform(new Vector3(4, 5, 6)), new Uniform(new Vector3(7, 8, 9))];
  const group = new UniformsGroup().setName("Shared").setUsage(DynamicDrawUsage);
  group.add(vector).add(array).add(scalar).add(elements);
  const material = new ShaderMaterial({ uniformsGroups: [group], uniforms: { amount: scalar } });
  const clone = material.clone();
  const copiedGroup = clone.uniformsGroups[0];
  const copiedVector = copiedGroup.uniforms[0] as Uniform<Vector3>;
  const copiedArray = copiedGroup.uniforms[1] as Uniform<number[]>;
  const copiedElements = copiedGroup.uniforms[3] as Uniform<Vector3>[];
  assert.notEqual(copiedGroup.id, group.id);
  assert.equal(copiedGroup.name, "Shared");
  assert.equal(copiedGroup.usage, DynamicDrawUsage);
  copiedVector.value.x = 10;
  copiedElements[0].value.y = 20;
  assert.deepEqual(vector.value.toArray(), [1, 2, 3]);
  assert.deepEqual(elements[0].value.toArray(), [4, 5, 6]);
  assert.equal(copiedArray.value, array.value, "Uniform.clone only deep-clones values with clone()");
  scalar.value = 0.8;
  assert.equal(clone.uniforms.amount.value, 0.5);
  group.remove(scalar).remove(scalar);
  assert.deepEqual(group.uniforms, [vector, array, elements]);
  let disposed = 0;
  group.addEventListener("dispose", () => disposed++);
  copiedGroup.dispose();
  assert.equal(disposed, 0);
  group.dispose();
  assert.equal(disposed, 1);
  material.dispose();
  clone.dispose();
});
