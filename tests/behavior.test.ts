import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { Vector3 } from "../src/math/Vector3";
import { Matrix4 } from "../src/math/Matrix4";
import { Quaternion } from "../src/math/Quaternion";
import { Euler } from "../src/math/Euler";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { Mesh } from "../src/objects/Mesh";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Object3D } from "../src/core/Object3D";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { basicShader } from "../src/renderers/shaders/BasicShader";
import { cloneUniforms } from "../src/renderers/shaders/UniformsUtils";
import { Vector3 as UpstreamVector3 } from "../upstream/three.js/src/math/Vector3.js";
import { Matrix4 as UpstreamMatrix4 } from "../upstream/three.js/src/math/Matrix4.js";
import { Quaternion as UpstreamQuaternion } from "../upstream/three.js/src/math/Quaternion.js";
import { Euler as UpstreamEuler } from "../upstream/three.js/src/math/Euler.js";
import { BoxGeometry as UpstreamBoxGeometry } from "../upstream/three.js/src/geometries/BoxGeometry.js";
import { PerspectiveCamera as UpstreamCamera } from "../upstream/three.js/src/cameras/PerspectiveCamera.js";
import { DataTexture } from "../src/textures/DataTexture";
import { Vector2 } from "../src/math/Vector2";
import { RepeatWrapping, ClampToEdgeWrapping, MirroredRepeatWrapping, SRGBColorSpace } from "../src/constants";
import { DataTexture as UpstreamDataTexture } from "../upstream/three.js/src/textures/DataTexture.js";
import { Vector2 as UpstreamVector2 } from "../upstream/three.js/src/math/Vector2.js";
import { MeshLambertMaterial } from "../src/materials/MeshLambertMaterial";
import { HemisphereLight } from "../src/lights/HemisphereLight";
import { MeshLambertMaterial as UpstreamLambert } from "../upstream/three.js/src/materials/MeshLambertMaterial.js";
import { HemisphereLight as UpstreamHemisphere } from "../upstream/three.js/src/lights/HemisphereLight.js";
import { CubeTexture } from "../src/textures/CubeTexture";
import { ShaderMaterial } from "../src/materials/ShaderMaterial";
import { getEnvironment } from "../src/renderers/webgl/WebGLEnvironmentAccess";
import { backgroundShader } from "../src/renderers/shaders/BackgroundShader";
import { backgroundCubeShader } from "../src/renderers/shaders/BackgroundCubeShader";
import {
  CubeReflectionMapping,
  CubeRefractionMapping,
  EquirectangularReflectionMapping,
  EquirectangularRefractionMapping,
} from "../src/constants";
import { WebGLEnvironments as UpstreamEnvironments } from "../upstream/three.js/src/renderers/webgl/WebGLEnvironments.js";
import { DirectionalLight } from "../src/lights/DirectionalLight";
import { PointLight } from "../src/lights/PointLight";
import { MeshDepthMaterial } from "../src/materials/MeshDepthMaterial";
import { MeshDistanceMaterial } from "../src/materials/MeshDistanceMaterial";
import { DepthTexture } from "../src/textures/DepthTexture";
import { DirectionalLight as UpstreamDirectionalLight } from "../upstream/three.js/src/lights/DirectionalLight.js";
import { PointLight as UpstreamPointLight } from "../upstream/three.js/src/lights/PointLight.js";
import { MeshDepthMaterial as UpstreamDepthMaterial } from "../upstream/three.js/src/materials/MeshDepthMaterial.js";
import { MeshDistanceMaterial as UpstreamDistanceMaterial } from "../upstream/three.js/src/materials/MeshDistanceMaterial.js";
import { DepthTexture as UpstreamDepthTexture } from "../upstream/three.js/src/textures/DepthTexture.js";
import { RGBADepthPacking, LessEqualCompare } from "../src/constants";
import { WebGLCoordinateSystem } from "../src/constants";
import { Frustum } from "../src/math/Frustum";
import { Frustum as UpstreamFrustum } from "../upstream/three.js/src/math/Frustum.js";
import { OrthographicCamera } from "../src/cameras/OrthographicCamera";
import { OrthographicCamera as UpstreamOrthographicCamera } from "../upstream/three.js/src/cameras/OrthographicCamera.js";

