import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Texture } from "ek3d/textures/Texture";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { DataTexture } from "ek3d/textures/DataTexture";
import {
  RGBAFormat,
  UnsignedByteType,
  UnsignedIntType,
  RepeatWrapping,
  SRGBColorSpace,
  UVMapping,
  EquirectangularReflectionMapping,
  EquirectangularRefractionMapping,
  CubeReflectionMapping,
  CubeRefractionMapping,
  NearestFilter,
} from "ek3d/constants";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import type { WebGLBackgroundSystem } from "ek3d/renderers/webgl/WebGLBackground";
import { CubeTexture } from "ek3d/textures/CubeTexture";
import { Color } from "ek3d/math/Color";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import type { WebGLEnvironmentProvider } from "ek3d/renderers/webgl/WebGLEnvironmentAccess";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { WebGLCubeRenderTarget } from "ek3d/renderers/WebGLCubeRenderTarget";
import { Vector4 } from "ek3d/math/Vector4";
import { createEnvironmentPixels, environmentWidth, environmentHeight } from "./browser-fixtures";
import { DepthTexture } from "ek3d/textures/DepthTexture";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { InterleavedBuffer } from "ek3d/core/InterleavedBuffer";
import { InterleavedBufferAttribute } from "ek3d/core/InterleavedBufferAttribute";
import { InstancedBufferAttribute } from "ek3d/core/InstancedBufferAttribute";
import { InstancedInterleavedBuffer } from "ek3d/core/InstancedInterleavedBuffer";
import { InstancedBufferGeometry } from "ek3d/core/InstancedBufferGeometry";
import { GLBufferAttribute } from "ek3d/core/GLBufferAttribute";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { DynamicDrawUsage } from "ek3d/constants";

// Run in an actual browser served by Vite: await (await import('/tests/browser.ts')).verifyRenderingBoundaries().
export async function verifyRenderingBoundaries() {
  const renderer = new WebGLRenderer({ preserveDrawingBuffer: true });
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial({ color: 0xff8833 });
  const texture = new Texture();
  const mesh = new Mesh(geometry, material);
  const depths: number[] = [];
  const originalGet = renderer.renderLists.get;
  renderer.renderLists.get = (object: Scene, depth: number) => {
    depths.push(depth);
    return originalGet(object, depth);
  };
  const rejections: string[] = [];
  function reject(action: () => void, expected: string) {
    try {
      action();
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes(expected)) throw error;
      rejections.push(error.message);
      return;
    }
    throw new Error(`Missing rejection: ${expected}`);
  }
  const check = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const animate = () =>
    new Promise<number>((resolve, rejectAnimation) => {
      let frames = 0;
      const timer = setTimeout(() => {
        renderer.setAnimationLoop(null);
        rejectAnimation(new Error("Window animation timed out"));
      }, 10000);
      renderer.setAnimationLoop(() => {
        try {
          renderer.render(scene, camera);
          if (++frames === 2) {
            renderer.setAnimationLoop(null);
            clearTimeout(timer);
            resolve(frames);
          }
        } catch (error) {
          clearTimeout(timer);
          renderer.setAnimationLoop(null);
          rejectAnimation(error);
        }
      });
    });
  try {
    renderer.setSize(32, 32);
    camera.position.z = 3;
    scene.add(mesh);
    reject(() => renderer.render(scene, camera), "No explicit shader selected");
    reject(() => renderer.compile(scene, camera), "No explicit shader selected");
    renderer.shaders = { MeshBasicMaterial: basicShader };
    renderer.render(scene, camera);
    scene.background = texture;
    reject(() => renderer.render(scene, camera), "Textured backgrounds require");
    scene.background = null;
    texture.mapping = EquirectangularReflectionMapping;
    material.envMap = texture;
    reject(() => renderer.render(scene, camera), "Environment maps require");
    material.envMap = null;
    material.needsUpdate = true;
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const pixel = new Uint8Array(4);
    gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    if (pixel.join(",") !== "255,136,51,255" || gl.getError() !== gl.NO_ERROR)
      throw new Error("Rendering did not recover after configuration errors");
    if (depths.some((depth) => depth !== 0)) throw new Error(`Failed render leaked stack entries: ${depths.join(",")}`);
    const animationFrames = [await animate()];
    const stoppedFrame = renderer.info.render.frame;
    await nextFrame();
    await nextFrame();
    check(renderer.info.render.frame === stoppedFrame, "setAnimationLoop(null) did not stop window rendering");
    const animationError = "Intentional window animation failure";
    await new Promise<void>((resolve, rejectAnimation) => {
      const done = (event: ErrorEvent) => {
        if (!(event.error instanceof Error) || event.error.message !== animationError) return;
        event.preventDefault();
        clearTimeout(timer);
        window.removeEventListener("error", done);
        renderer.setAnimationLoop(null);
        rejections.push(event.error.message);
        resolve();
      };
      const timer = setTimeout(() => {
        window.removeEventListener("error", done);
        renderer.setAnimationLoop(null);
        rejectAnimation(new Error("Animation exception was not observed"));
      }, 10000);
      window.addEventListener("error", done);
      renderer.setAnimationLoop(() => {
        throw new Error(animationError);
      });
    });
    animationFrames.push(await animate());

    const extension = gl.getExtension("WEBGL_lose_context");
    check(extension !== null, "Context-loss extension is required for this smoke");
    const contextEvent = (name: string, action: () => void) =>
      new Promise<void>((resolve, rejectEvent) => {
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          renderer.domElement.removeEventListener(name, done);
          rejectEvent(new Error(`Timed out waiting for ${name}`));
        }, 10000);
        renderer.domElement.addEventListener(name, done, { once: true });
        action();
      });
    await contextEvent("webglcontextlost", () => extension!.loseContext());
    check(gl.isContextLost(), "Real WebGL context was not lost");
    await contextEvent("webglcontextrestored", () => {
      setTimeout(() => extension!.restoreContext(), 0);
    });
    animationFrames.push(await animate());
    const restoredPixel = new Uint8Array(4);
    gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, restoredPixel);
    check(
      restoredPixel.every((value, index) => value === pixel[index]),
      "Window rendering changed after context restore",
    );

    const externalColor = gl.createTexture();
    const externalDepth = gl.createTexture();
    if (externalColor === null || externalDepth === null) throw new Error("Unable to allocate external GPU textures");
    const externalTarget = new WebGLRenderTarget(8, 8, { depthTexture: new DepthTexture(8, 8, UnsignedIntType) });
    const initialTextures = renderer.info.memory.textures;
    try {
      gl.bindTexture(gl.TEXTURE_2D, externalColor);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 8, 8);
      gl.bindTexture(gl.TEXTURE_2D, externalDepth);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, 8, 8);
      gl.bindTexture(gl.TEXTURE_2D, null);
      renderer.resetState();
      renderer.setRenderTargetTextures(externalTarget, externalColor, externalDepth);
      renderer.setRenderTarget(externalTarget);
      const framebuffer: WebGLFramebuffer = renderer.properties.get(externalTarget).__webglFramebuffer;
      check(gl.isFramebuffer(framebuffer), "External target did not allocate its framebuffer");
      check(
        gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE,
        "External target framebuffer is incomplete",
      );
      renderer.setRenderTarget(null);
      externalTarget.dispose();
      check(
        gl.isTexture(externalColor) && gl.isTexture(externalDepth),
        "Target disposal deleted caller-owned GPU textures",
      );
      check(!gl.isFramebuffer(framebuffer), "External target disposal leaked its owned framebuffer");
      check(renderer.info.memory.textures === initialTextures, "External target disposal leaked texture accounting");
    } finally {
      renderer.setRenderTarget(null);
      externalTarget.dispose();
      gl.deleteTexture(externalColor);
      gl.deleteTexture(externalDepth);
    }
    const programs = (renderer.info.programs ?? []).map((program) => program.program);
    renderer.setAnimationLoop(() => renderer.render(scene, camera));
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    const disposedFrame = renderer.info.render.frame;
    await nextFrame();
    await nextFrame();
    check(renderer.info.render.frame === disposedFrame, "Renderer disposal did not cancel window animation");
    check(
      programs.every((program) => !gl.isProgram(program) || gl.getProgramParameter(program, gl.DELETE_STATUS) === true),
      "Disposal retained GPU programs",
    );
    check(
      renderer.info.memory.geometries === 0 &&
        renderer.info.memory.textures === 0 &&
        renderer.info.programs?.length === 0,
      "Disposal retained GPU resource accounting",
    );
    check(gl.getError() === gl.NO_ERROR, "Window lifecycle or external target cleanup produced a WebGL error");
    return {
      rejections,
      renderListDepths: depths,
      recoveredPixel: Array.from(pixel),
      calls: renderer.info.render.calls,
      animationFrames,
      restoredPixel: Array.from(restoredPixel),
      externalTextureOwnership: "caller textures preserved; owned framebuffer released",
      finalGeometries: renderer.info.memory.geometries,
      finalTextures: renderer.info.memory.textures,
      finalPrograms: renderer.info.programs?.length,
      glError: gl.getError(),
    };
  } finally {
    renderer.setAnimationLoop(null);
    geometry.dispose();
    material.dispose();
    texture.dispose();
    renderer.dispose();
  }
}

