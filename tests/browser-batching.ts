import { GL } from "ek3d/GL";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import type { Object3D } from "ek3d/core/Object3D";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { BatchedMesh } from "ek3d/objects/BatchedMesh";
import { LOD } from "ek3d/objects/LOD";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { PointLight } from "ek3d/lights/PointLight";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Color } from "ek3d/math/Color";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { distanceShader } from "ek3d/renderers/shaders/DistanceShader";
import { ColorSpace } from "ek3d/constants";
import { configureShadowScene } from "./browser-fixtures";

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

type Allocation = { buffers: WebGLBuffer[]; textures: WebGLTexture[]; vao: WebGLVertexArrayObject };

export async function verifyBatchingRendering() {
  const renderer = new WebGLRenderer({
    antialias: false,
    preserveDrawingBuffer: true,
    createShadowMap: WebGLShadowMap,
    shaders: {
      MeshBasicMaterial: basicShader,
      MeshLambertMaterial: lambertShader,
      MeshDepthMaterial: depthShader,
      MeshDistanceMaterial: distanceShader,
    },
  });
  const gl = renderer.getContext();
  const nativeMultiDraw = gl.getExtension("WEBGL_multi_draw") !== null;
  const scene = new Scene();
  const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 30);
  camera.position.z = 5;
  const square = new BufferGeometry();
  square.setAttribute(
    "position",
    new Float32BufferAttribute([-0.375, -0.375, 0, 0.375, -0.375, 0, -0.375, 0.375, 0, 0.375, 0.375, 0], 3),
  );
  square.setIndex([0, 1, 2, 2, 1, 3]);
  const triangle = square.clone().setIndex([0, 1, 2]);
  const arraysSquare = square.toNonIndexed();
  const arraysTriangle = triangle.toNonIndexed();
  const material = new MeshBasicMaterial({ color: 0xffffff });
  const nearMaterial = new MeshBasicMaterial({ color: 0xff0000 });
  const farMaterial = new MeshBasicMaterial({ color: 0x0000ff });
  const batches = [new BatchedMesh(4, 32, 48, material), new BatchedMesh(4, 48, 0, material)];
  const ordinary = new Mesh(square, material);
  ordinary.position.y = -1;
  const matrix = new Matrix4();
  const tint = new Color();
  const place = (batch: BatchedMesh, id: number, x: number, y = 0, z = 0) =>
    batch.setMatrixAt(id, matrix.makeTranslation(x, y, z));
  const paint = (batch: BatchedMesh, id: number, r: number, g: number, b: number) =>
    batch.setColorAt(id, tint.setRGB(r, g, b));
  const readPixels = (width = 64, height = 64) => {
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, GL.RGBA, GL.UNSIGNED_BYTE, pixels);
    check(gl.getError() === GL.NO_ERROR, "Batching produced a GL error");
    return pixels;
  };
  const draw = (...objects: Object3D[]) => {
    scene.clear();
    for (const object of objects) scene.add(object);
    renderer.render(scene, camera);
    return readPixels();
  };
  const color = (pixels: Uint8Array, x: number, y: number, expected: number[], label: string) => {
    const actual = pixels.subarray((y * 64 + x) * 4, (y * 64 + x) * 4 + 3);
    check(
      actual.every((value, i) => Math.abs(value - expected[i]) <= 1),
      `${label}: ${actual.join(",")} != ${expected.join(",")}`,
    );
  };
  const same = (actual: Uint8Array, expected: Uint8Array, label: string) =>
    check(
      actual.every((value, i) => value === expected[i]),
      label,
    );
  const allocation = (batch: BatchedMesh): Allocation => {
    draw(batch);
    const program = gl.getParameter(GL.CURRENT_PROGRAM) as WebGLProgram;
    const position = gl.getAttribLocation(program, "position");
    check(position >= 0, "Missing batching position attribute");
    const buffers = [gl.getVertexAttrib(position, GL.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING) as WebGLBuffer];
    const index = gl.getParameter(GL.ELEMENT_ARRAY_BUFFER_BINDING) as WebGLBuffer | null;
    if (index !== null) buffers.push(index);
    const vao = gl.getParameter(GL.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject;
    const active = gl.getParameter(GL.ACTIVE_TEXTURE) as number;
    const textures = ["batchingTexture", "batchingIdTexture", "batchingColorTexture"].map((name) => {
      const location = gl.getUniformLocation(program, name);
      if (location === null) throw new Error(`Missing ${name} sampler`);
      const unit = gl.getUniform(program, location) as number;
      gl.activeTexture(GL.TEXTURE0 + unit);
      return gl.getParameter(GL.TEXTURE_BINDING_2D) as WebGLTexture;
    });
    gl.activeTexture(active);
    check(
      buffers.every((handle) => gl.isBuffer(handle)),
      "Missing real batch buffers",
    );
    check(
      textures.every((handle) => gl.isTexture(handle)),
      "Missing real batch textures",
    );
    check(gl.isVertexArray(vao), "Missing real batch VAO");
    return { buffers, textures, vao };
  };
  const deletedGeometry = (resource: Allocation, label: string) => {
    check(
      resource.buffers.every((handle) => !gl.isBuffer(handle)),
      `${label}: live buffers`,
    );
    check(!gl.isVertexArray(resource.vao), `${label}: live VAO`);
  };
  const deleted = (resource: Allocation, label: string) => {
    deletedGeometry(resource, label);
    check(
      resource.textures.every((handle) => !gl.isTexture(handle)),
      `${label}: live textures`,
    );
  };
  const fresh = (current: Allocation, old: Allocation, label: string) => {
    check(current.vao !== old.vao, `${label}: stale VAO`);
    check(
      current.buffers.every((handle) => !old.buffers.includes(handle)),
      `${label}: stale buffer`,
    );
    check(
      current.textures.every((handle) => !old.textures.includes(handle)),
      `${label}: stale texture`,
    );
  };
  const shadowScene = new Scene();
  const shadowCamera = new PerspectiveCamera(50, 4 / 3, 0.1, 100);
  const receiverGeometry = new BoxGeometry();
  const casterGeometry = new BoxGeometry(1.2, 1.2, 1.2);
  const receiverMaterial = new MeshLambertMaterial({ color: 0xb8c4d0 });
  const casterMaterial = new MeshLambertMaterial({ color: 0xffaa66 });
  const receiver = new Mesh(receiverGeometry, receiverMaterial);
  const caster = new BatchedMesh(2, 24, 36, casterMaterial);
  const casterGeometryId = caster.addGeometry(casterGeometry);
  const casterIds = [caster.addInstance(casterGeometryId), caster.addInstance(casterGeometryId)];
  const directional = new DirectionalLight(0xffffff, 3);
  const point = new PointLight(0xffffff, 150);
  const liveBatches = new Set([...batches, caster]);
  const disposeBatch = (batch: BatchedMesh) => {
    if (liveBatches.delete(batch)) batch.dispose();
  };
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(64, 64, false);
    renderer.outputColorSpace = ColorSpace.LinearSRGB;
    renderer.setClearColor(0x000000, 1);
    for (let variant = 0; variant < batches.length; variant++) {
      const batch = batches[variant];
      const full = variant === 0 ? square : arraysSquare;
      const half = variant === 0 ? triangle : arraysTriangle;
      const firstGeometry = batch.addGeometry(full, 8, 12);
      const secondGeometry = batch.addGeometry(half, 8, 12);
      const left = batch.addInstance(firstGeometry);
      const right = batch.addInstance(secondGeometry);
      place(batch, left, -1);
      place(batch, right, 1);
      paint(batch, left, 1, 0, 0);
      paint(batch, right, 0, 1, 0);
      const initial = draw(batch);
      color(initial, 19, 35, [255, 0, 0], "Full geometry range");
      color(initial, 45, 29, [0, 255, 0], "Second reserved geometry range");
      color(initial, 51, 35, [0, 0, 0], "Triangle range drew reserved vertices");
      check(renderer.info.render.triangles === 3, "Batch triangle ranges include reserved capacity");
      check(renderer.info.render.calls === (nativeMultiDraw ? 1 : 2), "Native/fallback batching submission count");
      batch.setVisibleAt(right, false);
      let pixels = draw(batch);
      color(pixels, 45, 29, [0, 0, 0], "Hidden instance rendered");
      check(renderer.info.render.triangles === 2, "Hidden instance submitted geometry");
      batch.setVisibleAt(left, false);
      pixels = draw(batch);
      check(renderer.info.render.calls === 0, "Invisible batch submitted draws");
      same(pixels, draw(), "Invisible batch rendered pixels");
      batch.setVisibleAt(left, true);
      batch.setVisibleAt(right, true);
      same(draw(batch), initial, "Visibility restore changed pixels");
      place(batch, left, -1, 1);
      paint(batch, left, 0, 0, 1);
      pixels = draw(batch, ordinary);
      color(pixels, 16, 32, [0, 0, 0], "Old matrix location retained");
      color(pixels, 16, 48, [0, 0, 255], "Matrix/color texture update");
      color(pixels, 32, 16, [255, 255, 255], "Adjacent ordinary mesh inherited batching state");
      ordinary.renderOrder = -1;
      color(draw(batch, ordinary), 32, 16, [255, 255, 255], "Ordinary-first shared material draw");
      ordinary.renderOrder = 0;
      batch.setGeometryAt(secondGeometry, full);
      color(draw(batch), 51, 35, [0, 255, 0], "Replacement geometry did not expand draw range");
      batch.setGeometryAt(secondGeometry, half);
      color(draw(batch), 51, 35, [0, 0, 0], "Replacement geometry did not shrink draw range");
      place(batch, left, 10);
      pixels = draw(batch);
      check(renderer.info.render.triangles === 1, "Per-instance frustum culling submitted offscreen range");
      batch.perObjectFrustumCulled = false;
      same(draw(batch), pixels, "Disabling culling changed visible pixels");
      check(renderer.info.render.triangles === 3, "Disabling per-instance culling did not submit offscreen range");
      batch.perObjectFrustumCulled = true;
      place(batch, left, -1);
      paint(batch, left, 1, 0, 0);
      batch.deleteInstance(left);
      color(draw(batch), 16, 32, [0, 0, 0], "Deleted instance still rendered");
      const reused = batch.addInstance(firstGeometry);
      check(reused === left, "Deleted instance ID not reused");
      place(batch, reused, -1);
      paint(batch, reused, 1, 0, 0);
      same(draw(batch), initial, "Reused instance changed pixels");
      batch.deleteGeometry(firstGeometry);
      color(draw(batch), 16, 32, [0, 0, 0], "Deleting geometry retained its instance");
      const surviving = draw(batch);
      batch.optimize();
      same(draw(batch), surviving, "Compacting surviving geometry changed pixels");
      const reusedGeometry = batch.addGeometry(full, 8, 12);
      check(reusedGeometry === firstGeometry, "Deleted geometry ID not reused");
      const replacement = batch.addInstance(reusedGeometry);
      place(batch, replacement, -1);
      paint(batch, replacement, 1, 0, 0);
      same(draw(batch), initial, "Geometry reuse after optimize changed pixels");
      batch.optimize();
      const beforeResize = allocation(batch);
      batch.setInstanceCount(8);
      check(
        beforeResize.textures.every((handle) => !gl.isTexture(handle)),
        "Instance resize retained old GPU textures",
      );
      batch.setGeometrySize(64, variant === 0 ? 96 : 0);
      deletedGeometry(beforeResize, "Geometry growth");
      same(draw(batch), initial, "Growing capacities changed pixels");
      const grown = allocation(batch);
      fresh(grown, beforeResize, "Capacity growth");
      batch.setInstanceCount(2);
      batch.setGeometrySize(16, variant === 0 ? 24 : 0);
      deleted(grown, "Capacity shrink");
      same(draw(batch), initial, "Shrinking capacities changed pixels");
      const shrunk = allocation(batch);
      fresh(shrunk, grown, "Capacity shrink");
      batch.geometry.dispose();
      deletedGeometry(shrunk, "Explicit geometry disposal");
      same(draw(batch), initial, "Geometry disposal/reallocation changed pixels");
    }

    const sorted = batches[0];
    sorted.setGeometryIdAt(0, 0);
    sorted.setGeometryIdAt(1, 0);
    place(sorted, 0, 0, 0, 1);
    place(sorted, 1, 0, 0, 0);
    paint(sorted, 0, 1, 0, 0);
    paint(sorted, 1, 0, 0, 1);
    // With depth disabled, the final pixel exposes the actual submission order.
    material.depthTest = material.depthWrite = false;
    color(draw(sorted), 32, 32, [0, 0, 255], "Opaque front-to-back sorting");
    material.transparent = true;
    material.opacity = 0.5;
    material.needsUpdate = true;
    color(draw(sorted), 32, 32, [128, 0, 64], "Transparent back-to-front sorting");
    sorted.setCustomSort((list) => list.sort((a, b) => a.z - b.z));
    color(draw(sorted), 32, 32, [64, 0, 128], "Custom sort did not reverse alpha compositing");
    sorted.setCustomSort(null);
    sorted.sortObjects = false;
    color(draw(sorted), 32, 32, [64, 0, 128], "Unsorted instance order");
    sorted.sortObjects = true;
    material.transparent = false;
    material.opacity = 1;
    material.depthTest = material.depthWrite = true;
    material.needsUpdate = true;

    const lod = new LOD();
    lod.addLevel(new Mesh(square, nearMaterial), 0);
    lod.addLevel(new Mesh(square, farMaterial), 10, 0.2);
    const lodPixel = (z: number, expected: number[], label: string) => {
      camera.position.z = z;
      color(draw(lod), 32, 32, expected, label);
    };
    lodPixel(5, [255, 0, 0], "LOD near");
    lodPixel(11, [0, 0, 255], "LOD far");
    lodPixel(9, [0, 0, 255], "LOD hysteresis retained far level");
    lodPixel(7, [255, 0, 0], "LOD hysteresis returned near level");
    lodPixel(11, [0, 0, 255], "LOD far before zoom");
    camera.zoom = 2;
    camera.updateProjectionMatrix();
    lodPixel(11, [255, 0, 0], "LOD zoom-adjusted distance");
    lod.autoUpdate = false;
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    lodPixel(11, [255, 0, 0], "LOD autoUpdate false changed level");
    camera.updateMatrixWorld();
    lod.updateMatrixWorld();
    lod.update(camera);
    lodPixel(11, [0, 0, 255], "LOD manual update");
    camera.position.z = 5;

    place(caster, casterIds[0], -1.3);
    place(caster, casterIds[1], 1.3);
    configureShadowScene(renderer, shadowScene, shadowCamera, receiver, caster, directional, point);
    renderer.setSize(96, 72, false);
    const shadowVaos = new Set<WebGLVertexArrayObject>();
    const shadowBuffers = new Set<WebGLBuffer>();
    caster.onAfterShadow = () => {
      shadowVaos.add(gl.getParameter(GL.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject);
      const program = gl.getParameter(GL.CURRENT_PROGRAM) as WebGLProgram;
      shadowBuffers.add(
        gl.getVertexAttrib(
          gl.getAttribLocation(program, "position"),
          GL.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING,
        ) as WebGLBuffer,
      );
    };
    const shadowDraw = () => {
      renderer.render(shadowScene, shadowCamera);
      return readPixels(96, 72);
    };
    const shadows: { light: string; occludedPixels: number; movedPixels: number }[] = [];
    for (const light of [directional, point]) {
      shadowScene.remove(directional, point);
      shadowScene.add(light);
      const shadowed = shadowDraw();
      receiver.receiveShadow = false;
      const lit = shadowDraw();
      receiver.receiveShadow = true;
      let occludedPixels = 0;
      for (let i = 0; i < lit.length; i += 4)
        if (lit[i] - shadowed[i] > 12 && lit[i + 1] - shadowed[i + 1] > 12) occludedPixels++;
      check(occludedPixels > 16, `${light.type}: missing batch receiver shadow`);
      caster.castShadow = false;
      same(shadowDraw(), lit, `${light.type}: disabling batch shadows retained occlusion`);
      caster.castShadow = true;
      place(caster, casterIds[0], -2.4);
      const moved = shadowDraw();
      receiver.receiveShadow = false;
      const movedLit = shadowDraw();
      receiver.receiveShadow = true;
      let movedPixels = 0;
      for (let i = 0; i < lit.length; i += 4)
        if (lit[i] - shadowed[i] > 12 !== movedLit[i] - moved[i] > 12) movedPixels++;
      check(movedPixels > 8, `${light.type}: matrix texture update did not move batch shadow`);
      place(caster, casterIds[0], -1.3);
      same(shadowDraw(), shadowed, `${light.type}: restoring batch matrix did not restore shadow`);
      shadows.push({ light: light.type, occludedPixels, movedPixels });
    }
    check(shadowVaos.size >= 2 && shadowBuffers.size === 1, "Depth/distance passes did not share batch geometry");
    disposeBatch(caster);
    check(
      [...shadowVaos].every((handle) => !gl.isVertexArray(handle)),
      "Batch disposal retained shadow VAOs",
    );
    check(
      [...shadowBuffers].every((handle) => !gl.isBuffer(handle)),
      "Batch disposal retained shadow geometry",
    );
    directional.dispose();
    point.dispose();
    renderer.setSize(64, 64, false);
    renderer.setClearColor(0x000000, 1);

    const snapshots = batches.map((batch) => draw(batch));
    const allocated = batches.map(allocation);
    const extension = gl.getExtension("WEBGL_lose_context");
    if (extension === null) throw new Error("Batching restoration requires WEBGL_lose_context");
    // The browser fixture target is ES2022, which has no Promise.withResolvers.
    const contextEvent = (name: string, action: () => void) =>
      new Promise<void>((resolve, reject) => {
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          renderer.domElement.removeEventListener(name, done);
          reject(new Error(`Timed out waiting for ${name}`));
        }, 10000);
        renderer.domElement.addEventListener(name, done, { once: true });
        action();
      });
    await contextEvent("webglcontextlost", () => extension.loseContext());
    check(gl.isContextLost(), "Batch fixture did not lose the real context");
    await contextEvent("webglcontextrestored", () => setTimeout(() => extension.restoreContext(), 0));
    batches.forEach((batch, i) => same(draw(batch), snapshots[i], "Batch context restore pixels"));
    const restored = batches.map(allocation);
    restored.forEach((resource, i) => fresh(resource, allocated[i], "Context restoration"));
    disposeBatch(batches[0]);
    deleted(restored[0], "Batch disposal");
    same(draw(batches[1]), snapshots[1], "Disposing sibling batch damaged shared material");
    renderer.dispose();
    deleted(restored[1], "Renderer disposal with live batch");
    const glError = gl.getError();
    check(glError === GL.NO_ERROR, "Batch GPU lifecycle produced a GL error");

    // Hide only optional capability discovery on a second, real context; never replace GL draw calls.
    const canvas = document.createElement("canvas");
    const fallbackGL = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
    if (fallbackGL === null) throw new Error("Batch fallback requires a real WebGL2 context");
    const getExtension = fallbackGL.getExtension.bind(fallbackGL);
    fallbackGL.getExtension = (name: string) => (name === "WEBGL_multi_draw" ? null : getExtension(name));
    const fallback = new WebGLRenderer({ canvas, context: fallbackGL, shaders: { MeshBasicMaterial: basicShader } });
    const fallbackIndexed = new BatchedMesh(2, 4, 6, material);
    try {
      fallback.setPixelRatio(1);
      fallback.setSize(64, 64, false);
      fallback.setClearColor(0x000000, 1);
      fallback.outputColorSpace = ColorSpace.LinearSRGB;
      const geometryId = fallbackIndexed.addGeometry(square);
      const left = fallbackIndexed.addInstance(geometryId);
      const right = fallbackIndexed.addInstance(geometryId);
      place(fallbackIndexed, left, -1);
      place(fallbackIndexed, right, 1);
      paint(fallbackIndexed, left, 1, 0, 0);
      paint(fallbackIndexed, right, 0, 1, 0);
      for (const batch of [fallbackIndexed, batches[1]]) {
        scene.clear();
        scene.add(batch);
        fallback.render(scene, camera);
        const pixels = new Uint8Array(64 * 64 * 4);
        fallbackGL.readPixels(0, 0, 64, 64, GL.RGBA, GL.UNSIGNED_BYTE, pixels);
        if (batch === fallbackIndexed) {
          color(pixels, 16, 32, [255, 0, 0], "Indexed fallback first draw ID");
          color(pixels, 48, 32, [0, 255, 0], "Indexed fallback second draw ID");
        } else {
          same(pixels, snapshots[1], "Nonindexed multi-draw fallback pixels");
        }
        check(fallback.info.render.calls === 2, "Fallback did not issue individual draws");
        check(fallbackGL.getError() === GL.NO_ERROR, "Fallback produced a GL error");
      }
    } finally {
      fallbackIndexed.dispose();
      fallback.dispose();
      fallbackGL.getExtension = getExtension;
    }
    return {
      indexedAndNonindexedRanges: true,
      visibilityAndReuse: true,
      geometryReplacement: true,
      matrixColorUpdates: true,
      sharedMaterial: true,
      perInstanceFrustumCulling: true,
      capacityResizeAndOptimize: true,
      sorting: ["opaque", "transparent", "custom", "unsorted"],
      lod: ["near", "far", "zoom", "hysteresis", "manual"],
      shadows,
      nativeMultiDraw,
      realContextFallback: true,
      gpuBuffersTexturesVaos: true,
      contextRestored: true,
      glError,
    };
  } finally {
    for (const batch of liveBatches) disposeBatch(batch);
    directional.dispose();
    point.dispose();
    for (const geometry of [square, triangle, arraysSquare, arraysTriangle, receiverGeometry, casterGeometry])
      geometry.dispose();
    for (const item of [material, nearMaterial, farMaterial, receiverMaterial, casterMaterial]) item.dispose();
    renderer.dispose();
  }
}