// Differential checks guard against migration changing the numerical algorithms.
test("compose/invert/transform agrees exactly with upstream, including negative scale", () => {
  for (const scale of [1, -2, 0.125]) {
    const q = new Quaternion().setFromEuler(new Euler(0.3, -0.8, 1.1));
    const uq = new UpstreamQuaternion().setFromEuler(new UpstreamEuler(0.3, -0.8, 1.1));
    const m = new Matrix4().compose(new Vector3(2, -3, 5), q, new Vector3(scale, 2, 3));
    const um = new UpstreamMatrix4().compose(new UpstreamVector3(2, -3, 5), uq, new UpstreamVector3(scale, 2, 3));
    assert.deepEqual(m.elements, um.elements);
    assert.deepEqual(
      new Vector3(7, 8, -1).applyMatrix4(m).toArray(),
      new UpstreamVector3(7, 8, -1).applyMatrix4(um).toArray(),
    );
    assert.deepEqual(m.invert().elements, um.invert().elements);
  }
  assert.deepEqual(
    new Matrix4().makeScale(0, 1, 1).invert().elements,
    new UpstreamMatrix4().makeScale(0, 1, 1).invert().elements,
  );
});

test("box geometry and camera projection preserve upstream buffers and clipping", () => {
  const actual = new BoxGeometry(2, 3, 4, 2, 3, 1);
  const expected = new UpstreamBoxGeometry(2, 3, 4, 2, 3, 1);
  for (const name of ["position", "normal", "uv"]) {
    const attribute = actual.getAttribute(name);
    assert.ok(attribute && "array" in attribute);
    assert.deepEqual(attribute.array, expected.getAttribute(name).array);
  }
  assert.ok(actual.index);
  assert.ok(expected.index);
  assert.deepEqual(actual.index.array, expected.index.array);
  assert.deepEqual(actual.groups, expected.groups);
  const camera = new PerspectiveCamera(63, 1.5, 0.2, 400);
  const upstream = new UpstreamCamera(63, 1.5, 0.2, 400);
  camera.setViewOffset(1200, 800, 100, 200, 500, 400);
  upstream.setViewOffset(1200, 800, 100, 200, 500, 400);
  assert.deepEqual(camera.projectionMatrix.elements, upstream.projectionMatrix.elements);
  assert.deepEqual(camera.projectionMatrixInverse.elements, upstream.projectionMatrixInverse.elements);
});

test("WebGL projections and frustum boundaries agree with upstream at both depth conventions", () => {
  for (const reversedDepth of [false, true]) {
    for (const method of ["makePerspective", "makeOrthographic"] as const) {
      const actual = new Matrix4()[method](-2, 4, 3, -1, 2, 18, WebGLCoordinateSystem, reversedDepth);
      const expected = new UpstreamMatrix4()[method](-2, 4, 3, -1, 2, 18, WebGLCoordinateSystem, reversedDepth);
      assert.deepEqual(actual.elements, expected.elements);
      const frustum = new Frustum().setFromProjectionMatrix(actual, WebGLCoordinateSystem, reversedDepth);
      const upstreamFrustum = new UpstreamFrustum().setFromProjectionMatrix(
        expected,
        WebGLCoordinateSystem,
        reversedDepth,
      );
      assert.deepEqual(
        frustum.planes.map((plane) => [...plane.normal.toArray(), plane.constant]),
        upstreamFrustum.planes.map((plane) => [...plane.normal.toArray(), plane.constant]),
      );
      for (const z of [-2, -18, -2 + 1e-8, -2 - 1e-8, -18 + 1e-8, -18 - 1e-8]) {
        const scale = method === "makePerspective" ? -z / 2 : 1;
        for (const [x, y] of [
          [0, 0],
          [-2, 0],
          [4, 0],
          [0, -1],
          [0, 3],
          [-2 - 1e-8, 0],
          [4 + 1e-8, 0],
        ]) {
          const point = new Vector3(x * scale, y * scale, z);
          const upstreamPoint = new UpstreamVector3(x * scale, y * scale, z);
          assert.equal(frustum.containsPoint(point), upstreamFrustum.containsPoint(upstreamPoint));
          assert.deepEqual(point.applyMatrix4(actual).toArray(), upstreamPoint.applyMatrix4(expected).toArray());
        }
      }
      assert.ok(Math.abs(new Vector3(0, 0, -2).applyMatrix4(actual).z - (reversedDepth ? 1 : -1)) < 1e-14);
      assert.ok(Math.abs(new Vector3(0, 0, -18).applyMatrix4(actual).z - (reversedDepth ? 0 : 1)) < 1e-14);
      if (!reversedDepth) {
        for (const matrix of [new Matrix4(), new UpstreamMatrix4()]) {
          assert.throws(
            () => Reflect.apply(matrix[method], matrix, [-2, 4, 3, -1, 2, 18, -123]),
            /Invalid coordinate system/,
          );
        }
        for (const candidate of [new Frustum(), new UpstreamFrustum()]) {
          assert.throws(
            () => Reflect.apply(candidate.setFromProjectionMatrix, candidate, [actual, -123]),
            /Invalid coordinate system/,
          );
        }
      }
    }
    for (const [camera, upstream] of [
      [new PerspectiveCamera(63, 1.5, 0.2, 400), new UpstreamCamera(63, 1.5, 0.2, 400)],
      [new OrthographicCamera(-3, 7, 5, -2, 0.2, 400), new UpstreamOrthographicCamera(-3, 7, 5, -2, 0.2, 400)],
    ] as const) {
      camera._reversedDepth = upstream._reversedDepth = reversedDepth;
      camera.setViewOffset(1200, 800, 100, 200, 500, 400);
      upstream.setViewOffset(1200, 800, 100, 200, 500, 400);
      assert.deepEqual(camera.projectionMatrix.elements, upstream.projectionMatrix.elements);
      assert.deepEqual(camera.projectionMatrixInverse.elements, upstream.projectionMatrixInverse.elements);
    }
  }
});

