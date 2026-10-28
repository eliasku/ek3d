import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { DecalGeometry } from "ek3d/addons/geometries/DecalGeometry";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ColorSpace } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { MeshNormalMaterial } from "ek3d/materials/MeshNormalMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Euler } from "ek3d/math/Euler";
import { Matrix3 } from "ek3d/math/Matrix3";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Line } from "ek3d/objects/Line";
import { Mesh } from "ek3d/objects/Mesh";
import { Raycaster } from "ek3d/core/Raycaster";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import type { Texture } from "ek3d/textures/Texture";
import { Scene } from "ek3d/scenes/Scene";
import { disposeMaterial, disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing decal canvas");
const canvas: HTMLCanvasElement = selected;
const scene = new Scene();
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 1, 1000);
camera.position.z = 120;
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  shaders: { MeshPhongMaterial: phongShader, LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 50;
controls.maxDistance = 200;
const stats = new Stats();
document.body.appendChild(stats.dom);
scene.add(new AmbientLight(0x666666));
const light1 = new DirectionalLight(0xffddcc, 3);
light1.position.set(1, 0.75, 0.5);
scene.add(light1);
const light2 = new DirectionalLight(0xccccff, 3);
light2.position.set(-1, 0.75, -0.5);
scene.add(light2);
const line = new Line(new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]), new LineBasicMaterial());
scene.add(line);
const helper = new Mesh(new BoxGeometry(1, 1, 10), new MeshNormalMaterial());
helper.visible = false;
scene.add(helper);
const manager = new LoadingManager();
const textures = new TextureLoader(manager);
let disposed = false;
const onError = (error: unknown): void => {
  if (!disposed) {
    canvas.dataset.state = "error";
    console.error(error);
  }
};
const onTextureLoad = (texture: Texture): void => {
  if (disposed) texture.dispose();
};
canvas.dataset.state = "loading";
const diffuse = textures.load("/examples/textures/decal/decal-diffuse.png", onTextureLoad, undefined, onError);
diffuse.colorSpace = ColorSpace.SRGB;
const normal = textures.load("/examples/textures/decal/decal-normal.jpg", onTextureLoad, undefined, onError);
const decalMaterial = new MeshPhongMaterial({
  specular: 0x444444,
  map: diffuse,
  normalMap: normal,
  normalScale: new Vector2(1, 1),
  shininess: 30,
  transparent: true,
  depthTest: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  wireframe: false,
});
const base = "/examples/models/gltf/LeePerrySmith/";
const map = textures.load(base + "Map-COL.jpg", onTextureLoad, undefined, onError);
map.colorSpace = ColorSpace.SRGB;
const specularMap = textures.load(base + "Map-SPEC.jpg", onTextureLoad, undefined, onError);
const normalMap = textures.load(base + "Infinite-Level_02_Tangent_SmoothUV.jpg", onTextureLoad, undefined, onError);
const headMaterial = new MeshPhongMaterial({ specular: 0x111111, map, specularMap, normalMap, shininess: 25 });
let mesh: Mesh | undefined;
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
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) disposeMaterial(material);
    child.material = headMaterial;
    mesh = child;
    scene.add(mesh);
    mesh.scale.multiplyScalar(10);
    mesh.updateMatrixWorld(true);
    canvas.dataset.model = "loaded";
    canvas.dataset.state = "ready";
  },
  undefined,
  onError,
);
const raycaster = new Raycaster();
const mouse = new Vector2();
const point = new Vector3();
const orientation = new Euler();
const size = new Vector3();
const normalMatrix = new Matrix3();
let hit = false;
let moved = false;
const decals: Mesh<MeshPhongMaterial>[] = [];
function clear(): void {
  for (const decal of decals) {
    decal.removeFromParent();
    decal.geometry.dispose();
    decal.material.dispose();
  }
  decals.length = 0;
}
const params = { minScale: 10, maxScale: 20, rotate: true, clear };
const gui = new GUI();
gui.add(params, "minScale", 1, 30);
gui.add(params, "maxScale", 1, 30);
gui.add(params, "rotate");
gui.add(params, "clear");
gui.open();
function checkIntersection(x: number, y: number): void {
  if (!mesh) return;
  mouse.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouse, camera);
  const intersection = raycaster.intersectObject(mesh, false)[0];
  if (!intersection?.face) {
    hit = false;
    return;
  }
  point.copy(intersection.point);
  helper.position.copy(point);
  const end = intersection.face.normal
    .clone()
    .applyNormalMatrix(normalMatrix.getNormalMatrix(mesh.matrixWorld))
    .multiplyScalar(10)
    .add(point);
  helper.lookAt(end);
  const positions = line.geometry.attributes.position as BufferAttribute;
  positions.setXYZ(0, point.x, point.y, point.z);
  positions.setXYZ(1, end.x, end.y, end.z);
  positions.needsUpdate = true;
  hit = true;
}
function onChange(): void {
  moved = true;
}
function onDown(): void {
  moved = false;
}
function onMove(event: PointerEvent): void {
  if (event.isPrimary) checkIntersection(event.clientX, event.clientY);
}
function onUp(event: PointerEvent): void {
  if (moved || !mesh) return;
  checkIntersection(event.clientX, event.clientY);
  if (!hit) return;
  orientation.copy(helper.rotation);
  if (params.rotate) orientation.z = Math.random() * 2 * Math.PI;
  size.setScalar(params.minScale + Math.random() * (params.maxScale - params.minScale));
  const material = decalMaterial.clone();
  material.color.setHex(Math.random() * 0xffffff);
  const decal = new Mesh<MeshPhongMaterial>(new DecalGeometry(mesh, point, orientation, size), material);
  decal.renderOrder = decals.length;
  decals.push(decal);
  mesh.attach(decal);
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
controls.addEventListener("change", onChange);
window.addEventListener("pointerdown", onDown);
window.addEventListener("pointermove", onMove);
window.addEventListener("pointerup", onUp);
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  stats.update();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  manager.abort();
  controls.removeEventListener("change", onChange);
  controls.dispose();
  window.removeEventListener("pointerdown", onDown);
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerup", onUp);
  window.removeEventListener("resize", resize);
  gui.destroy();
  stats.dom.remove();
  clear();
  disposeObject(scene, [headMaterial, decalMaterial]);
  renderer.dispose();
});
