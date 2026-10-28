import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { InstancedBufferGeometry } from "ek3d/core/InstancedBufferGeometry";
import { InstancedBufferAttribute } from "ek3d/core/InstancedBufferAttribute";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { PointLight } from "ek3d/lights/PointLight";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Color } from "ek3d/math/Color";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { distanceShader } from "ek3d/renderers/shaders/DistanceShader";
import { DynamicDrawUsage, LinearSRGBColorSpace } from "ek3d/constants";
import { configureShadowScene } from "./browser-fixtures";

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export async function verifyInstancingRendering() {
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
  const scene = new Scene();
  const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 20);
  camera.position.z = 5;
  const geometry = new PlaneGeometry(0.75, 0.75);
  const material = new MeshBasicMaterial({ color: 0xffffff });
  const instances = new InstancedMesh(geometry, material, 2);
  const sibling = new InstancedMesh(geometry, material, 1);
  const ordinary = new Mesh(geometry, material);
  ordinary.position.y = -1;
  const matrix = new Matrix4();
  const tint = new Color();
  const place = (object: InstancedMesh, index: number, x: number, y: number) =>
    object.setMatrixAt(index, matrix.makeTranslation(x, y, 0));
  place(instances, 0, -1, 0);
  place(instances, 1, 1, 0);
  instances.setColorAt(0, tint.setRGB(1, 0, 0));
  instances.setColorAt(1, tint.setRGB(0, 1, 0));
  instances.instanceMatrix.setUsage(DynamicDrawUsage);
  instances.instanceColor!.setUsage(DynamicDrawUsage);
  place(sibling, 0, 0, 1);
  sibling.setColorAt(0, tint.setRGB(1, 1, 0));

  const instancedGeometry = new InstancedBufferGeometry();
  instancedGeometry.setAttribute(
    "position",
    new Float32BufferAttribute([-0.4, -0.4, 0, 0.4, -0.4, 0, -0.4, 0.4, 0, 0.4, -0.4, 0, 0.4, 0.4, 0, -0.4, 0.4, 0], 3),
  );
  const offsets = new InstancedBufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0]), 3, false, 2);
  const lanes = new InstancedBufferAttribute(new Float32Array([-0.6, 0.6, -0.6, 0.6]), 1);
  const colors = new InstancedBufferAttribute(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0]), 3);
  instancedGeometry.setAttribute("offset", offsets);
  instancedGeometry.setAttribute("lane", lanes);
  instancedGeometry.setAttribute("tint", colors);
  instancedGeometry.instanceCount = 4;
  const custom = new ShaderMaterial({
    vertexShader: `attribute vec3 offset;
attribute float lane;
attribute vec3 tint;
varying vec3 instanceTint;
void main() {
  instanceTint = tint;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + offset + vec3(0.0, lane, 0.0), 1.0);
}`,
    fragmentShader: `varying vec3 instanceTint;
void main() { gl_FragColor = vec4(instanceTint, 1.0); }`,
  });
  const attributed = new Mesh(instancedGeometry, custom);
  // The custom shader moves vertices beyond the base geometry's CPU bounds.
  attributed.frustumCulled = false;

  const shadowScene = new Scene();
  const shadowCamera = new PerspectiveCamera(50, 4 / 3, 0.1, 100);
  const receiverGeometry = new BoxGeometry();
  const casterGeometry = new BoxGeometry(1.2, 1.2, 1.2);
  const receiverMaterial = new MeshLambertMaterial({ color: 0xb8c4d0 });
  const casterMaterial = new MeshLambertMaterial({ color: 0xffaa66 });
  const receiver = new Mesh(receiverGeometry, receiverMaterial);
  const caster = new InstancedMesh(casterGeometry, casterMaterial, 2);
  place(caster, 0, -1.3, 0);
  place(caster, 1, 1.3, 0);
  const directional = new DirectionalLight(0xffffff, 3);
  const point = new PointLight(0xffffff, 150);
  const geometries = [geometry, instancedGeometry, receiverGeometry, casterGeometry];
  const materials = [material, custom, receiverMaterial, casterMaterial];
  const readPixels = (width = 64, height = 64) => {
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    check(gl.getError() === gl.NO_ERROR, "Instancing produced a GL error");
    return pixels;
  };
  const draw = (...objects: Mesh[]) => {
    scene.clear();
    for (const object of objects) scene.add(object);
    renderer.render(scene, camera);
    return readPixels();
  };
  const color = (pixels: Uint8Array, x: number, y: number, expected: number[], label: string) => {
    const actual = pixels.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 3);
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
  const attribute = (name: string) => {
    const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
    const location = gl.getAttribLocation(program, name);
    check(location >= 0, `Missing active ${name} attribute`);
    const buffer = gl.getVertexAttrib(location, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING) as WebGLBuffer;
    check(gl.isBuffer(buffer), `Missing GPU ${name} buffer`);
    return { location, buffer };
  };
  const vao = () => {
    const handle = gl.getParameter(gl.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject;
    check(gl.isVertexArray(handle), "Missing instancing VAO");
    return handle;
  };
  const allocation = (object: Mesh, names: string[]) => {
    draw(object);
    const buffers = names.map((name) => attribute(name).buffer);
    const index = gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING) as WebGLBuffer | null;
    if (index !== null) {
      check(gl.isBuffer(index), "Missing index buffer");
      buffers.push(index);
    }
    return { buffers, vao: vao() };
  };
  const objects = [instances, sibling, ordinary, attributed];
  const names = [
    ["position", "instanceMatrix", "instanceColor"],
    ["position", "instanceMatrix", "instanceColor"],
    ["position"],
    ["position", "offset", "lane", "tint"],
  ];
  const allocations = () => objects.map((object, i) => allocation(object, names[i]));
  const disposeObjects = () => {
    instances.dispose();
    sibling.dispose();
    for (const item of [geometry, instancedGeometry]) item.dispose();
    material.dispose();
    custom.dispose();
  };
  const deleted = (resources: { buffers: WebGLBuffer[]; vao: WebGLVertexArrayObject }[], label: string) => {
    check(
      resources.every(({ buffers }) => buffers.every((handle) => !gl.isBuffer(handle))),
      `${label}: live buffer`,
    );
    check(
      resources.every(({ vao: handle }) => !gl.isVertexArray(handle)),
      `${label}: live VAO`,
    );
  };
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(64, 64, false);
    renderer.outputColorSpace = LinearSRGBColorSpace;
    renderer.setClearColor(0x000000, 1);
    const initial = draw(instances);
    color(initial, 16, 32, [255, 0, 0], "Initial left instance");
    color(initial, 48, 32, [0, 255, 0], "Initial right instance");
    check(renderer.info.render.calls === 1 && renderer.info.render.triangles === 4, "Indexed instanced draw count");
    const matrixLocation = attribute("instanceMatrix").location;
    for (let column = 0; column < 4; column++)
      check(gl.getVertexAttrib(matrixLocation + column, gl.VERTEX_ATTRIB_ARRAY_DIVISOR) === 1, "Matrix column divisor");
    check(
      gl.getVertexAttrib(attribute("instanceColor").location, gl.VERTEX_ATTRIB_ARRAY_DIVISOR) === 1,
      "Color divisor",
    );

    place(instances, 0, -1, 1);
    instances.setColorAt(0, tint.setRGB(0, 0, 1));
    place(instances, 1, 10, 0);
    instances.setColorAt(1, tint.setRGB(1, 1, 1));
    same(draw(instances), initial, "CPU changes uploaded without needsUpdate");
    instances.instanceMatrix.addUpdateRange(0, 16);
    instances.instanceColor!.addUpdateRange(0, 3);
    instances.instanceMatrix.needsUpdate = instances.instanceColor!.needsUpdate = true;
    let pixels = draw(instances);
    color(pixels, 16, 32, [0, 0, 0], "Old matrix position remained");
    color(pixels, 16, 48, [0, 0, 255], "Matrix/color partial upload");
    color(pixels, 48, 32, [0, 255, 0], "Partial upload changed excluded instance");
    check(
      instances.instanceMatrix.updateRanges.length === 0 && instances.instanceColor!.updateRanges.length === 0,
      "Uploaded update ranges were not consumed",
    );
    place(instances, 0, -1, 0);
    place(instances, 1, 1, 0);
    instances.setColorAt(0, tint.setRGB(1, 0, 0));
    instances.setColorAt(1, tint.setRGB(0, 1, 0));
    instances.instanceMatrix.needsUpdate = instances.instanceColor!.needsUpdate = true;
    same(draw(instances), initial, "Full matrix/color upload did not restore instances");
    instances.count = 1;
    pixels = draw(instances);
    color(pixels, 16, 32, [255, 0, 0], "Count one lost first instance");
    color(pixels, 48, 32, [0, 0, 0], "Count one drew second instance");
    instances.count = 0;
    pixels = draw(instances);
    check(renderer.info.render.calls === 0, "Count zero submitted a draw");
    same(pixels, draw(), "Count zero drew pixels");
    instances.count = 2;
    place(instances, 0, 20, 0);
    place(instances, 1, 22, 0);
    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingBox();
    instances.computeBoundingSphere();
    draw(instances);
    check(renderer.info.render.calls === 0, "Recomputed offscreen instance bounds did not cull");
    place(instances, 0, -1, 0);
    place(instances, 1, 1, 0);
    instances.instanceMatrix.needsUpdate = true;
    draw(instances);
    check(renderer.info.render.calls === 0, "Instance matrix writes unexpectedly recomputed bounds");
    instances.computeBoundingBox();
    instances.computeBoundingSphere();
    same(draw(instances), initial, "Recomputed visible instance bounds did not restore rendering");
    pixels = draw(instances, ordinary, sibling);
    color(pixels, 16, 32, [255, 0, 0], "Shared geometry first instance");
    color(pixels, 48, 32, [0, 255, 0], "Shared geometry second instance");
    color(pixels, 32, 16, [255, 255, 255], "Ordinary Mesh inherited instance attributes");
    color(pixels, 32, 48, [255, 255, 0], "Sibling InstancedMesh inherited matrix/color buffers");

    const attributedInitial = draw(attributed);
    for (const [x, y, expected] of [
      [16, 22, [255, 0, 0]],
      [16, 42, [0, 255, 0]],
      [48, 22, [0, 0, 255]],
      [48, 42, [255, 255, 0]],
    ] as const)
      color(attributedInitial, x, y, [...expected], "Instanced attribute placement/color");
    check(renderer.info.render.triangles === 8, "Non-indexed instance count");
    for (const [name, divisor] of [
      ["offset", 2],
      ["lane", 1],
      ["tint", 1],
    ] as const)
      check(
        gl.getVertexAttrib(attribute(name).location, gl.VERTEX_ATTRIB_ARRAY_DIVISOR) === divisor,
        `${name} divisor`,
      );
    colors.setXYZ(0, 1, 0, 1);
    colors.addUpdateRange(0, 3);
    colors.needsUpdate = true;
    offsets.setX(1, 0.5);
    offsets.addUpdateRange(3, 3);
    offsets.needsUpdate = true;
    pixels = draw(attributed);
    color(pixels, 16, 22, [255, 0, 255], "Instanced color attribute update");
    color(pixels, 40, 42, [255, 255, 0], "Divisor-two offset update");
    color(pixels, 52, 42, [0, 0, 0], "Old divisor-two offset remained");
    check(colors.updateRanges.length === 0 && offsets.updateRanges.length === 0, "Instanced geometry ranges retained");
    offsets.setX(1, 1);
    colors.setXYZ(0, 1, 0, 0);
    offsets.needsUpdate = colors.needsUpdate = true;
    instancedGeometry.instanceCount = 3;
    pixels = draw(attributed);
    color(pixels, 48, 22, [0, 0, 255], "Instance count three lost third instance");
    color(pixels, 48, 42, [0, 0, 0], "Instance count three drew fourth instance");
    instancedGeometry.instanceCount = 0;
    pixels = draw(attributed);
    check(renderer.info.render.calls === 0, "Instanced geometry count zero submitted a draw");
    same(pixels, draw(), "Instanced geometry count zero drew pixels");
    instancedGeometry.instanceCount = Infinity;
    same(draw(attributed), attributedInitial, "Attribute capacity did not limit infinite instance count");
    instancedGeometry.setDrawRange(3, 3);
    pixels = draw(attributed);
    color(pixels, 13, 19, [0, 0, 0], "Draw range retained first triangle");
    color(pixels, 19, 25, [255, 0, 0], "Draw range lost second triangle");
    check(renderer.info.render.triangles === 4, "Instanced draw range triangle count");
    instancedGeometry.setDrawRange(0, Infinity);

    configureShadowScene(renderer, shadowScene, shadowCamera, receiver, caster, directional, point);
    renderer.setSize(96, 72, false);
    const shadowVaos = new Set<WebGLVertexArrayObject>();
    const shadowBuffers = new Set<WebGLBuffer>();
    caster.onAfterShadow = () => {
      shadowVaos.add(vao());
      shadowBuffers.add(attribute("instanceMatrix").buffer);
    };
    const shadowDraw = () => {
      renderer.render(shadowScene, shadowCamera);
      return readPixels(96, 72);
    };
    const shadows: { light: string; occludedPixels: number; litPixels: number }[] = [];
    for (const light of [directional, point]) {
      shadowScene.remove(directional, point);
      shadowScene.add(light);
      caster.count = 2;
      const shadowed = shadowDraw();
      receiver.receiveShadow = false;
      const lit = shadowDraw();
      receiver.receiveShadow = true;
      let occludedPixels = 0;
      let litPixels = 0;
      for (let i = 0; i < lit.length; i += 4) {
        if (lit[i] - shadowed[i] > 12 && lit[i + 1] - shadowed[i + 1] > 12) occludedPixels++;
        if (lit[i] > 80 && lit[i + 1] > 80 && Math.abs(lit[i] - shadowed[i]) <= 1) litPixels++;
      }
      check(occludedPixels > 16 && litPixels > 16, `${light.type}: missing meaningful lit/shadow pixels`);
      caster.castShadow = false;
      same(shadowDraw(), lit, `${light.type}: disabling instance shadows retained occlusion`);
      caster.castShadow = true;
      same(shadowDraw(), shadowed, `${light.type}: instance shadows did not recover`);
      // Move only one instance; compare each frame to its own unshadowed receiver.
      place(caster, 0, -2.4, 0);
      caster.instanceMatrix.needsUpdate = true;
      caster.computeBoundingSphere();
      const moved = shadowDraw();
      receiver.receiveShadow = false;
      const movedLit = shadowDraw();
      receiver.receiveShadow = true;
      let changedShadow = 0;
      for (let i = 0; i < lit.length; i += 4) {
        const before = lit[i] - shadowed[i] > 12;
        const after = movedLit[i] - moved[i] > 12;
        if (before !== after) changedShadow++;
      }
      check(changedShadow > 8, `${light.type}: matrix upload did not move receiver shadow`);
      place(caster, 0, -1.3, 0);
      caster.instanceMatrix.needsUpdate = true;
      caster.computeBoundingSphere();
      shadows.push({ light: light.type, occludedPixels, litPixels });
    }
    check(shadowVaos.size >= 2 && shadowBuffers.size === 1, "Shadow passes did not share the instance matrix buffer");
    caster.dispose();
    check(
      [...shadowVaos].every((handle) => !gl.isVertexArray(handle)),
      "Instance disposal retained shadow VAOs",
    );
    check(
      [...shadowBuffers].every((handle) => !gl.isBuffer(handle)),
      "Instance disposal retained shadow matrix buffer",
    );
    directional.dispose();
    point.dispose();
    receiverGeometry.dispose();
    casterGeometry.dispose();
    receiverMaterial.dispose();
    casterMaterial.dispose();
    renderer.setSize(64, 64, false);
    renderer.setClearColor(0x000000, 1);

    const snapshots = objects.map((object) => draw(object));
    const sharedSnapshot = draw(sibling, ordinary);
    const first = allocations();
    instances.dispose();
    check(
      !gl.isBuffer(first[0].buffers[1]) && !gl.isBuffer(first[0].buffers[2]),
      "Instance disposal retained matrix/color buffers",
    );
    check(!gl.isVertexArray(first[0].vao), "Instance disposal retained its VAO");
    check(
      gl.isBuffer(first[0].buffers[0]) && gl.isBuffer(first[0].buffers[3]),
      "Instance disposal deleted shared geometry buffers",
    );
    check(
      first[1].buffers.every((handle) => gl.isBuffer(handle)) && gl.isVertexArray(first[1].vao),
      "Instance disposal damaged sibling resources",
    );
    same(draw(sibling, ordinary), sharedSnapshot, "Shared geometry changed after instance disposal");
    same(draw(instances), snapshots[0], "Instance-only disposal did not reallocate");
    const reallocatedInstance = allocation(instances, names[0]);
    check(
      reallocatedInstance.buffers[1] !== first[0].buffers[1] && reallocatedInstance.vao !== first[0].vao,
      "Instance-only redraw reused deleted handles",
    );
    const allocated = allocations();
    disposeObjects();
    deleted(allocated, "Geometry/instance disposal");
    objects.forEach((object, i) => same(draw(object), snapshots[i], "Disposal/reallocation pixels"));
    const reallocated = allocations();
    check(
      reallocated.every(
        (resource, i) =>
          resource.vao !== allocated[i].vao &&
          resource.buffers.every((handle) => !allocated[i].buffers.includes(handle)),
      ),
      "Redraw reused deleted GPU handles",
    );

    const extension = gl.getExtension("WEBGL_lose_context");
    if (extension === null) throw new Error("Instancing restoration requires WEBGL_lose_context");
    // ES2022 does not provide Promise.withResolvers.
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
    check(gl.isContextLost(), "Instancing did not lose actual context");
    await contextEvent("webglcontextrestored", () => setTimeout(() => extension.restoreContext(), 0));
    objects.forEach((object, i) => same(draw(object), snapshots[i], "Instancing context restore pixels"));
    const restored = allocations();
    check(
      restored.every(
        (resource, i) =>
          resource.vao !== reallocated[i].vao &&
          resource.buffers.every((handle) => !reallocated[i].buffers.includes(handle)),
      ),
      "Context restore reused stale handles",
    );
    disposeObjects();
    deleted(restored, "Restored instance/geometry disposal");
    check(gl.getError() === gl.NO_ERROR, "Context restore followed by instance disposal produced a GL error");
    const liveAtRendererDisposal = allocations();
    renderer.dispose();
    deleted(liveAtRendererDisposal, "Renderer disposal with live instances and shared geometry");
    const glError = gl.getError();
    check(glError === gl.NO_ERROR, "Instancing lifecycle produced a GL error");
    return {
      matrixColorUploads: true,
      updateRanges: true,
      countsIncludingZero: true,
      recomputedBoundsCulling: true,
      sharedGeometry: true,
      instancedAttributes: { divisors: [1, 2], capacityClamp: true, drawRanges: true },
      shadows,
      gpuBuffersAndVaosDisposed: true,
      gpuReallocated: true,
      contextRestored: true,
      rendererDisposesLiveInstances: true,
      glError,
    };
  } finally {
    instances.dispose();
    sibling.dispose();
    caster.dispose();
    directional.dispose();
    point.dispose();
    for (const item of geometries) item.dispose();
    for (const item of materials) item.dispose();
    renderer.dispose();
  }
}
