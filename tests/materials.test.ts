import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { LightProbe } from "../src/lights/LightProbe";
import { RectAreaLight } from "../src/lights/RectAreaLight";
import { SphericalHarmonics3 } from "../src/math/SphericalHarmonics3";
import { Vector3 } from "../src/math/Vector3";
import { Vector2 } from "../src/math/Vector2";
import { Color } from "../src/math/Color";
import { Object3D } from "../src/core/Object3D";
import { Material } from "../src/materials/Material";
import type { MaterialProperties } from "../src/materials/Material";
import { RawShaderMaterial } from "../src/materials/RawShaderMaterial";
import { MeshPhongMaterial } from "../src/materials/MeshPhongMaterial";
import { MeshNormalMaterial } from "../src/materials/MeshNormalMaterial";
import { MeshMatcapMaterial } from "../src/materials/MeshMatcapMaterial";
import { MeshToonMaterial } from "../src/materials/MeshToonMaterial";
import { ShadowMaterial } from "../src/materials/ShadowMaterial";
import { MeshStandardMaterial } from "../src/materials/MeshStandardMaterial";
import { MeshPhysicalMaterial } from "../src/materials/MeshPhysicalMaterial";
import { DataTexture } from "../src/textures/DataTexture";
import { createDFGLUT } from "../src/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "../src/renderers/shaders/LTCTextures";
import { toHalfFloat } from "../src/extras/DataUtils";
import { LightProbe as UpstreamProbe } from "../upstream/three.js/src/lights/LightProbe.js";
import { RectAreaLight as UpstreamArea } from "../upstream/three.js/src/lights/RectAreaLight.js";
import { SphericalHarmonics3 as UpstreamSH } from "../upstream/three.js/src/math/SphericalHarmonics3.js";
import { MeshPhongMaterial as UpstreamPhong } from "../upstream/three.js/src/materials/MeshPhongMaterial.js";
import { MeshNormalMaterial as UpstreamNormal } from "../upstream/three.js/src/materials/MeshNormalMaterial.js";
import { MeshMatcapMaterial as UpstreamMatcap } from "../upstream/three.js/src/materials/MeshMatcapMaterial.js";
import { MeshToonMaterial as UpstreamToon } from "../upstream/three.js/src/materials/MeshToonMaterial.js";
import { ShadowMaterial as UpstreamShadow } from "../upstream/three.js/src/materials/ShadowMaterial.js";
import { MeshStandardMaterial as UpstreamStandard } from "../upstream/three.js/src/materials/MeshStandardMaterial.js";
import { MeshPhysicalMaterial as UpstreamPhysical } from "../upstream/three.js/src/materials/MeshPhysicalMaterial.js";
import { getDFGLUT as upstreamDFG } from "../upstream/three.js/src/renderers/shaders/DFGLUTData.js";

const coefficients = Array.from({ length: 27 }, (_, i) => (Math.sin(i + 0.25) * (i + 1)) / 27);
function json(value: unknown): unknown {
  // Object UUIDs are identity; static is an excluded WebGPU flag.
  return JSON.parse(
    JSON.stringify(value, (key, entry: unknown) => (key === "uuid" || key === "static" ? undefined : entry)),
  );
}