// Run beside verifyRenderingBoundaries(); this checks actual uploads and GPU deletion.
export function verifyTextureLifecycle() {
  const renderer = new WebGLRenderer({ preserveDrawingBuffer: true, shaders: { MeshBasicMaterial: basicShader } });
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  const geometry = new BoxGeometry();
  const data = new Uint8Array([255, 64, 32, 255, 32, 192, 64, 255, 64, 96, 255, 255, 224, 176, 32, 255]);
  const texture = new DataTexture(data, 2, 2, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  const material = new MeshBasicMaterial({ map: texture });
  const gl = renderer.getContext();
  const check = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const draw = () => {
    renderer.render(scene, camera);
    const pixels = [
      [12, 12],
      [20, 12],
      [12, 20],
      [20, 20],
    ].map(([x, y]) => {
      const pixel = new Uint8Array(4);
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return Array.from(pixel);
    });
    check(gl.getError() === gl.NO_ERROR, "Texture path produced a WebGL error");
    return pixels;
  };
  try {
    renderer.setSize(32, 32);
    camera.position.z = 3;
    scene.add(new Mesh(geometry, material));
    texture.needsUpdate = true;
    const initial = draw();
    check(
      initial.every((pixel, i) => pixel.every((value, channel) => Math.abs(value - data[i * 4 + channel]) <= 1)),
      `Unexpected sRGB texture regions: ${JSON.stringify(initial)}`,
    );
    check(renderer.info.memory.textures === 1, "Texture was not allocated exactly once");
    const gpuTexture: WebGLTexture = renderer.properties.get(texture).__webglTexture;
    check(gl.isTexture(gpuTexture), "Missing real GPU texture");

    data.set([96, 48, 192, 255], 0);
    const withoutUpdate = draw();
    check(JSON.stringify(withoutUpdate) === JSON.stringify(initial), "Data uploaded without needsUpdate");
    texture.needsUpdate = true;
    const updated = draw();
    check(
      updated[0].every((value, channel) => Math.abs(value - data[channel]) <= 1),
      "needsUpdate did not upload changed texels",
    );
    check(JSON.stringify(updated.slice(1)) === JSON.stringify(initial.slice(1)), "Upload changed untouched texels");
    texture.offset.x = 0.5;
    const shifted = draw();
    check(
      JSON.stringify(shifted) === JSON.stringify([updated[1], updated[0], updated[3], updated[2]]),
      "UV offset/repeat did not swap texture columns",
    );
    check(renderer.info.memory.textures === 1, "Updating texels or UVs leaked GPU textures");

    texture.dispose();
    const texturesAfterDispose = renderer.info.memory.textures;
    check(texturesAfterDispose === 0 && !gl.isTexture(gpuTexture), "dispose did not delete the GPU texture");
    texture.needsUpdate = true;
    const restored = draw();
    const restoredGPUTexture: WebGLTexture = renderer.properties.get(texture).__webglTexture;
    check(JSON.stringify(restored) === JSON.stringify(shifted), "Texture did not recover after disposal");
    check(
      renderer.info.memory.textures === 1 && restoredGPUTexture !== gpuTexture && gl.isTexture(restoredGPUTexture),
      "Texture was not reallocated after disposal",
    );
    texture.dispose();
    check(renderer.info.memory.textures === 0 && !gl.isTexture(restoredGPUTexture), "Restored GPU texture leaked");
    return {
      initial,
      withoutUpdate,
      updated,
      shifted,
      restored,
      texturesAfterDispose,
      texturesAfterFinalDispose: renderer.info.memory.textures,
      gpuTextureDeleted: true,
      restoredGPUTextureDeleted: true,
      glError: gl.getError(),
    };
  } finally {
    texture.dispose();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  }
}

export function verifyLambertLighting() {
  const renderer = new WebGLRenderer({ preserveDrawingBuffer: true, shaders: { MeshBasicMaterial: basicShader } });
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 2, 0.1, 100);
  const geometry = new BoxGeometry(0.8, 0.8, 0.8);
  const otherGeometry = geometry.clone();
  const material = new MeshLambertMaterial();
  const otherMaterial = new MeshLambertMaterial();
  material.color.setRGB(0.8, 0.4, 0.2);
  otherMaterial.color.setRGB(0.3, 0.8, 0.5);
  const left = new Mesh(geometry, material);
  const right = new Mesh(otherGeometry, otherMaterial);
  left.position.x = -0.75;
  right.position.x = 0.75;
  const light = new HemisphereLight(0xffffff, 0xffffff, Math.PI);
  const sky = [0.6, 0.2, 0.1],
    ground = [0.05, 0.15, 0.4];
  light.color.setRGB(sky[0], sky[1], sky[2]);
  light.groundColor.setRGB(ground[0], ground[1], ground[2]);
  light.position.set(0, 0, 1);
  const gl = renderer.getContext();
  const check = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const depths: number[] = [];
  const originalGet = renderer.renderLists.get;
  renderer.renderLists.get = (object: Scene, depth: number) => {
    depths.push(depth);
    return originalGet(object, depth);
  };
  const rejections: string[] = [];
  const encode = (linear: number) =>
    Math.round(255 * (linear <= 0.0031308 ? 12.92 * linear : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055));
  const expected = (color: number[], irradiance: number[], emissive = [0, 0, 0]) => [
    ...color.map((value, i) => encode(value * irradiance[i] + emissive[i])),
    255,
  ];
  const near = (pixel: number[], target: number[], label: string) =>
    check(
      pixel.every((value, i) => Math.abs(value - target[i]) <= 2),
      `${label}: ${pixel.join(",")} != ${target.join(",")}`,
    );
  const draw = () => {
    renderer.render(scene, camera);
    const samples = [33, 63].map((x) => {
      const pixel = new Uint8Array(4);
      gl.readPixels(x, 24, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return Array.from(pixel);
    });
    check(gl.getError() === gl.NO_ERROR, "Lambert path produced a WebGL error");
    for (const program of renderer.info.programs ?? []) {
      check(gl.getProgramParameter(program.program, gl.LINK_STATUS), "Lambert program did not link");
    }
    return samples;
  };
  try {
    renderer.setSize(96, 48);
    camera.position.z = 3;
    scene.add(left, right, light);
    for (const action of [() => renderer.render(scene, camera), () => renderer.compile(scene, camera)]) {
      try {
        action();
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("No explicit shader selected for MeshLambertMaterial"))
          throw error;
        rejections.push(error.message);
      }
    }
    check(rejections.length === 2, "Lambert shader was selected implicitly");
    renderer.shaders.MeshLambertMaterial = lambertShader;
    const initial = draw();
    near(initial[0], expected([0.8, 0.4, 0.2], sky), "Sky lighting");
    near(initial[1], expected([0.3, 0.8, 0.5], sky), "Independent diffuse color");
    light.position.negate();
    const reversed = draw();
    near(reversed[0], expected([0.8, 0.4, 0.2], ground), "Ground lighting");
    light.intensity = 0;
    const dark = draw();
    for (const pixel of dark) near(pixel, [0, 0, 0, 255], "Zero light intensity");
    material.emissive.setRGB(0.1, 0.02, 0.04);
    material.emissiveIntensity = 0.5;
    const emissive = draw();
    near(emissive[0], expected([0, 0, 0], sky, [0.05, 0.01, 0.02]), "Emissive intensity");
    near(emissive[1], dark[1], "Emissive leaked between materials");
    light.intensity = Math.PI;
    light.position.negate();
    material.color.setRGB(0.2, 0.7, 0.4);
    const changed = draw();
    near(changed[0], expected([0.2, 0.7, 0.4], sky, [0.05, 0.01, 0.02]), "Material update");
    near(changed[1], initial[1], "Diffuse update leaked between materials");
    const normals = geometry.getAttribute("normal");
    if (!normals || !("setXYZ" in normals)) throw new Error("Missing CPU normal attribute");
    for (let i = 0; i < normals.count; i++) normals.setXYZ(i, Math.SQRT1_2, 0, Math.SQRT1_2);
    normals.needsUpdate = true;
    left.scale.z = 0.5;
    const transformedNormals = draw();
    const weight = 0.5 + 1 / Math.sqrt(5);
    const irradiance = sky.map((value, i) => ground[i] * (1 - weight) + value * weight);
    near(
      transformedNormals[0],
      expected([0.2, 0.7, 0.4], irradiance, [0.05, 0.01, 0.02]),
      "Inverse-transpose normal matrix",
    );
    near(transformedNormals[1], initial[1], "Normal update affected another mesh");
    scene.remove(light);
    const removed = draw();
    near(removed[0], emissive[0], "Removing light retained stale lighting");
    near(removed[1], dark[1], "Removing light retained stale uniforms");
    scene.add(light);
    material.dispose();
    const restored = draw();
    near(restored[0], transformedNormals[0], "Material disposal/recompile changed uniforms");
    near(restored[1], initial[1], "Material disposal affected another instance");
    check(
      depths.every((depth) => depth === 0),
      "Lambert failures leaked render stack entries",
    );
    return {
      initial,
      reversed,
      dark,
      emissive,
      changed,
      transformedNormals,
      removed,
      restored,
      rejections,
      renderListDepths: depths,
      glError: gl.getError(),
    };
  } finally {
    geometry.dispose();
    otherGeometry.dispose();
    material.dispose();
    otherMaterial.dispose();
    renderer.dispose();
  }
}

