import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { AudioListener } from "ek3d/audio/AudioListener";
import { PositionalAudio } from "ek3d/audio/PositionalAudio";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Timer } from "ek3d/core/Timer";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { AudioLoader } from "ek3d/loaders/AudioLoader";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { Scene } from "ek3d/scenes/Scene";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing timing canvas");
const canvas: HTMLCanvasElement = selected;
const info = document.createElement("div");
info.style.cssText =
  "position:absolute;top:12px;left:0;width:100%;text-align:center;color:white;font:14px sans-serif;pointer-events:none";
info.innerHTML =
  'Click canvas or press Enter to play<br>Sound effect by <a style="color:white;pointer-events:auto" href="https://freesound.org/people/michorvath/sounds/269718/">michorvath</a>';
document.body.appendChild(info);
const scene = new Scene();
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(7, 3, 7);
scene.add(camera, new AmbientLight(0xcccccc));
const light = new DirectionalLight(0xffffff, 2.5);
light.position.set(0, 5, 5);
light.castShadow = true;
light.shadow.camera.left = -5;
light.shadow.camera.right = 5;
light.shadow.camera.top = 5;
light.shadow.camera.bottom = -5;
light.shadow.camera.near = 1;
light.shadow.camera.far = 20;
light.shadow.mapSize.set(1024, 1024);
scene.add(light);
const floorGeometry = new PlaneGeometry(10, 10);
const floorMaterial = new MeshLambertMaterial({ color: 0x4676b6 });
const floor = new Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const ballGeometry = new SphereGeometry(0.3, 32, 16);
ballGeometry.translate(0, 0.3, 0);
const ballMaterial = new MeshLambertMaterial({ color: 0xcccccc });
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createShadowMap: WebGLShadowMap,
  shaders: { MeshLambertMaterial: lambertShader, MeshDepthMaterial: depthShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
if (!renderer.shadowMap) throw new Error("Shadow map system unavailable");
renderer.shadowMap.enabled = true;
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 1;
controls.maxDistance = 25;
const timer = new Timer();
timer.connect(document);
const balls: { mesh: Mesh; audio: PositionalAudio; down: boolean }[] = [];
let listener: AudioListener | undefined;
let started = false;
let disposed = false;
let frames = 0;
canvas.dataset.state = "waiting";
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
resize();
window.addEventListener("resize", resize);
renderer.render(scene, camera);
function fail(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  info.textContent = `Audio failed: ${canvas.dataset.error}`;
  console.error(error);
}
function start(): void {
  if (started || disposed) return;
  started = true;
  canvas.dataset.state = "loading";
  listener = new AudioListener();
  camera.add(listener);
  void listener.context.resume().catch(fail);
  new AudioLoader().load(
    "/examples/sounds/ping_pong.mp3",
    (buffer) => {
      if (disposed || !listener) return;
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const mesh = new Mesh(ballGeometry, ballMaterial);
        mesh.castShadow = true;
        mesh.position.set(3 * Math.cos(angle), 0, 3 * Math.sin(angle));
        const audio = new PositionalAudio(listener);
        audio.setBuffer(buffer);
        mesh.add(audio);
        scene.add(mesh);
        balls.push({ mesh, audio, down: false });
      }
      if (canvas.dataset.state !== "error")
        info.innerHTML =
          'Sound effect by <a style="color:white;pointer-events:auto" href="https://freesound.org/people/michorvath/sounds/269718/">michorvath</a>';
      renderer.setAnimationLoop(() => {
        timer.update();
        const time = timer.getElapsed();
        for (let i = 0; i < balls.length; i++) {
          const ball = balls[i]!;
          const previous = ball.mesh.position.y;
          ball.mesh.position.y = Math.abs(Math.sin(i * 0.5 + time * 2.5) * 3);
          if (ball.mesh.position.y < previous) ball.down = true;
          else if (ball.down) {
            ball.audio.play();
            ball.down = false;
          }
        }
        renderer.render(scene, camera);
        canvas.dataset.frames = String(++frames);
        if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
      });
    },
    undefined,
    fail,
  );
}
function keydown(event: KeyboardEvent): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    start();
  }
}
canvas.addEventListener("click", start);
window.addEventListener("keydown", keydown);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  canvas.removeEventListener("click", start);
  window.removeEventListener("keydown", keydown);
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  timer.dispose();
  for (const { audio } of balls) {
    if (audio.isPlaying) audio.stop();
    audio.source?.disconnect();
    audio.getOutput().disconnect();
    audio.gain.disconnect();
  }
  if (listener) {
    listener.gain.disconnect();
    void listener.context.close();
  }
  floorGeometry.dispose();
  floorMaterial.dispose();
  ballGeometry.dispose();
  ballMaterial.dispose();
  light.shadow.dispose();
  renderer.dispose();
  info.remove();
});
