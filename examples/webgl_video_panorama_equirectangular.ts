import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SRGBColorSpace } from "ek3d/constants";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import { VideoTexture } from "ek3d/textures/VideoTexture";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing panorama canvas");
const canvas = selected;
const video = document.createElement("video");
video.loop = true;
video.muted = true;
video.playsInline = true;
for (const [src, type] of [
  ["/examples/textures/pano.webm", "video/webm"],
  ["/examples/textures/pano.mp4", "video/mp4"],
]) {
  const source = document.createElement("source");
  source.src = src;
  source.type = type;
  video.appendChild(source);
}
const texture = new VideoTexture(video);
texture.colorSpace = SRGBColorSpace;
const camera = new PerspectiveCamera(75, innerWidth / innerHeight, 0.25, 10);
const scene = new Scene();
const geometry = new SphereGeometry(5, 60, 40);
geometry.scale(-1, 1, 1);
scene.add(new Mesh(geometry, new MeshBasicMaterial({ map: texture })));
const renderer = new WebGLRenderer({ canvas, shaders: { MeshBasicMaterial: basicShader } });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
let disposed = false;
let frames = 0;
let lon = 0,
  lat = 0,
  downX = 0,
  downY = 0,
  downLon = 0,
  downLat = 0,
  dragging = false;
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
function mediaError(): void {
  fail(video.error?.message ?? "Unable to load panorama video");
}
video.addEventListener("error", mediaError);
function pointerDown(event: PointerEvent): void {
  dragging = true;
  downX = event.clientX;
  downY = event.clientY;
  downLon = lon;
  downLat = lat;
  play();
}
function pointerMove(event: PointerEvent): void {
  if (!dragging) return;
  lon = (downX - event.clientX) * 0.1 + downLon;
  lat = (downY - event.clientY) * 0.1 + downLat;
}
function pointerUp(): void {
  dragging = false;
}
canvas.addEventListener("pointerdown", pointerDown);
window.addEventListener("pointermove", pointerMove);
window.addEventListener("pointerup", pointerUp);
play();
renderer.setAnimationLoop(() => {
  lat = Math.max(-85, Math.min(85, lat));
  const phi = ((90 - lat) * Math.PI) / 180,
    theta = (lon * Math.PI) / 180;
  camera.position.set(
    0.5 * Math.sin(phi) * Math.cos(theta),
    0.5 * Math.cos(phi),
    0.5 * Math.sin(phi) * Math.sin(theta),
  );
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
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
  canvas.removeEventListener("pointerdown", pointerDown);
  window.removeEventListener("pointermove", pointerMove);
  window.removeEventListener("pointerup", pointerUp);
  video.removeEventListener("error", mediaError);
  renderer.setAnimationLoop(null);
  video.pause();
  video.removeAttribute("src");
  video.replaceChildren();
  video.load();
  disposeObject(scene);
  renderer.dispose();
});
