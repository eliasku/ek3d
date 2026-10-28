import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SRGBColorSpace } from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import { VideoTexture } from "ek3d/textures/VideoTexture";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing webcam canvas");
const canvas = selected;
const video = document.createElement("video");
video.muted = true;
video.playsInline = true;
const texture = new VideoTexture(video);
texture.colorSpace = SRGBColorSpace;
const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 0.01;
const scene = new Scene();
const geometry = new PlaneGeometry(16, 9);
geometry.scale(0.5, 0.5, 0.5);
const material = new MeshBasicMaterial({ map: texture });
for (let i = 1; i <= 128; i++) {
  const phi = Math.acos(-1 + (2 * i) / 128);
  const theta = Math.sqrt(128 * Math.PI) * phi;
  const mesh = new Mesh(geometry, material);
  mesh.position.setFromSphericalCoords(32, phi, theta);
  mesh.lookAt(camera.position);
  scene.add(mesh);
}
const renderer = new WebGLRenderer({ canvas, antialias: true, shaders: { MeshBasicMaterial: basicShader } });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.enableZoom = false;
controls.enablePan = false;
let disposed = false;
let stream: MediaStream | undefined;
let pending = false;
let frames = 0;
canvas.dataset.state = "loading";
function fail(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(error);
  console.error(error);
}
async function start(): Promise<void> {
  if (disposed || pending) return;
  pending = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("MediaDevices interface not available");
    const acquired = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: "user" },
    });
    if (disposed) {
      for (const track of acquired.getTracks()) track.stop();
      return;
    }
    stream = acquired;
    video.srcObject = stream;
    await video.play();
    if (!disposed) canvas.dataset.state = "rendered";
  } catch (error) {
    fail(error);
  } finally {
    pending = false;
  }
}
void start();
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
});
function retry(): void {
  if (!stream) {
    void start();
    return;
  }
  if (stream && !disposed)
    void video
      .play()
      .then(() => {
        if (!disposed) canvas.dataset.state = "rendered";
      })
      .catch(fail);
}
canvas.addEventListener("click", retry);
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
  video.pause();
  for (const track of stream?.getTracks() ?? []) track.stop();
  video.srcObject = null;
  canvas.removeEventListener("click", retry);
  controls.dispose();
  disposeObject(scene);
  renderer.dispose();
});
