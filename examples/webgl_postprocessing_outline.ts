import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { OBJLoader } from "ek3d/addons/loaders/OBJLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutlinePass } from "ek3d/addons/postprocessing/OutlinePass";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { ShaderPass } from "ek3d/addons/postprocessing/ShaderPass";
import { FXAAShader } from "ek3d/addons/shaders/FXAAShader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DoubleSide, RepeatWrapping } from "ek3d/constants";
import { Object3D } from "ek3d/core/Object3D";
import { Raycaster } from "ek3d/core/Raycaster";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { TorusGeometry } from "ek3d/geometries/TorusGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Vector2 } from "ek3d/math/Vector2";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeMaterial, disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing outline canvas");
const scene = new Scene();
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 8);
const renderer = new WebGLRenderer({
  canvas,
  createShadowMap: WebGLShadowMap,
  shaders: { MeshLambertMaterial: lambertShader, MeshPhongMaterial: phongShader, MeshDepthMaterial: depthShader },
});
if (renderer.shadowMap) renderer.shadowMap.enabled = true;
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 5;
controls.maxDistance = 20;
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.05;
scene.add(new AmbientLight(0xaaaaaa, 0.6));
const light = new DirectionalLight(0xddffdd, 2);
light.position.set(5, 5, 5);
light.castShadow = true;
light.shadow.mapSize.set(1024, 1024);
light.shadow.camera.left = -10;
light.shadow.camera.right = 10;
light.shadow.camera.top = 10;
light.shadow.camera.bottom = -10;
light.shadow.camera.far = 25;
scene.add(light);
const group = new Group();
const object = new Object3D();
group.add(object);
scene.add(group);
let disposed = false;
new OBJLoader().load(
  "/examples/models/obj/tree.obj",
  (tree) => {
    if (disposed) {
      disposeObject(tree);
      return;
    }
    let scale = 1;
    tree.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.geometry.center();
      child.geometry.computeBoundingSphere();
      if (child.geometry.boundingSphere) scale = 0.2 * child.geometry.boundingSphere.radius;
      for (const old of Array.isArray(child.material) ? child.material : [child.material]) disposeMaterial(old);
      child.material = new MeshPhongMaterial({ color: 0xffffff, specular: 0x111111, shininess: 5 });
      child.receiveShadow = true;
      child.castShadow = true;
    });
    tree.position.y = 1;
    tree.scale.divideScalar(scale);
    object.add(tree);
  },
  undefined,
  (error) => {
    if (!disposed) console.error(error);
  },
);
const sphere = new SphereGeometry(3, 48, 24);
for (let i = 0; i < 20; i++) {
  const material = new MeshLambertMaterial();
  material.color.setHSL(Math.random(), 1, 0.3);
  const mesh = new Mesh(sphere, material);
  mesh.position.set(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.scale.multiplyScalar(Math.random() * 0.3 + 0.1);
  group.add(mesh);
}
const floor = new Mesh(new PlaneGeometry(12, 12), new MeshLambertMaterial({ side: DoubleSide }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.5;
floor.receiveShadow = true;
group.add(floor);
const torus = new Mesh(new TorusGeometry(1, 0.3, 16, 100), new MeshPhongMaterial({ color: 0xffaaff }));
torus.position.z = -4;
torus.castShadow = true;
torus.receiveShadow = true;
group.add(torus);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const outline = new OutlinePass(new Vector2(innerWidth, innerHeight), scene, camera);
composer.addPass(outline);
const pattern = new TextureLoader().load("/examples/textures/tri_pattern.jpg", (texture) => {
  if (disposed) {
    texture.dispose();
    return;
  }
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  outline.patternTexture = texture;
});
composer.addPass(new OutputPass());
const fxaa = new ShaderPass(FXAAShader);
fxaa.uniforms!["resolution"].value.set(1 / innerWidth, 1 / innerHeight);
composer.addPass(fxaa);
const params = { rotate: false, visibleEdgeColor: "#ffffff", hiddenEdgeColor: "#190a05" };
const gui = new GUI({ width: 280 });
gui.add(outline, "edgeStrength", 0.01, 10);
gui.add(outline, "edgeGlow", 0, 1);
gui.add(outline, "edgeThickness", 1, 4);
gui.add(outline, "pulsePeriod", 0, 5);
gui.add(params, "rotate");
gui.add(outline, "usePatternTexture");
gui.addColor(params, "visibleEdgeColor").onChange((value: unknown) => outline.visibleEdgeColor.set(String(value)));
gui.addColor(params, "hiddenEdgeColor").onChange((value: unknown) => outline.hiddenEdgeColor.set(String(value)));
const stats = new Stats();
document.body.appendChild(stats.dom);
const raycaster = new Raycaster();
const mouse = new Vector2();
function pointer(event: PointerEvent): void {
  if (!event.isPrimary) return;
  mouse.set((event.clientX / innerWidth) * 2 - 1, (-event.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(scene, true)[0];
  if (hit) outline.selectedObjects = [hit.object];
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  fxaa.uniforms!["resolution"].value.set(1 / innerWidth, 1 / innerHeight);
}
canvas.style.touchAction = "none";
canvas.addEventListener("pointermove", pointer);
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  stats.begin();
  if (params.rotate) group.rotation.y = performance.now() * 0.0001;
  controls.update();
  composer.render();
  stats.end();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  canvas.removeEventListener("pointermove", pointer);
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  for (const pass of composer.passes) pass.dispose();
  composer.dispose();
  pattern.dispose();
  light.shadow.dispose();
  disposeObject(scene);
  renderer.dispose();
});
