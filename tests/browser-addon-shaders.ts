import { CopyShader } from "ek3d/addons/shaders/CopyShader";
import { LuminosityShader } from "ek3d/addons/shaders/LuminosityShader";
import { ColorifyShader } from "ek3d/addons/shaders/ColorifyShader";
import { ExposureShader } from "ek3d/addons/shaders/ExposureShader";
import { FreiChenShader } from "ek3d/addons/shaders/FreiChenShader";
import { TriangleBlurShader } from "ek3d/addons/shaders/TriangleBlurShader";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { cloneUniforms } from "ek3d/renderers/shaders/UniformsUtils";
import { Scene } from "ek3d/scenes/Scene";
import { DataTexture } from "ek3d/textures/DataTexture";

export function verifyAddonShaders() {
  const renderer = new WebGLRenderer({ preserveDrawingBuffer: true });
  renderer.setSize(4, 4);
  const gl = renderer.getContext();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new PlaneGeometry(2, 2);
  const texture = new DataTexture(new Uint8Array([64, 128, 192, 255]), 1, 1);
  texture.needsUpdate = true;
  const materials = [
    CopyShader,
    LuminosityShader,
    ColorifyShader,
    ExposureShader,
    FreiChenShader,
    TriangleBlurShader,
  ].map((shader) => new ShaderMaterial({ ...shader, uniforms: cloneUniforms(shader.uniforms) }));
  const mesh = new Mesh(geometry, materials[0]);
  const scene = new Scene();
  scene.add(mesh);
  const pixel = new Uint8Array(4);
  function sample(material: ShaderMaterial, expected: number[], label: string): void {
    mesh.material = material;
    renderer.render(scene, camera);
    gl.readPixels(2, 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    if (!pixel.every((channel, i) => Math.abs(channel - expected[i]) <= 2)) {
      throw new Error(`${label}: ${pixel.join(",")} != ${expected.join(",")}`);
    }
    if (gl.getError() !== gl.NO_ERROR) throw new Error(`${label}: WebGL error`);
  }
  try {
    for (const material of materials) (material.uniforms.tDiffuse ?? material.uniforms.texture).value = texture;
    sample(materials[0], [64, 128, 192, 255], "Copy preserves RGBA");
    materials[0].uniforms.opacity.value = 0.5;
    sample(materials[0], [32, 64, 96, 128], "Copy scales alpha and RGB");
    sample(materials[1], [119, 119, 119, 255], "Rec.709 luminance");
    materials[2].uniforms.color.value.setRGB(0, 1, 0);
    sample(materials[2], [0, 119, 0, 255], "Colorify applies linear tint");
    materials[3].uniforms.exposure.value = 0.5;
    sample(materials[3], [32, 64, 96, 255], "Exposure preserves alpha");
    materials[3].uniforms.exposure.value = 0;
    sample(materials[3], [0, 0, 0, 255], "Zero exposure");
    materials[4].uniforms.aspect.value.set(1, 1);
    sample(materials[4], [0, 0, 0, 255], "FreiChen flat field yields no edges");
    materials[5].uniforms.delta.value.set(0, 0);
    sample(materials[5], [64, 128, 192, 255], "Triangle blur with zero delta preserves texel");
    if (CopyShader.uniforms.tDiffuse.value !== null || CopyShader.uniforms.opacity.value !== 1) {
      throw new Error("Material changes mutated shared shader defaults");
    }
    return {
      glError: gl.getError(),
      checks: [
        "copy",
        "opacity",
        "luminance",
        "tint",
        "exposure",
        "Frei-Chen edge response",
        "triangle blur zero delta",
        "uniform isolation",
      ],
    };
  } finally {
    for (const material of materials) material.dispose();
    texture.dispose();
    geometry.dispose();
    renderer.dispose();
  }
}
