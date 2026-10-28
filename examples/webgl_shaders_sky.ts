import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Sky } from "ek3d/addons/objects/Sky";
import { CubeCamera } from "ek3d/cameras/CubeCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ACESFilmicToneMapping, HalfFloatType } from "ek3d/constants";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { degToRad } from "ek3d/math/MathUtils";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLCubeRenderTarget } from "ek3d/renderers/WebGLCubeRenderTarget";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import chunk_tonemapping_fragment from "ek3d/renderers/shaders/ShaderChunk/tonemapping_fragment.glsl";
import chunk_colorspace_fragment from "ek3d/renderers/shaders/ShaderChunk/colorspace_fragment.glsl";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing sky canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 100, 2000000);
camera.position.set(0, 100, 2000);
const scene = new Scene();
const cubeRenderTarget = new WebGLCubeRenderTarget(256, { type: HalfFloatType });
const cubeCamera = new CubeCamera(1, 1000, cubeRenderTarget);
const sphereMaterial = new MeshBasicMaterial({ envMap: cubeRenderTarget.texture });
const sphere = new Mesh(new SphereGeometry(400, 64, 32), sphereMaterial);
scene.add(sphere);
const renderer = new WebGLRenderer({
  canvas,
  shaders: { MeshBasicMaterial: basicShader },
  shaderChunks: { tonemapping_fragment: chunk_tonemapping_fragment, colorspace_fragment: chunk_colorspace_fragment },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;
const controls = new OrbitControls(camera, canvas);
controls.enableZoom = false;
controls.enablePan = false;
const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);
const sun = new Vector3();
const effectController = {
  turbidity: 10,
  rayleigh: 3,
  mieCoefficient: 0.005,
  mieDirectionalG: 0.7,
  elevation: 65,
  azimuth: 0,
  exposure: 0.05,
  cloudCoverage: 0.4,
  cloudDensity: 0.4,
  cloudElevation: 0.5,
  showSunDisc: true,
};
function guiChanged(): void {
  const uniforms = sky.material.uniforms;
  uniforms.turbidity.value = effectController.turbidity;
  uniforms.rayleigh.value = effectController.rayleigh;
  uniforms.mieCoefficient.value = effectController.mieCoefficient;
  uniforms.mieDirectionalG.value = effectController.mieDirectionalG;
  uniforms.cloudCoverage.value = effectController.cloudCoverage;
  uniforms.cloudDensity.value = effectController.cloudDensity;
  uniforms.cloudElevation.value = effectController.cloudElevation;
  uniforms.showSunDisc.value = effectController.showSunDisc;
  sun.setFromSphericalCoords(1, degToRad(90 - effectController.elevation), degToRad(effectController.azimuth));
  uniforms.sunPosition.value.copy(sun);
  renderer.toneMappingExposure = effectController.exposure;
}
const gui = new GUI();
gui.add(effectController, "turbidity", 0, 20, 0.1).onChange(guiChanged);
gui.add(effectController, "rayleigh", 0, 4, 0.001).onChange(guiChanged);
gui.add(effectController, "mieCoefficient", 0, 0.1, 0.001).onChange(guiChanged);
gui.add(effectController, "mieDirectionalG", 0, 1, 0.001).onChange(guiChanged);
gui.add(effectController, "elevation", 0, 90, 0.1).onChange(guiChanged);
gui.add(effectController, "azimuth", -180, 180, 0.1).onChange(guiChanged);
gui.add(effectController, "exposure", 0, 1, 0.0001).onChange(guiChanged);
gui.add(effectController, "showSunDisc").onChange(guiChanged);
const clouds = gui.addFolder("Clouds");
clouds.add(effectController, "cloudCoverage", 0, 1, 0.01).name("coverage").onChange(guiChanged);
clouds.add(effectController, "cloudDensity", 0, 1, 0.01).name("density").onChange(guiChanged);
clouds.add(effectController, "cloudElevation", 0, 1, 0.01).name("elevation").onChange(guiChanged);
guiChanged();
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
resize();
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  sky.material.uniforms.time.value = performance.now() * 0.001;
  sphere.visible = false;
  cubeCamera.update(renderer, scene);
  sphere.visible = true;
  renderer.render(scene, camera);
  canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  sphereMaterial.envMap = null;
  disposeObject(scene);
  cubeRenderTarget.dispose();
  renderer.dispose();
});