test("shadow matrices preserve WebGL depth remapping and reversed-depth identity Z", () => {
  for (const reversedDepth of [false, true]) {
    const actual = new DirectionalLight();
    const expected = new UpstreamDirectionalLight();
    for (const light of [actual, expected]) {
      const position: unknown = Reflect.get(light, "position");
      const targetPosition: unknown = Reflect.get(light.target, "position");
      assert.ok(position instanceof Vector3 || position instanceof UpstreamVector3);
      assert.ok(targetPosition instanceof Vector3 || targetPosition instanceof UpstreamVector3);
      position.set(3, 5, -2);
      targetPosition.set(-1, 0.5, 2);
      light.updateMatrixWorld();
      light.target.updateMatrixWorld();
      const camera = light.shadow.camera;
      camera.left = -8;
      camera.right = 6;
      camera.near = 2;
      camera.far = 18;
      camera._reversedDepth = reversedDepth;
      camera.updateProjectionMatrix();
    }
    actual.shadow.updateMatrices(actual);
    expected.shadow.updateMatrices(expected);
    assert.deepEqual(actual.shadow.matrix.elements, expected.shadow.matrix.elements);
    assert.deepEqual(
      actual.shadow.getFrustum().planes.map((plane) => [...plane.normal.toArray(), plane.constant]),
      expected.shadow.getFrustum().planes.map((plane) => [...plane.normal.toArray(), plane.constant]),
    );
    for (const depth of [2, 18, 2 - 1e-8, 2 + 1e-8, 18 - 1e-8, 18 + 1e-8]) {
      const point = new Vector3(0, 0, -depth).applyMatrix4(actual.shadow.camera.matrixWorld);
      const upstreamPoint = new UpstreamVector3(0, 0, -depth).applyMatrix4(expected.shadow.camera.matrixWorld);
      assert.equal(
        actual.shadow.getFrustum().containsPoint(point),
        expected.shadow.getFrustum().containsPoint(upstreamPoint),
      );
      const mapped = point.applyMatrix4(actual.shadow.matrix);
      assert.deepEqual(mapped.toArray(), upstreamPoint.applyMatrix4(expected.shadow.matrix).toArray());
      if (depth === 2 || depth === 18) {
        const far = depth === 18;
        assert.ok(Math.abs(mapped.z - (reversedDepth ? Number(!far) : Number(far))) < 1e-14);
      }
    }
  }
});

