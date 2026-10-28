import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { ArrowHelper } from "../src/helpers/ArrowHelper";
import { AxesHelper } from "../src/helpers/AxesHelper";
import { Box3Helper } from "../src/helpers/Box3Helper";
import { BoxHelper } from "../src/helpers/BoxHelper";
import { CameraHelper } from "../src/helpers/CameraHelper";
import { DirectionalLightHelper } from "../src/helpers/DirectionalLightHelper";
import { GridHelper } from "../src/helpers/GridHelper";
import { HemisphereLightHelper } from "../src/helpers/HemisphereLightHelper";
import { PlaneHelper } from "../src/helpers/PlaneHelper";
import { PointLightHelper } from "../src/helpers/PointLightHelper";
import { PolarGridHelper } from "../src/helpers/PolarGridHelper";
import { SkeletonHelper } from "../src/helpers/SkeletonHelper";
import { SpotLightHelper } from "../src/helpers/SpotLightHelper";
import { ArrowHelper as UpArrow } from "../upstream/three.js/src/helpers/ArrowHelper.js";
import { AxesHelper as UpAxes } from "../upstream/three.js/src/helpers/AxesHelper.js";
import { Box3Helper as UpBox3 } from "../upstream/three.js/src/helpers/Box3Helper.js";
import { BoxHelper as UpBox } from "../upstream/three.js/src/helpers/BoxHelper.js";
import { CameraHelper as UpCamera } from "../upstream/three.js/src/helpers/CameraHelper.js";
import { DirectionalLightHelper as UpDirectional } from "../upstream/three.js/src/helpers/DirectionalLightHelper.js";
import { GridHelper as UpGrid } from "../upstream/three.js/src/helpers/GridHelper.js";
import { HemisphereLightHelper as UpHemisphere } from "../upstream/three.js/src/helpers/HemisphereLightHelper.js";
import { PlaneHelper as UpPlane } from "../upstream/three.js/src/helpers/PlaneHelper.js";
import { PointLightHelper as UpPoint } from "../upstream/three.js/src/helpers/PointLightHelper.js";
import { PolarGridHelper as UpPolar } from "../upstream/three.js/src/helpers/PolarGridHelper.js";
import { SkeletonHelper as UpSkeleton } from "../upstream/three.js/src/helpers/SkeletonHelper.js";
import { SpotLightHelper as UpSpot } from "../upstream/three.js/src/helpers/SpotLightHelper.js";
import { Object3D } from "../src/core/Object3D";
import { BufferGeometry } from "../src/core/BufferGeometry";
import type { BufferAttribute } from "../src/core/BufferAttribute";
import { Mesh } from "../src/objects/Mesh";
import { Bone } from "../src/objects/Bone";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { LineBasicMaterial } from "../src/materials/LineBasicMaterial";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { OrthographicCamera } from "../src/cameras/OrthographicCamera";
import { DirectionalLight } from "../src/lights/DirectionalLight";
import { HemisphereLight } from "../src/lights/HemisphereLight";
import { PointLight } from "../src/lights/PointLight";
import { SpotLight } from "../src/lights/SpotLight";
import { Box3 } from "../src/math/Box3";
import { Plane } from "../src/math/Plane";
import { Vector3 } from "../src/math/Vector3";
import { Color } from "../src/math/Color";

function snapshot(object: Object3D): unknown {
  const drawable = object as Object3D & { geometry?: BufferGeometry; material?: LineBasicMaterial | MeshBasicMaterial };
  const geometry = drawable.geometry;
  const material = drawable.material;
  return {
    type: object.type,
    position: object.position.toArray(),
    quaternion: object.quaternion.toArray(),
    scale: object.scale.toArray(),
    matrix: object.matrix.elements,
    matrixWorld: object.matrixWorld.elements,
    matrixAutoUpdate: object.matrixAutoUpdate,
    visible: object.visible,
    attributes:
      geometry &&
      Object.fromEntries(
        Object.entries(geometry.attributes as Record<string, BufferAttribute>).map(([name, attribute]) => [
          name,
          { itemSize: attribute.itemSize, array: Array.from(attribute.array) },
        ]),
      ),
    index: geometry?.index && Array.from(geometry.index.array),
    material: material && {
      type: material.type,
      color: material.color.toArray(),
      vertexColors: material.vertexColors,
      toneMapped: material.toneMapped,
      depthTest: material.depthTest,
      depthWrite: material.depthWrite,
      transparent: material.transparent,
      opacity: material.opacity,
      fog: material.fog,
    },
    children: object.children.map(snapshot),
  };
}

function parity(actual: Object3D, expected: Object3D) {
  actual.updateMatrixWorld(true);
  expected.updateMatrixWorld(true);
  assert.deepEqual(snapshot(actual), snapshot(expected));
}