test("SH radiance and irradiance preserve all bands, target reuse and directional basis", () => {
  const actual = new SphericalHarmonics3().fromArray(coefficients);
  const expected = new UpstreamSH().fromArray(coefficients) as unknown as SphericalHarmonics3;
  for (const direction of [
    new Vector3(1, 0, 0),
    new Vector3(0, -1, 0),
    new Vector3(0, 0, 1),
    new Vector3(2, -3, 4).normalize(),
  ]) {
    const basis: number[] = [];
    const reference: number[] = [];
    SphericalHarmonics3.getBasisAt(direction, basis);
    UpstreamSH.getBasisAt(direction, reference);
    assert.deepEqual(basis, reference);
    const radiance = new Vector3();
    assert.equal(actual.getAt(direction, radiance), radiance);
    assert.deepEqual(radiance.toArray(), expected.getAt(direction, new Vector3()).toArray());
    const reconstructed = new Vector3();
    actual.coefficients.forEach((coefficient, i) => reconstructed.addScaledVector(coefficient, basis[i]));
    assert.ok(radiance.distanceTo(reconstructed) < 1e-14);
    const irradiance = new Vector3();
    assert.equal(actual.getIrradianceAt(direction, irradiance), irradiance);
    assert.deepEqual(irradiance.toArray(), expected.getIrradianceAt(direction, new Vector3()).toArray());
  }
  actual.zero();
  assert.deepEqual(actual.getAt(new Vector3(0, 0, 1), new Vector3(9, 8, 7)).toArray(), [0, 0, 0]);
});

test("SH blending, array offsets and copies retain independent coefficient storage", () => {
  const actual = new SphericalHarmonics3().fromArray([99, ...coefficients, 88], 1);
  const expected = new UpstreamSH().fromArray([99, ...coefficients, 88], 1) as unknown as SphericalHarmonics3;
  const reversed = [...coefficients].reverse();
  const other = new SphericalHarmonics3().fromArray(reversed);
  actual.add(other).addScaledSH(other, -0.25).scale(0.75).lerp(other, 0.4);
  expected.add(other).addScaledSH(other, -0.25).scale(0.75).lerp(other, 0.4);
  const output = Array(31).fill(123) as number[];
  assert.equal(actual.toArray(output, 2), output);
  assert.deepEqual(output, [123, 123, ...expected.toArray(), 123, 123]);
  const clone = actual.clone();
  assert.ok(clone.equals(actual));
  clone.coefficients[4].x += 1;
  assert.equal(clone.equals(actual), false);
  assert.deepEqual(actual.toArray(), expected.toArray());
  const copied = new SphericalHarmonics3().set(other.coefficients);
  other.zero();
  assert.deepEqual(copied.toArray(), reversed);
});

test("probe SH and area power, transforms, clone and JSON preserve upstream semantics", () => {
  const sh = new SphericalHarmonics3().fromArray(coefficients);
  const probe = new LightProbe(sh, 2.5);
  const upstreamProbe = new UpstreamProbe(new UpstreamSH().fromArray(coefficients), 2.5) as unknown as LightProbe;
  assert.equal(probe.sh, sh);
  const clone = probe.clone();
  assert.notEqual(clone.sh, sh);
  clone.sh.coefficients[0].x += 1;
  assert.deepEqual(sh.toArray(), coefficients);
  assert.deepEqual(json(probe.toJSON()), json(upstreamProbe.toJSON()));
  const area = new RectAreaLight("#8ca4e8", 3, 4, 2);
  const upstreamArea = new UpstreamArea("#8ca4e8", 3, 4, 2) as unknown as RectAreaLight;
  for (const light of [area, upstreamArea]) {
    light.position.set(2, 3, 4);
    light.lookAt(1, -1, 0);
    light.updateMatrixWorld(true);
  }
  assert.deepEqual(area.matrixWorld.elements, upstreamArea.matrixWorld.elements);
  for (const [width, height, power] of [
    [4, 2, 7],
    [1.5, 0.5, 23],
    [0, 1, 0],
  ]) {
    for (const light of [area, upstreamArea]) {
      light.width = width;
      light.height = height;
      light.power = power;
    }
    assert.equal(area.intensity, upstreamArea.intensity);
    assert.equal(area.power, upstreamArea.power);
  }
  area.width = 3;
  area.height = 5;
  area.power = 15 * Math.PI * 2;
  assert.equal(area.intensity, 2);
  area.add(new Object3D());
  const areaClone = area.clone();
  assert.notEqual(areaClone.color, area.color);
  assert.notEqual(areaClone.children[0], area.children[0]);
  assert.equal(areaClone.power, area.power);
  assert.deepEqual(json(new RectAreaLight().copy(area).toJSON()), json(area.toJSON()));
});

