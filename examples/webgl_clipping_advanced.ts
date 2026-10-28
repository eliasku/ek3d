import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DoubleSide } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Plane } from "ek3d/math/Plane";
import { Vector3 } from "ek3d/math/Vector3";
import { Group } from "ek3d/objects/Group";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing advanced clipping canvas");
const vertices = [
  new Vector3(1, 0, Math.SQRT1_2),
  new Vector3(-1, 0, Math.SQRT1_2),
  new Vector3(0, 1, -Math.SQRT1_2),
  new Vector3(0, -1, -Math.SQRT1_2),
];
const indices = [0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2];
const planes = Array.from({ length: indices.length / 3 }, (_, i) =>
  new Plane().setFromCoplanarPoints(
    vertices[indices[i * 3]],
    vertices[indices[i * 3 + 1]],
    vertices[indices[i * 3 + 2]],
  ),
);
const planeMatrices = planes.map((plane) => {
  const z = plane.normal;
  const y = Math.abs(z.x) > Math.abs(z.z) ? new Vector3(-z.y, z.x, 0) : new Vector3(0, -z.z, z.y);
  const x = new Vector3().crossVectors(y.normalize(), z);
  const p = plane.coplanarPoint(new Vector3());
  return new Matrix4().set(x.x, y.x, z.x, p.x, x.y, y.y, z.y, p.y, x.z, y.z, z.z, p.z, 0, 0, 0, 1);
});
const globalPlanes = Array.from(
  { length: 5 },
  (_, i) => new Plane(new Vector3(Math.cos((i * Math.PI * 2) / 5), 0, Math.sin((i * Math.PI * 2) / 5)), 2.5),
);
const transformedGlobalPlanes = globalPlanes.map(() => new Plane());
const emptyPlanes: Plane[] = [];
const camera = new PerspectiveCamera(36, innerWidth / innerHeight, 0.25, 16);
camera.position.set(0, 1.5, 3);
const scene = new Scene();
scene.add(new AmbientLight(0xffffff));
const spot = new SpotLight(0xffffff, 60);
spot.angle = Math.PI / 5;
spot.penumbra = 0.2;
spot.position.set(2, 3, 3);
spot.castShadow = true;
spot.shadow.camera.near = 3;
spot.shadow.camera.far = 10;
spot.shadow.mapSize.set(1024, 1024);
scene.add(spot);
const light = new DirectionalLight(0xffffff, 1.5);
light.position.set(0, 2, 0);
light.castShadow = true;
light.shadow.camera.near = 1;
light.shadow.camera.far = 10;
light.shadow.camera.left = -1;
light.shadow.camera.right = 1;
light.shadow.camera.top = 1;
light.shadow.camera.bottom = -1;
light.shadow.mapSize.set(1024, 1024);
scene.add(light);
const clippingPlanes = planes.map(() => new Plane());
const material = new MeshPhongMaterial({
  color: 0xee0a10,
  shininess: 100,
  side: DoubleSide,
  clippingPlanes,
  clipShadows: true,
});
const object = new InstancedMesh(new BoxGeometry(0.18, 0.18, 0.18), material, 125);
object.castShadow = true;
const matrix = new Matrix4();
let index = 0;
for (let z = -2; z <= 2; z++)
  for (let y = -2; y <= 2; y++)
    for (let x = -2; x <= 2; x++) {
      matrix.setPosition(x / 5, y / 5, z / 5);
      object.setMatrixAt(index++, matrix);
    }
scene.add(object);
const planeGeometry = new PlaneGeometry(3, 3, 1, 1);
const volume = new Group();
volume.visible = false;
const color = new Color();
planes.forEach((_, i) => {
  const mesh = new Mesh(
    planeGeometry,
    new MeshBasicMaterial({
      color: color.setHSL(i / planes.length, 0.5, 0.5).getHex(),
      side: DoubleSide,
      opacity: 0.2,
      transparent: true,
      clippingPlanes: clippingPlanes.filter((_, j) => j !== i),
    }),
  );
  mesh.matrixAutoUpdate = false;
  volume.add(mesh);
});
scene.add(volume);
const ground = new Mesh(planeGeometry, new MeshPhongMaterial({ color: 0xa0adaf, shininess: 10 }));
ground.rotation.x = -Math.PI / 2;
ground.scale.multiplyScalar(3);
ground.receiveShadow = true;
scene.add(ground);
const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  createShadowMap: WebGLShadowMap,
  shaders: { MeshBasicMaterial: basicShader, MeshPhongMaterial: phongShader, MeshDepthMaterial: depthShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
if (!renderer.shadowMap) throw new Error("Missing shadow map system");
renderer.shadowMap.enabled = true;
renderer.clippingPlanes = emptyPlanes;
renderer.localClippingEnabled = true;
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 1;
controls.maxDistance = 8;
controls.target.set(0, 1, 0);
controls.update();
const stats = new Stats();
document.body.appendChild(stats.dom);
const gui = new GUI();
const props = {
  get Enabled(): boolean {
    return renderer.localClippingEnabled;
  },
  set Enabled(value: boolean) {
    renderer.localClippingEnabled = value;
    if (!value) volume.visible = false;
  },
  get Shadows(): boolean {
    return material.clipShadows;
  },
  set Shadows(value: boolean) {
    material.clipShadows = value;
  },
  get Visualize(): boolean {
    return volume.visible;
  },
  set Visualize(value: boolean) {
    if (renderer.localClippingEnabled) volume.visible = value;
  },
};
const folder = gui.addFolder("Local Clipping");
folder.add(props, "Enabled");
folder.add(props, "Shadows");
folder.add(props, "Visualize").listen();
gui.addFolder("Global Clipping").add(
  {
    get Enabled(): boolean {
      return renderer.clippingPlanes !== emptyPlanes;
    },
    set Enabled(value: boolean) {
      renderer.clippingPlanes = value ? transformedGlobalPlanes : emptyPlanes;
    },
  },
  "Enabled",
);
const startTime = Date.now();
const transform = new Matrix4();
const temp = new Matrix4();
renderer.setAnimationLoop(() => {
  const time = (Date.now() - startTime) / 1000;
  object.position.y = 1;
  object.rotation.x = time * 0.5;
  object.rotation.y = time * 0.2;
  object.updateMatrix();
  const bouncy = Math.cos(time * 0.5) * 0.5 + 0.7;
  transform.copy(object.matrix).multiply(temp.makeScale(bouncy, bouncy, bouncy));
  clippingPlanes.forEach((plane, i) => plane.copy(planes[i]).applyMatrix4(transform));
  scene.updateMatrixWorld();
  volume.children.forEach((mesh, i) => {
    temp.multiplyMatrices(transform, planeMatrices[i]);
    mesh.matrix.copy(volume.matrixWorld).invert();
    mesh.applyMatrix4(temp);
  });
  transform.makeRotationY(time * 0.1);
  transformedGlobalPlanes.forEach((plane, i) => plane.copy(globalPlanes[i]).applyMatrix4(transform));
  stats.begin();
  renderer.render(scene, camera);
  stats.end();
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
  gui.destroy();
  stats.dom.remove();
  disposeObject(scene);
  object.dispose();
  spot.shadow.dispose();
  light.shadow.dispose();
  renderer.dispose();
});
