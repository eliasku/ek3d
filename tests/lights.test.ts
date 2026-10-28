import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { AmbientLight } from "../src/lights/AmbientLight";
import { SpotLight } from "../src/lights/SpotLight";
import { SpotLightShadow } from "../src/lights/SpotLightShadow";
import { DirectionalLight } from "../src/lights/DirectionalLight";
import { PointLight } from "../src/lights/PointLight";
import { RectAreaLight } from "../src/lights/RectAreaLight";
import { DirectionalLightShadow } from "../src/lights/DirectionalLightShadow";
import { PointLightShadow } from "../src/lights/PointLightShadow";
import { OrthographicCamera } from "../src/cameras/OrthographicCamera";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { Object3D } from "../src/core/Object3D";
import { Color } from "../src/math/Color";
import { Vector3 } from "../src/math/Vector3";
import { DataTexture } from "../src/textures/DataTexture";
import { WebGLRenderTarget } from "../src/renderers/WebGLRenderTarget";
import { AmbientLight as UpstreamAmbient } from "../upstream/three.js/src/lights/AmbientLight.js";
import { SpotLight as UpstreamSpot } from "../upstream/three.js/src/lights/SpotLight.js";
import { SpotLightShadow as UpstreamShadow } from "../upstream/three.js/src/lights/SpotLightShadow.js";
import { Object3D as UpstreamObject } from "../upstream/three.js/src/core/Object3D.js";
import { Color as UpstreamColor } from "../upstream/three.js/src/math/Color.js";
import { DataTexture as UpstreamTexture } from "../upstream/three.js/src/textures/DataTexture.js";
import { WebGLRenderTarget as UpstreamRenderTarget } from "../upstream/three.js/src/renderers/WebGLRenderTarget.js";

// The upstream static flag belongs to the excluded WebGPU object contract.
function webGLJSON(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (key, entry: unknown) => (key === "static" ? undefined : entry)));
}

function lightValues(light: SpotLight) {
  return {
    color: light.color.toArray(),
    intensity: light.intensity,
    power: light.power,
    distance: light.distance,
    angle: light.angle,
    penumbra: light.penumbra,
    decay: light.decay,
    position: light.position.toArray(),
    target: light.target.position.toArray(),
    focus: light.shadow.focus,
    aspect: light.shadow.aspect,
    mapSize: light.shadow.mapSize.toArray(),
    projection: light.shadow.camera.projectionMatrix.elements,
  };
}

test("ambient color, intensity, recursive copy and clone retain upstream ownership", () => {
  const color = new Color(0x4a82cf);
  const upstreamColor = new UpstreamColor(0x4a82cf);
  const actual = new AmbientLight(color, 2.75);
  const expected = new UpstreamAmbient(upstreamColor, 2.75) as unknown as AmbientLight;
  actual.add(new Object3D());
  expected.add(new UpstreamObject() as unknown as Object3D);
  color.setHex(0xffffff);
  upstreamColor.setHex(0xffffff);
  assert.notDeepEqual(actual.color.toArray(), color.toArray());
  for (const recursive of [false, true]) {
    const clone = actual.clone(recursive);
    const upstreamClone = expected.clone(recursive);
    assert.ok(clone instanceof AmbientLight);
    assert.notEqual(clone.color, actual.color);
    assert.deepEqual(clone.color.toArray(), upstreamClone.color.toArray());
    assert.equal(clone.intensity, upstreamClone.intensity);
    assert.equal(clone.children.length, recursive ? 1 : 0);
    assert.equal(clone.children.length, upstreamClone.children.length);
    if (recursive) assert.notEqual(clone.children[0], actual.children[0]);
    clone.color.setRGB(0.1, 0.2, 0.3);
    clone.intensity = 0;
    assert.deepEqual(actual.color.toArray(), expected.color.toArray());
    assert.equal(actual.intensity, 2.75);
  }
  actual.color.set("rebeccapurple");
  expected.color.set("rebeccapurple");
  actual.intensity = expected.intensity = -0.5;
  const copy = new AmbientLight();
  const upstreamCopy = new UpstreamAmbient() as unknown as AmbientLight;
  assert.equal(copy.copy(actual, false), copy);
  upstreamCopy.copy(expected, false);
  assert.notEqual(copy.color, actual.color);
  assert.deepEqual(copy.color.toArray(), upstreamCopy.color.toArray());
  assert.equal(copy.intensity, upstreamCopy.intensity);
  assert.equal(copy.children.length, 0);
});