test("configured material families preserve values, serialization and subtype cloning", () => {
  const cases: [Material, Material][] = [
    [
      new MeshPhongMaterial({
        color: "#e8a040",
        specular: 0x7799ff,
        shininess: 73,
        emissive: "#112233",
        emissiveIntensity: 2,
      }),
      new UpstreamPhong({
        color: "#e8a040",
        specular: 0x7799ff,
        shininess: 73,
        emissive: "#112233",
        emissiveIntensity: 2,
      }) as unknown as Material,
    ],
    [
      new MeshNormalMaterial({ flatShading: true, opacity: 0.3, transparent: true }),
      new UpstreamNormal({ flatShading: true, opacity: 0.3, transparent: true }) as unknown as Material,
    ],
    [
      new MeshMatcapMaterial({ color: 0xaabbcc, bumpScale: 0.3, flatShading: true }),
      new UpstreamMatcap({ color: 0xaabbcc, bumpScale: 0.3, flatShading: true }) as unknown as Material,
    ],
    [
      new MeshToonMaterial({ color: "coral", emissive: 0x123456, emissiveIntensity: 1.7 }),
      new UpstreamToon({ color: "coral", emissive: 0x123456, emissiveIntensity: 1.7 }) as unknown as Material,
    ],
    [
      new ShadowMaterial({ color: "#203040", opacity: 0.45 }),
      new UpstreamShadow({ color: "#203040", opacity: 0.45 }) as unknown as Material,
    ],
    [
      new MeshStandardMaterial({
        color: "silver",
        roughness: 0.27,
        metalness: 0.8,
        emissive: "#102030",
        envMapIntensity: 2.5,
      }),
      new UpstreamStandard({
        color: "silver",
        roughness: 0.27,
        metalness: 0.8,
        emissive: "#102030",
        envMapIntensity: 2.5,
      }) as unknown as Material,
    ],
    [
      new MeshPhysicalMaterial({
        color: "#d8e8f8",
        clearcoat: 0.7,
        sheen: 0.4,
        sheenColor: "blue",
        attenuationColor: "#a0c0e0",
        specularColor: "orange",
        transmission: 0.8,
        thickness: 0.5,
        iridescence: 0.6,
        anisotropy: 0.3,
        diffuseRoughness: 0.4,
        retroreflectivity: 0.2,
      }),
      new UpstreamPhysical({
        color: "#d8e8f8",
        clearcoat: 0.7,
        sheen: 0.4,
        sheenColor: "blue",
        attenuationColor: "#a0c0e0",
        specularColor: "orange",
        transmission: 0.8,
        thickness: 0.5,
        iridescence: 0.6,
        anisotropy: 0.3,
        diffuseRoughness: 0.4,
        retroreflectivity: 0.2,
      }) as unknown as Material,
    ],
  ];
  for (const [actual, expected] of cases) {
    assert.deepEqual(json(actual.toJSON()), json(expected.toJSON()), actual.type);
    const clone = actual.clone();
    assert.equal(clone.constructor, actual.constructor);
    assert.deepEqual(json(clone.toJSON()), json(expected.clone().toJSON()), actual.type);
    const restored = actual.clone().fromJSON(actual.toJSON(), {});
    assert.deepEqual(
      json(restored.toJSON()),
      json(expected.clone().fromJSON(expected.toJSON(), {}).toJSON()),
      actual.type,
    );
  }
});

