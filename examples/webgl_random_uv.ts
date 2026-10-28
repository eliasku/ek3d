import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { DRACOLoader, DRACO_GLTF_CONFIG } from "ek3d/addons/loaders/DRACOLoader";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { HDRLoader } from "ek3d/addons/loaders/HDRLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ToneMapping, Mapping, Wrapping, ColorSpace, ShadowMap } from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { ShadowMaterial } from "ek3d/materials/ShadowMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { shadowShader } from "ek3d/renderers/shaders/ShadowShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import mapChunk from "ek3d/renderers/shaders/ShaderChunk/map_fragment.glsl";
import alphaParsChunk from "ek3d/renderers/shaders/ShaderChunk/alphamap_pars_fragment.glsl";
import alphaChunk from "ek3d/renderers/shaders/ShaderChunk/alphamap_fragment.glsl";
import clippingParsChunk from "ek3d/renderers/shaders/ShaderChunk/clipping_planes_pars_fragment.glsl";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";
import { alphamap_fragment, alphamap_pars_fragment, map_fragment, randomUV } from "./random-uv-shaders";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 20);
camera.position.set(-0.8, 0.6, 1.5);
const scene = new Scene();
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  createShadowMap: WebGLShadowMap,
  getDFGLUT: () => dfg,
  shaders: {
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
    MeshDepthMaterial: depthShader,
    ShadowMaterial: shadowShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = ToneMapping.ACESFilmic;
renderer.toneMappingExposure = 0.7;
renderer.shadowMap!.enabled = true;
renderer.shadowMap!.type = ShadowMap.VSM;
const light = new DirectionalLight(0xffffff, 3);
light.position.set(-0.5, 1, 0.8);
light.castShadow = true;
light.shadow.mapSize.set(1024, 1024);
light.shadow.radius = 16;
light.shadow.bias = -0.0005;
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 3;
light.shadow.camera.right = light.shadow.camera.top = 2;
light.shadow.camera.left = light.shadow.camera.bottom = -2;
scene.add(light);
const plane = new PlaneGeometry(2, 2);
plane.rotateX(-Math.PI * 0.5);
const ground = new Mesh<ShadowMaterial>(plane, new ShadowMaterial({ opacity: 0.5 }));
ground.receiveShadow = true;
ground.position.z = -0.5;
scene.add(ground);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 0.3;
controls.maxDistance = 10;
controls.target.set(0, 0.4, 0);
controls.update();
const manager = new LoadingManager();
const draco = new DRACOLoader(manager).setDecoderPath(DRACO_GLTF_CONFIG);
let disposed = false,
  failed = false,
  loaded = false,
  frames = 0;
let gui: GUI | undefined;
canvas.dataset.state = "loading";
function fail(error: unknown): void {
  if (disposed) return;
  failed = true;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(error);
  console.error(error);
}
manager.onLoad = () => {
  if (!disposed && !failed) {
    loaded = true;
    render();
  }
};
const textures = new TextureLoader(manager);
const map = textures.load("/examples/textures/jade.jpg", render, undefined, fail);
controls.addEventListener("change", render);
map.colorSpace = ColorSpace.SRGB;
map.wrapS = map.wrapT = Wrapping.Repeat;
map.repeat.set(20, 20);
map.flipY = false;
const dissolveMap = textures.load("/examples/textures/shaderball_ds.jpg", render, undefined, fail);
dissolveMap.flipY = false;
const noise = textures.load("/examples/textures/noise.png", render, undefined, fail);
const env = new HDRLoader(manager).load(
  "/examples/textures/equirectangular/lobe.hdr",
  (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    texture.mapping = Mapping.EquirectangularReflection;
    scene.background = scene.environment = texture;
    scene.backgroundBlurriness = 0.5;
    scene.backgroundIntensity = 1;
    scene.environmentIntensity = 1.5;
    new GLTFLoader(manager).setDRACOLoader(draco).load(
      "/examples/models/gltf/ShaderBall2.glb",
      (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }
        const ball = gltf.scene.children[0];
        const outer = ball?.children[0],
          inner = ball?.children[1];
        if (
          !(outer instanceof Mesh) ||
          !(inner instanceof Mesh) ||
          !(outer.material instanceof MeshStandardMaterial) ||
          !(inner.material instanceof MeshStandardMaterial)
        ) {
          disposeObject(gltf.scene);
          fail(new Error("Missing shader ball materials"));
          return;
        }
        for (let i = ball.children.length - 1, order = 0; i >= 0; i--, order++) {
          const part = ball.children[i];
          part.receiveShadow = part.castShadow = true;
          part.renderOrder = order;
        }
        const material = outer.material,
          materialIn = inner.material;
        material.map = map;
        material.alphaMap = dissolveMap;
        material.transparent = true;
        materialIn.alphaMap = dissolveMap;
        materialIn.transparent = true;
        const uniforms = {
          disolve: { value: 0 },
          threshold: { value: 0.2 },
          noiseMap: { value: noise },
          enableRandom: { value: 1 },
          useNoiseMap: { value: 1 },
          useSuslikMethod: { value: 0 },
          debugNoise: { value: 0 },
        };
        material.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, uniforms);
          shader.fragmentShader = shader.fragmentShader
            .replace(clippingParsChunk, clippingParsChunk + randomUV)
            .replace(mapChunk, map_fragment)
            .replace(alphaParsChunk, alphamap_pars_fragment)
            .replace(alphaChunk, alphamap_fragment);
        };
        materialIn.onBeforeCompile = (shader) => {
          shader.uniforms.disolve = uniforms.disolve;
          shader.uniforms.threshold = uniforms.threshold;
          shader.fragmentShader = shader.fragmentShader
            .replace(alphaParsChunk, alphamap_pars_fragment)
            .replace(alphaChunk, alphamap_fragment);
        };
        scene.add(gltf.scene);
        const setting = {
          get Enabled() {
            return uniforms.enableRandom.value === 1;
          },
          set Enabled(v: boolean) {
            uniforms.enableRandom.value = v ? 1 : 0;
            render();
          },
          get UseNoiseMap() {
            return uniforms.useNoiseMap.value === 1;
          },
          set UseNoiseMap(v: boolean) {
            uniforms.useNoiseMap.value = v ? 1 : 0;
            render();
          },
          get SuslikMethod() {
            return uniforms.useSuslikMethod.value === 1;
          },
          set SuslikMethod(v: boolean) {
            uniforms.useSuslikMethod.value = v ? 1 : 0;
            render();
          },
          get DebugNoise() {
            return uniforms.debugNoise.value === 1;
          },
          set DebugNoise(v: boolean) {
            uniforms.debugNoise.value = v ? 1 : 0;
            render();
          },
          get disolve() {
            return uniforms.disolve.value;
          },
          set disolve(v: number) {
            uniforms.disolve.value = v;
            ground.material.opacity = (1 - v) * 0.5;
            render();
          },
          get threshold() {
            return uniforms.threshold.value;
          },
          set threshold(v: number) {
            uniforms.threshold.value = v;
            render();
          },
        };
        gui = new GUI();
        gui.add(material, "roughness", 0, 1, 0.01).onChange(render);
        gui.add(material, "metalness", 0, 1, 0.01).onChange(render);
        gui.add(setting, "disolve", 0, 1, 0.01);
        gui.add(setting, "threshold", 0, 1, 0.01);
        gui.add(setting, "Enabled");
        gui.add(setting, "UseNoiseMap");
        gui.add(setting, "SuslikMethod");
        gui.add(setting, "DebugNoise");
        render();
      },
      undefined,
      fail,
    );
  },
  undefined,
  fail,
);
function render(): void {
  if (disposed) return;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (loaded && !failed) canvas.dataset.state = "rendered";
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  render();
}
render();
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  controls.removeEventListener("change", render);
  controls.dispose();
  gui?.destroy();
  disposeObject(scene);
  map.dispose();
  dissolveMap.dispose();
  noise.dispose();
  env.dispose();
  draco.dispose();
  dfg.dispose();
  renderer.dispose();
});
