import { TrackballControls } from "ek3d/addons/controls/TrackballControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { mergeGeometries } from "ek3d/addons/utils/BufferGeometryUtils";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { GLSL, TextureType, PixelFormat } from "ek3d/constants";
import { Float32BufferAttribute, Int16BufferAttribute } from "ek3d/core/BufferAttribute";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Color } from "ek3d/math/Color";
import { Euler } from "ek3d/math/Euler";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Quaternion } from "ek3d/math/Quaternion";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing GPU picking canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 1, 10000);
camera.position.z = 1000;
const scene = new Scene();
scene.background = new Color(0xffffff);
scene.add(new AmbientLight(0xcccccc));
const light = new DirectionalLight(0xffffff, 3);
light.position.set(0, 500, 2000);
scene.add(light);
const pickingScene = new Scene();
const target = new WebGLRenderTarget(1, 1, {
  type: TextureType.Int,
  format: PixelFormat.RGBAInteger,
  internalFormat: "RGBA32I",
});
const pickingMaterial = new ShaderMaterial({
  glslVersion: GLSL.GLSL3,
  vertexShader: `attribute int id;
flat varying int vid;
void main() { vid = id; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `layout(location = 0) out int out_id;
flat varying int vid;
void main() { out_id = vid; }`,
});
const geometries: BoxGeometry[] = [];
const data: { position: Vector3; rotation: Euler; scale: Vector3 }[] = [];
const matrix = new Matrix4(),
  quaternion = new Quaternion(),
  color = new Color();
for (let i = 0; i < 5000; i++) {
  const geometry = new BoxGeometry();
  const position = new Vector3(Math.random() * 10000 - 5000, Math.random() * 6000 - 3000, Math.random() * 8000 - 4000);
  const rotation = new Euler(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI);
  const scale = new Vector3(Math.random() * 200 + 100, Math.random() * 200 + 100, Math.random() * 200 + 100);
  matrix.compose(position, quaternion.setFromEuler(rotation), scale);
  geometry.applyMatrix4(matrix);
  color.setHex(Math.random() * 0xffffff);
  const attribute = geometry.getAttribute("position");
  if (!attribute) throw new Error("Missing box positions");
  const count = attribute.count;
  const colors = new Float32Array(count * 3),
    ids = new Int16Array(count);
  for (let j = 0; j < count; j++) {
    colors[j * 3] = color.r;
    colors[j * 3 + 1] = color.g;
    colors[j * 3 + 2] = color.b;
  }
  ids.fill(i);
  const id = new Int16BufferAttribute(ids, 1);
  id.gpuType = TextureType.Int;
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setAttribute("id", id);
  geometries.push(geometry);
  data.push({ position, rotation, scale });
}
const merged = mergeGeometries(geometries);
for (const geometry of geometries) geometry.dispose();
if (!merged) throw new Error("Could not merge picking geometry");
scene.add(
  new Mesh(merged, new MeshPhongMaterial({ color: 0xffffff, flatShading: true, vertexColors: true, shininess: 0 })),
);
pickingScene.add(new Mesh(merged, pickingMaterial));
const highlight = new Mesh(new BoxGeometry(), new MeshLambertMaterial({ color: 0xffff00 }));
scene.add(highlight);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  shaders: { MeshPhongMaterial: phongShader, MeshLambertMaterial: lambertShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new TrackballControls(camera, canvas);
controls.rotateSpeed = 1;
controls.zoomSpeed = 1.2;
controls.panSpeed = 0.8;
controls.noZoom = false;
controls.noPan = false;
controls.staticMoving = true;
controls.dynamicDampingFactor = 0.3;
const stats = new Stats();
document.body.appendChild(stats.dom);
const pointer = new Vector2(),
  offset = new Vector3(10, 10, 10),
  clearColor = new Color();
let disposed = false,
  sequence = 0,
  frames = 0,
  pending = false;
function pointerMove(event: PointerEvent): void {
  pointer.set(event.clientX, event.clientY);
  sequence++;
}
canvas.addEventListener("pointermove", pointerMove);
function pick(): void {
  if (pending) return;
  pending = true;
  const id = sequence;
  camera.setViewOffset(
    canvas.width,
    canvas.height,
    Math.floor(pointer.x * devicePixelRatio),
    Math.floor(pointer.y * devicePixelRatio),
    1,
    1,
  );
  renderer.setRenderTarget(target);
  renderer.setClearColor(clearColor.setRGB(-1, -1, -1));
  renderer.render(pickingScene, camera);
  renderer.setRenderTarget(null);
  camera.clearViewOffset();
  const pixels = new Int32Array(4);
  renderer
    .readRenderTargetPixelsAsync(target, 0, 0, 1, 1, pixels)
    .then(() => {
      if (disposed || id !== sequence) return;
      const hit = data[pixels[0]];
      if (hit) {
        highlight.position.copy(hit.position);
        highlight.rotation.copy(hit.rotation);
        highlight.scale.copy(hit.scale).add(offset);
        highlight.visible = true;
      } else highlight.visible = false;
    })
    .catch((cause: unknown) => {
      if (!disposed) {
        canvas.dataset.state = "error";
        console.error(cause);
      }
    })
    .finally(() => {
      pending = false;
    });
}
renderer.setAnimationLoop(() => {
  controls.update();
  pick();
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  controls.handleResize();
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  disposed = true;
  sequence++;
  window.removeEventListener("resize", resize);
  canvas.removeEventListener("pointermove", pointerMove);
  renderer.setAnimationLoop(null);
  controls.dispose();
  stats.dom.remove();
  pickingMaterial.dispose();
  target.dispose();
  disposeObject(scene);
  renderer.dispose();
});
