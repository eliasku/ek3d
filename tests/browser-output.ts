import { GL } from "ek3d/GL";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLOutput } from "ek3d/renderers/webgl/WebGLOutput";
import type { WebGLOutputEffect, WebGLOutputSystem } from "ek3d/renderers/webgl/WebGLOutput";
import { WebGLCubeRenderTarget } from "ek3d/renderers/WebGLCubeRenderTarget";
import type { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import type { DepthTexture } from "ek3d/textures/DepthTexture";
import { Scene } from "ek3d/scenes/Scene";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { TextureType, ToneMapping, ColorSpace } from "ek3d/constants";

// Run in a real browser served by Vite: (await import('/tests/browser-output.ts')).verifyOutputLifecycle().
export async function verifyOutputLifecycle() {
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
  const shaders = { MeshBasicMaterial: basicShader };
  const boundary = new WebGLRenderer({ shaders });
  try {
    reject(() => boundary.setEffects([]), "outputBufferType");
    reject(() => boundary.setEffects(null), "outputBufferType");
    reject(() => {
      const unexpected = new WebGLRenderer({
        canvas: boundary.domElement,
        context: boundary.getContext(),
        shaders,
        outputBufferType: TextureType.Float,
      });
      unexpected.dispose();
    }, "createOutput");
  } finally {
    boundary.dispose();
  }

  const outputs: WebGLOutputSystem[] = [];
  const capturedTargets = new Set<WebGLRenderTarget>();
  let sceneTarget: WebGLRenderTarget | null = null;
  let beginCount = 0;
  const createOutput: typeof WebGLOutput = (...args) => {
    const system = WebGLOutput(...args);
    const begin = system.begin.bind(system);
    system.begin = (owner, target) => {
      const active = begin(owner, target);
      if (active) {
        beginCount++;
        if (!system.hasRenderPass()) sceneTarget = owner.getRenderTarget();
      }
      return active;
    };
    outputs.push(system);
    return system;
  };
  const renderer = new WebGLRenderer({
    shaders,
    createOutput,
    outputBufferType: TextureType.Float,
    antialias: false,
    depth: true,
    preserveDrawingBuffer: true,
  });
  const gl = renderer.getContext();
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  const geometry = new BoxGeometry(2, 2, 1);
  const material = new MeshBasicMaterial();
  material.color.setRGB(4, 1, 0.25);
  const mesh = new Mesh(geometry, material);
  mesh.position.z = -1;
  scene.add(mesh);
  const copyScene = new Scene();
  const copyMaterial = new MeshBasicMaterial({ toneMapped: false });
  const copyMesh = new Mesh(geometry, copyMaterial);
  copyMesh.position.z = -1;
  copyScene.add(copyMesh);
  const missingMaterial = new MeshBasicMaterial();
  missingMaterial.type = "MissingOutputSmokeShader";
  const nestedScene = new Scene();
  const nestedMesh = new Mesh(geometry, missingMaterial);
  nestedMesh.position.z = -1;
  nestedScene.add(nestedMesh);
  const cube = new WebGLCubeRenderTarget(16, { generateMipmaps: true });
  const originalSetTarget = renderer.setRenderTarget;
  renderer.setRenderTarget = (target, face, mip) => {
    if (target !== null && target !== cube) capturedTargets.add(target);
    originalSetTarget(target, face, mip);
  };
  const depths: number[] = [];
  const trackDepths = () => {
    const get = renderer.renderLists.get;
    renderer.renderLists.get = (object: Scene, depth: number) => {
      depths.push(depth);
      return get(object, depth);
    };
  };
  const currentOutput = () => outputs[outputs.length - 1];
  const currentSceneTarget = () => {
    if (sceneTarget === null) throw new Error("Output never bound its real scene buffer");
    return sceneTarget;
  };
  const pixel = () => {
    const result = new Uint8Array(4);
    gl.readPixels(
      Math.floor(gl.drawingBufferWidth / 2),
      Math.floor(gl.drawingBufferHeight / 2),
      1,
      1,
      GL.RGBA,
      GL.UNSIGNED_BYTE,
      result,
    );
    check(gl.getError() === GL.NO_ERROR, "Output produced a WebGL error");
    for (const program of renderer.info.programs ?? [])
      check(gl.getProgramParameter(program.program, GL.LINK_STATUS), `Output shader did not link: ${program.name}`);
    return Array.from(result);
  };
  const draw = () => {
    renderer.render(scene, camera);
    return pixel();
  };
  const nearPixel = (actual: number[], expected: number[], label: string) => {
    check(
      actual.every((value, index) => Math.abs(value - expected[index]) <= 2),
      `${label}: got ${actual.join(",")}, expected ${expected.join(",")}`,
    );
  };
  const expectedPixel = (tone: number, exposure: number, srgb: boolean) =>
    [4, 1, 0.25]
      .map((value) => {
        if (tone === ToneMapping.Reinhard) value = (value * exposure) / (1 + value * exposure);
        else if (tone === ToneMapping.Linear) value *= exposure;
        value = Math.min(1, value);
        if (srgb) value = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
        return Math.round(value * 255);
      })
      .concat(255);
  const handles = () =>
    [...capturedTargets]
      .flatMap((target) => [target.texture, target.depthTexture])
      .filter((texture) => texture !== null)
      .map((texture): WebGLTexture | undefined => renderer.properties.get(texture).__webglTexture)
      .filter((handle): handle is WebGLTexture => handle !== undefined && gl.isTexture(handle));
  const copy = (owner: WebGLRenderer, write: WebGLRenderTarget, read: WebGLRenderTarget) => {
    if (copyMaterial.map === null) copyMaterial.needsUpdate = true;
    copyMaterial.map = read.texture;
    owner.setRenderTarget(write);
    owner.render(copyScene, camera);
  };
  const transitions: { toneMapping: ToneMapping; exposure: number; colorSpace: string; pixel: number[] }[] = [];
  const effectCalls: string[] = [];
  const sizes: number[][] = [];
  let depthTexture: DepthTexture | null = null;
  const observedBuffers: { write: WebGLRenderTarget; read: WebGLRenderTarget }[] = [];
  const observer: WebGLOutputEffect = {
    needsSwap: false,
    needsDepthTexture: true,
    setDepthTexture(texture) {
      depthTexture = texture;
    },
    setSize(width, height) {
      sizes.push([width, height]);
    },
    render(_owner, write, read) {
      effectCalls.push("observe");
      observedBuffers.push({ write, read });
      check(read.depthTexture === depthTexture && depthTexture !== null, "Effect did not receive scene depth");
    },
  };
  const disabled: WebGLOutputEffect = {
    enabled: false,
    render() {
      throw new Error("Disabled effect ran");
    },
  };
  const firstCopy: WebGLOutputEffect = {
    render(owner, write, read) {
      effectCalls.push("copy-a");
      observedBuffers.push({ write, read });
      copy(owner, write, read);
    },
  };
  const secondCopy: WebGLOutputEffect = {
    needsSwap: true,
    render(owner, write, read) {
      effectCalls.push("copy-b");
      observedBuffers.push({ write, read });
      copy(owner, write, read);
    },
  };
  const effectChain = [disabled, observer, firstCopy, secondCopy];
  const recoveryPixels: number[][] = [];
  let disposed = false;
  try {
    check(gl.getExtension("EXT_color_buffer_float") !== null, "Float output smoke requires EXT_color_buffer_float");
    renderer.setSize(32, 24, false);
    renderer.toneMapping = ToneMapping.Reinhard;
    renderer.outputColorSpace = ColorSpace.LinearSRGB;
    trackDepths();
    const initial = draw();
    nearPixel(initial, expectedPixel(ToneMapping.Reinhard, 1, false), "Reinhard output");
    const hdr = new Float32Array(4);
    renderer.readRenderTargetPixels(currentSceneTarget(), 16, 12, 1, 1, hdr);
    check(
      hdr.every((value, index) => Math.abs(value - [4, 1, 0.25, 1][index]) < 0.01),
      `HDR was clamped or tone mapped before output: ${hdr.join(",")}`,
    );
    check(gl.getError() === GL.NO_ERROR, "HDR readback produced a WebGL error");
    for (const [tone, exposure, colorSpace] of [
      [ToneMapping.Reinhard, 0.5, ColorSpace.LinearSRGB],
      [ToneMapping.Reinhard, 2, ColorSpace.SRGB],
      [ToneMapping.Linear, 0.125, ColorSpace.LinearSRGB],
      [ToneMapping.Linear, 0.125, ColorSpace.SRGB],
      [ToneMapping.No, 0.125, ColorSpace.LinearSRGB],
      [ToneMapping.No, 2, ColorSpace.SRGB],
      [ToneMapping.Reinhard, 1, ColorSpace.LinearSRGB],
    ] as const) {
      renderer.toneMapping = tone;
      renderer.toneMappingExposure = exposure;
      renderer.outputColorSpace = colorSpace;
      const before = beginCount;
      const result = draw();
      nearPixel(result, expectedPixel(tone, exposure, colorSpace === ColorSpace.SRGB), "Output setting transition");
      check(
        beginCount - before === Number(tone !== ToneMapping.No),
        "No-tone/no-effects output did not bypass compositing",
      );
      transitions.push({ toneMapping: tone, exposure, colorSpace, pixel: result });
    }

    renderer.setEffects(effectChain);
    nearPixel(draw(), initial, "Local copy effects changed the frame");
    check(effectCalls.join(",") === "observe,copy-a,copy-b", `Unexpected effect order: ${effectCalls.join(",")}`);
    const [observation, first, second] = observedBuffers;
    check(
      observation.read === first.read && observation.write === first.write,
      "needsSwap=false swapped effect buffers",
    );
    check(
      second.read === first.write && second.write !== first.write && second.write !== first.read,
      "Effect ping-pong reused the scene buffer",
    );
    check(
      currentSceneTarget().depthTexture !== null &&
        gl.isTexture(renderer.properties.get(currentSceneTarget().depthTexture).__webglTexture),
      "Depth effect has no GPU depth texture",
    );
    const effectBuffers = [first.read, first.write, second.write];
    const beforeResize = handles();
    renderer.setDrawingBufferSize(40, 30, 2);
    check(
      beforeResize.every((handle) => !gl.isTexture(handle)),
      "Drawing-buffer resize retained old output GPU textures",
    );
    nearPixel(draw(), initial, "Drawing-buffer resize changed output");
    check(
      effectBuffers.every((target) => target.width === 80 && target.height === 60),
      "Drawing-buffer resize missed output targets",
    );
    check(sizes.at(-1)?.join(",") === "80,60", "Effect missed physical drawing-buffer resize");
    const resizedDepth = currentSceneTarget().depthTexture;
    check(
      resizedDepth !== null &&
        !Array.isArray(resizedDepth.image) &&
        resizedDepth.image.width === 80 &&
        resizedDepth.image.height === 60,
      "Depth texture was not resized",
    );
    renderer.setPixelRatio(1);
    renderer.setSize(32, 24, false);
    nearPixel(draw(), initial, "Logical resize changed output");
    check(
      effectBuffers.every((target) => target.width === 32 && target.height === 24),
      "Logical resize missed ping-pong targets",
    );

    renderer.toneMapping = ToneMapping.No;
    renderer.toneMappingExposure = 0.125;
    const beforeNoTone = beginCount;
    const noToneWithEffects = draw();
    nearPixel(noToneWithEffects, expectedPixel(ToneMapping.No, 0.125, false), "No-tone effects output");
    check(beginCount === beforeNoTone + 1, "No-tone effects skipped compositing");
    renderer.toneMapping = ToneMapping.Reinhard;
    renderer.toneMappingExposure = 1;
    let sceneDraws = 0;
    mesh.onBeforeRender = () => {
      sceneDraws++;
    };
    const renderPass: WebGLOutputEffect = {
      isRenderPass: true,
      needsSwap: false,
      render(owner, _write, read) {
        owner.setRenderTarget(read);
        owner.render(scene, camera);
      },
    };
    renderer.setEffects([renderPass, firstCopy]);
    check(currentOutput().hasRenderPass(), "Explicit RenderPass was not recognized");
    nearPixel(draw(), initial, "RenderPass output");
    check(sceneDraws === 1, `RenderPass rendered the scene ${sceneDraws} times`);
    mesh.onBeforeRender = () => {};
    renderer.setEffects(null);
    check(!currentOutput().hasRenderPass(), "Removing RenderPass retained its scene-skip flag");
    nearPixel(draw(), initial, "Removing effects changed output");
    check(currentSceneTarget().depthTexture === null, "Removing depth effect retained scene depth attachment");

    // Exercise saved cube face/mip through the output transaction itself, not ordinary offscreen rendering.
    renderer.setRenderTarget(cube, 3, 1);
    check(currentOutput().begin(renderer, cube), "Direct output transaction did not begin");
    renderer.setRenderTarget(cube, 1, 0);
    currentOutput().restore(renderer);
    check(
      renderer.getRenderTarget() === cube &&
        renderer.getActiveCubeFace() === 3 &&
        renderer.getActiveMipmapLevel() === 1,
      "Aborted output transaction lost target/face/mip",
    );
    check(
      renderer.toneMapping === ToneMapping.Reinhard && !currentOutput().isCompositing(),
      "Aborted transaction lost tone mapping or compositing state",
    );
    renderer.setRenderTarget(null);
    renderer.setSize(32, 24, false);
    nearPixel(draw(), initial, "Direct abort did not recover");

    for (const phase of ["scene", "effect"] as const) {
      for (const failure of ["callback", "render", "compile"] as const) {
        const fail = () => {
          renderer.setRenderTarget(cube, 2, 1);
          if (failure === "callback") throw new Error(`${phase} output callback failure`);
          if (failure === "render") renderer.render(nestedScene, camera);
          else renderer.compile(nestedScene, camera);
        };
        if (phase === "scene") scene.onBeforeRender = fail;
        else renderer.setEffects([{ needsSwap: false, render: fail }]);
        reject(
          () => renderer.render(scene, camera),
          failure === "callback" ? `${phase} output callback failure` : "No explicit shader selected",
        );
        check(
          renderer.getRenderTarget() === null &&
            renderer.getActiveCubeFace() === 0 &&
            renderer.getActiveMipmapLevel() === 0,
          `${phase}/${failure} did not restore the canvas target/face/mip`,
        );
        check(
          renderer.toneMapping === ToneMapping.Reinhard && !currentOutput().isCompositing(),
          `${phase}/${failure} leaked output transaction state`,
        );
        scene.onBeforeRender = () => {};
        renderer.setEffects(null);
        const depthStart = depths.length;
        const recovered = draw();
        nearPixel(recovered, initial, `${phase}/${failure} recovery`);
        check(depths[depthStart] === 0, `${phase}/${failure} leaked renderer stack depth`);
        recoveryPixels.push(recovered);
      }
    }
    check(depths.includes(1), "Effects and nested failures never exercised nested rendering");

    renderer.setEffects(effectChain);
    nearPixel(draw(), initial, "Re-enabling depth effects changed output");
    const released = handles();
    check(released.length >= 4, "Output did not allocate scene, depth and two ping-pong textures");
    currentOutput().dispose();
    check(
      released.every((handle) => !gl.isTexture(handle)),
      "Output disposal retained GPU texture storage",
    );
    nearPixel(draw(), initial, "Disposed output did not recover");
    const reallocated = handles();
    check(
      reallocated.length >= 4 && reallocated.every((handle) => !released.includes(handle)),
      "Disposed output reused deleted GPU handles",
    );

    const extension = gl.getExtension("WEBGL_lose_context");
    check(extension !== null, "WEBGL_lose_context is required for this smoke");
    // ES2022 has no Promise.withResolvers; use the existing GPU-smoke event bridge.
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
    const beforeLossPixel = draw();
    const beforeLossCalls = effectCalls.length;
    const beforeLoss = handles();
    await contextEvent("webglcontextlost", () => extension!.loseContext());
    check(
      beforeLoss.every((handle) => !gl.isTexture(handle)),
      "Context loss retained output textures",
    );
    await contextEvent("webglcontextrestored", () => {
      setTimeout(() => extension!.restoreContext(), 0);
    });
    trackDepths();
    nearPixel(draw(), beforeLossPixel, "Context restore changed output pixels");
    check(effectCalls.length === beforeLossCalls + 3, "Context restore lost configured effects or enabled flags");
    check(sizes.at(-1)?.join(",") === "32,24", "Restored effects did not receive current size");
    check(
      currentSceneTarget().depthTexture === depthTexture && depthTexture !== null,
      "Context restore did not reconnect effect depth",
    );
    const restored = handles();
    check(
      restored.length >= 4 && restored.every((handle) => !beforeLoss.includes(handle)),
      "Context restore did not replace output GPU handles",
    );
    check(
      renderer.toneMapping === ToneMapping.Reinhard &&
        renderer.toneMappingExposure === 1 &&
        renderer.outputColorSpace === ColorSpace.LinearSRGB,
      "Context restore lost output settings",
    );

    const programs = (renderer.info.programs ?? []).map((program) => program.program);
    cube.dispose();
    geometry.dispose();
    material.dispose();
    copyMaterial.dispose();
    missingMaterial.dispose();
    renderer.dispose();
    disposed = true;
    check(
      restored.every((handle) => !gl.isTexture(handle)),
      "Renderer disposal retained output textures",
    );
    check(
      programs.every((program) => !gl.isProgram(program) || gl.getProgramParameter(program, GL.DELETE_STATUS) === true),
      "Renderer disposal retained output programs",
    );
    check(
      renderer.info.memory.textures === 0 &&
        renderer.info.memory.geometries === 0 &&
        renderer.info.programs?.length === 0,
      `Output disposal leaked resources: textures=${renderer.info.memory.textures}, geometries=${renderer.info.memory.geometries}, programs=${renderer.info.programs?.length}`,
    );
    check(gl.getError() === GL.NO_ERROR, "Output cleanup produced a WebGL error");
    return {
      hdrPixel: Array.from(hdr),
      initial,
      transitions,
      noToneWithEffects,
      recoveryPixels,
      rejections,
      effectOrder: effectCalls.slice(0, 3),
      effectCalls: effectCalls.length,
      effectSizes: sizes,
      renderPassSceneDraws: sceneDraws,
      renderListDepths: depths,
      factoryCalls: outputs.length,
      beginCount,
      releasedTextures: released.length,
      reallocatedTextures: reallocated.length,
      restoredTextures: restored.length,
      contextRestored: true,
      finalTextures: renderer.info.memory.textures,
      finalGeometries: renderer.info.memory.geometries,
      finalPrograms: renderer.info.programs?.length,
      glError: gl.getError(),
    };
  } finally {
    scene.onBeforeRender = () => {};
    mesh.onBeforeRender = () => {};
    if (!disposed) {
      currentOutput().restore(renderer);
      renderer.setRenderTarget(null);
      cube.dispose();
      geometry.dispose();
      material.dispose();
      copyMaterial.dispose();
      missingMaterial.dispose();
      renderer.dispose();
    }
  }
}
