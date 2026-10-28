import { BloomPass } from "ek3d/addons/postprocessing/BloomPass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ColorSpace } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { Scene } from "ek3d/scenes/Scene";
import { VideoTexture } from "ek3d/textures/VideoTexture";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing video canvas");
const canvas = selected;
const video = document.createElement("video");
video.loop = true;
video.muted = true;
video.playsInline = true;
for (const [src, type] of [
  ["/examples/textures/sintel.ogv", 'video/ogg; codecs="theora, vorbis"'],
  ["/examples/textures/sintel.mp4", 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'],
]) {
  const source = document.createElement("source");
  source.src = src;
  source.type = type;
  video.appendChild(source);
}
const texture = new VideoTexture(video);
texture.colorSpace = ColorSpace.SRGB;
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 10000);
camera.position.z = 500;
const scene = new Scene();
const light = new DirectionalLight(0xffffff, 3);
light.position.set(0.5, 1, 1).normalize();
scene.add(light);
const tiles: { mesh: Mesh; material: MeshLambertMaterial; hue: number; saturation: number; dx: number; dy: number }[] =
  [];
for (let i = 0; i < 20; i++) {
  for (let j = 0; j < 10; j++) {
    const geometry = new BoxGeometry(24, 20.4, 24);
    const uv = geometry.attributes.uv;
    if (!(uv instanceof BufferAttribute)) throw new Error("Missing video tile UV coordinates");
    for (let n = 0; n < uv.count; n++) uv.setXY(n, (uv.getX(n) + i) / 20, (uv.getY(n) + j) / 10);
    const material = new MeshLambertMaterial({ color: 0xffffff, map: texture });
    const hue = i / 20,
      saturation = 1 - j / 10;
    material.color.setHSL(hue, saturation, 0.5);
    const mesh = new Mesh(geometry, material);
    mesh.position.set((i - 10) * 24, (j - 5) * 20.4, 0);
    scene.add(mesh);
    tiles.push({
      mesh,
      material,
      hue,
      saturation,
      dx: 0.001 * (0.5 - Math.random()),
      dy: 0.001 * (0.5 - Math.random()),
    });
  }
}
const renderer = new WebGLRenderer({ canvas, shaders: { MeshLambertMaterial: lambertShader } });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera),
  bloom = new BloomPass(1.3),
  output = new OutputPass();
composer.addPass(renderPass);
composer.addPass(bloom);
composer.addPass(output);
let disposed = false,
  frames = 0,
  counter = 1,
  mouseX = 0,
  mouseY = 0;
canvas.dataset.state = "loading";
function fail(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(error);
  console.error(error);
}
function play(): void {
  void video
    .play()
    .then(() => {
      if (!disposed) canvas.dataset.state = "rendered";
    })
    .catch(fail);
}
function onPlay(): void {
  video.currentTime = 3;
}
function mediaError(): void {
  fail(video.error?.message ?? "Unable to load Sintel video");
}
video.addEventListener("play", onPlay);
video.addEventListener("error", mediaError);
canvas.addEventListener("click", play);
play();
function move(event: MouseEvent): void {
  mouseX = event.clientX - innerWidth / 2;
  mouseY = (event.clientY - innerHeight / 2) * 0.3;
}
window.addEventListener("mousemove", move);
renderer.setAnimationLoop(() => {
  camera.position.x += (mouseX - camera.position.x) * 0.05;
  camera.position.y += (-mouseY - camera.position.y) * 0.05;
  camera.lookAt(scene.position);
  const time = Date.now() * 0.00005;
  for (const tile of tiles) {
    tile.material.color.setHSL(((360 * (tile.hue + time)) % 360) / 360, tile.saturation, 0.5);
    if (counter % 1000 > 200) {
      tile.mesh.rotation.x += 10 * tile.dx;
      tile.mesh.rotation.y += 10 * tile.dy;
      tile.mesh.position.x -= 150 * tile.dx;
      tile.mesh.position.y += 150 * tile.dy;
      tile.mesh.position.z += 300 * tile.dx;
    }
    if (counter % 1000 === 0) {
      tile.dx *= -1;
      tile.dy *= -1;
    }
  }
  counter++;
  renderer.clear();
  composer.render();
  canvas.dataset.frames = String(++frames);
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
  window.removeEventListener("mousemove", move);
  canvas.removeEventListener("click", play);
  video.removeEventListener("play", onPlay);
  video.removeEventListener("error", mediaError);
  renderer.setAnimationLoop(null);
  video.pause();
  video.replaceChildren();
  video.load();
  disposeObject(scene);
  bloom.dispose();
  output.dispose();
  composer.dispose();
  renderer.dispose();
});
