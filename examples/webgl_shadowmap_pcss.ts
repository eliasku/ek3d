import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ShadowMap } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { CameraHelper } from "ek3d/helpers/CameraHelper";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

// The PCSS filter reads raw shadow depths, so it replaces only the basic-shadow branch.
const pcss = `
#define LIGHT_WORLD_SIZE 0.005
#define LIGHT_FRUSTUM_WIDTH 3.75
#define LIGHT_SIZE_UV (LIGHT_WORLD_SIZE / LIGHT_FRUSTUM_WIDTH)
#define NEAR_PLANE 9.5
#define NUM_SAMPLES 17
#define NUM_RINGS 11
vec2 poissonDisk[NUM_SAMPLES];
void initPoissonSamples( const in vec2 randomSeed ) {
  float angleStep = PI2 * float(NUM_RINGS) / float(NUM_SAMPLES);
  float radiusStep = 1.0 / float(NUM_SAMPLES);
  float angle = rand(randomSeed) * PI2;
  float radius = radiusStep;
  for (int i = 0; i < NUM_SAMPLES; i++) {
    poissonDisk[i] = vec2(cos(angle), sin(angle)) * pow(radius, 0.75);
    radius += radiusStep;
    angle += angleStep;
  }
}
float findBlocker(sampler2D shadowMap, vec2 uv, float zReceiver) {
  float searchRadius = LIGHT_SIZE_UV * (zReceiver - NEAR_PLANE) / zReceiver;
  float sum = 0.0;
  int count = 0;
  for (int i = 0; i < NUM_SAMPLES; i++) {
    float depth = texture2D(shadowMap, uv + poissonDisk[i] * searchRadius).r;
    if (depth < zReceiver) { sum += depth; count++; }
  }
  return count == 0 ? -1.0 : sum / float(count);
}
float PCSS(sampler2D shadowMap, vec4 coords) {
  initPoissonSamples(coords.xy);
  float blocker = findBlocker(shadowMap, coords.xy, coords.z);
  if (blocker == -1.0) return 1.0;
  float penumbra = (coords.z - blocker) / blocker;
  float radius = penumbra * LIGHT_SIZE_UV * NEAR_PLANE / coords.z;
  float sum = 0.0;
  float depth;
  #pragma unroll_loop_start
  for (int i = 0; i < 17; i++) {
    depth = texture2D(shadowMap, coords.xy + poissonDisk[i] * radius).r;
    if (coords.z <= depth) sum += 1.0;
  }
  #pragma unroll_loop_end
  #pragma unroll_loop_start
  for (int i = 0; i < 17; i++) {
    depth = texture2D(shadowMap, coords.xy - poissonDisk[i].yx * radius).r;
    if (coords.z <= depth) sum += 1.0;
  }
  #pragma unroll_loop_end
  return sum / 34.0;
}
`;
const branch = "#else // SHADOWMAP_TYPE_BASIC";
const depthRead = "float depth = texture2D( shadowMap, shadowCoord.xy ).r;";
if (!phongShader.fragmentShader.includes(branch) || !phongShader.fragmentShader.includes(depthRead)) {
  throw new Error("PCSS shadow shader anchors are missing");
}
const customPhong = {
  ...phongShader,
  fragmentShader: phongShader.fragmentShader
    .replace(branch, `${branch}\n${pcss}`)
    .replace(depthRead, `return mix( 1.0, PCSS( shadowMap, shadowCoord ), shadowIntensity );\n${depthRead}`),
};

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing PCSS example canvas");
const canvas = selected;
const scene = new Scene();
scene.fog = new Fog(0xcce0ff, 5, 100);
const camera = new PerspectiveCamera(30, innerWidth / innerHeight, 1, 10000);
camera.position.set(7, 13, 7);
scene.add(camera, new AmbientLight(0xaaaaaa, 3));
const light = new DirectionalLight(0xf0f6ff, 4.5);
light.position.set(2, 8, 4);
light.castShadow = true;
light.shadow.mapSize.set(1024, 1024);
light.shadow.camera.far = 20;
scene.add(light, new CameraHelper(light.shadow.camera));
const group = new Group();
scene.add(group);
const geometry = new SphereGeometry(0.3, 20, 20);
const spheres: { mesh: Mesh; phase: number }[] = [];
for (let i = 0; i < 20; i++) {
  const mesh = new Mesh(geometry, new MeshPhongMaterial({ color: Math.random() * 0xffffff }));
  mesh.position
    .set(Math.random() - 0.5, 0, Math.random() - 0.5)
    .normalize()
    .multiplyScalar(Math.random() * 2 + 1);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  spheres.push({ mesh, phase: Math.random() * Math.PI });
  group.add(mesh);
}
const groundMaterial = new MeshPhongMaterial({ color: 0x898989 });
const ground = new Mesh(new PlaneGeometry(20000, 20000, 8, 8), groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const column = new Mesh(new BoxGeometry(1, 4, 1), groundMaterial);
column.position.y = 2;
column.castShadow = true;
column.receiveShadow = true;
scene.add(column);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createShadowMap: WebGLShadowMap,
  shaders: { MeshPhongMaterial: customPhong, MeshDepthMaterial: depthShader, LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(scene.fog.color);
if (!renderer.shadowMap) throw new Error("Shadow map system unavailable");
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = ShadowMap.Basic;
const controls = new OrbitControls(camera, canvas);
controls.maxPolarAngle = Math.PI * 0.5;
controls.minDistance = 10;
controls.maxDistance = 75;
controls.target.set(0, 2.5, 0);
controls.update();
const stats = new Stats();
document.body.appendChild(stats.dom);
renderer.setAnimationLoop(() => {
  const time = performance.now() / 1000;
  for (const { mesh, phase } of spheres) mesh.position.y = Math.abs(Math.sin(time + phase)) * 4 + 0.3;
  renderer.render(scene, camera);
  stats.update();
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  stats.dom.remove();
  disposeObject(scene);
  light.shadow.dispose();
  renderer.dispose();
});
