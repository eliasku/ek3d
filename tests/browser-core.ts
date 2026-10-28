import { GL } from "ek3d/GL";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { Fog } from "ek3d/scenes/Fog";
import { FogExp2 } from "ek3d/scenes/FogExp2";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { Uniform } from "ek3d/core/Uniform";
import { UniformsGroup } from "ek3d/core/UniformsGroup";
import { Matrix3 } from "ek3d/math/Matrix3";
import { Vector3 } from "ek3d/math/Vector3";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { BufferUsage, GLSL, ColorSpace } from "ek3d/constants";

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function verifyFogRendering() {
  const renderer = new WebGLRenderer({
    preserveDrawingBuffer: true,
    shaders: { MeshBasicMaterial: basicShader, MeshLambertMaterial: lambertShader },
  });
  const geometry = new PlaneGeometry(8, 8);
  const materials = [new MeshBasicMaterial({ color: 0xff0000 }), new MeshLambertMaterial({ color: 0xff0000 })];
  const light = new HemisphereLight(0xffffff, 0xffffff, Math.PI);
  try {
    renderer.setSize(32, 32);
    renderer.outputColorSpace = ColorSpace.LinearSRGB;
    const scene = new Scene();
    const camera = new PerspectiveCamera(50, 1, 0.1, 20);
    const mesh = new Mesh(geometry, materials[0]);
    mesh.position.z = -4;
    scene.add(mesh, light);
    const gl = renderer.getContext();
    const pixel = new Uint8Array(4);
    const sample = (expected: number[]) => {
      renderer.render(scene, camera);
      gl.readPixels(16, 16, 1, 1, GL.RGBA, GL.UNSIGNED_BYTE, pixel);
      check(gl.getError() === GL.NO_ERROR, "Fog rendering produced a GL error");
      check(
        pixel.every((value, i) => Math.abs(value - expected[i]) <= 1),
        `Fog pixel ${pixel.join(",")} != ${expected.join(",")}`,
      );
    };
    for (const material of materials) {
      mesh.material = material;
      scene.fog = null;
      sample([255, 0, 0, 255]);
      const linear = new Fog(0x00ff00, 2, 6);
      scene.fog = linear;
      sample([128, 128, 0, 255]);
      linear.near = 4;
      sample([255, 0, 0, 255]);
      linear.near = 0;
      linear.far = 4;
      sample([0, 255, 0, 255]);
      const exponential = new FogExp2(0x00ff00, Math.sqrt(Math.log(2)) / 4);
      scene.fog = exponential;
      sample([128, 128, 0, 255]);
      exponential.density = 0;
      sample([255, 0, 0, 255]);
      exponential.density = 1;
      exponential.color.set(0x0000ff);
      sample([0, 0, 255, 255]);
      material.fog = false;
      material.needsUpdate = true;
      sample([255, 0, 0, 255]);
      material.fog = true;
      material.needsUpdate = true;
      scene.fog = null;
      sample([255, 0, 0, 255]);
    }
    return { linear: true, exponential: true, materialOptOut: true, glError: gl.getError() };
  } finally {
    geometry.dispose();
    for (const material of materials) material.dispose();
    light.dispose();
    renderer.dispose();
  }
}

