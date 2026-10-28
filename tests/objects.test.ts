import { test, vi } from "vite-plus/test";
import assert from "node:assert/strict";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";
import { Raycaster } from "../src/core/Raycaster";
import type { Intersection } from "../src/core/Raycaster";
import { Object3D } from "../src/core/Object3D";
import { Line } from "../src/objects/Line";
import { LineLoop } from "../src/objects/LineLoop";
import { LineSegments } from "../src/objects/LineSegments";
import { Points } from "../src/objects/Points";
import { Sprite } from "../src/objects/Sprite";
import { LineBasicMaterial } from "../src/materials/LineBasicMaterial";
import { LineDashedMaterial } from "../src/materials/LineDashedMaterial";
import { PointsMaterial } from "../src/materials/PointsMaterial";
import { SpriteMaterial } from "../src/materials/SpriteMaterial";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { OrthographicCamera } from "../src/cameras/OrthographicCamera";
import { ArrayCamera } from "../src/cameras/ArrayCamera";
import { CubeCamera } from "../src/cameras/CubeCamera";
import { WebGLCubeRenderTarget } from "../src/renderers/WebGLCubeRenderTarget";
import { LOD } from "../src/objects/LOD";
import { Mesh } from "../src/objects/Mesh";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { AxesHelper } from "../src/helpers/AxesHelper";
import { SkeletonHelper } from "../src/helpers/SkeletonHelper";
import { Vector2 } from "../src/math/Vector2";
import { Vector3 } from "../src/math/Vector3";
import { Frustum } from "../src/math/Frustum";
import { Matrix4 } from "../src/math/Matrix4";
import { Texture } from "../src/textures/Texture";
import { Line as UpstreamLine } from "../upstream/three.js/src/objects/Line.js";
import { LineLoop as UpstreamLoop } from "../upstream/three.js/src/objects/LineLoop.js";
import { LineSegments as UpstreamSegments } from "../upstream/three.js/src/objects/LineSegments.js";
import { Points as UpstreamPoints } from "../upstream/three.js/src/objects/Points.js";
import { Sprite as UpstreamSprite } from "../upstream/three.js/src/objects/Sprite.js";
import { LineBasicMaterial as UpstreamBasic } from "../upstream/three.js/src/materials/LineBasicMaterial.js";
import { LineDashedMaterial as UpstreamDashed } from "../upstream/three.js/src/materials/LineDashedMaterial.js";
import { PointsMaterial as UpstreamPointsMaterial } from "../upstream/three.js/src/materials/PointsMaterial.js";
import { SpriteMaterial as UpstreamSpriteMaterial } from "../upstream/three.js/src/materials/SpriteMaterial.js";
import { BufferGeometry as UpstreamGeometry } from "../upstream/three.js/src/core/BufferGeometry.js";
import { Float32BufferAttribute as UpstreamAttribute } from "../upstream/three.js/src/core/BufferAttribute.js";

const modes = [
  [Line, UpstreamLine],
  [LineLoop, UpstreamLoop],
  [LineSegments, UpstreamSegments],
] as const;
function geometry(values: number[], indexed = false) {
  const result = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(values, 3));
  if (indexed) result.setIndex([3, 2, 1, 0]);
  return result;
}
function upstreamGeometry(values: number[], indexed = false) {
  const result = new UpstreamGeometry().setAttribute("position", new UpstreamAttribute(values, 3));
  if (indexed) result.setIndex([3, 2, 1, 0]);
  return result;
}
function upstreamHits(object: Pick<Line, "raycast">, ray: Raycaster) {
  const hits: Intersection[] = [];
  object.raycast(ray, hits);
  return snapshot(hits.sort((a, b) => a.distance - b.distance));
}
function snapshot(hits: Intersection[]) {
  return hits.map((hit) => ({
    distance: hit.distance,
    distanceToRay: hit.distanceToRay,
    index: hit.index,
    point: hit.point.toArray(),
    uv: hit.uv?.toArray(),
    face: hit.face,
    faceIndex: hit.faceIndex,
  }));
}
function rayAt(x: number, y: number) {
  const ray = new Raycaster(new Vector3(x, y, 5), new Vector3(0, 0, -1));
  ray.params.Line.threshold = 0.05;
  ray.params.Points.threshold = 0.05;
  return ray;
}

