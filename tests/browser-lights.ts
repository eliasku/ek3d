import { GL } from "ek3d/GL";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { Scene } from "ek3d/scenes/Scene";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { DataTexture } from "ek3d/textures/DataTexture";
import type { Texture } from "ek3d/textures/Texture";
import { ShadowMap, ColorSpace } from "ek3d/constants";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Run in the existing Vite page: (await import('/tests/browser-lights.ts')).verifyLightRendering().
export async function verifyLightRendering() {
  const size = 96;
  const renderer = new WebGLRenderer({
    antialias: false,
    preserveDrawingBuffer: true,
    shaders: { MeshBasicMaterial: basicShader, MeshLambertMaterial: lambertShader, MeshDepthMaterial: depthShader },
    createShadowMap: WebGLShadowMap,
  });
  const scene = new Scene();
  const camera = new OrthographicCamera(-4, 4, 4, -4, 0.1, 20);
  camera.position.z = 8;
  const lambert = new MeshLambertMaterial({ color: 0xffffff });
  const basic = new MeshBasicMaterial({ color: 0xffffff });
  const receiver = new Mesh(new PlaneGeometry(8, 8), lambert);
  const caster = new Mesh(new BoxGeometry(0.8, 0.8, 0.8), lambert);
  const ambient = new AmbientLight(0xffffff, Math.PI * 0.2);
  const additive = new AmbientLight(0xffffff, Math.PI * 0.1);
  const spot = new SpotLight(0xffffff, Math.PI * 0.8, 0, Math.PI / 6, 0, 0);
  const shadowOnly = new SpotLight(0x00ff00, Math.PI * 0.2, 0, Math.PI / 4, 0, 0);
  const mapOnly = new SpotLight(0xffffff, Math.PI * 0.2, 0, Math.PI / 4, 0, 0);
  const cookieBytes = new Uint8Array([128, 64, 255, 0]);
  const replacementBytes = new Uint8Array([0, 255, 0, 255]);
  const cookie = new DataTexture(cookieBytes, 1, 1);
  const replacement = new DataTexture(replacementBytes, 1, 1);
  const redCookie = new DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
  const blueCookie = new DataTexture(new Uint8Array([0, 0, 255, 255]), 1, 1);
  const textures = [cookie, replacement, redCookie, blueCookie];
  const lights = [spot, shadowOnly, mapOnly];
  for (const texture of textures) texture.needsUpdate = true;
  for (const light of lights) {
    light.position.set(0, 0, 4);
    light.shadow.mapSize.set(128, 128);
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 20;
    // The caster is invisible to the view camera, but visible to the real shadow camera.
    light.shadow.camera.layers.set(1);
  }
  caster.layers.set(1);
  caster.position.z = 1;
  caster.castShadow = true;
  receiver.receiveShadow = true;
  scene.add(receiver, ambient);
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = ColorSpace.LinearSRGB;
  renderer.setClearColor(0x000000, 1);
  renderer.shadowMap!.enabled = true;
  renderer.shadowMap!.type = ShadowMap.PCF;
  const gl = renderer.getContext();
  const evidence: Record<string, number[]> = {};
  const draw = () => {
    renderer.render(scene, camera);
    const pixels = new Uint8Array(size * size * 4);
    gl.readPixels(0, 0, size, size, GL.RGBA, GL.UNSIGNED_BYTE, pixels);
    check(gl.getError() === GL.NO_ERROR, "Light fixture produced a WebGL error");
    for (const program of renderer.info.programs ?? [])
      check(gl.getProgramParameter(program.program, GL.LINK_STATUS), `Light program did not link: ${program.name}`);
    return pixels;
  };
  const sample = (frame: Uint8Array, x = 48, y = 48) =>
    Array.from(frame.slice((y * size + x) * 4, (y * size + x) * 4 + 4));
  const expectedPixel = (name: string, frame: Uint8Array, expected: number[], x = 48, y = 48) => {
    const actual = sample(frame, x, y);
    check(
      actual.every((value, i) => Math.abs(value - expected[i]) <= 2),
      `${name}: ${actual.join(",")} != ${expected.join(",")}`,
    );
    evidence[name] = actual;
    return actual;
  };
  const same = (a: Uint8Array, b: Uint8Array, message: string) =>
    check(
      a.every((value, i) => Math.abs(value - b[i]) <= 1),
      message,
    );
  const different = (a: Uint8Array, b: Uint8Array, message: string) =>
    check(
      a.some((value, i) => Math.abs(value - b[i]) > 12),
      message,
    );
  const occluded = (shadowed: Uint8Array, clear: Uint8Array) => {
    let count = 0;
    for (let i = 0; i < shadowed.length; i += 4)
      if (clear[i] - shadowed[i] > 12 && clear[i + 1] - shadowed[i + 1] > 12 && clear[i + 2] - shadowed[i + 2] > 12)
        count++;
    check(count > 16, `Spot shadow has only ${count} visibly occluded receiver pixels`);
    return count;
  };
  const handles = (light: SpotLight, includePass = true) =>
    [
      light.shadow.map?.texture,
      light.shadow.map?.depthTexture,
      ...(includePass ? [light.shadow.mapPass?.texture, light.shadow.mapPass?.depthTexture] : []),
    ]
      .filter((texture): texture is Texture => texture != null)
      .map((texture): WebGLTexture => renderer.properties.get(texture).__webglTexture)
      .filter((handle) => handle !== undefined);
  const textureHandle = (texture: Texture): WebGLTexture => {
    const handle: WebGLTexture = renderer.properties.get(texture).__webglTexture;
    check(handle !== undefined && gl.isTexture(handle), "Cookie has no live GPU texture");
    return handle;
  };
  // Orthographic pixel centers give an independent analytic Lambert/attenuation reference.
  const spotValue = (x = 48, y = 48) => {
    const px = ((x + 0.5) / size) * 8 - 4;
    const py = ((y + 0.5) / size) * 8 - 4;
    const distance = Math.hypot(px, py, spot.position.z);
    const cosine = spot.position.z / distance;
    const outer = Math.cos(spot.angle);
    const inner = Math.cos(spot.angle * (1 - spot.penumbra));
    const t = inner === outer ? Number(cosine > outer) : Math.max(0, Math.min(1, (cosine - outer) / (inner - outer)));
    const cone = t * t * (3 - 2 * t);
    const cutoff = spot.distance > 0 ? Math.max(0, 1 - (distance / spot.distance) ** 4) ** 2 : 1;
    return (255 * spot.intensity * cosine * cone * cutoff) / (Math.PI * Math.max(distance ** spot.decay, 0.01));
  };
  const spotPixel = (name: string, x = 48, y = 48) => {
    const value = spotValue(x, y);
    return expectedPixel(name, draw(), [value, value, value, 255], x, y);
  };
  try {
    const rejections: string[] = [];
    for (const missing of ["factory", "depth"] as const) {
      const probe = new Scene();
      const probeLight = new SpotLight(0xffffff, Math.PI * 0.8, 0, Math.PI / 4, 0, 0);
      probeLight.position.set(0, 0, 4);
      probeLight.castShadow = true;
      probeLight.shadow.mapSize.set(32, 32);
      const probeMesh = new Mesh(receiver.geometry, lambert);
      probeMesh.castShadow = true;
      probe.add(probeMesh, probeLight, probeLight.target);
      const candidate = new WebGLRenderer({
        shaders: missing === "depth" ? { MeshLambertMaterial: lambertShader } : renderer.shaders,
        ...(missing === "factory" ? {} : { createShadowMap: WebGLShadowMap }),
      });
      try {
        candidate.setSize(16, 16, false);
        candidate.outputColorSpace = ColorSpace.LinearSRGB;
        if (candidate.shadowMap !== null) candidate.shadowMap.enabled = true;
        const expected = missing === "factory" ? "createShadowMap" : "No explicit shader selected";
        let rejected = false;
        try {
          candidate.render(probe, camera);
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes(expected)) throw error;
          rejected = true;
          rejections.push(error.message);
        }
        check(rejected, `Spot rendering accepted missing ${missing}`);
        if (missing === "depth") candidate.shaders = renderer.shaders;
        const recovered = missing === "depth" ? candidate : renderer;
        recovered.render(probe, camera);
        const context = recovered.getContext();
        const pixel = new Uint8Array(4);
        const center = missing === "depth" ? 8 : size / 2;
        context.readPixels(center, center, 1, 1, GL.RGBA, GL.UNSIGNED_BYTE, pixel);
        check(
          pixel[0] > 200 && pixel[0] < 206 && pixel[1] === pixel[0] && pixel[2] === pixel[0] && pixel[3] === 255,
          `Spot ${missing} recovery did not draw Lambert pixels: ${pixel.join(",")}`,
        );
        check(context.getError() === GL.NO_ERROR, `Spot ${missing} recovery produced a GL error`);
        for (const program of recovered.info.programs ?? [])
          check(
            context.getProgramParameter(program.program, GL.LINK_STATUS),
            "Recovered spot depth program did not link",
          );
      } finally {
        probeLight.dispose();
        candidate.dispose();
      }
    }
    expectedPixel("ambientIntensity", draw(), [51, 51, 51, 255]);
    ambient.intensity *= 2;
    expectedPixel("ambientDouble", draw(), [102, 102, 102, 255]);
    ambient.color.setRGB(1, 0.5, 0.25);
    expectedPixel("ambientColor", draw(), [102, 51, 25.5, 255]);
    additive.color.setRGB(0, 0.5, 1);
    scene.add(additive);
    expectedPixel("ambientAddition", draw(), [102, 63.75, 51, 255]);
    receiver.material = basic;
    const unlit = draw();
    expectedPixel("basicWithAmbient", unlit, [255, 255, 255, 255]);
    scene.remove(ambient, additive);
    same(draw(), unlit, "Ambient removal changed unlit Basic material");
    receiver.material = lambert;
    expectedPixel("lambertWithoutLights", draw(), [0, 0, 0, 255]);

    scene.add(spot, spot.target);
    spotPixel("spotCenter");
    spotPixel("insideHardCone", 69);
    spotPixel("outsideCone", 84);
    spot.penumbra = 0.5;
    spotPixel("penumbra", 69);
    check(evidence.penumbra[0] < evidence.insideHardCone[0] - 20, "Penumbra did not soften the cone interior");
    spot.penumbra = 0;
    spot.decay = 1;
    spotPixel("decayOne");
    spot.decay = 2;
    spotPixel("decayTwo");
    spot.decay = 0;
    spot.distance = 5;
    spotPixel("distanceFade");
    spot.distance = 3;
    spotPixel("distanceCutoff");
    spot.distance = 0;
    const centered = draw();
    spot.target.position.x = 4;
    expectedPixel("movedTargetCenter", draw(), [0, 0, 0, 255]);
    spot.target.position.x = 0;
    same(draw(), centered, "Restoring target did not restore spotlight pixels");
    receiver.material = basic;
    same(draw(), unlit, "Spot illumination changed unlit Basic material");
    receiver.material = lambert;

    // WebGLLights updates map-only spot matrices; the shader multiplies RGB, not cookie alpha.
    spot.map = cookie;
    const value = spotValue();
    const transparentCookie = draw();
    expectedPixel("mapOnlyRgb", transparentCookie, [(value * 128) / 255, (value * 64) / 255, value, 255]);
    check(
      Boolean(!spot.castShadow && spot.shadow.map === null),
      "Map-only cookie unexpectedly allocated a shadow target",
    );
    const cookieHandle = textureHandle(cookie);
    cookieBytes[3] = 255;
    cookie.needsUpdate = true;
    same(draw(), transparentCookie, "Cookie alpha incorrectly modulated spotlight RGB");
    spot.map = replacement;
    expectedPixel("cookieReplacement", draw(), [0, value, 0, 255]);
    const replacementHandle = textureHandle(replacement);
    check(gl.isTexture(cookieHandle), "Replacing a cookie disposed caller-owned storage");
    replacementBytes.set([0, 0, 255, 255]);
    replacement.needsUpdate = true;
    expectedPixel("cookieUpdate", draw(), [0, 0, value, 255]);
    spot.map = null;
    same(draw(), centered, "Clearing cookie did not restore untextured spotlight");
    check(gl.isTexture(replacementHandle), "Clearing a cookie disposed caller-owned storage");

    spot.intensity = Math.PI * 0.2;
    spot.castShadow = shadowOnly.castShadow = true;
    spot.map = redCookie;
    mapOnly.map = blueCookie;
    scene.add(mapOnly, mapOnly.target, shadowOnly, shadowOnly.target);
    const ordered = draw();
    expectedPixel("mixedSpotOrdering", ordered, [51, 51, 51, 255]);
    scene.remove(spot, shadowOnly, mapOnly);
    scene.add(shadowOnly, spot, mapOnly);
    same(draw(), ordered, "Spot insertion order changed shadow/map uniform indexing");
    spot.map = null;
    expectedPixel("mixedMapRemoval", draw(), [51, 102, 102, 255]);
    spot.map = redCookie;
    spot.castShadow = false;
    same(draw(), ordered, "Moving shadow+map light to map-only broke uniform indexing");
    spot.castShadow = true;
    scene.remove(shadowOnly, shadowOnly.target, mapOnly, mapOnly.target);
    spot.map = null;
    spot.intensity = Math.PI * 0.8;
    spot.angle = Math.PI / 4;
    scene.add(caster);

    const shadowed = draw();
    const initialHandles = handles(spot);
    check(
      initialHandles.length > 0 && initialHandles.every((handle) => gl.isTexture(handle)),
      "Spot shadow has no live GPU storage",
    );
    receiver.receiveShadow = false;
    const clear = draw();
    const initialOcclusion = occluded(shadowed, clear);
    receiver.receiveShadow = true;
    caster.castShadow = false;
    same(draw(), clear, "castShadow=false retained spot occlusion");
    caster.castShadow = true;
    spot.shadow.intensity = 0;
    same(draw(), clear, "Zero shadow intensity retained occlusion");
    spot.shadow.intensity = 0.5;
    const halfShadow = draw();
    const fullPixel = sample(shadowed);
    const clearPixel = sample(clear);
    expectedPixel(
      "halfShadowIntensity",
      halfShadow,
      fullPixel.map((channel, i) => (channel + clearPixel[i]) / 2),
    );
    check(clearPixel[0] - fullPixel[0] > 100, "Center pixel did not lie inside the spot shadow");
    spot.shadow.intensity = 1;
    same(draw(), shadowed, "Shadow flags/intensity did not recover");
    caster.position.x = 0.9;
    const moved = draw();
    different(moved, shadowed, "Moving the hidden caster did not move receiver occlusion");
    occluded(moved, clear);
    caster.position.x = 0;
    draw();

    renderer.shadowMap!.autoUpdate = false;
    caster.position.x = 0.9;
    same(draw(), shadowed, "Frozen renderer updated the spot shadow");
    renderer.shadowMap!.needsUpdate = true;
    same(draw(), moved, "Renderer one-shot update did not move spot occlusion");
    check(!renderer.shadowMap!.needsUpdate, "Renderer one-shot flag was not consumed");
    caster.position.x = 0;
    same(draw(), moved, "Renderer one-shot flag did not return to frozen state");
    renderer.shadowMap!.autoUpdate = true;
    spot.shadow.autoUpdate = false;
    same(draw(), moved, "Frozen light updated the spot shadow");
    spot.shadow.needsUpdate = true;
    same(draw(), shadowed, "Light one-shot update did not restore spot occlusion");
    check(!spot.shadow.needsUpdate, "Light one-shot flag was not consumed");
    caster.position.x = 0.9;
    same(draw(), shadowed, "Light one-shot flag did not return to frozen state");
    spot.shadow.autoUpdate = true;
    caster.position.x = 0;

    const modes: { type: number; occludedPixels: number; gpuTextures: number }[] = [];
    for (const type of [ShadowMap.Basic, ShadowMap.VSM, ShadowMap.PCF]) {
      const oldHandles = handles(spot, false);
      renderer.shadowMap!.type = type;
      const frame = draw();
      receiver.receiveShadow = false;
      const unobstructed = draw();
      receiver.receiveShadow = true;
      const current = handles(spot);
      check(
        oldHandles.every((handle) => !gl.isTexture(handle)),
        "Shadow mode change retained old GPU storage",
      );
      check(current.length > 0 && current.every((handle) => gl.isTexture(handle)), "Shadow mode has no GPU storage");
      if (type === ShadowMap.VSM) check(spot.shadow.mapPass !== null, "Spot VSM did not allocate its blur target");
      modes.push({ type, occludedPixels: occluded(frame, unobstructed), gpuTextures: current.length });
    }

    const beforeResize = handles(spot, false);
    spot.shadow.focus = 0.75;
    spot.shadow.aspect = 0.75;
    spot.shadow.mapSize.set(256, 128);
    spot.distance = 12;
    const focused = draw();
    check(Math.abs(spot.shadow.camera.fov - 67.5) < 1e-10, "Spot focus did not set camera FOV");
    check(
      spot.shadow.camera.aspect === 1.5 && spot.shadow.camera.far === 12,
      "Spot aspect/mapSize/distance did not update projection",
    );
    check(spot.shadow.map?.width === 256 && spot.shadow.map.height === 128, "Spot shadow target did not resize");
    check(
      beforeResize.every((handle) => !gl.isTexture(handle)),
      "Spot mapSize resize retained old GPU storage",
    );
    receiver.receiveShadow = false;
    const focusedOcclusion = occluded(focused, draw());
    receiver.receiveShadow = true;
    spot.shadow.focus = spot.shadow.aspect = 1;
    spot.shadow.mapSize.set(128, 128);
    spot.distance = 0;
    spot.shadow.camera.far = 20;
    spot.map = cookie;
    const ownedFrame = draw();
    const ownedCookie = textureHandle(cookie);
    const released = handles(spot);
    spot.dispose();
    check(
      released.length > 0 && released.every((handle) => !gl.isTexture(handle)),
      "Spot disposal retained shadow GPU storage",
    );
    check(gl.isTexture(ownedCookie) && spot.map === cookie, "Spot disposal destroyed its caller-owned cookie");
    same(draw(), ownedFrame, "Spot shadow failed to recover after light disposal");
    check(
      handles(spot).every((handle) => !released.includes(handle) && gl.isTexture(handle)),
      "Spot disposal did not reallocate shadow storage",
    );

    renderer.shadowMap!.autoUpdate = spot.shadow.autoUpdate = false;
    const beforeLossFrame = draw();
    const beforeLoss = [...handles(spot), textureHandle(cookie)];
    const extension = gl.getExtension("WEBGL_lose_context");
    check(extension !== null, "Light fixture requires WEBGL_lose_context");
    const canvas = renderer.domElement;
    // Match the ES2022 event bridge used by the other browser fixtures.
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
    await contextEvent("webglcontextlost", () => extension.loseContext());
    check(
      beforeLoss.every((handle) => !gl.isTexture(handle)),
      "Context loss retained spot/cookie GPU storage",
    );
    await contextEvent("webglcontextrestored", () => {
      setTimeout(() => extension.restoreContext(), 0);
    });
    check(!renderer.shadowMap!.autoUpdate && !spot.shadow.autoUpdate, "Context restore lost frozen spot settings");
    same(draw(), beforeLossFrame, "Context restore did not regenerate frozen spot shadow and cookie");
    const restored = [...handles(spot), textureHandle(cookie)];
    check(
      restored.length > 1 && restored.every((handle) => !beforeLoss.includes(handle) && gl.isTexture(handle)),
      "Context restore reused stale spot/cookie handles",
    );
    spot.map = null;
    const finalCookie = textureHandle(cookie);
    cookie.dispose();
    check(!gl.isTexture(finalCookie), "Caller cookie disposal retained GPU storage");

    return {
      rejections,
      pixels: evidence,
      initialOcclusion,
      focusedOcclusion,
      modes,
      mapOnlyWithoutShadow: true,
      cookieAlphaIgnored: true,
      mixedSpotOrdering: true,
      hiddenCasterMovement: true,
      rendererAndLightOneShot: true,
      camera: { fov: 67.5, aspect: 1.5, width: 256, height: 128, far: 12 },
      callerOwnsCookie: true,
      shadowReallocated: true,
      frozenContextRestored: true,
      glError: gl.getError(),
    };
  } finally {
    const finalHandles = lights.flatMap((light) => handles(light));
    const programs = (renderer.info.programs ?? []).map((program) => program.program);
    for (const light of lights) light.dispose();
    ambient.dispose();
    additive.dispose();
    for (const texture of textures) texture.dispose();
    receiver.geometry.dispose();
    caster.geometry.dispose();
    lambert.dispose();
    basic.dispose();
    renderer.dispose();
    check(
      finalHandles.every((handle) => !gl.isTexture(handle)),
      "Light fixture cleanup retained shadow GPU handles",
    );
    check(
      programs.every((program) => !gl.isProgram(program) || gl.getProgramParameter(program, GL.DELETE_STATUS) === true),
      "Light fixture cleanup retained GPU programs",
    );
    check(gl.getError() === GL.NO_ERROR, "Light fixture cleanup produced a WebGL error");
  }
}
