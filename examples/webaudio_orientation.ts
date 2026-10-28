import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { PositionalAudioHelper } from "ek3d/addons/helpers/PositionalAudioHelper";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { AudioListener } from "ek3d/audio/AudioListener";
import { PositionalAudio } from "ek3d/audio/PositionalAudio";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { CubeTextureLoader } from "ek3d/loaders/CubeTextureLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing audio orientation canvas");
const canvas: HTMLCanvasElement = selected;
canvas.dataset.state = "waiting";
let disposed = false;
let started = false;
let loading = false;
let failed = false;
let frames = 0;
function report(error: unknown): void {
  if (disposed) return;
  failed = true;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}

const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(3, 2, 3);
const scene = new Scene();
scene.background = new Color(0xa0a0a0);
scene.fog = new Fog(0xa0a0a0, 2, 20);
const hemi = new HemisphereLight(0xffffff, 0x8d8d8d, 3);
hemi.position.set(0, 20, 0);
scene.add(hemi);
const light = new DirectionalLight(0xffffff, 3);
light.position.set(5, 5, 0);
light.castShadow = true;
light.shadow.camera.top = 1;
light.shadow.camera.bottom = -1;
light.shadow.camera.left = -1;
light.shadow.camera.right = 1;
light.shadow.camera.near = 0.1;
light.shadow.camera.far = 20;
scene.add(light);
const ground = new Mesh(new PlaneGeometry(50, 50), new MeshPhongMaterial({ color: 0xcbcbcb, depthWrite: false }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground, new GridHelper(50, 50, 0xc1c1c1, 0xc1c1c1));
const wall = new Mesh(
  new BoxGeometry(2, 1, 0.1),
  new MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 }),
);
wall.position.set(0, 0.5, -0.5);
scene.add(wall);

const dfg = createDFGLUT();
const ltc = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  createShadowMap: WebGLShadowMap,
  getDFGLUT: () => dfg,
  ltcTextures: ltc,
  shaders: {
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
    MeshPhongMaterial: phongShader,
    MeshStandardMaterial: standardShader,
    MeshDepthMaterial: depthShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
if (renderer.shadowMap === null) throw new Error("Shadow map system unavailable");
renderer.shadowMap.enabled = true;
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.1, 0);
controls.minDistance = 0.5;
controls.maxDistance = 10;
controls.maxPolarAngle = Math.PI / 2;
controls.update();
const listener = new AudioListener();
camera.add(listener);
const music = document.createElement("audio");
music.loop = true;
music.preload = "auto";
for (const [file, type] of [
  ["376737_Skullbeatz___Bad_Cat_Maste.ogg", "audio/ogg"],
  ["376737_Skullbeatz___Bad_Cat_Maste.mp3", "audio/mpeg"],
]) {
  const source = document.createElement("source");
  source.src = `/examples/sounds/${file}`;
  source.type = type;
  music.appendChild(source);
}
const audio = new PositionalAudio(listener);
audio.setMediaElementSource(music);
audio.setRefDistance(1);
audio.setDirectionalCone(180, 230, 0.1);
audio.add(new PositionalAudioHelper(audio, 0.1));
const reflection = new CubeTextureLoader()
  .setPath("/examples/textures/cube/SwedishRoyalCastle/")
  .load(["px.jpg", "nx.jpg", "py.jpg", "ny.jpg", "pz.jpg", "nz.jpg"], undefined, undefined, report);
new GLTFLoader().load(
  "/examples/models/gltf/BoomBox.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    const box = gltf.scene;
    box.position.set(0, 0.2, 0);
    box.scale.set(20, 20, 20);
    box.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (material instanceof MeshStandardMaterial) material.envMap = reflection;
      object.geometry.rotateY(-Math.PI);
      object.castShadow = true;
    });
    box.add(audio);
    scene.add(box);
    canvas.dataset.model = "loaded";
  },
  undefined,
  report,
);

function start(): void {
  if (disposed || started || loading) return;
  loading = true;
  const resumed = listener.context.resume();
  const playing = music.play();
  void Promise.all([resumed, playing])
    .then(() => {
      if (disposed) return;
      started = true;
      loading = false;
      if (!failed) canvas.dataset.state = "playing";
    })
    .catch((error: unknown) => {
      loading = false;
      report(error);
    });
}
function onKey(event: KeyboardEvent): void {
  if (event.key === "Enter" || event.key === " ") start();
}
canvas.addEventListener("pointerdown", start);
window.addEventListener("keydown", onKey);
music.addEventListener("error", () => report(music.error?.message ?? "Audio failed to load"));
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
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
  music.pause();
  music.removeAttribute("src");
  for (const source of Array.from(music.children)) source.remove();
  music.load();
  audio.disconnect();
  audio.panner.disconnect();
  audio.gain.disconnect();
  listener.gain.disconnect();
  void listener.context.close().catch(console.error);
  audio.removeFromParent();
  disposeObject(audio);
  disposeObject(scene);
  reflection.dispose();
  dfg.dispose();
  for (const texture of Object.values(ltc)) texture.dispose();
  renderer.dispose();
});