test("line modes retain indexed/unindexed topology, draw ranges and closing-edge picking", () => {
  const square = [0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0];
  for (const [Actual, Expected] of modes) {
    for (const indexed of [false, true]) {
      const actual = new Actual(geometry(square, indexed), new LineBasicMaterial());
      const expected = new Expected(upstreamGeometry(square, indexed), new UpstreamBasic());
      for (const [start, count] of [
        [0, 4],
        [1, 2],
        [0, 3],
        [2, 20],
      ]) {
        actual.geometry.setDrawRange(start, count);
        expected.geometry.setDrawRange(start, count);
        for (const [x, y] of [
          [1, 0],
          [2, 1],
          [1, 2],
          [0, 1],
          [1, 1],
          [8, 8],
        ]) {
          const ray = rayAt(x, y);
          assert.deepEqual(snapshot(ray.intersectObject(actual)), upstreamHits(expected, ray));
        }
      }
      actual.geometry.setDrawRange(0, 4);
      assert.equal(rayAt(0, 1).intersectObject(actual).length, Actual === LineLoop ? 1 : 0);
      assert.equal(rayAt(2, 1).intersectObject(actual).length, Actual === LineSegments ? 0 : 1);
      assert.ok(actual.geometry.boundingSphere);
    }
  }
});

test("line distance attributes distinguish strips and disjoint segments without mutating indexed geometry", () => {
  const values = [0, 0, 0, 3, 0, 0, 3, 4, 0, 6, 4, 0];
  for (const [Actual, Expected] of modes) {
    const actual = new Actual(geometry(values), new LineDashedMaterial());
    const expected = new Expected(upstreamGeometry(values), new UpstreamDashed());
    assert.equal(actual.computeLineDistances(), actual);
    expected.computeLineDistances();
    const distances = actual.geometry.getAttribute("lineDistance");
    assert.ok(distances instanceof Float32BufferAttribute);
    assert.deepEqual(Array.from(distances.array), Actual === LineSegments ? [0, 3, 3, 6] : [0, 3, 7, 10]);
    assert.deepEqual(distances.array, expected.geometry.getAttribute("lineDistance").array);
    actual.geometry.setIndex([0, 1, 2, 3]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      actual.computeLineDistances();
      assert.equal(actual.geometry.getAttribute("lineDistance"), distances);
      assert.equal(warn.mock.calls.length, 1);
    } finally {
      warn.mockRestore();
    }
  }
});

