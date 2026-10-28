import { Stats } from "ek3d/addons/libs/Stats";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { TorusGeometry } from "ek3d/geometries/TorusGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing render-to-texture canvas");
const canvas: HTMLCanvasElement = selected;
const vertexShader = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const fragmentShader = `varying vec2 vUv;
uniform float time;
void main() {
  float r = vUv.x;
  if (vUv.y < 0.5) r = 0.0;
  float g = vUv.y;
  if (vUv.x < 0.5) g = 0.0;
  gl_FragColor = vec4(r, g, time, 1.0);
}`;
const screenShader = `varying vec2 vUv;
uniform sampler2D tDiffuse;
void main() {
  gl_FragColor = texture2D(tDiffuse, vUv);
  #include <colorspace_fragment>
}`;
const camera = new PerspectiveCamera(30, innerWidth / innerHeight, 1, 10000);
camera.position.z = 100;
const cameraRTT = new OrthographicCamera(-innerWidth / 2, innerWidth / 2, innerHeight / 2, -innerHeight / 2, 1, 1000);
cameraRTT.position.z = 500;
const scene = new Scene();
const sceneRTT = new Scene();
const sceneScreen = new Scene();
const light1 = new DirectionalLight(0xffffff, 3);
light1.position.set(0, 0, 1).normalize();
sceneRTT.add(light1);
const light2 = new DirectionalLight(0xffd5d5, 4.5);
light2.position.set(0, 0, -1).normalize();
sceneRTT.add(light2);
const target = new WebGLRenderTarget(innerWidth, innerHeight);
const material = new ShaderMaterial({ uniforms: { time: { value: 0 } }, vertexShader, fragmentShader });
const materialScreen = new ShaderMaterial({
  uniforms: { tDiffuse: { value: target.texture } },
  vertexShader,
  fragmentShader: screenShader,
  depthWrite: false,
});
let plane = new PlaneGeometry(innerWidth, innerHeight);
const quad = new Mesh(plane, material);
quad.position.z = -100;
sceneRTT.add(quad);
const torus = new TorusGeometry(100, 25, 15, 30);
const zmesh1 = new Mesh(torus, new MeshPhongMaterial({ color: 0x9c9c9c, specular: 0xffaa00, shininess: 5 }));
zmesh1.position.set(0, 0, 100);
zmesh1.scale.set(1.5, 1.5, 1.5);
sceneRTT.add(zmesh1);
const zmesh2 = new Mesh(torus, new MeshPhongMaterial({ color: 0x9c0000, specular: 0xff2200, shininess: 5 }));
zmesh2.position.set(0, 150, 100);
zmesh2.scale.set(0.75, 0.75, 0.75);
sceneRTT.add(zmesh2);
const screenQuad = new Mesh(plane, materialScreen);
screenQuad.position.z = -100;
sceneScreen.add(screenQuad);
const sphere = new SphereGeometry(10, 64, 32);
const sphereMaterial = new MeshBasicMaterial({ color: 0xffffff, map: target.texture });
for (let j = 0; j < 5; j++) {
  for (let i = 0; i < 5; i++) {
    const mesh = new Mesh(sphere, sphereMaterial);
    mesh.position.set((i - 2) * 20, (j - 2) * 20, 0);
    mesh.rotation.y = -Math.PI / 2;
    scene.add(mesh);
  }
}
const renderer = new WebGLRenderer({
  canvas,
  shaders: { MeshBasicMaterial: basicShader, MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
const stats = new Stats();
document.body.appendChild(stats.dom);
let mouseX = 0,
  mouseY = 0,
  delta = 0.01;
function mouseMove(event: MouseEvent): void {
  mouseX = event.clientX - innerWidth / 2;
  mouseY = event.clientY - innerHeight / 2;
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  cameraRTT.left = -innerWidth / 2;
  cameraRTT.right = innerWidth / 2;
  cameraRTT.top = innerHeight / 2;
  cameraRTT.bottom = -innerHeight / 2;
  cameraRTT.updateProjectionMatrix();
  target.setSize(innerWidth, innerHeight);
  plane.dispose();
  plane = new PlaneGeometry(innerWidth, innerHeight);
  quad.geometry = screenQuad.geometry = plane;
  renderer.setSize(innerWidth, innerHeight);
}
function animate(): void {
  const time = Date.now() * 0.0015;
  camera.position.x += (mouseX - camera.position.x) * 0.05;
  camera.position.y += (-mouseY - camera.position.y) * 0.05;
  camera.lookAt(scene.position);
  zmesh1.rotation.y = -time;
  zmesh2.rotation.y = -time + Math.PI / 2;
  if (material.uniforms.time.value > 1 || material.uniforms.time.value < 0) delta *= -1;
  material.uniforms.time.value += delta;
  renderer.setRenderTarget(target);
  renderer.clear();
  renderer.render(sceneRTT, cameraRTT);
  renderer.setRenderTarget(null);
  renderer.clear();
  renderer.render(sceneScreen, cameraRTT);
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.state = "rendered";
}
document.addEventListener("mousemove", mouseMove);
window.addEventListener("resize", resize);
renderer.setAnimationLoop(animate);
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  document.removeEventListener("mousemove", mouseMove);
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  stats.dom.remove();
  sceneRTT.add(sceneScreen, scene);
  disposeObject(sceneRTT);
  target.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
