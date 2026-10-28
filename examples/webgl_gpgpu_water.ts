import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { DRACOLoader, DRACO_GLTF_CONFIG } from "ek3d/addons/loaders/DRACOLoader";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { HDRLoader } from "ek3d/addons/loaders/HDRLoader";
import { SimplexNoise } from "ek3d/addons/math/SimplexNoise";
import { GPUComputationRenderer } from "ek3d/addons/misc/GPUComputationRenderer";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import {
  ACESFilmicToneMapping,
  ClampToEdgeWrapping,
  DoubleSide,
  EquirectangularReflectionMapping,
  NearestFilter,
  RGBAFormat,
  UnsignedByteType,
  VSMShadowMap,
} from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { TorusGeometry } from "ek3d/geometries/TorusGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Quaternion } from "ek3d/math/Quaternion";
import type { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Raycaster } from "ek3d/core/Raycaster";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import type { Object3D } from "ek3d/core/Object3D";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import common from "ek3d/renderers/shaders/ShaderChunk/common.glsl";
import beginNormal from "ek3d/renderers/shaders/ShaderChunk/beginnormal_vertex.glsl";
import beginVertex from "ek3d/renderers/shaders/ShaderChunk/begin_vertex.glsl";
import { Scene } from "ek3d/scenes/Scene";
import type { Texture } from "ek3d/textures/Texture";
import { disposeObject } from "./dispose-object";
import {
  heightmapShader,
  readWaterLevelShader,
  waterNormalVertex,
  waterBeginVertex,
} from "./webgl_gpgpu_water_shaders";

const WIDTH = 128,
  BOUNDS = 6,
  HALF = BOUNDS / 2;
const canvasElement = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvasElement) throw new Error("Missing gpgpu water canvas");
const canvas: HTMLCanvasElement = canvasElement;
const scene = new Scene();
const camera = new PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 2, 4);
camera.lookAt(0, 0, 0);
const dfg = createDFGLUT(),
  ltc = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  createShadowMap: WebGLShadowMap,
  getDFGLUT: () => dfg,
  ltcTextures: ltc,
  shaders: {
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
    MeshBasicMaterial: basicShader,
    MeshDepthMaterial: depthShader,
  },
});
const selectedShadowMap = renderer.shadowMap;
if (!selectedShadowMap) throw new Error("Missing shadow renderer");
const shadowMap = selectedShadowMap;
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;
const sun = new DirectionalLight(0xffffff, 4);
sun.position.set(-1, 2.6, 1.4);
scene.add(sun);
const controls = new OrbitControls(camera, canvas);
const stats = new Stats();
document.body.appendChild(stats.dom);
const manager = new LoadingManager();
const draco = new DRACOLoader(manager).setDecoderPath(DRACO_GLTF_CONFIG);
let disposed = false;
let environment: Texture | undefined;
let gpu: GPUComputationRenderer | undefined;
let readMaterial: ShaderMaterial | undefined;
let readTarget: WebGLRenderTarget | undefined;
let gui: GUI | undefined;
canvas.dataset.state = "loading";

function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  manager.abort();
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui?.destroy();
  stats.dom.remove();
  draco.dispose();
  readMaterial?.dispose();
  readTarget?.dispose();
  gpu?.dispose();
  disposeObject(scene);
  environment?.dispose();
  sun.shadow.dispose();
  dfg.dispose();
  for (const texture of Object.values(ltc)) texture.dispose();
  renderer.dispose();
});

void init().catch((error: unknown) => {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
});