test("line and point picks preserve world transforms, thresholds, clipping, recursion and layers", () => {
  for (const [Actual, Expected] of [...modes, [Points, UpstreamPoints]] as const) {
    const actual = new Actual(geometry([-1, 0, 0, 1, 0, 0]), new LineBasicMaterial());
    const expected = new Expected(upstreamGeometry([-1, 0, 0, 1, 0, 0]), new UpstreamBasic());
    const root = new Object3D();
    root.position.set(3, -2, 1);
    root.rotation.z = Math.PI / 3;
    root.add(actual);
    actual.position.set(0.4, 0.2, -1);
    actual.scale.set(2, 1.5, 0.75);
    root.updateMatrixWorld(true);
    expected.matrixWorld.copy(actual.matrixWorld);
    // Upstream's Object.defineProperties accessors are absent from inferred JS declarations.
    const upstreamTransform = expected as unknown as { scale: Vector3 };
    upstreamTransform.scale.copy(actual.scale);
    const target = new Vector3(Actual === Points ? 1 : 0, 0, 0).applyMatrix4(actual.matrixWorld);
    for (const offset of [0, 0.03, 0.3, 20]) {
      const ray = new Raycaster(target.clone().add(new Vector3(offset, 0, 5)), new Vector3(0, 0, -1));
      for (const threshold of [0.01, 0.1, 0.5]) {
        ray.params.Line.threshold = threshold;
        ray.params.Points.threshold = threshold;
        for (const [near, far] of [
          [0, 10],
          [5.1, 10],
          [0, 4.9],
          [5, 5],
        ]) {
          ray.near = near;
          ray.far = far;
          assert.deepEqual(snapshot(ray.intersectObject(actual)), upstreamHits(expected, ray));
        }
      }
    }
    const ray = new Raycaster(target.clone().add(new Vector3(0, 0, 5)), new Vector3(0, 0, -1));
    assert.ok(ray.intersectObject(root).length > 0);
    assert.equal(ray.intersectObject(root, false).length, 0);
    actual.layers.set(2);
    assert.equal(ray.intersectObject(root).length, 0);
    ray.layers.enable(2);
    assert.ok(ray.intersectObject(root).length > 0);
    assert.equal(ray.intersectObject(actual)[0].object, actual);
  }
});

test("points honor indexed vertex identities, draw ranges, distanceToRay and distance sorting", () => {
  for (const indexed of [false, true]) {
    const positions = [0, 0, 0, 0.02, 0, 1, 2, 0, 0, 0, 0, -1];
    const actual = new Points(geometry(positions, indexed), new PointsMaterial());
    const expected = new UpstreamPoints(upstreamGeometry(positions, indexed), new UpstreamPointsMaterial());
    for (const [start, count] of [
      [0, 4],
      [1, 2],
      [0, 0],
      [2, 10],
    ]) {
      actual.geometry.setDrawRange(start, count);
      expected.geometry.setDrawRange(start, count);
      const ray = rayAt(0, 0);
      const hits = ray.intersectObject(actual);
      assert.deepEqual(snapshot(hits), upstreamHits(expected, ray));
      if (start === 0 && count === 4) {
        assert.deepEqual(
          hits.map((hit) => hit.index),
          [1, 0, 3],
        );
        assert.deepEqual(
          hits.map((hit) => hit.distance),
          [4, 5, 6],
        );
        assert.ok(Math.abs(hits[0].distanceToRay! - 0.02) < 1e-8);
        assert.deepEqual(hits[0].point.toArray(), [0, 0, 1]);
      }
    }
    assert.ok(actual.geometry.boundingSphere);
  }
});

test("object clones retain runtime subtype, shared GPU resources and independent morph and child state", () => {
  for (const [Actual] of [...modes, [Points, UpstreamPoints]] as const) {
    const shape = geometry([0, 0, 0, 1, 0, 0]);
    const morph = new Float32BufferAttribute([0, 1, 0, 1, 1, 0], 3);
    morph.name = "raised";
    shape.morphAttributes.position = [morph];
    const material = new LineBasicMaterial();
    const actual = new Actual(shape, [material]);
    actual.morphTargetInfluences![0] = 0.75;
    actual.add(new Object3D());
    const clone = actual.clone();
    assert.ok(clone instanceof Actual);
    assert.equal(clone.geometry, shape);
    assert.notEqual(clone.material, actual.material);
    assert.deepEqual(clone.material, [material]);
    assert.deepEqual(clone.morphTargetDictionary, { raised: 0 });
    assert.deepEqual(clone.morphTargetInfluences, [0.75]);
    assert.notEqual(clone.morphTargetDictionary, actual.morphTargetDictionary);
    assert.notEqual(clone.morphTargetInfluences, actual.morphTargetInfluences);
    assert.notEqual(clone.children[0], actual.children[0]);
    assert.equal(actual.clone(false).children.length, 0);
    const plain = new Actual(geometry([0, 0, 0, 1, 0, 0]), material);
    if (clone instanceof Points && plain instanceof Points) clone.copy(plain, false);
    else if (clone instanceof Line && plain instanceof Line) clone.copy(plain, false);
    else assert.fail("Clone must preserve its object family");
    assert.equal(clone.geometry, plain.geometry);
    assert.equal(clone.material, material);
    assert.equal(clone.morphTargetDictionary, undefined);
    assert.equal(clone.morphTargetInfluences, undefined);
  }
});

