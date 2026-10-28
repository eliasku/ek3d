import { Water } from "ek3d/addons/objects/Water";
import { Sky } from "ek3d/addons/objects/Sky";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { UnrealBloomPass } from "ek3d/addons/postprocessing/UnrealBloomPass";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { degToRad } from "ek3d/math/MathUtils";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { ACESFilmicToneMapping, RepeatWrapping } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Scene } from "ek3d/scenes/Scene";
import chunk_tonemapping_fragment from "ek3d/renderers/shaders/ShaderChunk/tonemapping_fragment.glsl";
import chunk_colorspace_fragment from "ek3d/renderers/shaders/ShaderChunk/colorspace_fragment.glsl";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing ocean example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const dfgLUT = createDFGLUT();

const timer = new Timer();

const stats = new Stats();
document.body.appendChild(stats.dom);

//

const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  getDFGLUT: () => dfgLUT,
  shaderChunks: { tonemapping_fragment: chunk_tonemapping_fragment, colorspace_fragment: chunk_colorspace_fragment },
  shaders: { MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.1;

const bloomPass = new UnrealBloomPass(new Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0;
bloomPass.strength = 0.1;
bloomPass.radius = 0;

// WebGL equivalent of upstream's HDR output effects: the composer keeps the scene in
// half-float targets and OutputPass applies the ACES tone mapping with the exposure.
const composer = new EffectComposer(renderer);

//

const scene = new Scene();

const camera = new PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 20000);
camera.position.set(30, 30, 100);

composer.addPass(new RenderPass(scene, camera));
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

//

const sun = new Vector3();

// Water

const waterGeometry = new PlaneGeometry(10000, 10000);

let disposed = false;
const waterNormals = new TextureLoader().load(
  "/examples/textures/waternormals.jpg",
  (texture) => {
    if (disposed) return;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    canvas.dataset.loaded = "true";
  },
  undefined,
  (error) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  },
);

const water = new Water(waterGeometry, {
  textureWidth: 512,
  textureHeight: 512,
  waterNormals: waterNormals,
  sunDirection: new Vector3(),
  sunColor: 0xffffff,
  waterColor: 0x001e0f,
  distortionScale: 3.7,
  fog: scene.fog !== undefined,
});

water.rotation.x = -Math.PI / 2;

scene.add(water);

// Skybox

const sky = new Sky();
sky.scale.setScalar(10000);
scene.add(sky);

const skyUniforms = sky.material.uniforms;

skyUniforms["turbidity"].value = 10;
skyUniforms["rayleigh"].value = 2;
skyUniforms["mieCoefficient"].value = 0.005;
skyUniforms["mieDirectionalG"].value = 0.8;
skyUniforms["cloudCoverage"].value = 0.4;
skyUniforms["cloudDensity"].value = 0.5;
skyUniforms["cloudElevation"].value = 0.5;

const parameters = {
  elevation: 2,
  azimuth: 180,
  exposure: 0.1,
};

const pmremGenerator = new PMREMGenerator(renderer);
const sceneEnv = new Scene();

let renderTarget: ReturnType<PMREMGenerator["fromScene"]> | undefined;

function updateSun(): void {
  const phi = degToRad(90 - parameters.elevation);
  const theta = degToRad(parameters.azimuth);

  sun.setFromSphericalCoords(1, phi, theta);

  (sky.material.uniforms["sunPosition"].value as Vector3).copy(sun);
  (water.material.uniforms["sunDirection"].value as Vector3).copy(sun).normalize();

  if (renderTarget !== undefined) renderTarget.dispose();

  sceneEnv.add(sky);
  renderTarget = pmremGenerator.fromScene(sceneEnv);
  scene.add(sky);

  scene.environment = renderTarget.texture;
}

updateSun();

//

const meshMaterial = new MeshStandardMaterial({ roughness: 0 });
const mesh = new Mesh(new BoxGeometry(30, 30, 30), meshMaterial);
scene.add(mesh);

//

const controls = new OrbitControls(camera, canvas);
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(0, 10, 0);
controls.minDistance = 40.0;
controls.maxDistance = 200.0;
controls.update();

// GUI

const gui = new GUI();

const folderSky = gui.addFolder("Sky");
folderSky.add(parameters, "elevation", 0, 90, 0.1).onChange(updateSun);
folderSky.add(parameters, "azimuth", -180, 180, 0.1).onChange(updateSun);
folderSky.add(parameters, "exposure", 0, 1, 0.0001).onChange(function (value) {
  renderer.toneMappingExposure = value as number;
});
folderSky.open();

const waterUniforms = water.material.uniforms;

const folderWater = gui.addFolder("Water");
folderWater.add(waterUniforms["distortionScale"], "value", 0, 8, 0.1).name("distortionScale");
folderWater.add(waterUniforms["size"], "value", 0.1, 10, 0.1).name("size");
folderWater.open();

const folderBloom = gui.addFolder("Bloom");
folderBloom.add(bloomPass, "strength", 0, 3, 0.01);
folderBloom.add(bloomPass, "radius", 0, 1, 0.01);
folderBloom.open();

const folderClouds = gui.addFolder("Clouds");
folderClouds.add(skyUniforms["cloudCoverage"], "value", 0, 1, 0.01).name("coverage");
folderClouds.add(skyUniforms["cloudDensity"], "value", 0, 1, 0.01).name("density");
folderClouds.add(skyUniforms["cloudElevation"], "value", 0, 1, 0.01).name("elevation");
folderClouds.open();

//

window.addEventListener("resize", onWindowResize);

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

let frames = 0;

function animate(): void {
  timer.update();
  render();
  stats.update();
}

function render(): void {
  const time = performance.now() * 0.001;

  mesh.position.y = Math.sin(time) * 20 + 5;
  mesh.rotation.x = time * 0.5;
  mesh.rotation.z = time * 0.51;

  const delta = timer.getDelta();

  water.material.uniforms["time"].value = (water.material.uniforms["time"].value as number) + delta;
  sky.material.uniforms["time"].value = time;

  composer.render();

  if (canvas.dataset.loaded === "true" && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(++frames);
  canvas.dataset.exposure = String(renderer.toneMappingExposure);
  canvas.dataset.distortionScale = String(waterUniforms["distortionScale"].value);
}

window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    window.removeEventListener("resize", onWindowResize);
    renderer.setAnimationLoop(null);
    controls.dispose();
    gui.destroy();
    stats.dom.remove();
    pmremGenerator.dispose();
    renderTarget?.dispose();
    water.dispose();
    water.geometry.dispose();
    waterNormals.dispose();
    sky.geometry.dispose();
    sky.material.dispose();
    mesh.geometry.dispose();
    meshMaterial.dispose();
    for (const pass of composer.passes) pass.dispose();
    timer.dispose();
    composer.dispose();
    renderer.dispose();
    dfgLUT.dispose();
  },
  { once: true },
);