test("physical feature setters invalidate programs only across enabled boundaries", () => {
  const actual = new MeshPhysicalMaterial();
  const expected = new UpstreamPhysical() as unknown as MeshPhysicalMaterial;
  for (const key of [
    "anisotropy",
    "clearcoat",
    "diffuseRoughness",
    "dispersion",
    "iridescence",
    "retroreflectivity",
    "sheen",
    "transmission",
  ] as const) {
    for (const value of [0.5, 0.8, 0, -0.1, 1, 0]) {
      const wasEnabled = actual[key] > 0;
      const version = actual.version;
      actual[key] = expected[key] = value;
      assert.equal(actual[key], value);
      assert.equal(actual[key], expected[key]);
      assert.equal(actual.version, version + Number(wasEnabled !== value > 0), key);
      assert.equal(actual.version, expected.version, key);
    }
  }
  for (const value of [0, 0.25, 0.5, 1]) {
    actual.reflectivity = expected.reflectivity = value;
    assert.equal(actual.ior, expected.ior);
    assert.equal(actual.reflectivity, expected.reflectivity);
  }
  actual.ior = 2;
  assert.equal(actual.reflectivity, 2.5 / 3);
});

test("physical clone owns colors, vectors and defines but shares application textures", () => {
  const texture = new DataTexture(new Uint8Array([30, 70, 120, 255]), 1, 1);
  const original = new MeshPhysicalMaterial({
    normalScale: new Vector2(0.5, 0.8),
    clearcoatNormalScale: new Vector2(0.3, 0.7),
    sheenColor: new Color(0.2, 0.3, 0.4),
    specularColor: "#aabbcc",
    attenuationColor: "#bbccdd",
  });
  const mapKeys = [
    "map",
    "alphaMap",
    "aoMap",
    "lightMap",
    "emissiveMap",
    "normalMap",
    "bumpMap",
    "displacementMap",
    "roughnessMap",
    "metalnessMap",
    "envMap",
    "anisotropyMap",
    "clearcoatMap",
    "clearcoatRoughnessMap",
    "clearcoatNormalMap",
    "diffuseRoughnessMap",
    "iridescenceMap",
    "iridescenceThicknessMap",
    "sheenColorMap",
    "sheenRoughnessMap",
    "transmissionMap",
    "thicknessMap",
    "specularIntensityMap",
    "specularColorMap",
  ] as const;
  for (const key of mapKeys) original[key] = texture;
  const clone = original.clone();
  for (const key of mapKeys) assert.equal(clone[key], texture, key);
  for (const key of ["color", "emissive", "sheenColor", "specularColor", "attenuationColor"] as const) {
    assert.notEqual(clone[key], original[key], key);
    clone[key].setRGB(9, 8, 7);
    assert.notDeepEqual(clone[key].toArray(), original[key].toArray(), key);
  }
  for (const key of ["normalScale", "clearcoatNormalScale"] as const) {
    assert.notEqual(clone[key], original[key]);
    clone[key].set(5, 6);
    assert.notDeepEqual(clone[key].toArray(), original[key].toArray());
  }
  clone.defines.EXTRA = "1";
  assert.equal("EXTRA" in original.defines, false);
  clone.envMapRotation.x += 1;
  assert.notEqual(clone.envMapRotation.x, original.envMapRotation.x);
  let textureDisposals = 0;
  texture.addEventListener("dispose", () => textureDisposals++);
  clone.dispose();
  original.dispose();
  assert.equal(textureDisposals, 0);
  texture.dispose();
  assert.equal(textureDisposals, 1);
});

test("DFG factory preserves fitted upstream values and independent caller ownership", () => {
  const first = createDFGLUT();
  const second = createDFGLUT();
  const upstream = upstreamDFG();
  assert.ok(first.image.data instanceof Uint16Array);
  assert.ok(second.image.data instanceof Uint16Array);
  assert.deepEqual(first.image.data, upstream.image.data);
  assert.deepEqual(
    [first.image.width, first.image.height, first.format, first.type, first.minFilter, first.magFilter],
    [
      upstream.image.width,
      upstream.image.height,
      upstream.format,
      upstream.type,
      upstream.minFilter,
      upstream.magFilter,
    ],
  );
  assert.notEqual(first, second);
  assert.notEqual(first.source, second.source);
  assert.notEqual(first.image.data, second.image.data);
  const previous = second.image.data[0];
  first.image.data[0] = 0;
  assert.equal(second.image.data[0], previous);
  let disposed = false;
  second.addEventListener("dispose", () => {
    disposed = true;
  });
  first.dispose();
  assert.equal(disposed, false);
  second.dispose();
  assert.equal(disposed, true);
});

