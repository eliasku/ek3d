import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Vector4 } from "ek3d/math/Vector4";
import { Matrix3 } from "ek3d/math/Matrix3";
import { Matrix4 } from "ek3d/math/Matrix4";
import { DataTexture } from "ek3d/textures/DataTexture";
import { Data3DTexture } from "ek3d/textures/Data3DTexture";
import { DataArrayTexture } from "ek3d/textures/DataArrayTexture";
import { CubeTexture } from "ek3d/textures/CubeTexture";
import type { Texture } from "ek3d/textures/Texture";
import { GLSL1, GLSL3, NearestFilter } from "ek3d/constants";

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function verifyCustomShaders() {
  const renderer = new WebGLRenderer({ preserveDrawingBuffer: true });
  renderer.setSize(16, 16);
  const gl = renderer.getContext();
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const geometry = new PlaneGeometry(2, 2);
  const materials: ShaderMaterial[] = [];
  const textures: Texture[] = [];
  const initialMaterial = new ShaderMaterial();
  const mesh = new Mesh(geometry, initialMaterial);
  materials.push(initialMaterial);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const pixel = new Uint8Array(4);
  const diagnostics: Array<{
    kind: string;
    vertex: boolean;
    fragment: boolean;
    linked: boolean;
    programLog: string;
    vertexLog: string;
    fragmentLog: string;
  }> = [];
  const sample = (expected: number[], label: string) => {
    renderer.render(scene, camera);
    gl.readPixels(8, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    check(gl.getError() === gl.NO_ERROR, `${label}: unexpected GL error`);
    check(
      pixel.every((value, i) => Math.abs(value - expected[i]) <= 2),
      `${label}: ${pixel.join(",")} != ${expected.join(",")}`,
    );
  };
  const currentProgram = () => gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
  try {
    // GLSL1 ShaderMaterial is translated by the renderer; RawShaderMaterial stays GLSL1.
    for (const raw of [false, true]) {
      for (const glslVersion of [GLSL1, GLSL3] as const) {
        const modern = glslVersion === GLSL3;
        const material = new (raw ? RawShaderMaterial : ShaderMaterial)({
          glslVersion,
          uniforms: { tint: { value: new Vector3(0.25, 0.5, 0.75) } },
          vertexShader: `${raw ? `precision highp float; ${modern ? "in" : "attribute"} vec3 position;` : ""}\nvoid main() { gl_Position = vec4(position, 1.0); }`,
          fragmentShader: `precision highp float; uniform vec3 tint; ${modern ? "out vec4 result;" : ""}\nvoid main() { ${modern ? "result" : "gl_FragColor"} = vec4(tint, 1.0); }`,
        });
        materials.push(material);
        mesh.material = material;
        sample([64, 128, 191, 255], `${raw ? "raw" : "shader"} ${glslVersion}`);
      }
    }

    const included = new ShaderMaterial({
      vertexShader: "void main() { gl_Position = vec4(position, 1.0); }",
      fragmentShader: "#include <custom_color>\nvoid main() { gl_FragColor = vec4(customColor(), 1.0); }",
    });
    materials.push(included);
    mesh.material = included;
    const createProgram = gl.createProgram.bind(gl);
    let allocated = 0;
    let includeFailure = "";
    gl.createProgram = function () {
      allocated++;
      return createProgram();
    };
    try {
      renderer.compile(scene, camera);
    } catch (error) {
      includeFailure = error instanceof Error ? error.message : String(error);
    } finally {
      gl.createProgram = createProgram;
    }
    check(
      includeFailure.includes("Cannot resolve shader include <custom_color>"),
      "Missing explicit chunk did not fail clearly",
    );
    check(allocated === 0, "Missing include leaked an allocated GPU program");
    renderer.shaderChunks.custom_color = "#include <custom_value>\nvec3 customColor() { return customValue; }";
    renderer.shaderChunks.custom_value = "const vec3 customValue = vec3(0.0, 0.0, 1.0);";
    included.needsUpdate = true;
    sample([0, 0, 255, 255], "explicit nested chunks after missing include");

    const uniforms = {
      scalar: { value: 0.25, needsUpdate: true },
      pair: { value: new Vector2(0.25, 0.25) },
      triple: { value: new Vector3(0.25, 0.25, 0.25) },
      quad: { value: new Vector4(0.25, 0.25, 0.25, 0.25) },
      m2: { value: new Float32Array([1, 0, 0, 1]) },
      m3: { value: new Matrix3() },
      m4: { value: new Matrix4() },
      weights: { value: new Float32Array([0.25, 0.25]) },
      vectors: { value: [new Vector3(0.25, 0, 0), new Vector3(0, 0.25, 0)] },
      matrices: { value: [new Matrix4(), new Matrix4()] },
      matrices3: { value: [new Matrix3(), new Matrix3()] },
      matrices2: { value: new Float32Array([1, 0, 0, 1, 1, 0, 0, 1]) },
      surface: { value: { tint: new Vector3(0.25, 0.25, 0.25), gain: 1 } },
      stops: {
        value: [
          { tint: new Vector3(0.25, 0, 0), gain: 1 },
          { tint: new Vector3(0, 0.25, 0), gain: 1 },
        ],
      },
      enabled: { value: true },
      signedValue: { value: -2 },
      unsignedValue: { value: 3 },
      signedArray: { value: new Int32Array([-1, 2]) },
      unsignedArray: { value: new Uint32Array([1, 2]) },
      integerVector: { value: new Int32Array([1, 2, 3]) },
      unsignedVector: { value: new Uint32Array([1, 2]) },
      booleanVector: { value: [true, false] },
    };
    const structured = new ShaderMaterial({
      glslVersion: GLSL3,
      uniforms,
      vertexShader: "void main() { gl_Position = vec4(position, 1.0); }",
      fragmentShader: `
        struct Surface { vec3 tint; float gain; };
        uniform Surface surface; uniform Surface stops[2];
        uniform float scalar; uniform vec2 pair; uniform vec3 triple; uniform vec4 quad;
        uniform mat2 m2; uniform mat3 m3; uniform mat4 m4;
        uniform float weights[2]; uniform vec3 vectors[2];
        uniform mat2 matrices2[2]; uniform mat3 matrices3[2]; uniform mat4 matrices[2];
        uniform bool enabled; uniform int signedValue; uniform uint unsignedValue;
        uniform int signedArray[2]; uniform uint unsignedArray[2];
        uniform ivec3 integerVector; uniform uvec2 unsignedVector; uniform bvec2 booleanVector;
        out vec4 result;
        void main() {
          float r = (scalar + pair.x + triple.y + quad.z) / 4.0;
          float g = (weights[0] + weights[1] + vectors[0].x + vectors[1].y + surface.tint.y * surface.gain + stops[0].tint.x * stops[0].gain + stops[1].tint.y * stops[1].gain) / 7.0;
          float b = (m2[0][0] + m3[1][1] + m4[2][2] + matrices[0][0][0] + matrices[1][1][1] + matrices3[0][0][0] + matrices3[1][1][1] + matrices2[0][0][0] + matrices2[1][1][1]) / 36.0;
          bool valid = enabled && signedValue == -2 && unsignedValue == 3u && signedArray[0] + signedArray[1] == 1 && unsignedArray[0] + unsignedArray[1] == 3u && integerVector == ivec3(1, 2, 3) && unsignedVector == uvec2(1u, 2u) && booleanVector == bvec2(true, false);
          result = vec4(vec3(r, g, b) * (valid ? 1.0 : 0.0), 1.0);
        }`,
    });
    materials.push(structured);
    mesh.material = structured;
    sample([64, 64, 64, 255], "structured/scalar/vector/matrix/typed arrays");
    const cachedProgram = currentProgram();
    const uniform1f = gl.uniform1f.bind(gl);
    let scalarUploads = 0;
    gl.uniform1f = (location, value) => {
      scalarUploads++;
      uniform1f(location, value);
    };
    try {
      sample([64, 64, 64, 255], "unchanged uniforms");
      check(scalarUploads === 0, "Unchanged scalar/struct leaves bypassed the uniform cache");
    } finally {
      gl.uniform1f = uniform1f;
    }
    check(currentProgram() === cachedProgram, "Unchanged uniforms rebuilt the program");
    uniforms.scalar.value = 0.75;
    uniforms.scalar.needsUpdate = false;
    sample([64, 64, 64, 255], "per-uniform update opt-out");
    uniforms.scalar.needsUpdate = true;
    uniforms.pair.value.x = 0.75;
    uniforms.triple.value.y = 0.75;
    uniforms.quad.value.z = 0.75;
    uniforms.weights.value.fill(0.75);
    uniforms.vectors.value[0].x = uniforms.vectors.value[1].y = 0.75;
    uniforms.surface.value.tint.y = 0.75;
    uniforms.stops.value[0].gain = uniforms.stops.value[1].gain = 3;
    uniforms.m2.value[0] = 3;
    uniforms.m3.value.elements[4] = 3;
    uniforms.m4.value.elements[10] = 3;
    uniforms.matrices.value[0].elements[0] = uniforms.matrices.value[1].elements[5] = 3;
    uniforms.matrices3.value[0].elements[0] = uniforms.matrices3.value[1].elements[4] = 3;
    uniforms.matrices2.value[0] = uniforms.matrices2.value[7] = 3;
    structured.uniformsNeedUpdate = true;
    sample([191, 191, 191, 255], "in-place updates");
    check(!structured.uniformsNeedUpdate, "Renderer did not consume uniformsNeedUpdate");
    check(currentProgram() === cachedProgram, "Value updates recompiled the program");
    structured.needsUpdate = true;
    sample([191, 191, 191, 255], "same source cache reuse");
    check(currentProgram() === cachedProgram, "Identical source missed program cache");

    const data = (r: number, g: number, b: number) => new Uint8Array([r, g, b, 255]);
    const red = new DataTexture(data(255, 0, 0), 1, 1);
    const green = new DataTexture(data(0, 255, 0), 1, 1);
    const volume = new Data3DTexture(data(0, 0, 255), 1, 1, 1);
    const layers = new DataArrayTexture(data(255, 255, 255), 1, 1, 1);
    const faces = Array.from({ length: 6 }, () => new DataTexture(data(255, 0, 0), 1, 1));
    const cube = new CubeTexture(faces);
    textures.push(red, green, volume, layers, cube, ...faces);
    for (const texture of textures) {
      texture.minFilter = texture.magFilter = NearestFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
    }
    const samplerUniforms = {
      maps: { value: [red, green] },
      cubeMap: { value: cube },
      volume: { value: volume },
      layers: { value: layers },
    };
    const sampler = new RawShaderMaterial({
      glslVersion: GLSL3,
      uniforms: samplerUniforms,
      vertexShader: "precision highp float; in vec3 position; void main() { gl_Position = vec4(position, 1.0); }",
      fragmentShader: `precision highp float; precision highp sampler3D; precision highp sampler2DArray;
        uniform sampler2D maps[2]; uniform samplerCube cubeMap; uniform sampler3D volume; uniform sampler2DArray layers;
        out vec4 result;
        void main() { result = (texture(maps[0], vec2(0.5)) + texture(maps[1], vec2(0.5)) + texture(cubeMap, vec3(1.0, 0.0, 0.0)) + texture(volume, vec3(0.5)) + texture(layers, vec3(0.5, 0.5, 0.0))) / 5.0; }`,
    });
    materials.push(sampler);
    mesh.material = sampler;
    sample([153, 102, 102, 255], "2D array/cube/3D/layer samplers");
    samplerUniforms.maps.value[0] = green;
    sample([102, 153, 102, 255], "sampler rebinding");
    green.image.data!.set(data(0, 0, 255));
    green.needsUpdate = true;
    sample([102, 51, 204, 255], "sampler texture update");
    const shared = new RawShaderMaterial({
      glslVersion: GLSL3,
      uniforms: samplerUniforms,
      vertexShader: sampler.vertexShader,
      fragmentShader: sampler.fragmentShader,
    });
    materials.push(shared);
    const sharedProgram = currentProgram();
    mesh.material = shared;
    sample([102, 51, 204, 255], "shared program");
    check(currentProgram() === sharedProgram, "Identical custom sources did not share a program");
    const greenHandle: WebGLTexture = renderer.properties.get(green).__webglTexture;
    sampler.dispose();
    sample([102, 51, 204, 255], "one program owner disposed");
    check(gl.isTexture(greenHandle), "Material disposal destroyed a caller-owned texture");
    shared.dispose();
    gl.useProgram(null);
    check(!gl.isProgram(sharedProgram), "Last material owner leaked the program");
    green.dispose();
    check(!gl.isTexture(greenHandle), "Texture disposal leaked sampler storage");
    sample([102, 51, 204, 255], "disposed material and texture reallocation");
    check(currentProgram() !== sharedProgram, "Disposed program was reused");

    for (const kind of ["compile", "link"]) {
      const broken = new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader:
          "precision highp float; in vec3 position; out vec3 mismatch; void main() { mismatch = position; gl_Position = vec4(position, 1.0); }",
        fragmentShader:
          kind === "compile"
            ? "precision highp float; out vec4 result; void main() { result = definitely_not_valid_glsl; }"
            : "precision highp float; in vec4 mismatch; out vec4 result; void main() { result = mismatch; }",
      });
      materials.push(broken);
      mesh.material = broken;
      const before = diagnostics.length;
      renderer.debug.onShaderError = (context, program, vertex, fragment) => {
        diagnostics.push({
          kind,
          vertex: context.getShaderParameter(vertex, context.COMPILE_STATUS) === true,
          fragment: context.getShaderParameter(fragment, context.COMPILE_STATUS) === true,
          linked: context.getProgramParameter(program, context.LINK_STATUS) === true,
          programLog: context.getProgramInfoLog(program) ?? "",
          vertexLog: context.getShaderInfoLog(vertex) ?? "",
          fragmentLog: context.getShaderInfoLog(fragment) ?? "",
        });
      };
      renderer.render(scene, camera);
      check(diagnostics.length === before + 1, `${kind}: missing or repeated diagnostic callback`);
      const diagnostic = diagnostics[before];
      check(diagnostic.vertex && !diagnostic.linked, `${kind}: incorrect shader/program status`);
      check(
        kind === "compile"
          ? !diagnostic.fragment && diagnostic.fragmentLog.length > 0
          : diagnostic.fragment && diagnostic.programLog.length > 0,
        `${kind}: missing real driver error log`,
      );
      // Invalid programs may produce INVALID_OPERATION when the renderer attempts the draw.
      for (let error = gl.getError(); error !== gl.NO_ERROR; error = gl.getError()) {
        check(error === gl.INVALID_OPERATION, `${kind}: unexpected GL error ${error}`);
      }
      broken.vertexShader =
        "precision highp float; in vec3 position; void main() { gl_Position = vec4(position, 1.0); }";
      broken.fragmentShader =
        "precision highp float; out vec4 result; void main() { result = vec4(0.0, 1.0, 0.0, 1.0); }";
      broken.needsUpdate = true;
      sample([0, 255, 0, 255], `${kind}: repaired material`);
      check(diagnostics.length === before + 1, `${kind}: recovery produced diagnostics`);
      broken.dispose();
    }
    return {
      dialects: 4,
      explicitChunks: true,
      structuredUniforms: true,
      samplerKinds: ["2d-array", "cube", "3d", "array"],
      cache: true,
      lifetime: true,
      diagnostics,
      recovered: true,
      glError: gl.getError(),
    };
  } finally {
    renderer.debug.onShaderError = null;
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    geometry.dispose();
    renderer.dispose();
  }
}
