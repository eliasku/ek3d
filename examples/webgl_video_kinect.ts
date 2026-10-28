import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { AdditiveBlending, NearestFilter } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Vector3 } from "ek3d/math/Vector3";
import { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { VideoTexture } from "ek3d/textures/VideoTexture";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing Kinect canvas");
const canvas = selected;
const video = document.createElement("video");
video.loop = true;
video.muted = true;
video.playsInline = true;
for (const [src, type] of [
  ["/examples/textures/kinect.webm", "video/webm"],
  ["/examples/textures/kinect.mp4", "video/mp4"],
]) {
  const source = document.createElement("source");
  source.src = src;
  source.type = type;
  video.appendChild(source);
}
const texture = new VideoTexture(video);
texture.minFilter = NearestFilter;
texture.generateMipmaps = false;
const width = 640,
  height = 480;
const geometry = new BufferGeometry();
const vertices = new Float32Array(width * height * 3);
for (let i = 0, j = 0; i < vertices.length; i += 3, j++) {
  vertices[i] = j % width;
  vertices[i + 1] = Math.floor(j / width);
}
geometry.setAttribute("position", new BufferAttribute(vertices, 3));
const uniforms = {
  map: { value: texture },
  width: { value: width },
  height: { value: height },
  nearClipping: { value: 850 },
  farClipping: { value: 4000 },
  pointSize: { value: 2 },
  zOffset: { value: 1000 },
};
const material = new ShaderMaterial({
  uniforms,
  vertexShader: `uniform sampler2D map;
uniform float width, height, nearClipping, farClipping, pointSize, zOffset;
varying vec2 vUv;
void main() {
  vUv = vec2(position.x / width, position.y / height);
  vec4 color = texture2D(map, vUv);
  float depth = (color.r + color.g + color.b) / 3.0;
  float z = (1.0 - depth) * (farClipping - nearClipping) + nearClipping;
  vec4 pos = vec4((position.x / width - 0.5) * z * 1.11146, (position.y / height - 0.5) * z * 0.83359, -z + zOffset, 1.0);
  gl_PointSize = pointSize;
  gl_Position = projectionMatrix * modelViewMatrix * pos;
}`,
  fragmentShader: `uniform sampler2D map;
varying vec2 vUv;
void main() {
  vec4 color = texture2D(map, vUv);
  gl_FragColor = vec4(color.r, color.g, color.b, 0.2);
}`,
  blending: AdditiveBlending,
  depthTest: false,
  depthWrite: false,
  transparent: true,
});
const scene = new Scene();
scene.add(new Points(geometry, material));
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 1, 10000);
camera.position.z = 500;
const center = new Vector3(0, 0, -1000),
  mouse = new Vector3(0, 0, 1);
const renderer = new WebGLRenderer({ canvas });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const gui = new GUI();
gui.add(uniforms.nearClipping, "value", 1, 10000, 1).name("nearClipping");
gui.add(uniforms.farClipping, "value", 1, 10000, 1).name("farClipping");
gui.add(uniforms.pointSize, "value", 1, 10, 1).name("pointSize");
gui.add(uniforms.zOffset, "value", 0, 4000, 1).name("zOffset");
let disposed = false,
  frames = 0;
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
  fail(video.error?.message ?? "Unable to load Kinect video");
}
video.addEventListener("error", mediaError);
canvas.addEventListener("click", play);
play();
function move(event: MouseEvent): void {
  mouse.x = (event.clientX - innerWidth / 2) * 8;
  mouse.y = (event.clientY - innerHeight / 2) * 8;
}
window.addEventListener("mousemove", move);
renderer.setAnimationLoop(() => {
  camera.position.x += (mouse.x - camera.position.x) * 0.05;
  camera.position.y += (-mouse.y - camera.position.y) * 0.05;
  camera.lookAt(center);
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
  window.removeEventListener("mousemove", move);
  canvas.removeEventListener("click", play);
  video.removeEventListener("error", mediaError);
  renderer.setAnimationLoop(null);
  video.pause();
  video.replaceChildren();
  video.load();
  gui.destroy();
  disposeObject(scene);
  texture.dispose();
  renderer.dispose();
});