test("sprite picking agrees with upstream for camera projection, center, rotation, scale and size attenuation", () => {
  for (const camera of [new PerspectiveCamera(50, 1, 0.1, 100), new OrthographicCamera(-3, 3, 3, -3, 0.1, 100)]) {
    camera.position.set(1, 2, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const actual = new Sprite(new SpriteMaterial());
    const expected = new UpstreamSprite(new UpstreamSpriteMaterial());
    actual.scale.set(2, 0.75, 1);
    actual.updateMatrixWorld(true);
    expected.matrixWorld.copy(actual.matrixWorld);
    for (const center of [
      [0.5, 0.5],
      [0, 0],
      [0.2, 0.8],
    ]) {
      actual.center.set(center[0], center[1]);
      expected.center.copy(actual.center);
      for (const rotation of [0, Math.PI / 2, -0.7]) {
        for (const sizeAttenuation of [false, true]) {
          actual.material.rotation = expected.material.rotation = rotation;
          actual.material.sizeAttenuation = expected.material.sizeAttenuation = sizeAttenuation;
          for (const [x, y] of [
            [0, 0],
            [0.1, -0.1],
            [-0.2, 0.15],
            [0.6, 0.6],
            [2, 2],
          ]) {
            const ray = new Raycaster();
            ray.setFromCamera(new Vector2(x, y), camera);
            for (const [near, far] of [
              [0, 100],
              [0, 3],
              [8, 100],
            ]) {
              ray.near = near;
              ray.far = far;
              assert.deepEqual(snapshot(ray.intersectObject(actual)), upstreamHits(expected, ray));
            }
          }
        }
      }
    }
  }
});

test("sprite UVs, anchor and rotation change actual hit coverage and camera is required", () => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = 5;
  camera.updateMatrixWorld(true);
  const sprite = new Sprite(new SpriteMaterial());
  sprite.scale.set(2, 1, 1);
  sprite.updateMatrixWorld(true);
  const ray = rayAt(0, 0);
  ray.camera = camera;
  assert.deepEqual(ray.intersectObject(sprite)[0].uv!.toArray(), [0.5, 0.5]);
  ray.ray.origin.x = 0.75;
  assert.equal(ray.intersectObject(sprite).length, 1);
  sprite.material.rotation = Math.PI / 2;
  assert.equal(ray.intersectObject(sprite).length, 0);
  sprite.material.rotation = 0;
  sprite.center.set(0, 0);
  ray.ray.origin.set(1, 0.5, 5);
  assert.deepEqual(ray.intersectObject(sprite)[0].uv!.toArray(), [0.5, 0.5]);
  ray.near = 5.1;
  assert.equal(ray.intersectObject(sprite).length, 0);
  ray.near = 0;
  ray.far = 4.9;
  assert.equal(ray.intersectObject(sprite).length, 0);
  ray.far = 10;
  sprite.layers.set(1);
  assert.equal(ray.intersectObject(sprite).length, 0);
  ray.layers.enable(1);
  assert.equal(ray.intersectObject(sprite).length, 1);
  ray.camera = null;
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    assert.throws(() => ray.intersectObject(sprite), TypeError);
    assert.equal(error.mock.calls.length, 1);
  } finally {
    error.mockRestore();
  }
});

