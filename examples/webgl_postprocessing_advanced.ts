import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { Stats } from "ek3d/addons/libs/Stats";
import { BloomPass } from "ek3d/addons/postprocessing/BloomPass";
import { DotScreenPass } from "ek3d/addons/postprocessing/DotScreenPass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { FilmPass } from "ek3d/addons/postprocessing/FilmPass";
import { ClearMaskPass, MaskPass } from "ek3d/addons/postprocessing/MaskPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { ShaderPass } from "ek3d/addons/postprocessing/ShaderPass";
import { TexturePass } from "ek3d/addons/postprocessing/TexturePass";
import { BleachBypassShader } from "ek3d/addons/shaders/BleachBypassShader";
import { ColorifyShader } from "ek3d/addons/shaders/ColorifyShader";
import { GammaCorrectionShader } from "ek3d/addons/shaders/GammaCorrectionShader";
import { HorizontalBlurShader } from "ek3d/addons/shaders/HorizontalBlurShader";
import { SepiaShader } from "ek3d/addons/shaders/SepiaShader";
import { VerticalBlurShader } from "ek3d/addons/shaders/VerticalBlurShader";
import { VignetteShader } from "ek3d/addons/shaders/VignetteShader";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ColorSpace } from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeMaterial, disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing advanced postprocessing canvas");
let halfWidth = innerWidth / 2,
  halfHeight = innerHeight / 2;
const ortho = new OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, -10000, 10000);
ortho.position.z = 100;
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 1, 10000);
camera.position.z = 900;
const scene = new Scene();
const background = new Scene();
const light = new DirectionalLight(0xffffff, 3);
light.position.set(0, -0.1, 1).normalize();
scene.add(light);
let disposed = false;
const loader = new TextureLoader();
const bgTexture = loader.load("/examples/textures/cube/SwedishRoyalCastle/pz.jpg", (map) => {
  if (disposed) map.dispose();
});
bgTexture.colorSpace = ColorSpace.SRGB;
const bg = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: bgTexture, depthTest: false }));
bg.position.z = -500;
bg.scale.set(innerWidth, innerHeight, 1);
background.add(bg);
const diffuse = loader.load("/examples/models/gltf/LeePerrySmith/Map-COL.jpg", (map) => {
  if (disposed) map.dispose();
});
diffuse.colorSpace = ColorSpace.SRGB;
const normal = loader.load("/examples/models/gltf/LeePerrySmith/Infinite-Level_02_Tangent_SmoothUV.jpg", (map) => {
  if (disposed) map.dispose();
});
const material = new MeshPhongMaterial({
  color: 0xcbcbcb,
  specular: 0x080808,
  shininess: 20,
  map: diffuse,
  normalMap: normal,
  normalScale: new Vector2(0.75, 0.75),
});
let head: Mesh | undefined;
new GLTFLoader().load(
  "/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    const child = gltf.scene.children[0];
    if (!(child instanceof Mesh)) {
      disposeObject(gltf.scene);
      console.error("Missing head mesh");
      return;
    }
    head = new Mesh(child.geometry, material);
    head.position.y = -50;
    head.scale.setScalar(100);
    scene.add(head);
    for (const old of Array.isArray(child.material) ? child.material : [child.material]) disposeMaterial(old);
  },
  undefined,
  (error) => {
    if (!disposed) console.error(error);
  },
);
const renderer = new WebGLRenderer({
  canvas,
  shaders: { MeshBasicMaterial: basicShader, MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
const stats = new Stats();
document.body.appendChild(stats.dom);
const bleach = new ShaderPass(BleachBypassShader);
bleach.uniforms!["opacity"].value = 0.95;
const sepia = new ShaderPass(SepiaShader);
sepia.uniforms!["amount"].value = 0.9;
const vignette = new ShaderPass(VignetteShader);
vignette.uniforms!["offset"].value = 1.6;
vignette.uniforms!["darkness"].value = 0.95;
const gamma = new ShaderPass(GammaCorrectionShader);
const bloom = new BloomPass(0.5);
const film = new FilmPass(0.35);
const filmBW = new FilmPass(0.35, true);
const dots = new DotScreenPass(new Vector2(0, 0), 0.5, 0.8);
const hblur = new ShaderPass(HorizontalBlurShader);
const vblur = new ShaderPass(VerticalBlurShader);
hblur.uniforms!["h"].value = 2 / halfWidth;
vblur.uniforms!["v"].value = 2 / halfHeight;
const color1 = new ShaderPass(ColorifyShader);
color1.uniforms!["color"].value = new Color(1, 0.8, 0.8);
const color2 = new ShaderPass(ColorifyShader);
color2.uniforms!["color"].value = new Color(1, 0.75, 0.5);
const clear = new ClearMaskPass();
const mask = new MaskPass(scene, camera);
const inverse = new MaskPass(scene, camera);
inverse.inverse = true;
const renderBackground = new RenderPass(background, ortho);
const renderModel = new RenderPass(scene, camera);
renderModel.clear = false;
const sceneComposer = new EffectComposer(
  renderer,
  new WebGLRenderTarget(innerWidth, innerHeight, { stencilBuffer: true }),
);
sceneComposer.renderToScreen = false;
for (const pass of [renderBackground, renderModel, inverse, hblur, vblur, clear]) sceneComposer.addPass(pass);
const texturePass = new TexturePass(sceneComposer.readBuffer.texture);
const composers = Array.from(
  { length: 4 },
  () => new EffectComposer(renderer, new WebGLRenderTarget(halfWidth, halfHeight, { stencilBuffer: true })),
);
for (const pass of [texturePass, gamma, filmBW, vignette]) composers[0].addPass(pass);
for (const pass of [texturePass, gamma, dots, mask, color1, clear, inverse, color2, clear, vignette])
  composers[1].addPass(pass);
for (const pass of [texturePass, gamma, sepia, film, vignette]) composers[2].addPass(pass);
for (const pass of [texturePass, gamma, bloom, film, bleach, vignette]) composers[3].addPass(pass);
function resize(): void {
  halfWidth = innerWidth / 2;
  halfHeight = innerHeight / 2;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  ortho.left = -halfWidth;
  ortho.right = halfWidth;
  ortho.top = halfHeight;
  ortho.bottom = -halfHeight;
  ortho.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  sceneComposer.setSize(innerWidth, innerHeight);
  for (const composer of composers) composer.setSize(halfWidth, halfHeight);
  hblur.uniforms!["h"].value = 2 / halfWidth;
  vblur.uniforms!["v"].value = 2 / halfHeight;
  bg.scale.set(innerWidth, innerHeight, 1);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  stats.begin();
  if (head) head.rotation.y = -Date.now() * 0.0004;
  renderer.setViewport(0, 0, halfWidth, halfHeight);
  sceneComposer.render(0.01);
  texturePass.map = sceneComposer.readBuffer.texture;
  for (let i = 0; i < composers.length; i++) {
    renderer.setViewport((i % 2) * halfWidth, Math.floor(i / 2) * halfHeight, halfWidth, halfHeight);
    composers[i].render(0.01);
  }
  stats.end();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  stats.dom.remove();
  const all = [sceneComposer, ...composers];
  for (const pass of new Set(all.flatMap((composer) => composer.passes))) pass.dispose();
  for (const composer of all) composer.dispose();
  disposeObject(background);
  if (head) disposeObject(scene);
  else disposeMaterial(material);
  renderer.dispose();
});
