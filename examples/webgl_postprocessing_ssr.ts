import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { DRACOLoader } from "ek3d/addons/loaders/DRACOLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { ReflectorForSSRPass } from "ek3d/addons/objects/ReflectorForSSRPass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { SSRPass } from "ek3d/addons/postprocessing/SSRPass";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import type { Object3D } from "ek3d/core/Object3D";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { ConeGeometry } from "ek3d/geometries/ConeGeometry";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing SSR canvas");
const params = { enableSSR: true, autoRotate: true, otherMeshes: true, groundReflector: true };
const camera = new PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 15);
camera.position.set(0.13271600513224902, 0.3489546826045913, 0.43921296427927076);
const scene = new Scene();
scene.background = new Color(0x443333);
scene.fog = new Fog(0x443333, 1, 4);
const plane = new Mesh(new PlaneGeometry(8, 8), new MeshPhongMaterial({ color: 0xcbcbcb }));
plane.rotation.x = -Math.PI / 2;
plane.position.y = -0.0001;
scene.add(plane);
scene.add(new HemisphereLight(0x8d7c7c, 0x494966, 3));
const light = new SpotLight();
light.intensity = 8;
light.angle = Math.PI / 16;
light.penumbra = 0.5;
light.position.set(-1, 1, 1);
scene.add(light);
const selects: Object3D[] = [];
const otherMeshes: Mesh[] = [];
for (const [geometry, color, x, z] of [
  [new BoxGeometry(0.05, 0.05, 0.05), "green", -0.12, 0.015],
  [new IcosahedronGeometry(0.025, 4), "cyan", -0.05, 0.08],
  [new ConeGeometry(0.025, 0.05, 64), "yellow", -0.05, -0.055],
] as const) {
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ color }));
  mesh.position.set(x, 0.025, z);
  scene.add(mesh);
  otherMeshes.push(mesh);
  selects.push(mesh);
}
const reflector = new ReflectorForSSRPass(new PlaneGeometry(1, 1), {
  clipBias: 0.0003,
  textureWidth: innerWidth,
  textureHeight: innerHeight,
  color: 0x888888,
  useDepthTexture: true,
});
reflector.material.depthWrite = false;
reflector.rotation.x = -Math.PI / 2;
reflector.visible = false;
scene.add(reflector);
const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  antialias: false,
  createBackground: WebGLBackground,
  getDFGLUT: () => dfgLUT,
  ltcTextures,
  shaders: {
    MeshBasicMaterial: basicShader,
    MeshNormalMaterial: normalShader,
    MeshPhongMaterial: phongShader,
    MeshStandardMaterial: standardShader,
  },
});
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 0.0635, 0);
controls.update();
controls.enabled = false;
const stats = new Stats();
document.body.appendChild(stats.dom);
const composer = new EffectComposer(renderer);
const ssr = new SSRPass({
  renderer,
  scene,
  camera,
  width: innerWidth,
  height: innerHeight,
  groundReflector: reflector,
  selects,
});
composer.addPass(ssr);
composer.addPass(new OutputPass());
const gui = new GUI({ width: 260 });
gui.add(params, "enableSSR").name("Enable SSR");
gui.add(params, "groundReflector").onChange(() => {
  ssr.groundReflector = params.groundReflector ? reflector : null;
  ssr.selects = params.groundReflector ? selects : null;
});
ssr.thickness = 0.018;
gui.add(ssr, "resolutionScale").min(0).max(1);
gui.add(ssr, "thickness").min(0).max(0.1).step(0.0001);
ssr.infiniteThick = false;
gui.add(ssr, "infiniteThick");
gui.add(params, "autoRotate").onChange(() => {
  controls.enabled = !params.autoRotate;
});
const folder = gui.addFolder("more settings");
folder.add(ssr, "fresnel").onChange(() => {
  reflector.material.defines.FRESNEL = ssr.fresnel;
  reflector.material.needsUpdate = true;
});
folder.add(ssr, "distanceAttenuation").onChange(() => {
  reflector.material.defines.DISTANCE_ATTENUATION = ssr.distanceAttenuation;
  reflector.material.needsUpdate = true;
});
ssr.maxDistance = 0.1;
reflector.maxDistance = ssr.maxDistance;
folder
  .add(ssr, "maxDistance")
  .min(0)
  .max(0.5)
  .step(0.001)
  .onChange(() => {
    reflector.maxDistance = ssr.maxDistance;
  });
folder.add(params, "otherMeshes").onChange(() => {
  for (const mesh of otherMeshes) mesh.visible = params.otherMeshes;
});
folder.add(ssr, "bouncing");
folder.add(ssr, "output", {
  Default: SSRPass.OUTPUT.Default,
  "SSR Only": SSRPass.OUTPUT.SSR,
  Beauty: SSRPass.OUTPUT.Beauty,
  Depth: SSRPass.OUTPUT.Depth,
  Normal: SSRPass.OUTPUT.Normal,
  Metalness: SSRPass.OUTPUT.Metalness,
});
ssr.opacity = 1;
reflector.opacity = 1;
folder
  .add(ssr, "opacity")
  .min(0)
  .max(1)
  .onChange(() => {
    reflector.opacity = ssr.opacity;
  });
folder.add(ssr, "blur");
let disposed = false;
const loader = new DRACOLoader();
loader.load(
  "/examples/models/draco/bunny.drc",
  (geometry) => {
    if (disposed) {
      geometry.dispose();
      return;
    }
    geometry.computeVertexNormals();
    const mesh = new Mesh(geometry, new MeshStandardMaterial({ color: 0xa5a5a5 }));
    mesh.position.y = -0.0365;
    scene.add(mesh);
    selects.push(mesh);
    loader.dispose();
  },
  undefined,
  (error) => {
    if (!disposed) console.error(error);
  },
);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  reflector.getRenderTarget().setSize(innerWidth, innerHeight);
  reflector.resolution.set(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  stats.begin();
  if (params.autoRotate) {
    const time = Date.now() * 0.0003;
    camera.position.set(Math.sin(time) * 0.5, 0.2135, Math.cos(time) * 0.5);
    camera.lookAt(0, 0.0635, 0);
  } else controls.update();
  if (params.enableSSR) composer.render();
  else renderer.render(scene, camera);
  stats.end();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  loader.dispose();
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  for (const pass of composer.passes) pass.dispose();
  composer.dispose();
  reflector.dispose();
  disposeObject(scene);
  dfgLUT.dispose();
  for (const lut of Object.values(ltcTextures)) lut.dispose();
  renderer.dispose();
});