test("sprite cloning shares internal quad and material but not center or children; bounds remain upstream", () => {
  const sprite = new Sprite(new SpriteMaterial());
  sprite.center.set(0.2, 0.8);
  sprite.add(new Object3D());
  const clone = sprite.clone();
  assert.equal(clone.material, sprite.material);
  assert.equal(clone.geometry, sprite.geometry);
  assert.equal(new Sprite(new SpriteMaterial()).geometry, sprite.geometry);
  assert.notEqual(clone.center, sprite.center);
  assert.deepEqual(clone.center.toArray(), [0.2, 0.8]);
  assert.notEqual(clone.children[0], sprite.children[0]);
  assert.equal(sprite.clone(false).children.length, 0);
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = 5;
  camera.updateMatrixWorld(true);
  const frustum = new Frustum().setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
  );
  for (const [Actual, Expected] of [...modes, [Points, UpstreamPoints]] as const) {
    const actual = new Actual(geometry([-1, 0, 0, 1, 0, 0]), new LineBasicMaterial());
    const expected = new Expected(upstreamGeometry([-1, 0, 0, 1, 0, 0]), new UpstreamBasic());
    for (const x of [0, 100]) {
      actual.position.x = x;
      actual.updateMatrixWorld(true);
      expected.matrixWorld.copy(actual.matrixWorld);
      assert.equal(actual.intersectsFrustum(frustum), expected.intersectsFrustum(frustum));
      assert.equal(actual.intersectsFrustum(frustum), x === 0);
    }
  }
  const expected = new UpstreamSprite(new UpstreamSpriteMaterial());
  for (const x of [0, 100]) {
    sprite.position.x = x;
    sprite.updateMatrixWorld(true);
    expected.matrixWorld.copy(sprite.matrixWorld);
    assert.equal(sprite.intersectsFrustum(frustum), expected.intersectsFrustum(frustum));
    assert.equal(sprite.intersectsFrustum(frustum), x === 0);
  }
});

test("material clones preserve colors, textures and disposal ownership", () => {
  for (const Actual of [LineBasicMaterial, LineDashedMaterial, PointsMaterial, SpriteMaterial]) {
    const actual = new Actual();
    actual.color.set(0x123456);
    const map = new Texture();
    actual.map = map;
    actual.opacity = 0.4;
    const clone = actual.clone();
    assert.equal(clone.constructor, actual.constructor);
    assert.equal(clone.map, map);
    assert.notEqual(clone.color, actual.color);
    assert.equal(clone.color.getHex(), 0x123456);
    assert.equal(clone.opacity, 0.4);
    let materialDisposals = 0;
    let textureDisposals = 0;
    clone.addEventListener("dispose", () => materialDisposals++);
    map.addEventListener("dispose", () => textureDisposals++);
    clone.dispose();
    assert.equal(materialDisposals, 1);
    assert.equal(textureDisposals, 0);
    map.dispose();
    assert.equal(textureDisposals, 1);
  }
});

test("explicit constructors reject hidden resources", () => {
  for (const [Actual] of [...modes, [Points, UpstreamPoints]] as const) {
    assert.throws(() => Reflect.construct(Actual, []), /requires explicit geometry and material/);
    assert.throws(() => Reflect.construct(Actual, [new BufferGeometry()]), /requires explicit geometry and material/);
  }
  assert.throws(() => Reflect.construct(Sprite, []), /requires explicit material/);
});

