import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { FXAAPass } from "ek3d/addons/postprocessing/FXAAPass";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { ShaderPass } from "ek3d/addons/postprocessing/ShaderPass";
import { BleachBypassShader } from "ek3d/addons/shaders/BleachBypassShader";
import { ColorCorrectionShader } from "ek3d/addons/shaders/ColorCorrectionShader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { TextureType, ColorSpace } from "ek3d/constants";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { PointLight } from "ek3d/lights/PointLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Scene } from "ek3d/scenes/Scene";
import { DepthTexture } from "ek3d/textures/DepthTexture";
import { disposeMaterial, disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing normal map canvas");
const canvas: HTMLCanvasElement = selected;
const scene = new Scene();
scene.background = new Color(0x494949);
const camera = new PerspectiveCamera(27, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 12;
scene.add(new AmbientLight(0xffffff));
const point = new PointLight(0xffffff, 30);
point.position.set(0, 0, 6);
scene.add(point);
const directional = new DirectionalLight(0xffffff, 3);
directional.position.set(1, -0.5, -1);
scene.add(directional);
const renderer = new WebGLRenderer({ canvas, shaders: { MeshPhongMaterial: phongShader } });
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 8;
controls.maxDistance = 50;
controls.enablePan = false;
controls.enableDamping = true;
let disposed = false;
const manager = new LoadingManager();
const onError = (error: unknown): void => {
  if (!disposed) {
    canvas.dataset.state = "error";
    console.error(error);
  }
};
canvas.dataset.state = "loading";
const loader = new TextureLoader(manager);
const base = "/examples/models/gltf/LeePerrySmith/";
const diffuse = loader.load(base + "Map-COL.jpg", undefined, undefined, onError);
diffuse.colorSpace = ColorSpace.SRGB;
const specular = loader.load(base + "Map-SPEC.jpg", undefined, undefined, onError);
specular.colorSpace = ColorSpace.SRGB;
const normal = loader.load(base + "Infinite-Level_02_Tangent_SmoothUV.jpg", undefined, undefined, onError);
const material = new MeshPhongMaterial({
  color: 0xefefef,
  specular: 0x222222,
  shininess: 35,
  map: diffuse,
  specularMap: specular,
  normalMap: normal,
  normalScale: new Vector2(1, 1),
});
new GLTFLoader(manager).load(
  base + "LeePerrySmith.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    const child = gltf.scene.children[0];
    if (!(child instanceof Mesh)) {
      disposeObject(gltf.scene);
      onError(new Error("Missing head mesh"));
      return;
    }
    const mesh = new Mesh(child.geometry, material);
    mesh.position.y = -0.5;
    scene.add(mesh);
    for (const old of Array.isArray(child.material) ? child.material : [child.material]) disposeMaterial(old);
    canvas.dataset.model = "loaded";
    canvas.dataset.state = "ready";
  },
  undefined,
  onError,
);
const bleach = new ShaderPass(BleachBypassShader);
const color = new ShaderPass(ColorCorrectionShader);
bleach.uniforms!["opacity"].value = 0.2;
color.uniforms!["powRGB"].value.set(1.4, 1.45, 1.45);
color.uniforms!["mulRGB"].value.set(1.1, 1.1, 1.1);
const composer = new EffectComposer(
  renderer,
  new WebGLRenderTarget(innerWidth, innerHeight, {
    type: TextureType.HalfFloat,
    depthTexture: new DepthTexture(innerWidth, innerHeight),
  }),
);
const renderPass = new RenderPass(scene, camera);
const output = new OutputPass();
const fxaa = new FXAAPass();
composer.addPass(renderPass);
composer.addPass(bleach);
composer.addPass(color);
composer.addPass(output);
composer.addPass(fxaa);
const params = { enableNormalMap: true, normalScale: 1 };
const gui = new GUI();
gui
  .add(params, "enableNormalMap")
  .name("enable normal map")
  .onChange(() => {
    material.normalMap = params.enableNormalMap ? normal : null;
    material.needsUpdate = true;
  });
gui
  .add(params, "normalScale", 0, 2)
  .name("normal scale")
  .onChange(() => material.normalScale.setScalar(params.normalScale));
gui.open();
renderer.setAnimationLoop(() => {
  controls.update();
  composer.render();
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  manager.abort();
  controls.dispose();
  gui.destroy();
  disposeObject(scene, [material]);
  normal.dispose();
  renderPass.dispose();
  bleach.dispose();
  color.dispose();
  output.dispose();
  fxaa.dispose();
  composer.dispose();
  renderer.dispose();
});