test("spot power stays an accessor and copy/clone share only the cookie texture", () => {
  const actual = new SpotLight(0x789abc, 3, 27, Math.PI / 5, 0.4, 1.5);
  const expected = new UpstreamSpot(0x789abc, 3, 27, Math.PI / 5, 0.4, 1.5) as unknown as SpotLight;
  for (const intensity of [0, -2, 1.25, 100]) {
    actual.intensity = expected.intensity = intensity;
    assert.equal(actual.power, intensity * Math.PI);
    assert.equal(actual.power, expected.power);
  }
  for (const power of [0, -5, Math.PI * 7, 123.5]) {
    actual.power = expected.power = power;
    assert.equal(actual.intensity, power / Math.PI);
    assert.equal(actual.intensity, expected.intensity);
  }
  actual.map = new DataTexture(new Uint8Array([255, 128, 64, 255]), 1, 1);
  expected.map = new UpstreamTexture(new Uint8Array([255, 128, 64, 255]), 1, 1) as unknown as DataTexture;
  actual.add(new Object3D());
  expected.add(new UpstreamObject() as unknown as Object3D);
  actual.target.add(new Object3D());
  expected.target.add(new UpstreamObject() as unknown as Object3D);
  for (const light of [actual, expected]) {
    light.position.set(3, 8, -2);
    light.target.position.set(1, -2, 3);
    light.shadow.focus = 0.65;
    light.shadow.aspect = 1.25;
    light.shadow.mapSize.set(1024, 256);
    light.shadow.camera.near = 0.25;
    light.updateMatrixWorld(true);
    light.target.updateMatrixWorld(true);
    light.shadow.updateMatrices(light);
  }
  for (const recursive of [false, true]) {
    for (const [copy, upstreamCopy] of [
      [actual.clone(recursive), expected.clone(recursive)],
      [new SpotLight().copy(actual, recursive), new UpstreamSpot().copy(expected, recursive) as unknown as SpotLight],
    ] as const) {
      assert.deepEqual(lightValues(copy), lightValues(upstreamCopy));
      assert.equal(copy.map, actual.map);
      assert.notEqual(copy.target, actual.target);
      assert.notEqual(copy.target.children[0], actual.target.children[0]);
      assert.equal(copy.target.children.length, 1);
      assert.notEqual(copy.shadow, actual.shadow);
      assert.ok(copy.shadow instanceof SpotLightShadow);
      assert.notEqual(copy.shadow.camera, actual.shadow.camera);
      assert.notEqual(copy.shadow.mapSize, actual.shadow.mapSize);
      assert.notEqual(copy.color, actual.color);
      assert.equal(copy.children.length, recursive ? 1 : 0);
      copy.power = Math.PI * 2;
      assert.equal(copy.intensity, 2);
      copy.target.position.x = 99;
      copy.shadow.focus = 0.2;
      copy.shadow.camera.near = 9;
      assert.equal(actual.target.position.x, 1);
      assert.equal(actual.shadow.focus, 0.65);
      assert.equal(actual.shadow.camera.near, 0.25);
    }
  }
  const shadowCopy = new SpotLightShadow();
  assert.equal(shadowCopy.copy(actual.shadow), shadowCopy);
  const upstreamShadow = new UpstreamShadow().copy(expected.shadow);
  upstreamShadow.camera.uuid = shadowCopy.camera.uuid;
  assert.deepEqual(shadowCopy.toJSON(), webGLJSON(upstreamShadow.toJSON()));
  actual.map = expected.map = null;
  assert.equal(actual.clone().map, null);
});