test("explicit-material mesh cloning preserves shared assets and independently clones transforms and children", () => {
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial({ color: 0x3366ff });
  const mesh = new Mesh(geometry, material);
  const child = new Object3D();
  child.position.set(1, 2, 3);
  mesh.add(child);
  mesh.position.set(2, 0, -1);
  const clone = mesh.clone();
  assert.equal(clone.geometry, geometry);
  assert.equal(clone.material, material);
  assert.notEqual(clone.position, mesh.position);
  assert.deepEqual(clone.position.toArray(), [2, 0, -1]);
  assert.notEqual(clone.children[0], child);
  assert.equal(clone.children[0].parent, clone);
  assert.deepEqual(clone.children[0].position.toArray(), [1, 2, 3]);
  assert.deepEqual(mesh.clone(false).children, []);
  assert.throws(() => Reflect.construct(Mesh, [geometry]), /explicit geometry and material/);
});

test("selected shader uniform instances do not leak state between materials", () => {
  const first = cloneUniforms(basicShader.uniforms);
  const second = cloneUniforms(basicShader.uniforms);
  first.diffuse.value.setHex(0xff0000);
  first.mapTransform.value.elements[0] = 5;
  assert.equal(second.diffuse.value.getHex(), 0xffffff);
  assert.equal(second.mapTransform.value.elements[0], 1);
  assert.notEqual(first.diffuse.value, basicShader.uniforms.diffuse.value);
});

test("scene reparenting preserves event ownership and matrix updates", () => {
  const a = new Object3D(),
    b = new Object3D(),
    child = new Object3D();
  a.position.set(1, 0, 0);
  b.position.set(3, 0, 0);
  child.position.set(0, 2, 0);
  a.add(child);
  a.updateMatrixWorld(true);
  const before = child.getWorldPosition(new Vector3());
  b.attach(child);
  b.updateMatrixWorld(true);
  assert.equal(child.parent, b);
  assert.deepEqual(a.children, []);
  assert.deepEqual(child.getWorldPosition(new Vector3()).toArray(), before.toArray());
});

test("data texture UV transforms preserve upstream wrapping, boundaries and flipY", () => {
  for (const wrapping of [RepeatWrapping, ClampToEdgeWrapping, MirroredRepeatWrapping]) {
    for (const flipY of [false, true]) {
      const actual = new DataTexture(),
        expected = new UpstreamDataTexture();
      for (const texture of [actual, expected]) {
        texture.wrapS = texture.wrapT = wrapping;
        texture.flipY = flipY;
        texture.offset.set(-0.25, 0.5);
        texture.repeat.set(2, 3);
        texture.center.set(0.5, 0.5);
        texture.rotation = 0.3;
        texture.updateMatrix();
      }
      assert.deepEqual(actual.matrix.elements, expected.matrix.elements);
      for (const [u, v] of [
        [-2, -1],
        [0, 0],
        [0.25, 0.75],
        [1, 1],
        [2, 3],
      ]) {
        const uv = new Vector2(u, v);
        assert.equal(actual.transformUv(uv), uv);
        assert.deepEqual(uv.toArray(), expected.transformUv(new UpstreamVector2(u, v)).toArray());
      }
    }
  }
});

test("data texture clones share source updates but not UV state, matching upstream", () => {
  const data = new Uint8Array([255, 64, 32, 255]);
  const actual = new DataTexture(data, 1, 1),
    expected = new UpstreamDataTexture(data, 1, 1);
  for (const texture of [actual, expected]) {
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = false;
    assert.equal(texture.version, 0);
    texture.needsUpdate = true;
    const clone = texture.clone();
    assert.equal(clone.source, texture.source);
    assert.ok(clone.image && "data" in clone.image);
    assert.equal(clone.image.data, data);
    assert.equal(clone.colorSpace, SRGBColorSpace);
    assert.notEqual(clone.offset, texture.offset);
    clone.offset.set(0.5, 0.25);
    assert.deepEqual(texture.offset.toArray(), [0, 0]);
    const image = { data: new Uint8Array([32, 64, 255, 255]), width: 1, height: 1 };
    clone.image = image;
    assert.equal(texture.image, image);
    assert.equal(texture.source.data, image);
    assert.equal(texture.version, 1);
    assert.equal(texture.source.version, 2);
    clone.needsUpdate = true;
    assert.equal(texture.source.version, 3);
    let disposed = 0;
    clone.addEventListener("dispose", () => disposed++);
    clone.dispose();
    assert.equal(disposed, 1);
  }
  assert.equal(actual.version, expected.version);
  assert.equal(actual.source.version, expected.source.version);
  const material = new MeshBasicMaterial({ map: actual });
  assert.equal(material.clone().map, actual);
});

