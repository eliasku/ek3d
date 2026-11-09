import { test, vi } from "vite-plus/test";
import assert from "node:assert/strict";
import { ShaderMaterial } from "../src/materials/ShaderMaterial";
import { RawShaderMaterial } from "../src/materials/RawShaderMaterial";
import { Vector3 } from "../src/math/Vector3";
import { Matrix4 } from "../src/math/Matrix4";
import { Color } from "../src/math/Color";
import { Matrix3 } from "../src/math/Matrix3";
import { Quaternion } from "../src/math/Quaternion";
import { Vector2 } from "../src/math/Vector2";
import { Vector4 } from "../src/math/Vector4";
import { DataTexture } from "../src/textures/DataTexture";
import { GLSL } from "../src/constants";
import { cloneUniforms } from "../src/renderers/shaders/UniformsUtils";
import { WebGLRenderTarget } from "../src/renderers/WebGLRenderTarget";
import { GL } from "../src/GL";
import { WebGLUniforms } from "../src/renderers/webgl/WebGLUniforms";

test("custom material clone preserves upload flags and upstream value ownership boundaries", () => {
  for (const Material of [ShaderMaterial, RawShaderMaterial]) {
    const texture = new DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
    const structure = { tint: new Vector3(1, 0, 0) };
    const packed = new Float32Array([0.25, 0.75]);
    const material = new Material({
      glslVersion: GLSL.GLSL3,
      defines: { CUSTOM: 1 },
      vertexShader: "void main() {}",
      fragmentShader: "void main() {}",
      uniforms: {
        scalar: { value: 1, needsUpdate: false },
        tint: { value: new Vector3(1, 0, 0) },
        matrices: { value: [new Matrix4(), new Matrix4()] },
        structure: { value: structure },
        packed: { value: packed },
        map: { value: texture },
      },
    });
    const clone = material.clone();
    assert.equal(clone.type, material.type);
    assert.equal(clone.glslVersion, GLSL.GLSL3);
    assert.equal(clone.vertexShader, material.vertexShader);
    assert.equal(clone.fragmentShader, material.fragmentShader);
    assert.notEqual(clone.defines, material.defines);
    assert.notEqual(clone.uniforms, material.uniforms);
    assert.equal(clone.uniforms.scalar.needsUpdate, false);
    assert.notEqual(clone.uniforms.tint.value, material.uniforms.tint.value);
    assert.notEqual(clone.uniforms.matrices.value[0], material.uniforms.matrices.value[0]);
    // Upstream clones recognized math/texture values, not arbitrary nested structures or typed arrays.
    assert.equal(clone.uniforms.structure.value, structure);
    assert.equal(clone.uniforms.packed.value, packed);
    const clonedTexture: DataTexture = clone.uniforms.map.value;
    assert.notEqual(clonedTexture, texture);
    assert.equal(clonedTexture.source, texture.source);
    let textureDisposals = 0;
    texture.addEventListener("dispose", () => {
      textureDisposals++;
    });
    const version = material.version;
    material.uniforms.scalar.value = 2;
    material.uniformsNeedUpdate = true;
    assert.equal(material.version, version);
    material.needsUpdate = true;
    assert.equal(material.version, version + 1);
    material.dispose();
    clone.dispose();
    assert.equal(textureDisposals, 0, "Uniform textures remain caller-owned");
    texture.dispose();
    clonedTexture.dispose();
  }
});

test("uniform cloning nulls direct render-target textures but clones textures inside arrays", () => {
  const target = new WebGLRenderTarget(2, 2);
  const texture = new DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const source = {
      target: { value: target.texture, needsUpdate: false },
      map: { value: texture, label: "albedo" },
      maps: { value: [target.texture] },
      vectors: { value: [new Vector3(1, 2, 3)] },
    };
    const clone = cloneUniforms(source);
    assert.equal(clone.target.value, null);
    assert.equal(clone.target.needsUpdate, false);
    assert.equal(source.target.value, target.texture);
    assert.ok(clone.map.value);
    assert.notEqual(clone.map.value, texture);
    assert.equal(clone.map.value.source, texture.source);
    assert.equal(clone.map.label, "albedo");
    assert.notEqual(clone.maps.value[0], target.texture);
    assert.equal(clone.maps.value[0].source, target.texture.source);
    clone.vectors.value[0].x = 9;
    assert.deepEqual(source.vectors.value[0].toArray(), [1, 2, 3]);
    clone.map.value.dispose();
    clone.maps.value[0].dispose();
  } finally {
    warning.mockRestore();
    texture.dispose();
    target.dispose();
  }
});

