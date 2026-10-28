import { Audio } from "ek3d/audio/Audio";
import { AudioAnalyser } from "ek3d/audio/AudioAnalyser";
import { AudioListener } from "ek3d/audio/AudioListener";
import { Camera } from "ek3d/cameras/Camera";
import { RedFormat } from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { AudioLoader } from "ek3d/loaders/AudioLoader";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { DataTexture } from "ek3d/textures/DataTexture";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing visualizer canvas");
const canvas: HTMLCanvasElement = selected;
const info = document.createElement("div");
info.style.cssText =
  "position:absolute;top:12px;left:0;width:100%;text-align:center;color:white;font:14px sans-serif;pointer-events:none";
info.innerHTML =
  'Click canvas or press Enter to play<br>Music by <a style="color:white;pointer-events:auto" href="https://www.newgrounds.com/audio/listen/376737">skullbeatz</a>';
document.body.appendChild(info);
const scene = new Scene();
const camera = new Camera();
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight);
}
resize();
window.addEventListener("resize", resize);
let listener: AudioListener | undefined;
let audio: Audio | undefined;
let analyser: AudioAnalyser | undefined;
let media: HTMLAudioElement | undefined;
let texture: DataTexture | undefined;
let geometry: PlaneGeometry | undefined;
let material: ShaderMaterial | undefined;
let disposed = false;
let started = false;
let frames = 0;
canvas.dataset.state = "waiting";
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
  audio = new Audio(listener);
  void listener.context.resume().catch(fail);
  const file = "/examples/sounds/376737_Skullbeatz___Bad_Cat_Maste.mp3";
  if (/(iPad|iPhone|iPod)/.test(navigator.userAgent)) {
    new AudioLoader().load(
      file,
      (buffer) => {
        if (disposed || !audio) return;
        audio.setBuffer(buffer);
        audio.play();
      },
      undefined,
      fail,
    );
  } else {
    media = new globalThis.Audio(file);
    audio.setMediaElementSource(media);
    void media.play().catch(fail);
  }
  analyser = new AudioAnalyser(audio, 128);
  texture = new DataTexture(analyser.data, 64, 1, RedFormat);
  material = new ShaderMaterial({
    uniforms: { tAudioData: { value: texture } },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tAudioData;
      varying vec2 vUv;
      void main() {
        vec3 backgroundColor = vec3(0.125, 0.125, 0.125);
        vec3 color = vec3(1.0, 1.0, 0.0);
        float f = texture2D(tAudioData, vec2(vUv.x, 0.0)).r;
        float i = step(vUv.y, f) * step(f - 0.0125, vUv.y);
        gl_FragColor = vec4(mix(backgroundColor, color, i), 1.0);
      }`,
  });
  geometry = new PlaneGeometry(1, 1);
  scene.add(new Mesh(geometry, material));
  info.innerHTML =
    'Music by <a style="color:white;pointer-events:auto" href="https://www.newgrounds.com/audio/listen/376737">skullbeatz</a>';
  renderer.setAnimationLoop(() => {
    if (!analyser || !texture) return;
    analyser.getFrequencyData();
    texture.needsUpdate = true;
    renderer.render(scene, camera);
    canvas.dataset.frames = String(++frames);
    if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  });
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
  if (media) {
    media.pause();
    media.removeAttribute("src");
    media.load();
  }
  if (audio) {
    if (audio.isPlaying) audio.stop();
    audio.source?.disconnect();
    audio.gain.disconnect();
  }
  analyser?.analyser.disconnect();
  if (listener) {
    listener.gain.disconnect();
    void listener.context.close();
  }
  texture?.dispose();
  geometry?.dispose();
  material?.dispose();
  renderer.dispose();
  info.remove();
});