test("Lambert and hemisphere clones preserve values without sharing mutable colors or normals", () => {
  const options = { color: 0x6699cc, emissive: 0x220011, emissiveIntensity: 0.4, flatShading: true };
  const material = new MeshLambertMaterial(options),
    expected = new UpstreamLambert(options);
  material.normalScale.set(0.5, -1);
  expected.normalScale.set(0.5, -1);
  const clone = material.clone(),
    expectedClone = expected.clone();
  assert.ok(expectedClone instanceof UpstreamLambert);
  assert.deepEqual(clone.color.toArray(), expectedClone.color.toArray());
  assert.deepEqual(clone.emissive.toArray(), expectedClone.emissive.toArray());
  assert.deepEqual(clone.normalScale.toArray(), expectedClone.normalScale.toArray());
  assert.equal(clone.emissiveIntensity, expectedClone.emissiveIntensity);
  assert.equal(clone.flatShading, expectedClone.flatShading);
  clone.color.setHex(0);
  clone.emissive.setHex(0);
  clone.normalScale.set(2, 3);
  assert.deepEqual(material.color.toArray(), expected.color.toArray());
  assert.deepEqual(material.emissive.toArray(), expected.emissive.toArray());
  assert.deepEqual(material.normalScale.toArray(), expected.normalScale.toArray());

  const light = new HemisphereLight(0x88bbff, 0x552211, 2);
  const upstream = new UpstreamHemisphere(0x88bbff, 0x552211, 2);
  assert.ok("position" in upstream && upstream.position instanceof UpstreamVector3);
  light.position.set(1, 2, 3);
  upstream.position.set(1, 2, 3);
  const copy = light.clone(),
    reference = upstream.clone();
  assert.ok(reference instanceof UpstreamHemisphere);
  assert.ok("position" in reference && reference.position instanceof UpstreamVector3);
  assert.deepEqual(copy.color.toArray(), reference.color.toArray());
  assert.deepEqual(copy.groundColor.toArray(), reference.groundColor.toArray());
  assert.deepEqual(copy.position.toArray(), reference.position.toArray());
  assert.equal(copy.intensity, reference.intensity);
  copy.color.setHex(0);
  copy.groundColor.setHex(0);
  copy.position.set(0, 0, 1);
  assert.deepEqual(light.color.toArray(), upstream.color.toArray());
  assert.deepEqual(light.groundColor.toArray(), upstream.groundColor.toArray());
  assert.deepEqual(light.position.toArray(), upstream.position.toArray());
});

test("environment access preserves upstream passthrough and rejects only conversion without a provider", () => {
  const upstream = UpstreamEnvironments(null);
  const flat = new DataTexture(new Uint8Array(4), 1, 1);
  const cube = new CubeTexture();
  const prepared = Object.assign(new CubeTexture(), { isPMREMTexture: true });
  assert.equal(getEnvironment(null, null), null);
  assert.equal(getEnvironment(null, undefined), null);
  for (const texture of [flat, prepared]) {
    for (const usePMREM of [false, true]) {
      assert.equal(getEnvironment(null, texture, usePMREM), texture);
      assert.equal(getEnvironment(null, texture, usePMREM), upstream.get(texture, usePMREM));
    }
  }
  for (const mapping of [CubeReflectionMapping, CubeRefractionMapping]) {
    cube.mapping = mapping;
    assert.equal(getEnvironment(null, cube), cube);
    assert.equal(getEnvironment(null, cube), upstream.get(cube));
    assert.throws(() => getEnvironment(null, cube, true), /createEnvironments/);
  }
  for (const mapping of [EquirectangularReflectionMapping, EquirectangularRefractionMapping]) {
    flat.mapping = mapping;
    for (const usePMREM of [false, true]) {
      assert.throws(() => getEnvironment(null, flat, usePMREM), /createEnvironments/);
    }
  }
  let conversions = 0;
  const environments = {
    get(texture: DataTexture | CubeTexture, usePMREM = false) {
      conversions++;
      assert.equal(texture, flat);
      assert.equal(usePMREM, true);
      return prepared;
    },
  };
  assert.equal(getEnvironment(environments, flat, true), prepared);
  assert.equal(conversions, 1);
  assert.equal(getEnvironment(environments, null, true), null);
  assert.equal(conversions, 1);
  assert.equal(getEnvironment({ get: () => null }, flat, true), null);
  const error = new Error("conversion failed");
  assert.throws(
    () =>
      getEnvironment(
        {
          get() {
            throw error;
          },
        },
        flat,
      ),
    (candidate) => candidate === error,
  );
});