test("spot JSON preserves target references, texture cache and shadow camera settings", () => {
  const actual = new SpotLight("#4a82cf", 2, 32, 0.6, 0.3, 1.75);
  const expected = new UpstreamSpot("#4a82cf", 2, 32, 0.6, 0.3, 1.75) as unknown as SpotLight;
  actual.map = new DataTexture(new Uint8Array([20, 40, 80, 255]), 1, 1);
  expected.map = new UpstreamTexture(new Uint8Array([20, 40, 80, 255]), 1, 1) as unknown as DataTexture;
  Object.assign(expected, { uuid: actual.uuid });
  Object.assign(expected.target, { uuid: actual.target.uuid });
  expected.shadow.camera.uuid = actual.shadow.camera.uuid;
  expected.map.uuid = actual.map.uuid;
  expected.map.source.uuid = actual.map.source.uuid;
  for (const light of [actual, expected]) {
    light.castShadow = true;
    light.shadow.focus = 0.7;
    light.shadow.aspect = 1.5;
    light.shadow.bias = -0.001;
    light.shadow.normalBias = 0.02;
    light.shadow.mapSize.set(512, 256);
    light.shadow.camera.near = 0.125;
    light.shadow.updateMatrices(light);
  }
  const meta = { textures: {}, images: {} };
  const upstreamMeta = { textures: {}, images: {} };
  const json = actual.toJSON(meta);
  const upstreamJSON = expected.toJSON(upstreamMeta);
  assert.deepEqual(meta, upstreamMeta);
  assert.equal(json.object.target, actual.target.uuid);
  assert.equal(json.object.map, actual.map.uuid);
  assert.ok(Object.hasOwn(meta.textures, actual.map.uuid));
  assert.ok(Object.hasOwn(meta.images, actual.map.source.uuid));
  assert.equal(json.object.shadow.focus, 0.7);
  assert.equal(json.object.shadow.aspect, 1.5);
  assert.equal(json.object.shadow.camera.far, 32);
  assert.deepEqual(json, webGLJSON(upstreamJSON));
  assert.deepEqual(actual.toJSON(), webGLJSON(expected.toJSON()));
  actual.map = expected.map = null;
  assert.equal("map" in actual.toJSON().object, false);
  assert.deepEqual(actual.toJSON(), webGLJSON(expected.toJSON()));
});

test("spot shadow projection tracks dynamic cone, map shape, range and transformed targets at both depths", () => {
  for (const reversedDepth of [false, true]) {
    const actual = new SpotLight();
    const expected = new UpstreamSpot() as unknown as SpotLight;
    const parent = new Object3D();
    const upstreamParent = new UpstreamObject() as unknown as Object3D;
    parent.add(actual, actual.target);
    upstreamParent.add(expected, expected.target);
    for (const root of [parent, upstreamParent]) {
      root.position.set(4, -3, 2);
      root.rotation.set(0.2, -0.4, 0.1);
      root.scale.set(1.2, 0.8, 1.5);
    }
    for (const light of [actual, expected]) {
      light.position.set(2, 6, 4);
      light.target.position.set(-1, 0.5, -2);
      light.shadow.camera._reversedDepth = reversedDepth;
      light.shadow.camera.near = 0.25;
      light.shadow.camera.far = 73;
      light.shadow.camera.updateProjectionMatrix();
    }
    for (const [angle, focus, aspect, width, height, distance] of [
      [0.5, 0.8, 1.2, 1024, 256, 0],
      [0.7, 0.6, 0.75, 256, 512, 29],
      [0.7, 0.6, 0.75, 256, 512, 0],
      [Math.PI / 2, 1, 1, 512, 512, 18],
    ]) {
      for (const light of [actual, expected]) {
        light.angle = angle;
        light.distance = distance;
        light.shadow.focus = focus;
        light.shadow.aspect = aspect;
        light.shadow.mapSize.set(width, height);
        light.target.position.x += 0.5;
      }
      parent.updateMatrixWorld(true);
      upstreamParent.updateMatrixWorld(true);
      const previousFar = actual.shadow.camera.far;
      actual.shadow.updateMatrices(actual);
      expected.shadow.updateMatrices(expected);
      const camera = actual.shadow.camera;
      const upstreamCamera = expected.shadow.camera;
      assert.equal(camera.fov, (180 / Math.PI) * 2 * angle * focus);
      assert.equal(camera.aspect, (width / height) * aspect);
      assert.equal(camera.far, distance || previousFar);
      for (const name of ["projectionMatrix", "projectionMatrixInverse", "matrixWorld", "matrixWorldInverse"] as const)
        assert.deepEqual(camera[name].elements, upstreamCamera[name].elements);
      assert.deepEqual(actual.shadow.matrix.elements, expected.shadow.matrix.elements);
      assert.deepEqual(
        actual.shadow.getFrustum().planes.map((plane) => [...plane.normal.toArray(), plane.constant]),
        expected.shadow.getFrustum().planes.map((plane) => [...plane.normal.toArray(), plane.constant]),
      );
      for (const [depth, z] of [
        [camera.near, reversedDepth ? 1 : 0],
        [camera.far, reversedDepth ? 0 : 1],
      ]) {
        const point = new Vector3(0, 0, -depth).applyMatrix4(camera.matrixWorld).applyMatrix4(actual.shadow.matrix);
        assert.ok(Math.abs(point.z - z) < 1e-12);
      }
    }
  }
});