export async function verifyUniformGroups() {
  const renderer = new WebGLRenderer({ preserveDrawingBuffer: true });
  const geometry = new PlaneGeometry(2, 2);
  const gain = new Uniform(1);
  const tint = new Uniform(new Vector3(1, 0, 0));
  const transform = new Uniform(new Matrix3());
  const weights = new Uniform([0.25, 0.75]);
  const offsets = [new Uniform(new Vector3(0.25, 0, 0)), new Uniform(new Vector3(0, 0.25, 0))];
  const signed = new Uniform(-1);
  signed.type = "int";
  const unsigned = new Uniform(4);
  unsigned.type = "uint";
  const amount = new Uniform(1);
  const group = new UniformsGroup().setName("Frame").setUsage(BufferUsage.DynamicDraw);
  group.add(gain).add(tint).add(transform).add(weights).add(offsets).add(signed).add(unsigned);
  const fragmentShader = `precision highp float;
layout(std140) uniform Frame {
  float gain;
  vec3 tint;
  mat3 transform;
  float weights[2];
  vec3 offsets[2];
  int signedValue;
  uint unsignedValue;
};
uniform float amount;
out vec4 fragColor;
void main() {
  vec3 color = transform * (tint * gain * weights[1] + offsets[0] + offsets[1]);
  fragColor = vec4(color * amount * (float(signedValue) + float(unsignedValue)) / 3.0, 1.0);
}`;
  const materials = [
    new ShaderMaterial({
      glslVersion: GLSL.GLSL3,
      uniforms: { amount },
      uniformsGroups: [group],
      vertexShader: "void main() { gl_Position = vec4(position, 1.0); }",
      fragmentShader,
    }),
    new RawShaderMaterial({
      glslVersion: GLSL.GLSL3,
      uniforms: { amount },
      uniformsGroups: [group],
      vertexShader: "precision highp float; in vec3 position; void main() { gl_Position = vec4(position, 1.0); }",
      fragmentShader,
    }),
  ];
  const gl = renderer.getContext();
  try {
    renderer.setSize(32, 32);
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    const mesh = new Mesh(geometry, materials[0]);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const pixel = new Uint8Array(4);
    const sample = (expected: number[]) => {
      renderer.render(scene, camera);
      gl.readPixels(16, 16, 1, 1, GL.RGBA, GL.UNSIGNED_BYTE, pixel);
      check(gl.getError() === GL.NO_ERROR, "Uniform group rendering produced a GL error");
      check(
        pixel.every((value, i) => Math.abs(value - expected[i]) <= 1),
        `UBO pixel ${pixel.join(",")} != ${expected.join(",")}`,
      );
    };
    const buffer = () => {
      const program = gl.getParameter(GL.CURRENT_PROGRAM) as WebGLProgram;
      const index = gl.getUniformBlockIndex(program, "Frame");
      const binding = gl.getActiveUniformBlockParameter(program, index, GL.UNIFORM_BLOCK_BINDING) as number;
      const value = gl.getIndexedParameter(GL.UNIFORM_BUFFER_BINDING, binding) as WebGLBuffer;
      check(gl.isBuffer(value), "Uniform group has no GPU buffer");
      return value;
    };
    sample([255, 64, 0, 255]);
    const first = buffer();
    mesh.material = materials[1];
    sample([255, 64, 0, 255]);
    check(buffer() === first, "Sharing a group across programs duplicated its GPU buffer");
    tint.value.set(0, 0, 1);
    weights.value[1] = 0.5;
    offsets[0].value.set(0, 0, 0.25);
    offsets[1].value.set(0, 0.5, 0);
    sample([0, 128, 191, 255]);
    amount.value = 0.5;
    sample([0, 64, 96, 255]);
    transform.value.set(1, 0, 0, 0, 0.5, 0, 0, 0, 1);
    signed.value = -2;
    unsigned.value = 5;
    sample([0, 32, 96, 255]);
    group.dispose();
    check(!gl.isBuffer(first), "Group disposal did not delete its GPU buffer");
    sample([0, 32, 96, 255]);
    check(buffer() !== first, "Disposed uniform storage was reused");
    const extension = gl.getExtension("WEBGL_lose_context");
    check(extension !== null, "Context restoration requires WEBGL_lose_context");
    const contextEvent = (name: string, action: () => void) =>
      new Promise<void>((resolve, reject) => {
        const done = () => {
          clearTimeout(timeout);
          resolve();
        };
        const timeout = setTimeout(() => {
          renderer.domElement.removeEventListener(name, done);
          reject(new Error(`Timed out waiting for ${name}`));
        }, 10000);
        renderer.domElement.addEventListener(name, done, { once: true });
        action();
      });
    await contextEvent("webglcontextlost", () => extension.loseContext());
    await contextEvent("webglcontextrestored", () => setTimeout(() => extension.restoreContext(), 0));
    mesh.material = materials[0];
    sample([0, 32, 96, 255]);
    const restored = buffer();
    group.dispose();
    check(!gl.isBuffer(restored), "Restored group leaked its GPU buffer");
    check(gl.getError() === GL.NO_ERROR, "Restored group disposal used stale GPU handles");
    return {
      std140: true,
      sharedPrograms: true,
      updates: true,
      disposed: true,
      restored: true,
      glError: gl.getError(),
    };
  } finally {
    group.dispose();
    for (const material of materials) material.dispose();
    geometry.dispose();
    renderer.dispose();
  }
}
