import { FirstPersonControls } from "ek3d/addons/controls/FirstPersonControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Audio } from "ek3d/audio/Audio";
import { AudioAnalyser } from "ek3d/audio/AudioAnalyser";
import { AudioListener } from "ek3d/audio/AudioListener";
import { PositionalAudio } from "ek3d/audio/PositionalAudio";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Timer } from "ek3d/core/Timer";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { FogExp2 } from "ek3d/scenes/FogExp2";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing audio sandbox canvas");
const canvas: HTMLCanvasElement = selected;
canvas.dataset.state = "waiting";
let disposed = false;
let started = false;
let starting = false;
let oscillatorStarted = false;
let frames = 0;
function report(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}
function media(base: string, loop = false): HTMLAudioElement {
  const element = document.createElement("audio");
  element.preload = "auto";
  element.loop = loop;
  for (const [extension, type] of [
    ["ogg", "audio/ogg"],
    ["mp3", "audio/mpeg"],
  ]) {
    const source = document.createElement("source");
    source.src = `/examples/sounds/${base}.${extension}`;
    source.type = type;
    element.appendChild(source);
  }
  element.addEventListener("error", () => report(element.error?.message ?? `Failed to load ${base}`));
  return element;
}
const song = media("358232_j_s_song");
const skullbeatz = media("376737_Skullbeatz___Bad_Cat_Maste");
const utopia = media("Project_Utopia", true);
const elements = [song, skullbeatz, utopia];
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 1, 10000);
camera.position.set(0, 25, 0);
const listener = new AudioListener();
camera.add(listener);
const scene = new Scene();
scene.fog = new FogExp2(0x000000, 0.0025);
const light = new DirectionalLight(0xffffff, 3);
light.position.set(0, 0.5, 1).normalize();
scene.add(light);
const geometry = new SphereGeometry(20, 32, 16);
const materials = [0xffaa00, 0xff2200, 0x6622aa].map(
  (color) => new MeshPhongMaterial({ color, flatShading: true, shininess: 0 }),
);
const sound1 = new PositionalAudio(listener);
const sound2 = new PositionalAudio(listener);
const sound3 = new PositionalAudio(listener);
sound1.setMediaElementSource(song);
sound2.setMediaElementSource(skullbeatz);
const oscillator = listener.context.createOscillator();
oscillator.type = "sine";
oscillator.frequency.setValueAtTime(144, listener.context.currentTime);
sound3.setNodeSource(oscillator);
sound3.setVolume(0.5);
const sounds = [sound1, sound2, sound3];
const positions = [
  [-250, 30, 0],
  [250, 30, 0],
  [0, 30, -250],
];
for (let i = 0; i < sounds.length; i++) {
  const mesh = new Mesh(geometry, materials[i]!);
  const position = positions[i]!;
  mesh.position.set(position[0]!, position[1]!, position[2]!);
  sounds[i]!.setRefDistance(20);
  mesh.add(sounds[i]!);
  scene.add(mesh);
}
const analysers = sounds.map((sound) => new AudioAnalyser(sound, 32));
const ambient = new Audio(listener);
ambient.setMediaElementSource(utopia);
ambient.setVolume(0.5);
const grid = new GridHelper(1000, 10, 0x444444, 0x444444);
grid.position.y = 0.1;
scene.add(grid);
const gui = new GUI();
const volume = {
  master: listener.getMasterVolume(),
  firstSphere: sound1.getVolume(),
  secondSphere: sound2.getVolume(),
  thirdSphere: sound3.getVolume(),
  Ambient: ambient.getVolume(),
};
const generator: { frequency: number; wavetype: OscillatorType } = {
  frequency: oscillator.frequency.value,
  wavetype: oscillator.type,
};
const volumeFolder = gui.addFolder("sound volume");
volumeFolder.add(volume, "master", 0, 1, 0.01).onChange(() => listener.setMasterVolume(volume.master));
volumeFolder.add(volume, "firstSphere", 0, 1, 0.01).onChange(() => sound1.setVolume(volume.firstSphere));
volumeFolder.add(volume, "secondSphere", 0, 1, 0.01).onChange(() => sound2.setVolume(volume.secondSphere));
volumeFolder.add(volume, "thirdSphere", 0, 1, 0.01).onChange(() => sound3.setVolume(volume.thirdSphere));
volumeFolder.add(volume, "Ambient", 0, 1, 0.01).onChange(() => ambient.setVolume(volume.Ambient));
volumeFolder.open();
const generatorFolder = gui.addFolder("sound generator");
generatorFolder
  .add(generator, "frequency", 50, 5000, 1)
  .onChange(() => oscillator.frequency.setValueAtTime(generator.frequency, listener.context.currentTime));
generatorFolder.add(generator, "wavetype", ["sine", "square", "sawtooth", "triangle"]).onChange(() => {
  oscillator.type = generator.wavetype;
});
generatorFolder.open();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  shaders: { MeshPhongMaterial: phongShader, LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new FirstPersonControls(camera, canvas);
controls.movementSpeed = 70;
controls.lookSpeed = 0.2;
controls.lookVertical = false;
const timer = new Timer();
timer.connect(document);
function start(): void {
  if (disposed || started || starting) return;
  starting = true;
  if (!oscillatorStarted) {
    oscillator.start();
    oscillatorStarted = true;
  }
  const resumed = listener.context.resume();
  const playback = elements.map((element) => element.play());
  void Promise.all([resumed, ...playback])
    .then(() => {
      if (disposed) return;
      started = true;
      starting = false;
      canvas.dataset.state = "playing";
      delete canvas.dataset.error;
    })
    .catch((error: unknown) => {
      starting = false;
      if (disposed) return;
      for (const element of elements) element.pause();
      void listener.context.suspend().catch(console.error);
      report(error);
    });
}
function onKey(event: KeyboardEvent): void {
  if (event.key === "Enter" || event.key === " ") start();
}
canvas.addEventListener("pointerdown", start);
window.addEventListener("keydown", onKey);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  timer.update();
  controls.update(timer.getDelta());
  for (let i = 0; i < materials.length; i++) materials[i]!.emissive.b = analysers[i]!.getAverageFrequency() / 256;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  canvas.removeEventListener("pointerdown", start);
  window.removeEventListener("keydown", onKey);
  renderer.setAnimationLoop(null);
  controls.dispose();
  timer.dispose();
  gui.destroy();
  for (const element of elements) {
    element.pause();
    for (const source of Array.from(element.children)) source.remove();
    element.removeAttribute("src");
    element.load();
  }
  if (oscillatorStarted) oscillator.stop();
  for (const analyser of analysers) analyser.analyser.disconnect();
  for (const sound of [...sounds, ambient]) {
    sound.disconnect();
    sound.gain.disconnect();
  }
  for (const sound of sounds) sound.panner.disconnect();
  listener.gain.disconnect();
  void listener.context.close().catch(console.error);
  disposeObject(scene);
  renderer.dispose();
});