test("background material clones keep independent intensity and UV/rotation uniforms", () => {
  for (const actual of [backgroundShader, backgroundCubeShader]) {
    const material = new ShaderMaterial({ ...actual, uniforms: cloneUniforms(actual.uniforms) });
    const clone = material.clone();
    assert.notEqual(clone.uniforms, material.uniforms);
    assert.notEqual(clone.uniforms.backgroundIntensity, material.uniforms.backgroundIntensity);
    clone.uniforms.backgroundIntensity.value = 0.25;
    assert.equal(material.uniforms.backgroundIntensity.value, 1);
    for (const name of ["uvTransform", "backgroundRotation"]) {
      if (material.uniforms[name]) {
        assert.notEqual(clone.uniforms[name].value, material.uniforms[name].value);
        assert.deepEqual(clone.uniforms[name].value.elements, material.uniforms[name].value.elements);
        clone.uniforms[name].value.elements[0] = 2;
        assert.equal(material.uniforms[name].value.elements[0], 1);
      }
    }
    let disposals = 0;
    clone.addEventListener("dispose", () => disposals++);
    clone.dispose();
    assert.equal(disposals, 1);
  }
});

test("directional shadow matrices and light clones preserve upstream camera and shadow configuration", () => {
  const directional = new DirectionalLight(0xffddaa, 2);
  const upstreamDirectional = new UpstreamDirectionalLight(0xffddaa, 2);
  for (const light of [directional, upstreamDirectional]) {
    const position: unknown = Reflect.get(light, "position");
    const targetPosition: unknown = Reflect.get(light.target, "position");
    assert.ok(position instanceof Vector3 || position instanceof UpstreamVector3);
    assert.ok(targetPosition instanceof Vector3 || targetPosition instanceof UpstreamVector3);
    position.set(3, 5, -2);
    targetPosition.set(-1, 0.5, 2);
    light.updateMatrixWorld();
    light.target.updateMatrixWorld();
    light.shadow.camera.left = -8;
    light.shadow.camera.right = 6;
    light.shadow.camera.near = 0.2;
    light.shadow.camera.far = 70;
    light.shadow.camera.updateProjectionMatrix();
  }
  directional.shadow.updateMatrices(directional);
  upstreamDirectional.shadow.updateMatrices(upstreamDirectional);
  assert.deepEqual(directional.shadow.matrix.elements, upstreamDirectional.shadow.matrix.elements);
  assert.deepEqual(
    directional.shadow.camera.matrixWorldInverse.elements,
    upstreamDirectional.shadow.camera.matrixWorldInverse.elements,
  );
  assert.deepEqual(
    directional.shadow.getFrustum().planes.map((plane) => plane.normal.toArray()),
    upstreamDirectional.shadow.getFrustum().planes.map((plane) => plane.normal.toArray()),
  );
  const point = new PointLight(0x88aaff, 3, 40, 2);
  const upstreamPoint = new UpstreamPointLight(0x88aaff, 3, 40, 2);
  for (const [actual, expected] of [
    [directional, upstreamDirectional],
    [point, upstreamPoint],
  ] as const) {
    for (const light of [actual, expected]) {
      light.shadow.mapSize.set(256, 128);
      light.shadow.bias = -0.002;
      light.shadow.normalBias = 0.03;
      light.shadow.radius = 2;
      light.shadow.blurSamples = 4;
      light.shadow.camera.far = 80;
      light.shadow.camera.updateProjectionMatrix();
    }
    const clone = actual.clone();
    const upstreamClone = expected.clone();
    assert.ok(upstreamClone instanceof UpstreamDirectionalLight || upstreamClone instanceof UpstreamPointLight);
    assert.notEqual(clone.shadow, actual.shadow);
    assert.notEqual(clone.shadow.camera, actual.shadow.camera);
    assert.notEqual(clone.shadow.mapSize, actual.shadow.mapSize);
    const { camera: _camera, ...shadow } = clone.shadow.toJSON();
    const upstreamShadowJSON = upstreamClone.shadow.toJSON();
    assert.ok("camera" in upstreamShadowJSON);
    const { camera: _upstreamCamera, ...upstreamShadow } = upstreamShadowJSON;
    assert.deepEqual(shadow, upstreamShadow);
    assert.deepEqual(
      clone.shadow.camera.projectionMatrix.elements,
      upstreamClone.shadow.camera.projectionMatrix.elements,
    );
    assert.deepEqual(clone.color.toArray(), upstreamClone.color.toArray());
    assert.equal(clone.intensity, upstreamClone.intensity);
  }
  const upstreamPointClone = upstreamPoint.clone();
  assert.ok(upstreamPointClone instanceof UpstreamPointLight);
  assert.equal(point.clone().distance, upstreamPointClone.distance);
  assert.equal(point.clone().decay, upstreamPointClone.decay);
});