test("spot disposal releases shadow targets but never owns the shared cookie or target", () => {
  const events: string[][] = [];
  for (const [LightClass, TextureClass, TargetClass] of [
    [SpotLight, DataTexture, WebGLRenderTarget],
    [UpstreamSpot, UpstreamTexture, UpstreamRenderTarget],
  ] as const) {
    const light = new LightClass() as unknown as SpotLight;
    const cookie = new TextureClass(new Uint8Array([255, 255, 255, 255]), 1, 1) as unknown as DataTexture;
    light.map = cookie;
    light.shadow.map = new TargetClass(4, 4) as unknown as WebGLRenderTarget;
    light.shadow.mapPass = new TargetClass(4, 4) as unknown as WebGLRenderTarget;
    const calls: string[] = [];
    for (const [object, name] of [
      [light, "light"],
      [cookie, "cookie"],
      [light.target, "target"],
      [light.shadow.map, "map"],
      [light.shadow.mapPass, "mapPass"],
    ] as const)
      object.addEventListener("dispose", () => calls.push(name));
    const clone = light.clone();
    assert.equal(clone.shadow.map, null);
    assert.equal(clone.shadow.mapPass, null);
    clone.dispose();
    assert.deepEqual(calls, []);
    light.dispose();
    assert.deepEqual(calls, ["light", "map", "mapPass"]);
    assert.equal(light.map, cookie);
    events.push(calls);
    light.shadow.map = light.shadow.mapPass = null;
    light.shadow.dispose();
    assert.deepEqual(calls, ["light", "map", "mapPass"]);
  }
  assert.deepEqual(events[0], events[1]);
});

test("light and shadow specializations preserve inherited intensity and camera initialization", () => {
  const directional = new DirectionalLight(0xffffff, 3);
  const point = new PointLight(0xffffff, 4);
  const spot = new SpotLight(0xffffff, 5);
  const area = new RectAreaLight(0xffffff, 6);
  assert.equal(directional.intensity, 3);
  assert.equal(point.intensity, 4);
  assert.equal(spot.intensity, 5);
  assert.equal(area.intensity, 6);
  assert.ok(directional.shadow instanceof DirectionalLightShadow);
  assert.ok(point.shadow instanceof PointLightShadow);
  assert.ok(spot.shadow instanceof SpotLightShadow);
  assert.ok(directional.shadow.camera instanceof OrthographicCamera);
  assert.ok(point.shadow.camera instanceof PerspectiveCamera);
  assert.ok(spot.shadow.camera instanceof PerspectiveCamera);
  assert.equal(directional.shadow.camera.left, -5);
  assert.equal(point.shadow.camera.fov, 90);
  assert.equal(spot.shadow.camera.fov, 50);

  class CustomShadow extends DirectionalLightShadow {
    label: string = "shadow";
  }
  const shadow = new CustomShadow();
  const clone: CustomShadow = shadow.clone();
  assert.ok(clone instanceof CustomShadow);
  assert.equal(clone.label, "shadow");
  assert.ok(clone.camera instanceof OrthographicCamera);
  assert.notEqual(clone.camera, shadow.camera);
  assert.deepEqual(clone.camera.projectionMatrix.elements, shadow.camera.projectionMatrix.elements);
});