export async function verifyBackgroundLifecycle() {
  let factoryCalls = 0;
  let background!: WebGLBackgroundSystem;
  const renderer = new WebGLRenderer({
    alpha: true,
    preserveDrawingBuffer: true,
    shaders: { MeshBasicMaterial: basicShader },
    createBackground: (...args) => {
      factoryCalls++;
      return (background = WebGLBackground(...args));
    },
  });
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial({ color: 0xff8833 });
  const mesh = new Mesh(geometry, material);
  const data = new Uint8Array([255, 64, 32, 255, 32, 192, 64, 255, 64, 96, 255, 255, 224, 176, 32, 255]);
  const texture = new DataTexture(data, 2, 2, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.needsUpdate = true;
  const faceColors = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [255, 0, 255],
    [0, 255, 255],
  ];
  const faces = faceColors.map((color) => new DataTexture(new Uint8Array([...color, 255]), 1, 1));
  const cube = new CubeTexture(faces);
  cube.colorSpace = SRGBColorSpace;
  cube.minFilter = cube.magFilter = NearestFilter;
  cube.generateMipmaps = false;
  cube.needsUpdate = true;
  const gl = renderer.getContext();
  const check = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const near = (pixels: number[][], expected: number[][], label: string) =>
    check(
      pixels.length === expected.length &&
        pixels.every((pixel, i) => pixel.every((value, channel) => Math.abs(value - expected[i][channel]) <= 1)),
      `${label}: ${JSON.stringify(pixels)}`,
    );
  const readPixel = (x: number, y: number) => {
    const pixel = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return Array.from(pixel);
  };
  const draw = () => {
    renderer.render(scene, camera);
    const pixels = [
      [4, 4],
      [28, 4],
      [4, 28],
      [28, 28],
    ].map(([x, y]) => readPixel(x, y));
    check(gl.getError() === gl.NO_ERROR, "Background produced a WebGL error");
    for (const program of renderer.info.programs ?? []) {
      check(gl.getProgramParameter(program.program, gl.LINK_STATUS), "Background program did not link");
    }
    return pixels;
  };
  const depths: number[] = [];
  const trackDepths = () => {
    const get = renderer.renderLists.get;
    renderer.renderLists.get = (object: Scene, depth: number) => {
      depths.push(depth);
      return get(object, depth);
    };
  };
  const rejections: string[] = [];
  const reject = (action: () => void, message: string) => {
    try {
      action();
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes(message)) throw error;
      rejections.push(error.message);
      return;
    }
    throw new Error(`Missing rejection: ${message}`);
  };
  const target = new WebGLRenderTarget(8, 8);
  const nestedScene = new Scene();
  const nestedMaterial = new MeshLambertMaterial();
  const nestedMesh = new Mesh(geometry, nestedMaterial);
  nestedScene.add(nestedMesh);
  nestedScene.background = texture;
  try {
    renderer.setSize(32, 32);
    renderer.setClearColor(0x152238, 0.5);
    camera.position.z = 3;
    scene.add(mesh);
    scene.background = texture;
    trackDepths();
    const initial = draw();
    near(
      initial,
      [0, 4, 8, 12].map((offset) => Array.from(data.slice(offset, offset + 4))),
      "sRGB background regions",
    );
    near([readPixel(16, 16)], [[255, 136, 51, 255]], "Background obscured foreground");
    check(
      renderer.info.render.calls === 2 && renderer.info.memory.textures === 1,
      "Unexpected background allocation/draw count",
    );
    const gpuTexture: WebGLTexture = renderer.properties.get(texture).__webglTexture;
    check(gl.isTexture(gpuTexture), "Background texture was not uploaded");

    data.set([96, 48, 192, 255], 0);
    near(draw(), initial, "Upload occurred without needsUpdate");
    texture.needsUpdate = true;
    const updated = draw();
    near(updated, [Array.from(data.slice(0, 4)), ...initial.slice(1)], "Background texel update");
    texture.offset.x = 0.5;
    const shifted = draw();
    near(shifted, [updated[1], updated[0], updated[3], updated[2]], "Background UV shift");
    texture.matrixAutoUpdate = false;
    texture.offset.x = 0;
    near(draw(), shifted, "Disabled automatic UV matrix was ignored");
    texture.updateMatrix();
    near(draw(), updated, "Explicit UV matrix update");
    texture.matrixAutoUpdate = true;
    scene.backgroundIntensity = 0;
    const dark = draw();
    near(
      dark,
      Array.from({ length: 4 }, () => [0, 0, 0, 255]),
      "Zero background intensity",
    );
    near([readPixel(16, 16)], [[255, 136, 51, 255]], "Background intensity affected material");
    scene.backgroundIntensity = 1;

    scene.background = new Color(0x123456);
    renderer.autoClear = false;
    const solid = draw();
    near(
      solid,
      Array.from({ length: 4 }, () => [18, 52, 86, 255]),
      "Color background must force clear",
    );
    renderer.autoClear = true;
    scene.background = null;
    const cleared = draw();
    near(
      cleared,
      Array.from({ length: 4 }, () => [11, 17, 28, 128]),
      "Premultiplied clear color/alpha",
    );
    check(
      renderer.getClearAlpha() === 0.5 && renderer.getClearColor(new Color()).getHex() === 0x152238,
      "Background changed clear settings",
    );
    texture.dispose();
    check(
      renderer.info.memory.textures === 0 && !gl.isTexture(gpuTexture),
      "Background texture disposal leaked GPU storage",
    );
    scene.background = texture;
    texture.needsUpdate = true;
    const restored = draw();
    near(restored, updated, "Background texture reupload");
    const restoredGPU: WebGLTexture = renderer.properties.get(texture).__webglTexture;
    check(restoredGPU !== gpuTexture && gl.isTexture(restoredGPU), "Background texture was not reallocated");

    texture.mapping = EquirectangularReflectionMapping;
    reject(() => renderer.render(scene, camera), "createEnvironments");
    texture.mapping = UVMapping;
    near(draw(), updated, "Recovery from missing conversion");
    scene.background = cube;
    scene.remove(mesh);
    const cubeInitial = draw();
    near([readPixel(16, 16)], [[...faceColors[5], 255]], "Native cube background");
    scene.backgroundRotation.y = Math.PI;
    const cubeRotated = draw();
    near([readPixel(16, 16)], [[...faceColors[4], 255]], "Cube background rotation");
    scene.backgroundBlurriness = 0.25;
    reject(() => renderer.render(scene, camera), "createEnvironments");
    scene.backgroundBlurriness = 0;
    scene.backgroundRotation.y = 0;
    scene.background = texture;
    cube.dispose();
    scene.add(mesh);
    near(draw(), updated, "Recovery from missing PMREM");
    check(
      depths.every((depth) => depth === 0),
      "Background error leaked render-list stack",
    );

    mesh.onBeforeRender = () => {
      reject(() => renderer.compile(nestedScene, camera), "No explicit shader selected");
      reject(() => renderer.render(nestedScene, camera), "No explicit shader selected");
      nestedMesh.material = material;
      renderer.compile(nestedScene, camera);
      renderer.setRenderTarget(target);
      try {
        renderer.render(nestedScene, camera);
      } finally {
        renderer.setRenderTarget(null);
      }
    };
    near(draw(), updated, "Nested render changed outer background");
    mesh.onBeforeRender = () => {};
    near(draw(), updated, "Nested render/compile recovery");
    check(
      depths.filter((depth) => depth === 1).length === 2 && depths.at(-1) === 0 && depths.every((depth) => depth <= 1),
      "Nested render stack did not unwind",
    );

    const backgroundPrograms = (renderer.info.programs ?? [])
      .filter((program) => program.name.startsWith("Background"))
      .map((program) => program.program as WebGLProgram);
    check(
      backgroundPrograms.length >= 2 && backgroundPrograms.every((program) => gl.isProgram(program)),
      "Missing live background programs",
    );
    background.dispose();
    check(
      renderer.info.memory.geometries === 1 && backgroundPrograms.every((program) => !gl.isProgram(program)),
      "Background disposal retained geometry/programs",
    );
    near(draw(), updated, "Background recreation after dispose");

    const extension = gl.getExtension("WEBGL_lose_context");
    check(extension !== null, "Context-loss extension is required for this smoke");
    const canvas = renderer.domElement;
    // ES2022's Promise API requires the executor form; withResolvers is ES2024.
    const contextEvent = (name: string, action: () => void) =>
      new Promise<void>((resolve, reject) => {
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          canvas.removeEventListener(name, done);
          reject(new Error(`Timed out waiting for ${name}`));
        }, 10000);
        canvas.addEventListener(name, done, { once: true });
        action();
      });
    await contextEvent("webglcontextlost", () => extension!.loseContext());
    check(!gl.isTexture(restoredGPU), "Context loss retained a GPU texture");
    // Restore after the loss event finishes dispatching, not in its promise microtask.
    await contextEvent("webglcontextrestored", () => {
      setTimeout(() => extension!.restoreContext(), 0);
    });
    check(factoryCalls === 2, "Context restore did not recreate the opt-in subsystem");
    trackDepths();
    const afterContextRestore = draw();
    near(afterContextRestore, updated, "Context restore changed background");
    const contextGPU: WebGLTexture = renderer.properties.get(texture).__webglTexture;
    check(contextGPU !== restoredGPU && gl.isTexture(contextGPU), "Context restore did not replace GPU texture");
    check(
      renderer.info.memory.textures === 1 && renderer.info.memory.geometries === 2,
      "Context restore leaked resources",
    );
    texture.dispose();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    check(
      !gl.isTexture(contextGPU) &&
        renderer.info.memory.textures === 0 &&
        renderer.info.memory.geometries === 0 &&
        renderer.info.programs?.length === 0,
      "Final background disposal leaked resources",
    );
    check(gl.getError() === gl.NO_ERROR, "Background cleanup produced a WebGL error");
    return {
      initial,
      updated,
      shifted,
      dark,
      solid,
      cleared,
      restored,
      cubeInitial,
      cubeRotated,
      afterContextRestore,
      rejections,
      renderListDepths: depths,
      factoryCalls,
      backgroundProgramsDeleted: true,
      gpuTexturesDeleted: true,
      finalTextures: renderer.info.memory.textures,
      finalGeometries: renderer.info.memory.geometries,
      glError: gl.getError(),
    };
  } finally {
    texture.dispose();
    cube.dispose();
    for (const face of faces) face.dispose();
    target.dispose();
    nestedMaterial.dispose();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  }
}