test("material copies preserve family-specific settings and texture identity", () => {
  const texture = new Texture();
  const basic = new LineBasicMaterial({
    color: "red",
    linewidth: 4,
    linecap: "square",
    linejoin: "bevel",
    map: texture,
  });
  const basicCopy = basic.clone();
  assert.equal(basicCopy.linewidth, 4);
  assert.equal(basicCopy.linecap, "square");
  assert.equal(basicCopy.linejoin, "bevel");
  assert.equal(basicCopy.map, texture);
  const dashed = new LineDashedMaterial({ color: "blue", scale: 2, dashSize: 0.3, gapSize: 0.7 });
  const dashedCopy = dashed.clone();
  assert.deepEqual([dashedCopy.scale, dashedCopy.dashSize, dashedCopy.gapSize], [2, 0.3, 0.7]);
  const points = new PointsMaterial({ size: 7, sizeAttenuation: false, alphaMap: texture, fog: false });
  const pointsCopy = points.clone();
  assert.deepEqual([pointsCopy.size, pointsCopy.sizeAttenuation, pointsCopy.fog], [7, false, false]);
  assert.equal(pointsCopy.alphaMap, texture);
  const sprite = new SpriteMaterial({ rotation: 0.75, sizeAttenuation: false, alphaMap: texture, fog: false });
  const spriteCopy = sprite.clone();
  assert.deepEqual([spriteCopy.rotation, spriteCopy.sizeAttenuation, spriteCopy.fog], [0.75, false, false]);
  assert.equal(spriteCopy.alphaMap, texture);
});

test("typed camera and helper specializations retain inherited constructor state", () => {
  const subcamera = new PerspectiveCamera();
  const cameras = [subcamera];
  const arrayCamera = new ArrayCamera(cameras);
  assert.equal(arrayCamera.cameras, cameras);
  assert.ok(arrayCamera.projectionMatrix instanceof Matrix4);

  const target = new WebGLCubeRenderTarget(16);
  const cubeCamera = new CubeCamera(0.25, 100, target);
  assert.equal(cubeCamera.renderTarget, target);
  assert.equal(cubeCamera.children.length, 6);
  assert.equal(new Set(cubeCamera.children).size, 6);
  for (const camera of cubeCamera.children) {
    assert.ok(camera instanceof PerspectiveCamera);
    assert.equal(camera.near, 0.25);
    assert.equal(camera.layers, cubeCamera.layers);
    assert.equal(camera.parent, cubeCamera);
  }

  const axes = new AxesHelper();
  assert.ok(axes.material instanceof LineBasicMaterial);
  assert.ok(axes.geometry instanceof BufferGeometry);
  const root = new Object3D();
  const skeletonHelper = new SkeletonHelper(root);
  assert.equal(skeletonHelper.matrix, root.matrixWorld);
  assert.equal(skeletonHelper.matrixAutoUpdate, false);
  assert.ok(skeletonHelper.material instanceof LineBasicMaterial);
  axes.dispose();
  skeletonHelper.dispose();
  target.dispose();
});

test("LOD levels keep their immutable property descriptor and independent mutable arrays", () => {
  const lod = new LOD();
  const descriptor = Object.getOwnPropertyDescriptor(lod, "levels");
  assert.equal(descriptor?.enumerable, true);
  assert.equal(descriptor?.writable, false);
  assert.equal(descriptor?.configurable, false);
  assert.equal(descriptor?.value, lod.levels);
  assert.notEqual(lod.levels, new LOD().levels);
  const object = new Object3D();
  lod.addLevel(object, 10);
  assert.equal(lod.levels[0].object, object);
});

test("base clone methods preserve concrete camera and mesh subclass types", () => {
  class CustomCamera extends PerspectiveCamera {
    label: string = "camera";
  }
  class CustomMesh extends Mesh {
    label: string = "mesh";
  }
  const camera = new CustomCamera();
  const cameraClone: CustomCamera = camera.clone();
  assert.ok(cameraClone instanceof CustomCamera);
  assert.equal(cameraClone.label, "camera");
  assert.notEqual(cameraClone.projectionMatrix, camera.projectionMatrix);
  const mesh = new CustomMesh(new BufferGeometry(), new MeshBasicMaterial());
  const meshClone: CustomMesh = mesh.clone();
  assert.ok(meshClone instanceof CustomMesh);
  assert.equal(meshClone.label, "mesh");
  assert.equal(meshClone.geometry, mesh.geometry);
  assert.equal(meshClone.material, mesh.material);
});
