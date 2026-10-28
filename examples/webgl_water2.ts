import { Water } from "ek3d/addons/objects/Water2";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { HDRLoader } from "ek3d/addons/loaders/HDRLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector4 } from "ek3d/math/Vector4";
import { Color } from "ek3d/math/Color";
import { ToneMapping, Mapping, Wrapping } from "ek3d/constants";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { Scene } from "ek3d/scenes/Scene";
import type { Texture } from "ek3d/textures/Texture";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing water example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const params = {
  color: "#99e0ff",
  scale: 2,
  flowX: 1,
  flowY: 1,
};

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

const scene = new Scene();

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfgLUT,
  ltcTextures,
  shaders: { MeshStandardMaterial: standardShader },
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = ToneMapping.ACESFilmic;
renderer.toneMappingExposure = 0.5;

// camera

const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(-20, 6, -30);

let disposed = false;
const resources: Array<{ dispose(): void }> = [dfgLUT, ...Object.values(ltcTextures)];
let controls: OrbitControls<PerspectiveCamera> | undefined;
let gui: GUI | undefined;

void init().catch((error: unknown) => {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
});

async function init(): Promise<void> {
  window.addEventListener(
    "pagehide",
    () => {
      disposed = true;
      window.removeEventListener("resize", onWindowResize);
      renderer.setAnimationLoop(null);
      controls?.dispose();
      gui?.destroy();
      for (const resource of resources) resource.dispose();
      renderer.dispose();
    },
    { once: true },
  );

  // environment

  const environmentTexture: Texture = await new HDRLoader()
    .setPath("/examples/textures/equirectangular/")
    .loadAsync("venice_sunset_1k.hdr");
  if (disposed) {
    environmentTexture.dispose();
    return;
  }
  resources.push(environmentTexture);
  environmentTexture.mapping = Mapping.EquirectangularReflection;
  environmentTexture.needsUpdate = true;

  scene.background = environmentTexture;
  scene.environment = environmentTexture;

  // water normal maps

  const textureLoader = new TextureLoader().setPath("/examples/textures/water/");
  const [normalMap0, normalMap1] = await Promise.all([
    textureLoader.loadAsync("Water_1_M_Normal.jpg").then(ownTexture),
    textureLoader.loadAsync("Water_2_M_Normal.jpg").then(ownTexture),
  ]);
  if (disposed) return;

  function ownTexture(texture: Texture): Texture {
    if (disposed) texture.dispose();
    else resources.push(texture);
    return texture;
  }

  normalMap0.wrapS = normalMap0.wrapT = Wrapping.Repeat;
  normalMap1.wrapS = normalMap1.wrapT = Wrapping.Repeat;

  // water

  const waterGeometry = new PlaneGeometry(30, 40);

  const water = new Water(waterGeometry, {
    color: params.color,
    scale: params.scale,
    flowDirection: new Vector2(params.flowX, params.flowY),
    normalMap0: normalMap0,
    normalMap1: normalMap1,
  });
  resources.push(water, waterGeometry);

  water.position.set(0, 0.2, -2);
  water.rotation.x = Math.PI * -0.5;
  water.renderOrder = Infinity;
  scene.add(water);

  // floor

  const floorGeometry = new PlaneGeometry(1, 1);
  floorGeometry.rotateX(-Math.PI * 0.5);
  const floorMaterial = new MeshStandardMaterial({ color: 0x444444, roughness: 1, metalness: 0 });
  resources.push(floorGeometry, floorMaterial);

  function addFloor(x: number, z: number, scaleX: number, scaleZ: number): void {
    const floor = new Mesh(floorGeometry, floorMaterial);
    floor.position.set(x, 0, z);
    floor.scale.set(scaleX, 1, scaleZ);
    scene.add(floor);
  }

  addFloor(20, 0, 15, 80);
  addFloor(-20, 0, 15, 80);
  addFloor(0, 30, 30, 20);
  addFloor(0, -30, 30, 20);

  // controls

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.target.set(0, 0, -5);
  controls.update();

  // GUI

  const waterUniforms = water.material.uniforms;
  const colorUniform = waterUniforms["color"].value as Color;
  const config = waterUniforms["config"].value as Vector4;
  const flowDirection = waterUniforms["flowDirection"].value as Vector2;

  gui = new GUI();
  gui.addColor(params, "color").onChange(function (value) {
    colorUniform.set(value as string);
  });
  gui.add(params, "scale", 1, 10).onChange(function (value) {
    config.w = value as number;
  });
  gui.add(params, "flowX", -1, 1, 0.01).onChange(function (value) {
    flowDirection.x = value as number;
    flowDirection.normalize();
  });
  gui.add(params, "flowY", -1, 1, 0.01).onChange(function (value) {
    flowDirection.y = value as number;
    flowDirection.normalize();
  });

  window.addEventListener("resize", onWindowResize);

  function onWindowResize(): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  let frames = 0;

  function animate(): void {
    controls?.update();

    renderer.render(scene, camera);

    canvas.dataset.state = "rendered";
    canvas.dataset.frames = String(++frames);
    canvas.dataset.scale = String(config.w);
    canvas.dataset.flow = `${flowDirection.x.toFixed(3)},${flowDirection.y.toFixed(3)}`;
  }

  renderer.setAnimationLoop(animate);
}
