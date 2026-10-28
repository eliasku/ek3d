import { GL } from "ek3d/GL";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import type { ShaderMaterialParameters } from "ek3d/materials/ShaderMaterial";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { Uniform } from "ek3d/core/Uniform";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Vector3 } from "ek3d/math/Vector3";
import { Matrix4 } from "ek3d/math/Matrix4";
import { DataTexture } from "ek3d/textures/DataTexture";
import { Data3DTexture } from "ek3d/textures/Data3DTexture";
import { DataArrayTexture } from "ek3d/textures/DataArrayTexture";
import { CubeTexture } from "ek3d/textures/CubeTexture";
import { GLSL } from "ek3d/constants";

declare const canvas: HTMLCanvasElement;
const parameters: ShaderMaterialParameters = {
  glslVersion: GLSL.GLSL3,
  uniforms: {
    time: { value: 0, needsUpdate: false },
    tint: new Uniform(new Vector3(1, 0, 0)),
    object: { value: { tint: new Vector3(), gain: 1 } },
    matrices: { value: [new Matrix4(), new Matrix4()] },
    scalars: { value: new Float32Array([1, 2]) },
    samplers: { value: [new DataTexture(), new DataTexture()] },
    cube: { value: new CubeTexture() },
    volume: { value: new Data3DTexture() },
    layers: { value: new DataArrayTexture() },
  },
  defines: { ITERATIONS: 2, FEATURE: true, EXPRESSION: "vec3(1.0)" },
  vertexShader: "void main() { gl_Position = vec4(position, 1.0); }",
  fragmentShader: "out vec4 result; void main() { result = vec4(1.0); }",
};
const material: ShaderMaterial = new ShaderMaterial(parameters).clone();
const raw: RawShaderMaterial = new RawShaderMaterial(parameters).clone();
material.uniforms.time.needsUpdate = true;
raw.uniforms.time.needsUpdate = false;
material.uniformsNeedUpdate = true;
material.needsUpdate = true;
raw.glslVersion = GLSL.GLSL1;
const renderer = new WebGLRenderer({ canvas, shaderChunks: { custom: "const float gain = 1.0;" } });
renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
  const link: boolean = gl.getProgramParameter(program, GL.LINK_STATUS);
  const vertexLog: string | null = gl.getShaderInfoLog(vertex);
  const fragmentLog: string | null = gl.getShaderInfoLog(fragment);
  const programLog: string | null = gl.getProgramInfoLog(program);
  void [link, vertexLog, fragmentLog, programLog];
};
renderer.debug.onShaderError = null;
// @ts-expect-error Every uniform requires a value wrapper.
new ShaderMaterial({ uniforms: { time: 1 } });
// @ts-expect-error Per-uniform upload control is boolean.
new RawShaderMaterial({ uniforms: { time: { value: 1, needsUpdate: "yes" } } });
// @ts-expect-error Only supported WebGL GLSL dialect strings are accepted.
new ShaderMaterial({ glslVersion: "450" });
// @ts-expect-error Shader source is text.
new RawShaderMaterial({ fragmentShader: 1 });
// @ts-expect-error Diagnostics receive GPU program/shader objects, not a message string.
renderer.debug.onShaderError = (message: string) => {
  void message;
};
// @ts-expect-error Explicit shader chunks are GLSL strings.
new WebGLRenderer({ shaderChunks: { custom: 1 } });
void [material, raw];