// Browser-console entry point: verifyEnvironmentLifecycle() returns its GPU evidence asynchronously.
export async function verifyEnvironmentLifecycle() {
  let factoryCalls = 0;
  let environments!: WebGLEnvironmentProvider & { dispose(): void };
  const renderer = new WebGLRenderer({
    preserveDrawingBuffer: true,
    shaders: { MeshBasicMaterial: basicShader },
    createBackground: WebGLBackground,
    createEnvironments: (renderer) => {
      factoryCalls++;
      return (environments = WebGLEnvironments(renderer));
    },
  });
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial({ reflectivity: 1 });
  const mesh = new Mesh(geometry, material);
  const makeTexture = () => {
    const texture = new DataTexture(
      createEnvironmentPixels(),
      environmentWidth,
      environmentHeight,
      RGBAFormat,
      UnsignedByteType,
    );
    texture.mapping = EquirectangularReflectionMapping;
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  };
  const texture = makeTexture();
  const failedCubeSource = makeTexture();
  const failedPMREMSource = makeTexture();
  const uvTexture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const cubeTarget = new WebGLCubeRenderTarget(16);
  const nestedTarget = new WebGLRenderTarget(16, 16);
  const generator = new PMREMGenerator(renderer);
  let capturedTarget: WebGLCubeRenderTarget | null = null;
  const nestedScene = new Scene();
  const missingMaterial = new MeshLambertMaterial();
  const nestedMesh = new Mesh(geometry, missingMaterial);
  nestedScene.add(nestedMesh);
  const gl = renderer.getContext();
  const check = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const rejections: string[] = [];
  const reject = (action: () => void, expected: string) => {
    try {
      action();
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes(expected)) throw error;
      rejections.push(error.message);
      return;
    }
    throw new Error(`Missing rejection: ${expected}`);
  };
  const gpu = (texture: Texture): WebGLTexture => renderer.properties.get(texture).__webglTexture;
  const frame = () => {
    const pixels = new Uint8Array(32 * 32 * 4);
    gl.readPixels(0, 0, 32, 32, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    check(gl.getError() === gl.NO_ERROR, "Environment rendering produced a WebGL error");
    for (const program of renderer.info.programs ?? []) {
      check(
        gl.getProgramParameter(program.program, gl.LINK_STATUS),
        `Environment program did not link: ${program.name}`,
      );
    }
    return Array.from(pixels);
  };
  const draw = () => {
    renderer.render(scene, camera);
    return frame();
  };
  const same = (a: number[], b: number[], label: string) =>
    check(a.length === b.length && a.every((value, i) => Math.abs(value - b[i]) <= 1), label);
  const different = (a: number[], b: number[], label: string) =>
    check(
      a.some((value, i) => Math.abs(value - b[i]) > 8),
      label,
    );
  const sample = (pixels: number[], x = 16, y = 16) => pixels.slice((y * 32 + x) * 4, (y * 32 + x) * 4 + 4);
  const depths: number[] = [];
  const trackDepths = () => {
    const get = renderer.renderLists.get;
    renderer.renderLists.get = (object: Scene, depth: number) => {
      depths.push(depth);
      return get(object, depth);
    };
  };
  try {
    renderer.setSize(32, 32);
    renderer.setClearColor(0x152238, 1);
    camera.position.z = 3;
    mesh.rotation.set(0.2, 0.4, 0);
    scene.add(mesh);
    material.envMap = texture;
    scene.background = texture;
    trackDepths();
    check(
      environments.get(null) === null && environments.get(undefined) === null,
      "Null environment did not pass through",
    );
    check(
      environments.get(uvTexture) === uvTexture && environments.get(uvTexture, true) === uvTexture,
      "UV texture was converted unnecessarily",
    );
    const initial = draw();
    const cube = environments.get(texture)!;
    check(
      cube !== texture && cube instanceof CubeTexture && cube.mapping === CubeReflectionMapping,
      "Equirectangular reflection was not converted to a cube",
    );
    const cubeGPU = gpu(cube);
    check(gl.isTexture(cubeGPU), "Converted cube has no GPU storage");
    const cubeCount = renderer.info.memory.textures;
    same(draw(), initial, "Cached cube changed the framebuffer");
    check(
      environments.get(texture) === cube && renderer.info.memory.textures === cubeCount,
      "Cube cache did not reuse its allocation",
    );
    check(environments.get(cube) === cube, "Native cube was converted again");
    texture.mapping = EquirectangularRefractionMapping;
    material.needsUpdate = true;
    check(
      environments.get(texture) === cube && cube.mapping === CubeRefractionMapping,
      "Refraction mapping did not reuse/remap the cached cube",
    );
    const refracted = draw();
    different(refracted, initial, "Refraction mapping did not affect rendering");
    texture.mapping = EquirectangularReflectionMapping;
    material.needsUpdate = true;
    same(draw(), initial, "Reflection mapping failed to recover");

    scene.backgroundBlurriness = 0.65;
    const blurred = draw();
    const pmrem = environments.get(texture, true)!;
    const pmremGPU = gpu(pmrem);
    check(pmrem.isPMREMTexture === true && gl.isTexture(pmremGPU), "Blur did not generate a live PMREM texture");
    check(pmrem !== cube && environments.get(pmrem, true) === pmrem, "PMREM pass-through failed");
    different(blurred, initial, "PMREM blur did not change the background");
    same(sample(blurred), sample(initial), "Background blur changed the basic reflection");
    const blurredCount = renderer.info.memory.textures;
    same(draw(), blurred, "PMREM cache changed rendering");
    check(
      environments.get(texture, true) === pmrem && renderer.info.memory.textures === blurredCount,
      "PMREM cache allocated again",
    );
    scene.backgroundRotation.y = Math.PI / 2;
    const rotated = draw();
    different(rotated, blurred, "Environment rotation had no visible effect");
    scene.backgroundRotation.y = 0;
    scene.backgroundIntensity = 0;
    const dark = draw();
    same(sample(dark, 2, 2), [0, 0, 0, 255], "Zero background intensity was ignored");
    same(sample(dark), sample(blurred), "Background intensity changed the reflection");
    scene.backgroundIntensity = 1;

    scene.background = null;
    material.envMap = null;
    material.needsUpdate = true;
    texture.dispose();
    check(
      !gl.isTexture(cubeGPU) && !gl.isTexture(pmremGPU),
      "Source disposal retained converted cube or PMREM GPU storage",
    );
    texture.needsUpdate = true;
    scene.background = texture;
    material.envMap = texture;
    material.needsUpdate = true;
    same(draw(), blurred, "Source disposal/reconversion changed pixels");
    const reconvertedCube = environments.get(texture)!;
    const reconvertedPMREM = environments.get(texture, true)!;
    check(reconvertedCube !== cube && reconvertedPMREM !== pmrem, "Disposed environment cache entries were reused");
    const ownedGPU = [gpu(reconvertedCube), gpu(reconvertedPMREM)];
    environments.dispose();
    check(
      ownedGPU.every((handle) => !gl.isTexture(handle)),
      "Provider disposal retained cached GPU resources",
    );
    same(draw(), blurred, "Provider disposal did not permit reconversion");

    // A render-target source updates its PMREM in place, rather than allocating another cache entry.
    scene.background = cubeTarget.texture;
    renderer.setClearColor(0xff0000, 1);
    cubeTarget.clear(renderer);
    cubeTarget.texture.needsPMREMUpdate = true;
    const targetPMREM = environments.get(cubeTarget.texture, true)!;
    const redTarget = draw();
    renderer.setClearColor(0x00ff00, 1);
    cubeTarget.clear(renderer);
    cubeTarget.texture.needsPMREMUpdate = true;
    check(
      environments.get(cubeTarget.texture, true) === targetPMREM,
      "Render-target PMREM update replaced its cache entry",
    );
    check(targetPMREM.pmremVersion === cubeTarget.texture.pmremVersion, "Render-target PMREM version was not updated");
    const greenTarget = draw();
    different(sample(redTarget, 2, 2), sample(greenTarget, 2, 2), "needsPMREMUpdate did not update background pixels");
    const targetGPU = gpu(targetPMREM);
    scene.background = texture;
    cubeTarget.texture.dispose();
    cubeTarget.dispose();
    check(!gl.isTexture(targetGPU), "Render-target source disposal leaked its PMREM");
    renderer.setClearColor(0x152238, 1);

    // Throw from an actual texture upload callback while conversion owns the framebuffer.
    for (const [source, usePMREM] of [
      [failedCubeSource, false],
      [failedPMREMSource, true],
    ] as const) {
      nestedTarget.viewport.set(1, 2, 12, 11);
      renderer.setRenderTarget(nestedTarget);
      renderer.autoClear = false;
      const beforeFailureTextures = renderer.info.memory.textures;
      const beforeFailureGeometries = renderer.info.memory.geometries;
      const viewport = renderer.getCurrentViewport(new Vector4()).toArray();
      const sourceFilter = source.minFilter;
      source.onUpdate = () => {
        throw new Error("environment upload failure");
      };
      reject(() => environments.get(source, usePMREM), "environment upload failure");
      check(
        renderer.getRenderTarget() === nestedTarget &&
          renderer.getActiveCubeFace() === 0 &&
          renderer.getActiveMipmapLevel() === 0,
        "Conversion failure leaked the active render target",
      );
      check(
        renderer.getCurrentViewport(new Vector4()).toArray().join() === viewport.join() && renderer.autoClear === false,
        "Conversion failure leaked viewport/clear state",
      );
      check(source.minFilter === sourceFilter, "Conversion failure changed source filtering");
      source.onUpdate = null;
      source.needsUpdate = true;
      const recovered = environments.get(source, usePMREM)!;
      check(gl.isTexture(gpu(recovered)), "Conversion did not recover after upload failure");
      const recoveredGPU = gpu(recovered);
      source.dispose();
      check(!gl.isTexture(recoveredGPU), "Recovered conversion leaked GPU resources on source disposal");
      check(
        renderer.info.memory.textures === beforeFailureTextures &&
          renderer.info.memory.geometries === beforeFailureGeometries,
        "Failed conversion retained temporary GPU resources",
      );
      renderer.setRenderTarget(null);
      renderer.setViewport(0, 0, 32, 32);
      renderer.autoClear = true;
      same(draw(), blurred, "Failed conversion damaged subsequent environment rendering");
    }

    const captureScene = new Scene();
    renderer.setRenderTarget(nestedTarget);
    const beforeCaptureTextures = renderer.info.memory.textures;
    const beforeCaptureGeometries = renderer.info.memory.geometries;
    renderer.autoClear = renderer.autoClearColor = renderer.autoClearDepth = renderer.autoClearStencil = false;
    captureScene.onBeforeRender = () => {
      throw new Error("environment scene capture failure");
    };
    reject(() => generator.fromScene(captureScene, 0.15), "environment scene capture failure");
    check(captureScene.background === null, "Failed scene capture retained a temporary background");
    check(
      !renderer.autoClear && !renderer.autoClearColor && !renderer.autoClearDepth && !renderer.autoClearStencil,
      "Failed scene capture changed clear flags",
    );
    check(renderer.getRenderTarget() === nestedTarget, "Failed scene capture retained its render target");
    captureScene.onBeforeRender = () => {};
    captureScene.background = new Color(0x2050c0);
    capturedTarget = generator.fromScene(captureScene, 0.15);
    check(
      capturedTarget.texture.isPMREMTexture && renderer.getRenderTarget() === nestedTarget,
      "PMREM scene capture did not recover",
    );
    renderer.autoClear = renderer.autoClearColor = renderer.autoClearDepth = renderer.autoClearStencil = true;
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, 32, 32);
    scene.background = capturedTarget.texture;
    const captured = draw();
    same(sample(captured, 2, 2), [32, 80, 192, 255], "PMREM fromScene Gaussian blur changed a constant-color scene");
    const capturedGPU = gpu(capturedTarget.texture);
    scene.background = texture;
    capturedTarget.dispose();
    generator.dispose();
    check(
      !gl.isTexture(capturedGPU) &&
        renderer.info.memory.textures === beforeCaptureTextures &&
        renderer.info.memory.geometries === beforeCaptureGeometries,
      "Scene capture failure/recovery leaked GPU resources",
    );
    same(draw(), blurred, "Scene capture changed subsequent environment rendering");

    mesh.onBeforeRender = () => {
      renderer.setRenderTarget(nestedTarget);
      try {
        reject(() => renderer.compile(nestedScene, camera), "No explicit shader selected");
        reject(() => renderer.render(nestedScene, camera), "No explicit shader selected");
        nestedMesh.material = material;
        renderer.compile(nestedScene, camera);
        renderer.render(nestedScene, camera);
      } finally {
        renderer.setRenderTarget(null);
      }
    };
    same(draw(), blurred, "Nested render/compile failures changed the outer environment");
    mesh.onBeforeRender = () => {};
    same(draw(), blurred, "Nested rendering did not recover");
    check(depths.at(-1) === 0 && depths.includes(1), "Nested environment rendering leaked stack entries");

    const withoutFactory = new WebGLRenderer({
      preserveDrawingBuffer: true,
      shaders: { MeshBasicMaterial: basicShader },
      createBackground: WebGLBackground,
    });
    try {
      withoutFactory.setSize(32, 32);
      reject(() => withoutFactory.render(scene, camera), "createEnvironments");
      scene.background = null;
      reject(() => withoutFactory.compile(scene, camera), "createEnvironments");
      reject(() => withoutFactory.render(scene, camera), "createEnvironments");
      material.envMap = null;
      material.needsUpdate = true;
      withoutFactory.render(scene, camera);
      const missingGL = withoutFactory.getContext();
      const pixel = new Uint8Array(4);
      missingGL.readPixels(16, 16, 1, 1, missingGL.RGBA, missingGL.UNSIGNED_BYTE, pixel);
      same(Array.from(pixel), [255, 255, 255, 255], "Missing-factory renderer did not recover");
      check(missingGL.getError() === missingGL.NO_ERROR, "Missing-factory recovery produced a GL error");
    } finally {
      withoutFactory.dispose();
      material.envMap = texture;
      material.needsUpdate = true;
      scene.background = texture;
    }
    same(draw(), blurred, "Missing-factory checks disturbed the opt-in renderer");

    const beforeLoss = [gpu(environments.get(texture)!), gpu(environments.get(texture, true)!)];
    const extension = gl.getExtension("WEBGL_lose_context");
    check(extension !== null, "Context-loss extension is required for this smoke");
    const canvas = renderer.domElement;
    // The project targets ES2022; Promise.withResolvers requires ES2024.
    const contextEvent = (name: string, action: () => void) =>
      new Promise<void>((resolve, reject) => {
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          canvas.removeEventListener(name, done);
          reject(new Error(`Timed out waiting for ${name}`));
        }, 10000);
        canvas.addEventListener(name, done, { once: true });
        action();
      });
    await contextEvent("webglcontextlost", () => extension!.loseContext());
    check(
      beforeLoss.every((handle) => !gl.isTexture(handle)),
      "Context loss retained environment GPU resources",
    );
    await contextEvent("webglcontextrestored", () => {
      setTimeout(() => extension!.restoreContext(), 0);
    });
    check(factoryCalls === 2, "Context restore did not recreate the environment provider");
    trackDepths();
    const afterContextRestore = draw();
    same(afterContextRestore, blurred, "Context restore changed environment pixels");
    const restoredGPU = [gpu(environments.get(texture)!), gpu(environments.get(texture, true)!)];
    check(
      restoredGPU.every((handle, i) => handle !== beforeLoss[i] && gl.isTexture(handle)),
      "Context restore did not replace GPU allocations",
    );
    texture.dispose();
    geometry.dispose();
    material.dispose();
    nestedTarget.dispose();
    missingMaterial.dispose();
    renderer.dispose();
    check(
      restoredGPU.every((handle) => !gl.isTexture(handle)) &&
        renderer.info.memory.textures === 0 &&
        renderer.info.memory.geometries === 0 &&
        renderer.info.programs?.length === 0,
      `Final environment disposal leaked resources: textures=${renderer.info.memory.textures}, geometries=${renderer.info.memory.geometries}, programs=${renderer.info.programs?.length}, live=${restoredGPU.map((handle) => gl.isTexture(handle)).join(",")}`,
    );
    check(gl.getError() === gl.NO_ERROR, "Environment cleanup produced a WebGL error");
    return {
      initial: sample(initial),
      refracted: sample(refracted),
      blurred: sample(blurred, 2, 2),
      rotated: sample(rotated, 2, 2),
      renderTargetBefore: sample(redTarget, 2, 2),
      renderTargetAfter: sample(greenTarget, 2, 2),
      capturedScene: sample(captured, 2, 2),
      afterContextRestore: sample(afterContextRestore, 2, 2),
      rejections,
      renderListDepths: depths,
      factoryCalls,
      cacheReuse: true,
      gpuTexturesDeleted: true,
      finalTextures: renderer.info.memory.textures,
      finalGeometries: renderer.info.memory.geometries,
      glError: gl.getError(),
    };
  } finally {
    mesh.onBeforeRender = () => {};
    for (const source of [texture, failedCubeSource, failedPMREMSource, uvTexture]) source.dispose();
    cubeTarget.dispose();
    nestedTarget.dispose();
    capturedTarget?.dispose();
    generator.dispose();
    missingMaterial.dispose();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  }
}