function disposalEvents(helper: Object3D & { dispose(): void }) {
  const resources = new Set<BufferGeometry | LineBasicMaterial | MeshBasicMaterial>();
  helper.traverse((object) => {
    const drawable = object as Object3D & {
      geometry?: BufferGeometry;
      material?: LineBasicMaterial | MeshBasicMaterial;
    };
    if (drawable.geometry) resources.add(drawable.geometry);
    if (drawable.material) resources.add(drawable.material);
  });
  const counts = [...resources].map((resource) => {
    const count = { value: 0 };
    resource.addEventListener("dispose", () => count.value++);
    return count;
  });
  helper.dispose();
  assert.ok(counts.length > 0 && counts.every((count) => count.value > 0));
  return counts.map((count) => count.value);
}

test("axes, Cartesian and polar grids preserve upstream topology, colors and disposal", () => {
  for (const [actual, upstream] of [
    [new AxesHelper(2.5), new UpAxes(2.5)],
    [new GridHelper(7, 5, 0xff3322, 0x2288ff), new UpGrid(7, 5, 0xff3322, 0x2288ff)],
    [new PolarGridHelper(4, 7, 3, 19, 0xff3322, 0x2288ff), new UpPolar(4, 7, 3, 19, 0xff3322, 0x2288ff)],
    [new PolarGridHelper(2, 0, 2, 8), new UpPolar(2, 0, 2, 8)],
  ] as const) {
    const expected = upstream as unknown as typeof actual;
    parity(actual, expected);
    const clone = actual.clone();
    const upstreamClone = expected.clone();
    parity(clone, upstreamClone);
    assert.equal(clone.geometry, actual.geometry);
    assert.equal(clone.material, actual.material);
    clone.dispose();
    upstreamClone.dispose();
    assert.deepEqual(disposalEvents(actual), disposalEvents(expected));
  }
  const actual = new AxesHelper();
  const expected = new UpAxes() as unknown as AxesHelper;
  actual.setColors("red", new Color("green"), 0x0000ff);
  expected.setColors("red", new Color("green"), 0x0000ff);
  parity(actual, expected);
  assert.ok((actual.geometry.getAttribute("color") as BufferAttribute).version > 0);
  actual.dispose();
  expected.dispose();
});

test("arrow directions, short lengths, colors, copy and shared geometry match upstream", () => {
  const actual = new ArrowHelper();
  const expected = new UpArrow() as unknown as ArrowHelper;
  for (const direction of [new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(2, 3, -4).normalize()]) {
    actual.setDirection(direction);
    expected.setDirection(direction);
    for (const [length, head, width] of [
      [3, 0.8, 0.4],
      [0, 0.5, 0.2],
      [1, 2, 0.7],
    ]) {
      actual.setLength(length, head, width);
      expected.setLength(length, head, width);
      actual.setColor("hotpink");
      expected.setColor("hotpink");
      parity(actual, expected);
      assert.ok(actual.line.scale.y > 0);
    }
  }
  const copy = new ArrowHelper().copy(actual);
  const upstreamCopy = new UpArrow().copy(expected) as unknown as ArrowHelper;
  parity(copy, upstreamCopy);
  assert.equal(copy.line.geometry, actual.line.geometry);
  assert.equal(copy.line.material, actual.line.material);
  const sibling = new ArrowHelper();
  assert.equal(sibling.cone.geometry, actual.cone.geometry);
  assert.notEqual(sibling.cone.material, actual.cone.material);
  assert.deepEqual(disposalEvents(actual), disposalEvents(expected));
  copy.dispose();
  upstreamCopy.dispose();
  sibling.dispose();
});

test("object bounds track transformed descendants and explicit bounds retain empty-box behavior", () => {
  const root = new Object3D();
  const material = new MeshBasicMaterial();
  const mesh = new Mesh(new BoxGeometry(2, 3, 4), material);
  root.add(mesh);
  root.position.set(2, -1, 3);
  root.rotation.y = 0.4;
  mesh.position.set(-1, 2, 1);
  mesh.scale.set(0.5, 2, 1);
  root.updateMatrixWorld(true);
  const actual = new BoxHelper(root);
  const expected = new UpBox(root) as unknown as BoxHelper;
  parity(actual, expected);
  mesh.position.x = 4;
  actual.update();
  expected.update();
  parity(actual, expected);
  assert.equal(actual.setFromObject(mesh), actual);
  expected.setFromObject(mesh);
  parity(actual, expected);
  const box = new Box3(new Vector3(-2, -1, 0), new Vector3(4, 3, 8));
  const explicit = new Box3Helper(box);
  const upstreamExplicit = new UpBox3(box) as unknown as Box3Helper;
  parity(explicit, upstreamExplicit);
  box.makeEmpty();
  parity(explicit, upstreamExplicit);
  assert.deepEqual(disposalEvents(actual), disposalEvents(expected));
  assert.deepEqual(disposalEvents(explicit), disposalEvents(upstreamExplicit));
  mesh.geometry.dispose();
  material.dispose();
});

