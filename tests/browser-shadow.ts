import { GL } from "ek3d/GL";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { WebGLCubeRenderTarget } from "ek3d/renderers/WebGLCubeRenderTarget";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { MeshDepthMaterial } from "ek3d/materials/MeshDepthMaterial";
import { MeshDistanceMaterial } from "ek3d/materials/MeshDistanceMaterial";
import type { Material } from "ek3d/materials/Material";
import type { Texture } from "ek3d/textures/Texture";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { PointLight } from "ek3d/lights/PointLight";
import { ShadowMap } from "ek3d/constants";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { distanceShader } from "ek3d/renderers/shaders/DistanceShader";
import { configureShadowScene } from "./browser-fixtures";

// Run in a real browser served by Vite: (await import('/tests/browser-shadow.ts')).verifyShadowLifecycle().
export async function verifyShadowLifecycle() {
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
  const shaders = {
    MeshLambertMaterial: lambertShader,
    MeshDepthMaterial: depthShader,
    MeshDistanceMaterial: distanceShader,
  };
  const fixture = (renderer: WebGLRenderer) => {
    const scene = new Scene();
    const camera = new PerspectiveCamera(50, 4 / 3, 0.1, 100);
    const receiverMaterial = new MeshLambertMaterial({ color: 0xb8c4d0 });
    const casterMaterial = new MeshLambertMaterial({ color: 0xffaa66 });
    const receiver = new Mesh(new BoxGeometry(), receiverMaterial);
    const caster = new Mesh(new BoxGeometry(1.2, 1.2, 1.2), casterMaterial);
    const directional = new DirectionalLight(0xffffff, 3);
    const point = new PointLight(0xffffff, 150);
    configureShadowScene(renderer, scene, camera, receiver, caster, directional, point);
    renderer.setSize(96, 72, false);
    const dispose = () => {
      directional.dispose();
      point.dispose();
      receiver.geometry.dispose();
      caster.geometry.dispose();
      receiverMaterial.dispose();
      casterMaterial.dispose();
      renderer.dispose();
    };
    return { scene, camera, receiver, caster, receiverMaterial, casterMaterial, directional, point, dispose };
  };

  // Ordinary compile does not render the shadow pass; explicit depth/distance meshes exercise its descriptor boundary.
  for (const missing of ["factory", "depth", "distance"] as const) {
    const selected: WebGLRenderer["shaders"] =
      missing === "depth"
        ? { MeshLambertMaterial: lambertShader, MeshDistanceMaterial: distanceShader }
        : missing === "distance"
          ? { MeshLambertMaterial: lambertShader, MeshDepthMaterial: depthShader }
          : shaders;
    const renderer = new WebGLRenderer({
      antialias: false,
      preserveDrawingBuffer: true,
      shaders: selected,
      ...(missing === "factory" ? {} : { createShadowMap: WebGLShadowMap }),
    });
    const f = fixture(renderer);
    const depth = new MeshDepthMaterial();
    const distance = new MeshDistanceMaterial();
    try {
      if (missing === "distance") {
        f.scene.remove(f.directional);
        f.scene.add(f.point);
      }
      reject(
        () => renderer.render(f.scene, f.camera),
        missing === "factory" ? "createShadowMap" : "No explicit shader selected",
      );
      if (missing === "factory") reject(() => renderer.compile(f.scene, f.camera), "createShadowMap");
      else {
        const explicit = new Scene();
        explicit.add(new Mesh(f.caster.geometry, missing === "depth" ? depth : distance));
        reject(() => renderer.compile(explicit, f.camera), "No explicit shader selected");
        renderer.shaders = shaders;
        renderer.render(f.scene, f.camera);
      }
      check(renderer.getContext().getError() === GL.NO_ERROR, `Missing ${missing} recovery produced a GL error`);
    } finally {
      depth.dispose();
      distance.dispose();
      f.dispose();
    }
  }

  let factoryCalls = 0;
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: true,
    shaders,
    createShadowMap: (owner, objects, capabilities) => {
      factoryCalls++;
      return WebGLShadowMap(owner, objects, capabilities);
    },
  });
  const f = fixture(renderer);
  const { scene, camera, receiver, caster, casterMaterial, directional, point } = f;
  const gl = renderer.getContext();
  const target = new WebGLCubeRenderTarget(16, { generateMipmaps: true });
  const customDepth = new MeshDepthMaterial();
  const customDistance = new MeshDistanceMaterial();
  const missingMaterial = new MeshLambertMaterial();
  missingMaterial.type = "MissingShadowSmokeShader";
  const nestedScene = new Scene();
  const nestedMesh = new Mesh(caster.geometry, missingMaterial);
  nestedScene.add(nestedMesh);
  const depths: number[] = [];
  const trackDepths = () => {
    const get = renderer.renderLists.get;
    renderer.renderLists.get = (object: Scene, depth: number) => {
      depths.push(depth);
      return get(object, depth);
    };
  };
  const handles = (light: DirectionalLight | PointLight) => {
    const shadow = light.shadow;
    return [shadow.map?.texture, shadow.map?.depthTexture, shadow.mapPass?.texture, shadow.mapPass?.depthTexture]
      .filter((texture): texture is Texture => texture != null)
      .map((texture): WebGLTexture => renderer.properties.get(texture).__webglTexture)
      .filter((handle) => handle !== undefined);
  };
  const pixels = () => {
    const result = new Uint8Array(96 * 72 * 4);
    gl.readPixels(0, 0, 96, 72, GL.RGBA, GL.UNSIGNED_BYTE, result);
    check(gl.getError() === GL.NO_ERROR, "Shadow rendering produced a WebGL error");
    for (const program of renderer.info.programs ?? [])
      check(gl.getProgramParameter(program.program, GL.LINK_STATUS), `Shadow program did not link: ${program.name}`);
    return result;
  };
  const draw = () => {
    renderer.render(scene, camera);
    return pixels();
  };
  const same = (a: Uint8Array, b: Uint8Array, message: string) => {
    const changed = a.reduce((count, value, i) => count + Number(Math.abs(value - b[i]) > 1), 0);
    check(changed === 0, `${message}: ${changed} changed bytes`);
  };
  const different = (a: Uint8Array, b: Uint8Array, message: string) =>
    check(
      a.some((value, i) => Math.abs(value - b[i]) > 8),
      message,
    );
  const occluded = (shadowed: Uint8Array, unshadowed: Uint8Array) => {
    let count = 0;
    for (let i = 0; i < shadowed.length; i += 4)
      if (unshadowed[i] - shadowed[i] > 12 && unshadowed[i + 1] - shadowed[i + 1] > 12) count++;
    check(count > 8, `Expected visible receiver occlusion, got ${count} dark pixels`);
    return count;
  };
  const modes: { type: number; occludedPixels: number }[] = [];
  const seen = new Set<Material>();
  const disposed = new Set<Material>();
  const captureMaterial: typeof caster.onBeforeShadow = (
    _renderer,
    _object,
    _camera,
    _shadowCamera,
    _geometry,
    material,
  ) => {
    if (!seen.has(material)) {
      seen.add(material);
      material.addEventListener("dispose", () => disposed.add(material));
    }
  };
  try {
    trackDepths();
    const initial = draw();
    const firstHandles = handles(directional);
    check(
      firstHandles.length > 0 && firstHandles.every((handle) => gl.isTexture(handle)),
      "Directional map has no live GPU storage",
    );
    receiver.receiveShadow = false;
    const noReceive = draw();
    const initialOcclusion = occluded(initial, noReceive);
    receiver.receiveShadow = true;
    caster.castShadow = false;
    same(draw(), noReceive, "castShadow=false did not remove receiver shadow");
    caster.castShadow = true;
    same(draw(), initial, "Shadow flags did not recover");
    directional.shadow.intensity = 0;
    same(draw(), noReceive, "Shadow intensity zero did not remove occlusion");
    directional.shadow.intensity = 1;
    caster.position.x = 1.5;
    const moved = draw();
    different(moved, initial, "Caster movement did not change the frame");
    receiver.receiveShadow = false;
    occluded(moved, draw());
    receiver.receiveShadow = true;
    caster.position.x = 0;

    for (const type of [ShadowMap.Basic, ShadowMap.VSM, ShadowMap.PCF]) {
      const oldHandles = [directional.shadow.map!.texture, directional.shadow.map!.depthTexture]
        .filter((texture): texture is Texture => texture !== null)
        .map((texture): WebGLTexture => renderer.properties.get(texture).__webglTexture)
        .filter((handle) => handle !== undefined);
      renderer.shadowMap!.type = type;
      const shadowed = draw();
      receiver.receiveShadow = false;
      const clear = draw();
      receiver.receiveShadow = true;
      modes.push({ type, occludedPixels: occluded(shadowed, clear) });
      check(
        oldHandles.every((handle) => !gl.isTexture(handle)),
        "Shadow mode change retained old GPU map storage",
      );
      if (type === ShadowMap.VSM) check(directional.shadow.mapPass !== null, "VSM did not allocate its blur target");
    }

    let shadowDraws = 0;
    caster.onBeforeShadow = () => {
      shadowDraws++;
    };
    draw();
    renderer.shadowMap!.autoUpdate = false;
    const beforeFreeze = shadowDraws;
    caster.position.x = 1.5;
    const frozen = draw();
    check(shadowDraws === beforeFreeze, "Frozen renderer updated its shadow map");
    renderer.shadowMap!.needsUpdate = true;
    const updated = draw();
    check(shadowDraws > beforeFreeze && !renderer.shadowMap!.needsUpdate, "Renderer needsUpdate was not consumed");
    different(updated, frozen, "One-shot shadow update did not move occlusion");
    renderer.shadowMap!.autoUpdate = true;
    directional.shadow.autoUpdate = false;
    const beforeLightFreeze = shadowDraws;
    caster.position.x = 0;
    const lightFrozen = draw();
    check(shadowDraws === beforeLightFreeze, "Frozen light updated its shadow map");
    directional.shadow.needsUpdate = true;
    different(draw(), lightFrozen, "Light needsUpdate did not refresh occlusion");
    check(shadowDraws > beforeLightFreeze && !directional.shadow.needsUpdate, "Light needsUpdate was not consumed");
    directional.shadow.autoUpdate = true;

    caster.customDepthMaterial = customDepth;
    caster.onBeforeShadow = (_r, _o, _c, _s, _g, material) =>
      check(material === customDepth, "Custom depth material was ignored");
    draw();
    caster.customDepthMaterial = undefined;
    scene.remove(directional);
    scene.add(point);
    caster.customDistanceMaterial = customDistance;
    caster.onBeforeShadow = (_r, _o, _c, _s, _g, material) =>
      check(material === customDistance, "Custom distance material was ignored");
    const pointFrame = draw();
    caster.customDistanceMaterial = undefined;
    caster.onBeforeShadow = captureMaterial;
    same(draw(), pointFrame, "Default distance shader differs from equivalent custom distance shader");
    check(
      [...seen].some((material) => material instanceof MeshDistanceMaterial),
      "Point shadow did not use a distance material",
    );
    receiver.receiveShadow = false;
    const pointOcclusion = occluded(pointFrame, draw());
    receiver.receiveShadow = true;
    renderer.shadowMap!.type = ShadowMap.Basic;
    const pointBasic = draw();
    receiver.receiveShadow = false;
    occluded(pointBasic, draw());
    receiver.receiveShadow = true;
    const pointHandles = handles(point);
    point.dispose();
    check(
      pointHandles.length > 0 && pointHandles.every((handle) => !gl.isTexture(handle)),
      "Point disposal retained GPU map storage",
    );
    same(draw(), pointBasic, "Point shadow did not recover after light disposal");
    check(
      handles(point).every((handle) => !pointHandles.includes(handle) && gl.isTexture(handle)),
      "Point map was not reallocated",
    );
    scene.remove(point);
    scene.add(directional);
    renderer.shadowMap!.type = ShadowMap.PCF;

    // alphaToCoverage selects real per-source depth/distance cache variants without an extra texture fixture.
    casterMaterial.alphaToCoverage = true;
    casterMaterial.needsUpdate = true;
    seen.clear();
    disposed.clear();
    draw();
    scene.remove(directional);
    scene.add(point);
    draw();
    check(seen.size === 2, "Depth/distance cache variants were not both exercised");
    casterMaterial.dispose();
    check(
      [...seen].every((material) => disposed.has(material)),
      "Source material disposal retained cached shadow materials",
    );
    const oldVariants = new Set(seen);
    seen.clear();
    disposed.clear();
    draw();
    scene.remove(point);
    scene.add(directional);
    draw();
    check(
      seen.size === 2 && [...seen].every((material) => !oldVariants.has(material)),
      "Disposed shadow cache variants were reused",
    );
    caster.onBeforeShadow = () => {};

    const stable = draw();
    for (const failure of ["callback", "render", "compile"] as const) {
      renderer.setRenderTarget(target, 3, 1);
      caster.onBeforeShadow = () => {
        if (failure === "callback") throw new Error("shadow callback failure");
        if (failure === "render") renderer.render(nestedScene, camera);
        else renderer.compile(nestedScene, camera);
      };
      reject(
        () => renderer.render(scene, camera),
        failure === "callback" ? "shadow callback failure" : "No explicit shader selected",
      );
      check(
        renderer.getRenderTarget() === target &&
          renderer.getActiveCubeFace() === 3 &&
          renderer.getActiveMipmapLevel() === 1,
        `${failure} failure did not restore render target/face/mip`,
      );
      caster.onBeforeShadow = () => {};
      renderer.setRenderTarget(null);
      same(draw(), stable, `${failure} failure damaged the next shadow frame`);
      check(depths.at(-1) === 0, `${failure} failure leaked render-list stack depth`);
    }
    check(depths.includes(1), "Nested render failure did not exercise nested renderer state");
    const released = handles(directional);
    directional.dispose();
    check(
      released.every((handle) => !gl.isTexture(handle)),
      "Directional light disposal retained GPU map storage",
    );
    same(draw(), stable, "Directional shadow failed to recover after disposal");
    check(
      handles(directional).every((handle) => !released.includes(handle) && gl.isTexture(handle)),
      "Directional map was not reallocated",
    );

    renderer.shadowMap!.autoUpdate = false;
    directional.shadow.autoUpdate = false;
    renderer.setClearColor(0x152238, 0.5);
    const beforeLossFrame = draw();
    const beforeLoss = handles(directional);
    const extension = gl.getExtension("WEBGL_lose_context");
    check(extension !== null, "WEBGL_lose_context is required for this smoke");
    const canvas = renderer.domElement;
    // ES2022 has no Promise.withResolvers; use the same event bridge as the other GPU smokes.
    const contextEvent = (name: string, action: () => void) =>
      new Promise<void>((resolve, rejectEvent) => {
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          canvas.removeEventListener(name, done);
          rejectEvent(new Error(`Timed out waiting for ${name}`));
        }, 10000);
        canvas.addEventListener(name, done, { once: true });
        action();
      });
    await contextEvent("webglcontextlost", () => extension!.loseContext());
    check(
      beforeLoss.every((handle) => !gl.isTexture(handle)),
      "Context loss retained shadow GPU storage",
    );
    await contextEvent("webglcontextrestored", () => {
      setTimeout(() => extension!.restoreContext(), 0);
    });
    check(factoryCalls === 2, "Context restore did not recreate the shadow provider");
    check(
      !renderer.shadowMap!.autoUpdate && !directional.shadow.autoUpdate,
      "Context restore lost frozen shadow settings",
    );
    check(renderer.getClearAlpha() === 0.5, "Context restore lost clear alpha");
    trackDepths();
    same(draw(), beforeLossFrame, "Context restore did not regenerate the frozen shadow map");
    const restored = handles(directional);
    check(
      restored.length > 0 && restored.every((handle) => !beforeLoss.includes(handle) && gl.isTexture(handle)),
      "Context restore did not replace shadow GPU storage",
    );

    // Keep VSM blur programs and source cache variants live until renderer disposal.
    renderer.shadowMap!.autoUpdate = directional.shadow.autoUpdate = true;
    renderer.shadowMap!.type = ShadowMap.VSM;
    caster.onBeforeShadow = captureMaterial;
    seen.clear();
    disposed.clear();
    draw();
    const finalHandles = [...handles(directional), ...handles(point)];
    const programs = (renderer.info.programs ?? []).map((program) => program.program);
    target.dispose();
    customDepth.dispose();
    customDistance.dispose();
    missingMaterial.dispose();
    directional.dispose();
    point.dispose();
    receiver.geometry.dispose();
    caster.geometry.dispose();
    f.receiverMaterial.dispose();
    renderer.dispose();
    check(
      [...seen].every((material) => disposed.has(material)),
      "Renderer disposal retained internal shadow cache materials",
    );
    casterMaterial.dispose();
    check(
      finalHandles.every((handle) => !gl.isTexture(handle)),
      "Final disposal retained shadow textures",
    );
    check(
      programs.every((program) => !gl.isProgram(program) || gl.getProgramParameter(program, GL.DELETE_STATUS) === true),
      "Renderer disposal retained GPU shader programs",
    );
    check(
      renderer.info.memory.textures === 0 &&
        renderer.info.memory.geometries === 0 &&
        renderer.info.programs?.length === 0,
      `Final shadow disposal leaked resources: textures=${renderer.info.memory.textures}, geometries=${renderer.info.memory.geometries}, programs=${renderer.info.programs?.length}`,
    );
    check(gl.getError() === GL.NO_ERROR, "Shadow cleanup produced a WebGL error");
    return {
      initialOcclusion,
      pointOcclusion,
      modes,
      rejections,
      renderListDepths: depths,
      factoryCalls,
      frozenContextRestored: true,
      customMaterials: true,
      cacheMaterialsDisposed: true,
      gpuHandlesDeleted: true,
      finalTextures: renderer.info.memory.textures,
      finalGeometries: renderer.info.memory.geometries,
      finalPrograms: renderer.info.programs?.length,
      glError: gl.getError(),
    };
  } finally {
    caster.onBeforeShadow = () => {};
    target.dispose();
    customDepth.dispose();
    customDistance.dispose();
    missingMaterial.dispose();
    f.dispose();
  }
}