export function verifyBufferLifecycle() {
  const renderer = new WebGLRenderer({ preserveDrawingBuffer: true });
  const gl = renderer.getContext();
  const buffers: WebGLBuffer[] = [];
  const createBuffer = gl.createBuffer.bind(gl);
  gl.createBuffer = () => {
    const buffer = createBuffer();
    if (buffer) buffers.push(buffer);
    return buffer;
  };
  const geometry = new InstancedBufferGeometry();
  let nativeGeometry: BufferGeometry | undefined;
  const material = new RawShaderMaterial({
    vertexShader: `precision highp float;
attribute vec3 position;
attribute vec2 offset;
attribute vec3 tint;
varying vec3 vColor;
void main() {
  vColor = tint;
  gl_Position = vec4(position.xy + offset, 0.0, 1.0);
}`,
    fragmentShader: `precision highp float;
varying vec3 vColor;
void main() { gl_FragColor = vec4(vColor, 1.0); }`,
  });
  const check = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  try {
    renderer.setSize(64, 64);
    renderer.setClearColor(0x000000, 1);
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    const data = new InterleavedBuffer(new Int16Array(12), 4);
    const position = new InterleavedBufferAttribute(data, 3, 0, true);
    position.setXYZ(0, -0.2, -0.4, 0);
    position.setXYZ(1, 0.2, -0.4, 0);
    position.setXYZ(2, 0, 0.4, 0);
    const colorData = new InstancedInterleavedBuffer(new Uint8Array([255, 0, 0, 91, 0, 255, 0, 92]), 4, 2);
    colorData.setUsage(DynamicDrawUsage);
    const color = new InterleavedBufferAttribute(colorData, 3, 0, true);
    geometry.setAttribute("position", position);
    geometry.setAttribute("offset", new InstancedBufferAttribute(new Float32Array([-0.5, 0, 0.5, 0]), 2, false, 2));
    geometry.setAttribute("tint", color);
    geometry.instanceCount = 4;
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const sample = (x: number) => {
      const pixel = new Uint8Array(4);
      gl.readPixels(x, 28, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return Array.from(pixel).join(",");
    };
    const draw = () => {
      renderer.render(scene, camera);
      check(gl.getError() === gl.NO_ERROR, "Buffer rendering produced a GL error");
    };
    draw();
    check(
      sample(16) === "255,0,0,255" && sample(48) === "0,255,0,255",
      "Normalized instanced/interleaved attributes or divisors failed",
    );
    check(renderer.info.render.triangles === 4, "Instanced draw count was lost");
    color.setXYZ(0, 0, 0, 1);
    colorData.addUpdateRange(0, 2);
    colorData.addUpdateRange(1, 2);
    color.needsUpdate = true;
    draw();
    check(
      sample(16) === "0,0,255,255" && sample(48) === "0,255,0,255",
      "Partial buffer update changed the wrong instance",
    );
    check(
      colorData.updateRanges.length === 0 && colorData.array[3] === 91,
      "Update ranges were not consumed or adjacent data changed",
    );
    geometry.instanceCount = 2;
    draw();
    check(sample(16) === "0,0,255,255" && sample(48) === "0,0,0,255", "Instance count did not limit drawing");

    const native = gl.createBuffer();
    if (!native) throw new Error("Native VBO allocation failed");
    gl.bindBuffer(gl.ARRAY_BUFFER, native);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.2, -0.4, 0, 0.2, -0.4, 0, 0, 0.4, 0]), gl.STATIC_DRAW);
    nativeGeometry = geometry.clone();
    nativeGeometry.setAttribute("position", new GLBufferAttribute(native, gl.FLOAT, 3, 4, 3));
    mesh.geometry = nativeGeometry;
    draw();
    check(sample(16) === "0,0,255,255" && sample(48) === "0,0,0,255", "Native VBO rendering changed geometry");
    nativeGeometry.dispose();
    geometry.dispose();
    material.dispose();
    check(!gl.isBuffer(native), "Geometry disposal retained its native VBO");
    check(
      buffers.every((buffer) => !gl.isBuffer(buffer)),
      "Shared or instanced GPU buffers leaked",
    );
    check(renderer.info.memory.geometries === 0, "Buffer geometry lifetime leaked");
    return {
      partialUpdates: true,
      normalizedAttributes: true,
      instancedDivisors: true,
      nativeBufferDisposed: true,
      glError: gl.getError(),
    };
  } finally {
    nativeGeometry?.dispose();
    geometry.dispose();
    material.dispose();
    for (const buffer of buffers) if (gl.isBuffer(buffer)) gl.deleteBuffer(buffer);
    gl.createBuffer = createBuffer;
    renderer.dispose();
  }
}