async function init(): Promise<void> {
  const env = await new HDRLoader(manager)
    .setPath("/examples/textures/equirectangular/")
    .loadAsync("blouberg_sunrise_2_1k.hdr");
  if (disposed) {
    env.dispose();
    return;
  }
  environment = env;
  env.mapping = EquirectangularReflectionMapping;
  scene.background = env;
  scene.environment = env;
  scene.backgroundBlurriness = 0.3;
  scene.environmentIntensity = 1.25;
  const model = await new GLTFLoader(manager)
    .setDRACOLoader(draco)
    .setPath("/examples/models/gltf/")
    .loadAsync("duck.glb");
  if (disposed) {
    disposeObject(model.scene);
    return;
  }
  const duckModel = model.scene.children[0];
  if (!duckModel) {
    disposeObject(model.scene);
    throw new Error("Missing duck model");
  }
  duckModel.receiveShadow = true;
  duckModel.castShadow = true;
  scene.add(model.scene);

  const waterMaterial = new MeshStandardMaterial({
    color: 0x9bd2ec,
    metalness: 0.9,
    roughness: 0,
    transparent: true,
    opacity: 0.8,
    side: DoubleSide,
  });
  waterMaterial.defines = { STANDARD: "", USE_UV: "", WIDTH: WIDTH.toFixed(1), BOUNDS: BOUNDS.toFixed(1) };
  const heightmap: { value: Texture | null } = { value: null };
  waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.heightmap = heightmap;
    shader.vertexShader = shader.vertexShader
      .replace(common, common + "\nuniform sampler2D heightmap;\n")
      .replace(beginNormal, waterNormalVertex)
      .replace(beginVertex, waterBeginVertex);
  };
  const water = new Mesh(new PlaneGeometry(BOUNDS, BOUNDS, WIDTH - 1, WIDTH - 1), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.matrixAutoUpdate = false;
  water.updateMatrix();
  water.receiveShadow = water.castShadow = true;
  scene.add(water);
  const borderGeometry = new TorusGeometry(4.2, 0.1, 12, 4);
  borderGeometry.rotateX(Math.PI / 2);
  borderGeometry.rotateY(Math.PI / 4);
  const borderMaterial = new MeshStandardMaterial({ color: 0x908877, roughness: 0.2 });
  const border = new Mesh(borderGeometry, borderMaterial);
  border.receiveShadow = border.castShadow = true;
  scene.add(border);
  const rayMesh = new Mesh(new PlaneGeometry(BOUNDS, BOUNDS), new MeshBasicMaterial({ visible: false }));
  rayMesh.rotation.x = -Math.PI / 2;
  rayMesh.matrixAutoUpdate = false;
  rayMesh.updateMatrix();
  scene.add(rayMesh);

  const compute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);
  gpu = compute;
  const initial = compute.createTexture();
  const pixels = initial.image.data as Float32Array;
  const noise = new SimplexNoise();
  for (let y = 0; y < WIDTH; y++)
    for (let x = 0; x < WIDTH; x++) {
      let amplitude = 0.1,
        scale = 0.025,
        value = 0;
      for (let i = 0; i < 15; i++) {
        value += amplitude * noise.noise(((x * 128) / WIDTH) * scale, ((y * 128) / WIDTH) * scale);
        amplitude *= 0.53 + 0.025 * i;
        scale *= 1.25;
      }
      const p = (y * WIDTH + x) * 4;
      pixels[p] = pixels[p + 1] = value;
      pixels[p + 2] = 0;
      pixels[p + 3] = 1;
    }
  const variable = compute.addVariable("heightmap", heightmapShader.replace("#include <common>", common), initial);
  compute.setVariableDependencies(variable, [variable]);
  const mousePos = { value: new Vector2(10000, 10000) };
  const mouseSize = { value: 0.2 },
    deep = { value: 0.01 },
    viscosity = { value: 0.93 };
  Object.assign(variable.material.uniforms, { mousePos, mouseSize, deep, viscosity });
  variable.material.defines.BOUNDS = BOUNDS.toFixed(1);
  const error = compute.init();
  if (error !== null) throw new Error(error);
  const point = { value: new Vector2() };
  const level: { value: Texture | null } = { value: null };
  const readShader = compute.createShaderMaterial(readWaterLevelShader, { point1: point, levelTexture: level });
  readMaterial = readShader;
  readShader.defines.WIDTH = WIDTH.toFixed(1);
  readShader.defines.BOUNDS = BOUNDS.toFixed(1);
  const target = new WebGLRenderTarget(4, 1, {
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    format: RGBAFormat,
    type: UnsignedByteType,
    depthBuffer: false,
  });
  readTarget = target;
  const bytes = new Uint8Array(16),
    floats = new Float32Array(bytes.buffer);
  const ducks: { object: Object3D; velocity: Vector3 }[] = [];
  for (let i = 0; i < 12; i++) {
    const object = i < 11 ? duckModel.clone() : duckModel;
    object.position.x = (Math.random() - 0.5) * BOUNDS * 0.7;
    object.position.z = (Math.random() - 0.5) * BOUNDS * 0.7;
    scene.add(object);
    ducks.push({ object, velocity: new Vector3() });
  }
  const settings = {
    mouseSize: 0.2,
    mouseDeep: 0.01,
    viscosity: 0.93,
    speed: 5,
    ducksEnabled: true,
    wireframe: false,
    shadow: false,
  };
  gui = new GUI();
  gui.add(settings, "mouseSize", 0.1, 1, 0.1).onChange(() => {
    mouseSize.value = settings.mouseSize;
  });
  gui.add(settings, "mouseDeep", 0.01, 1, 0.01).onChange(() => {
    deep.value = settings.mouseDeep;
  });
  gui.add(settings, "viscosity", 0.9, 0.999, 0.001).onChange(() => {
    viscosity.value = settings.viscosity;
  });
  gui.add(settings, "speed", 1, 6, 1);
  gui.add(settings, "ducksEnabled").onChange(() => {
    for (const duck of ducks) duck.object.visible = settings.ducksEnabled;
  });
  gui.add(settings, "wireframe").onChange(() => {
    waterMaterial.wireframe = borderMaterial.wireframe = settings.wireframe;
  });
  gui.add(settings, "shadow").onChange(() => {
    shadowMap.enabled = sun.castShadow = settings.shadow;
    if (settings.shadow) {
      shadowMap.type = VSMShadowMap;
      const shadow = sun.shadow;
      shadow.mapSize.set(2048, 2048);
      shadow.radius = 2;
      shadow.bias = -0.0005;
      shadow.camera.near = 0.1;
      shadow.camera.far = 6;
      shadow.camera.right = shadow.camera.top = 5;
      shadow.camera.left = shadow.camera.bottom = -5;
    } else sun.shadow.dispose();
  });
  const mouse = new Vector2(),
    raycaster = new Raycaster();
  let pressed = false;
  function move(event: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    mouse.set(((event.clientX - rect.left) / rect.width) * 2 - 1, (-(event.clientY - rect.top) / rect.height) * 2 + 1);
  }
  function down(event: PointerEvent): void {
    pressed = true;
    move(event);
  }
  function up(): void {
    pressed = false;
    controls.enabled = true;
  }
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerdown", down);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerdown", down);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
  });
  const normal = new Vector3(),
    start = new Vector3(),
    direction = new Vector3(),
    surfaceNormal = new Vector3();
  const yAxis = new Vector3(0, 1, 0),
    zAxis = new Vector3(0, 0, -1);
  const rotation = new Quaternion(),
    qx = new Quaternion(),
    qz = new Quaternion();
  let frame = 0,
    frames = 0;
  renderer.setAnimationLoop(() => {
    mousePos.value.set(10000, 10000);
    if (pressed) {
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObject(rayMesh)[0];
      if (hit) {
        mousePos.value.set(hit.point.x, hit.point.z);
        controls.enabled = false;
      }
    }
    if (++frame >= 7 - settings.speed) {
      compute.compute();
      heightmap.value = compute.getCurrentRenderTarget(variable).texture;
      level.value = heightmap.value;
      if (settings.ducksEnabled)
        for (const { object, velocity } of ducks) {
          const pos = object.position;
          point.value.set((0.5 * pos.x) / HALF + 0.5, 1 - ((0.5 * pos.z) / HALF + 0.5));
          compute.doRenderTarget(readShader, target);
          renderer.readRenderTargetPixels(target, 0, 0, 4, 1, bytes);
          normal.set(floats[1], 0, -floats[2]);
          start.copy(pos);
          pos.y = floats[0];
          velocity.add(normal.multiplyScalar(0.01)).multiplyScalar(0.998);
          pos.add(velocity);
          const limit = HALF - 0.2;
          if (pos.x < -limit) {
            pos.x = -limit + 0.001;
            velocity.x *= -0.3;
          } else if (pos.x > limit) {
            pos.x = limit - 0.001;
            velocity.x *= -0.3;
          }
          if (pos.z < -limit) {
            pos.z = -limit + 0.001;
            velocity.z *= -0.3;
          } else if (pos.z > limit) {
            pos.z = limit - 0.001;
            velocity.z *= -0.3;
          }
          surfaceNormal.set(floats[1], 1, -floats[2]).normalize();
          direction.subVectors(start, pos);
          direction.y = 0;
          direction.normalize();
          qx.setFromUnitVectors(zAxis, direction);
          qz.setFromUnitVectors(yAxis, surfaceNormal);
          object.quaternion.slerp(rotation.multiplyQuaternions(qz, qx), 0.017);
        }
      frame = 0;
    }
    renderer.render(scene, camera);
    stats.update();
    canvas.dataset.state = "rendered";
    canvas.dataset.frames = String(++frames);
  });
}