test("LTC half data represents the same fitted matrices and factories do not share writable storage", () => {
  const first = createLTCTextures();
  const second = createLTCTextures();
  for (const [floatKey, halfKey] of [
    ["LTC_FLOAT_1", "LTC_HALF_1"],
    ["LTC_FLOAT_2", "LTC_HALF_2"],
  ] as const) {
    const floats = first[floatKey].image.data as Float32Array;
    const halves = first[halfKey].image.data as Uint16Array;
    assert.equal(floats.length, 64 * 64 * 4);
    assert.equal(halves.length, floats.length);
    // The source is rounded to float32 before conversion; tolerate one half-ULP at rounding ties.
    for (let i = 0; i < floats.length; i++)
      assert.ok(Math.abs(halves[i] - toHalfFloat(floats[i])) <= 1, `LTC ${floatKey}[${i}]`);
    assert.ok(floats.every(Number.isFinite));
    const secondData = second[floatKey].image.data;
    assert.ok(secondData instanceof Float32Array);
    const previous = secondData[0];
    floats[0] = 42;
    assert.equal(secondData[0], previous);
    assert.notEqual(first[halfKey].image.data, second[halfKey].image.data);
  }
  for (const texture of [...Object.values(first), ...Object.values(second)]) texture.dispose();
});

test("material IDs and physical setters retain descriptor and update contracts", () => {
  const material = new Material();
  assert.deepEqual(Object.getOwnPropertyDescriptor(material, "id"), {
    value: material.id,
    writable: false,
    enumerable: false,
    configurable: false,
  });
  const physical = new MeshPhysicalMaterial();
  for (const property of [
    "anisotropy",
    "clearcoat",
    "diffuseRoughness",
    "dispersion",
    "iridescence",
    "retroreflectivity",
    "sheen",
    "transmission",
  ] as const) {
    assert.equal(Object.hasOwn(physical, property), false);
    const version = physical.version;
    physical[property] = 0.5;
    assert.equal(physical.version, version + 1, property);
    assert.equal(physical[property], 0.5);
  }
  const reflectivity = Object.getOwnPropertyDescriptor(physical, "reflectivity");
  assert.equal(typeof reflectivity?.get, "function");
  assert.equal(typeof reflectivity?.set, "function");
  assert.equal(reflectivity?.enumerable, false);
  assert.equal(reflectivity?.configurable, false);
  physical.reflectivity = 0.25;
  assert.ok(Math.abs(physical.ior - 1.1 / 0.9) < 1e-12);
  const restored: Material & MaterialProperties = new Material().fromJSON({ roughness: 0.4 });
  assert.equal(restored.roughness, 0.4);
  assert.equal(restored.toJSON().roughness, 0.4);
});

test("material initialization and polymorphic copies preserve inherited state", () => {
  const shader = new RawShaderMaterial({ uniforms: { time: { value: 3 } }, name: "custom" });
  assert.equal(shader.uniforms.time.value, 3);
  assert.equal(shader.name, "custom");
  assert.equal(shader.type, "RawShaderMaterial");
  class CustomPhysicalMaterial extends MeshPhysicalMaterial {
    label: string = "custom";
  }
  const material = new CustomPhysicalMaterial({ clearcoat: 0.7, roughness: 0.2 });
  const cloned: CustomPhysicalMaterial = material.clone();
  const copied: CustomPhysicalMaterial = new CustomPhysicalMaterial().copy(material);
  assert.ok(cloned instanceof CustomPhysicalMaterial);
  assert.equal(cloned.clearcoat, 0.7);
  assert.equal(copied.roughness, 0.2);
  assert.equal(cloned.label, "custom");
});
