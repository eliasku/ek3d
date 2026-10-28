import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PLYLoader } from "ek3d/addons/loaders/PLYLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { LinearFilter, NeutralToneMapping, PCFShadowMap, SRGBColorSpace } from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { CameraHelper } from "ek3d/helpers/CameraHelper";
import { SpotLightHelper } from "ek3d/helpers/SpotLightHelper";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing spotlight canvas");
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createShadowMap: WebGLShadowMap,
  shaders: { MeshLambertMaterial: lambertShader, MeshDepthMaterial: depthShader, LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = NeutralToneMapping;
if (!renderer.shadowMap) throw new Error("Missing shadow map system");
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
const scene = new Scene();
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
camera.position.set(7, 4, 1);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 2;
controls.maxDistance = 10;
controls.maxPolarAngle = Math.PI / 2;
controls.target.set(0, 1, 0);
controls.update();
let disposed = false;
const manager = new LoadingManager();
const loader = new TextureLoader(manager).setPath("/examples/textures/");
const maps = ["disturb.jpg", "colors.png", "uv_grid_opengl.jpg"].map((name) => {
  const texture = loader.load(name, (loaded) => {
    if (disposed) loaded.dispose();
  });
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  return texture;
});
scene.add(new HemisphereLight(0xffffff, 0x8d8d8d, 0.25));
const light = new SpotLight(0xffffff, 100);
light.name = "spotLight";
light.map = maps[0]!;
light.position.set(2.5, 5, 2.5);
light.angle = Math.PI / 6;
light.penumbra = 1;
light.castShadow = true;
light.shadow.mapSize.set(1024, 1024);
light.shadow.camera.near = 2;
light.shadow.camera.far = 10;
light.shadow.focus = 1;
light.shadow.bias = -0.003;
scene.add(light);
const helper = new SpotLightHelper(light);
const cameraHelper = new CameraHelper(light.shadow.camera);
helper.visible = false;
cameraHelper.visible = false;
scene.add(helper, cameraHelper);
const floor = new Mesh(new PlaneGeometry(10, 10), new MeshLambertMaterial({ color: 0xbcbcbc }));
floor.position.y = -1;
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
new PLYLoader(manager).load("/examples/models/ply/binary/Lucy100k.ply", (geometry) => {
  if (disposed) {
    geometry.dispose();
    return;
  }
  geometry.scale(0.0024, 0.0024, 0.0024);
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, new MeshLambertMaterial());
  mesh.rotation.y = -Math.PI / 2;
  mesh.position.y = 0.8;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
});
const params = {
  map: "disturb.jpg",
  color: light.color.getHex(),
  focus: light.shadow.focus,
  shadowIntensity: light.shadow.intensity,
  helpers: false,
};
const gui = new GUI();
gui.add(params, "map", ["none", "disturb.jpg", "colors.png", "uv_grid_opengl.jpg"]).onChange(() => {
  light.map =
    params.map === "none"
      ? null
      : (maps[["disturb.jpg", "colors.png", "uv_grid_opengl.jpg"].indexOf(params.map)] ?? null);
});
gui.addColor(params, "color").onChange(() => light.color.setHex(params.color));
gui.add(light, "intensity", 0, 500);
gui.add(light, "distance", 0, 20);
gui.add(light, "angle", 0, Math.PI / 3);
gui.add(light, "penumbra", 0, 1);
gui.add(light, "decay", 1, 2);
gui.add(params, "focus", 0, 1).onChange(() => {
  light.shadow.focus = params.focus;
});
gui.add(params, "shadowIntensity", 0, 1).onChange(() => {
  light.shadow.intensity = params.shadowIntensity;
});
gui.add(params, "helpers").onChange(() => {
  helper.visible = params.helpers;
  cameraHelper.visible = params.helpers;
});
gui.open();
renderer.setAnimationLoop(() => {
  const time = performance.now() / 3000;
  light.position.x = Math.cos(time) * 2.5;
  light.position.z = Math.sin(time) * 2.5;
  helper.update();
  renderer.render(scene, camera);
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
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
  light.dispose();
  disposeObject(scene);
  for (const map of maps) map.dispose();
  renderer.dispose();
});