test("uniform cloning dispatches math values and preserves custom clone overrides", () => {
  const values = [
    new Color(0.2, 0.4, 0.6),
    new Matrix3().set(1, 2, 3, 4, 5, 6, 7, 8, 9),
    new Matrix4().makeTranslation(1, 2, 3),
    new Vector2(2, 3),
    new Vector3(3, 4, 5),
    new Vector4(4, 5, 6, 7),
    new Quaternion(0, 0.6, 0, 0.8),
  ];
  for (const value of values) {
    const clone = cloneUniforms({ direct: { value }, array: { value: [value] } });
    assert.notEqual(clone.direct.value, value);
    assert.notEqual(clone.array.value[0], value);
    assert.deepEqual(clone.direct.value.toArray(), value.toArray());
    assert.deepEqual(clone.array.value[0].toArray(), value.toArray());
  }

  class CustomTexture extends DataTexture {
    override clone(): CustomTexture {
      const result = new CustomTexture().copy(this);
      result.name = "custom clone";
      return result;
    }
  }
  const texture = new CustomTexture();
  const custom = { clone: () => ({ copied: true }) };
  const clone = cloneUniforms({ map: { value: texture }, mixed: { value: [new Vector3(1, 2, 3), custom] } });
  assert.equal(clone.map.value?.name, "custom clone");
  assert.deepEqual(clone.mixed.value[1], { copied: true });
  assert.equal(texture.name, "");
  assert.throws(() => cloneUniforms({ invalid: { value: [new Vector3(), {}] } }), TypeError);
});

test("uniform uploads retain numeric fast paths, math arrays and nested value updates", () => {
  const activeUniforms: WebGLActiveInfo[] = [
    { name: "numeric[0]", type: GL.FLOAT_VEC3, size: 2 },
    { name: "typed[0]", type: GL.FLOAT_VEC3, size: 2 },
    { name: "vectors2[0]", type: GL.FLOAT_VEC2, size: 2 },
    { name: "vectors3[0]", type: GL.FLOAT_VEC3, size: 2 },
    { name: "vectors4[0]", type: GL.FLOAT_VEC4, size: 2 },
    { name: "matrices3[0]", type: GL.FLOAT_MAT3, size: 2 },
    { name: "matrices4[0]", type: GL.FLOAT_MAT4, size: 2 },
    { name: "lights[0].color", type: GL.FLOAT_VEC3, size: 1 },
    { name: "lights[1].color", type: GL.FLOAT_VEC3, size: 1 },
  ];
  const uploads: Record<string, number[]> = {};
  const forwarded: Record<string, unknown> = {};
  function upload(name: string, values: ArrayLike<number>): void {
    uploads[name] = Array.from(values);
    forwarded[name] = values;
  }
  const gl = {
    getProgramParameter: () => activeUniforms.length,
    getActiveUniform: (_program: unknown, index: number) => activeUniforms[index],
    getUniformLocation: (_program: unknown, name: string) => name,
    uniform2fv: upload,
    uniform3fv: upload,
    uniform4fv: upload,
    uniformMatrix3fv: (name: string, transpose: boolean, values: ArrayLike<number>) => {
      assert.equal(transpose, false);
      upload(name, values);
    },
    uniformMatrix4fv: (name: string, transpose: boolean, values: ArrayLike<number>) => {
      assert.equal(transpose, false);
      upload(name, values);
    },
    uniform3f: (name: string, x: number, y: number, z: number) => {
      uploads[name] = [x, y, z];
    },
  };
  const uniforms = new WebGLUniforms(gl);
  const numeric = [1, 2, 3, 4, 5, 6];
  const typed = new Float32Array([6, 5, 4, 3, 2, 1]);
  const lightValues = [{ color: new Color(1, 2, 3) }, { color: new Color(4, 5, 6) }];
  WebGLUniforms.upload(gl, uniforms.seq, {
    numeric: { value: numeric },
    typed: { value: typed },
    vectors2: {
      value: [
        new Vector2(1, 2),
        {
          toArray(array: Float32Array, offset: number): Float32Array {
            array[offset] = 3;
            array[offset + 1] = 4;
            return array;
          },
        },
      ],
    },
    vectors3: { value: [new Color(1, 2, 3), new Vector3(4, 5, 6)] },
    vectors4: { value: [new Vector4(1, 2, 3, 4), new Quaternion(5, 6, 7, 8)] },
    matrices3: { value: [new Matrix3().set(1, 2, 3, 4, 5, 6, 7, 8, 9), new Matrix3()] },
    matrices4: { value: [new Matrix4().makeTranslation(1, 2, 3), new Matrix4().makeScale(2, 3, 4)] },
    lights: { value: lightValues },
  });
  assert.equal(forwarded["numeric[0]"], numeric);
  assert.equal(forwarded["typed[0]"], typed);
  assert.deepEqual(uploads["numeric[0]"], [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(uploads["typed[0]"], [6, 5, 4, 3, 2, 1]);
  assert.deepEqual(uploads["vectors2[0]"], [1, 2, 3, 4]);
  assert.deepEqual(uploads["vectors3[0]"], [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(uploads["vectors4[0]"], [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(uploads["matrices3[0]"], [1, 4, 7, 2, 5, 8, 3, 6, 9, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.deepEqual(
    uploads["matrices4[0]"],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1, 2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1],
  );
  assert.deepEqual(uploads["lights[0].color"], [1, 2, 3]);
  assert.deepEqual(uploads["lights[1].color"], [4, 5, 6]);
  lightValues[0].color.setRGB(7, 8, 9);
  uniforms.setValue(gl, "lights", lightValues);
  assert.deepEqual(uploads["lights[0].color"], [7, 8, 9]);
  assert.deepEqual(uploads["lights[1].color"], [4, 5, 6]);
});