test("depth and distance parameters and clones preserve upstream material and texture behavior", () => {
  const parameters = { alphaTest: 0.4, displacementScale: 2, displacementBias: -0.1 };
  const actualMap = new DataTexture(new Uint8Array(4), 1, 1);
  const expectedMap = new UpstreamDataTexture(new Uint8Array(4), 1, 1);
  for (const [Actual, Expected] of [
    [MeshDepthMaterial, UpstreamDepthMaterial],
    [MeshDistanceMaterial, UpstreamDistanceMaterial],
  ] as const) {
    const actual = new Actual({ ...parameters, map: actualMap, alphaMap: actualMap, displacementMap: actualMap });
    const expected = new Expected({
      ...parameters,
      map: expectedMap,
      alphaMap: expectedMap,
      displacementMap: expectedMap,
    });
    const clone = actual.clone();
    const upstreamClone = expected.clone();
    for (const key of ["alphaTest", "displacementScale", "displacementBias"] as const) {
      assert.equal(clone[key], upstreamClone[key]);
    }
    assert.equal(clone.map, actualMap);
    assert.equal(clone.alphaMap, actualMap);
    assert.equal(clone.displacementMap, actualMap);
    clone.displacementScale = 9;
    assert.equal(actual.displacementScale, expected.displacementScale);
  }
  assert.equal(
    new MeshDepthMaterial({ depthPacking: RGBADepthPacking }).clone().depthPacking,
    new UpstreamDepthMaterial({ depthPacking: RGBADepthPacking }).clone().depthPacking,
  );
  const depth = new DepthTexture(32, 16);
  const upstreamDepth = new UpstreamDepthTexture(32, 16);
  depth.compareFunction = upstreamDepth.compareFunction = LessEqualCompare;
  const clone = depth.clone();
  const upstreamClone = upstreamDepth.clone();
  assert.ok(upstreamClone instanceof UpstreamDepthTexture);
  assert.deepEqual(clone.image, upstreamClone.image);
  assert.notEqual(clone.image, depth.image);
  assert.equal(clone.compareFunction, upstreamClone.compareFunction);
  assert.equal(Object.hasOwn(clone, "image"), Object.hasOwn(upstreamClone, "image"));
});

test("scene serialization preserves shared WebGL assets without a node-material cache", () => {
  const root = new Object3D();
  const geometry = new BoxGeometry();
  const map = new DataTexture(new Uint8Array([32, 64, 128, 255]), 1, 1);
  const material = new MeshBasicMaterial({ map });
  const first = new Mesh(geometry, material);
  const second = new Mesh(geometry, material);
  second.position.set(2, 3, 4);
  second.updateMatrix();
  root.add(first, second);
  const serialized = root.toJSON();
  assert.deepEqual(
    serialized.geometries.map((entry: { uuid: string }) => entry.uuid),
    [geometry.uuid],
  );
  assert.deepEqual(
    serialized.materials.map((entry: { uuid: string }) => entry.uuid),
    [material.uuid],
  );
  assert.deepEqual(
    serialized.textures.map((entry: { uuid: string }) => entry.uuid),
    [map.uuid],
  );
  assert.equal(serialized.materials[0].map, map.uuid);
  assert.equal(serialized.object.children[0].geometry, geometry.uuid);
  assert.equal(serialized.object.children[1].material, material.uuid);
  assert.deepEqual(serialized.object.children[1].matrix, second.matrix.toArray());
});
