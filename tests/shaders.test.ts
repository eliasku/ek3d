import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { ShaderMaterial } from "../src/materials/ShaderMaterial";
import { RawShaderMaterial } from "../src/materials/RawShaderMaterial";
import { Vector3 } from "../src/math/Vector3";
import { Matrix4 } from "../src/math/Matrix4";
import { DataTexture } from "../src/textures/DataTexture";
import { GLSL3 } from "../src/constants";

test("custom material clone preserves upload flags and upstream value ownership boundaries", () => {
  for (const Material of [ShaderMaterial, RawShaderMaterial]) {
    const texture = new DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
    const structure = { tint: new Vector3(1, 0, 0) };
    const packed = new Float32Array([0.25, 0.75]);
    const material = new Material({
      glslVersion: GLSL3,
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
    assert.equal(clone.glslVersion, GLSL3);
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