test("camera helper follows perspective/orthographic projection, reversed depth and custom colors", () => {
  for (const camera of [new PerspectiveCamera(53, 1.4, 0.3, 13), new OrthographicCamera(-3, 2, 4, -1, 0.2, 17)]) {
    const actual = new CameraHelper(camera);
    const expected = new (UpCamera as unknown as typeof CameraHelper)(camera);
    assert.equal(actual.matrix, camera.matrixWorld);
    assert.deepEqual(actual.pointMap, expected.pointMap);
    for (const reversed of [false, true]) {
      camera._reversedDepth = reversed;
      camera.zoom = 1.7;
      camera.position.set(2, 3, 4);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      actual.update();
      expected.update();
      parity(actual, expected);
      const colors = [
        new Color("red"),
        new Color("blue"),
        new Color("green"),
        new Color("white"),
        new Color("yellow"),
      ] as const;
      assert.equal(actual.setColors(...colors), actual);
      expected.setColors(...colors);
      parity(actual, expected);
    }
    camera._reversedDepth = false;
    camera.coordinateSystem = -1;
    assert.throws(() => actual.update(), /Invalid coordinate system/);
    assert.throws(() => expected.update(), /Invalid coordinate system/);
    assert.deepEqual(disposalEvents(actual), disposalEvents(expected));
  }
});

test("light helpers follow target, distance, source colors, overrides and parent transforms", () => {
  const directional = new DirectionalLight(0x8844cc);
  const point = new PointLight(0x3388ff);
  const hemisphere = new HemisphereLight(0x88ccff, 0x332211);
  const spot = new SpotLight(0xff8833, 2, 5, Math.PI / 7);
  for (const [actual, upstream, light] of [
    [new DirectionalLightHelper(directional, 0.7), new UpDirectional(directional, 0.7), directional],
    [new PointLightHelper(point, 0.5), new UpPoint(point, 0.5), point],
    [new HemisphereLightHelper(hemisphere, 0.8), new UpHemisphere(hemisphere, 0.8), hemisphere],
    [new SpotLightHelper(spot), new UpSpot(spot), spot],
  ] as const) {
    const expected = upstream as unknown as typeof actual;
    const parent = new Object3D();
    const upstreamParent = new Object3D();
    parent.position.set(1, -2, 3);
    upstreamParent.position.copy(parent.position);
    parent.add(actual);
    upstreamParent.add(expected);
    for (const override of [undefined, "red", new Color(0x44cc88)]) {
      light.position.set(2, 3, -1);
      light.color.setHex(0x123456);
      directional.target.position.set(-2, 1, 3);
      spot.target.position.set(-1, 2, -4);
      spot.distance = override === undefined ? 0 : 7;
      spot.angle = Math.PI / 8;
      hemisphere.groundColor.setHex(0xff00ff);
      actual.color = expected.color = override;
      actual.update();
      expected.update();
      parent.updateMatrixWorld(true);
      upstreamParent.updateMatrixWorld(true);
      parity(actual, expected);
    }
    assert.deepEqual(disposalEvents(actual), disposalEvents(expected));
  }
});

test("plane normal, constant and size update the translucent fill with upstream ownership", () => {
  const plane = new Plane(new Vector3(1, 2, -3).normalize(), -2);
  const actual = new PlaneHelper(plane, 3, 0x3366ff);
  const expected = new UpPlane(plane, 3, 0x3366ff) as unknown as PlaneHelper;
  parity(actual, expected);
  plane.normal.set(0, 1, 0);
  plane.constant = 4;
  actual.size = expected.size = 6;
  parity(actual, expected);
  assert.deepEqual(disposalEvents(actual), disposalEvents(expected));
});

test("skeleton helpers extract only bones and update animated endpoints in root coordinates", () => {
  const root = new Object3D();
  const first = new Bone();
  const second = new Bone();
  const third = new Bone();
  root.add(first, new Object3D());
  first.add(second);
  second.add(third);
  second.position.y = 2;
  third.position.set(1, 1, 0);
  root.position.set(4, -3, 2);
  root.rotation.z = 0.4;
  const actual = new SkeletonHelper(root);
  const expected = new UpSkeleton(root) as unknown as SkeletonHelper;
  assert.deepEqual(actual.bones, [first, second, third]);
  assert.equal(actual.root, root);
  assert.equal(actual.matrix, root.matrixWorld);
  for (const angle of [0, 0.3, -0.8]) {
    first.rotation.z = angle;
    second.rotation.x = angle / 2;
    root.updateMatrixWorld(true);
    parity(actual, expected);
    assert.equal(actual.geometry.getAttribute("position")!.count, 4);
  }
  const c1 = new Color("red");
  const c2 = new Color("yellow");
  assert.equal(actual.setColors(c1, c2), actual);
  expected.setColors(c1, c2);
  parity(actual, expected);
  assert.deepEqual(disposalEvents(actual), disposalEvents(expected));
  const empty = new SkeletonHelper(new Object3D());
  assert.equal(empty.geometry.getAttribute("position")!.count, 0);
  empty.dispose();
});
