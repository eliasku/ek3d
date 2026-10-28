import { Stats } from "ek3d/addons/libs/Stats";
import { OBJLoader } from "ek3d/addons/loaders/OBJLoader";
import { BloomPass } from "ek3d/addons/postprocessing/BloomPass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { FilmPass } from "ek3d/addons/postprocessing/FilmPass";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { ShaderPass } from "ek3d/addons/postprocessing/ShaderPass";
import { FocusShader } from "ek3d/addons/shaders/FocusShader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BufferUsage } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Object3D } from "ek3d/core/Object3D";
import { Timer } from "ek3d/core/Timer";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { FogExp2 } from "ek3d/scenes/FogExp2";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing dynamic points canvas");
const canvas = selected;
let disposed = false,
  frames = 0,
  pending = 2;
canvas.dataset.state = "loading";
const camera = new PerspectiveCamera(20, innerWidth / innerHeight, 1, 50000);
camera.position.set(0, 700, 7000);
const scene = new Scene();
scene.background = new Color(0x000104);
scene.fog = new FogExp2(0x000104, 0.0000675);
camera.lookAt(scene.position);
const parent = new Object3D();
scene.add(parent);
const grid = new Points(new PlaneGeometry(15000, 15000, 64, 64), new PointsMaterial({ color: 0xff0000, size: 10 }));
grid.position.y = -400;
grid.rotation.x = -Math.PI / 2;
parent.add(grid);
const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  shaders: { PointsMaterial: pointsShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera),
  bloom = new BloomPass(0.75),
  film = new FilmPass(),
  focus = new ShaderPass(FocusShader),
  output = new OutputPass();
for (const pass of [renderPass, bloom, film, focus, output]) composer.addPass(pass);
focus.uniforms!["screenWidth"].value = innerWidth * devicePixelRatio;
focus.uniforms!["screenHeight"].value = innerHeight * devicePixelRatio;
const stats = new Stats();
document.body.appendChild(stats.dom);
const timer = new Timer();
timer.connect(document);
interface State {
  mesh: Points;
  positions: BufferAttribute;
  initial: BufferAttribute;
  down: number;
  up: number;
  direction: number;
  speed: number;
  delay: number;
  start: number;
}
const meshes: State[] = [],
  clones: { mesh: Points; speed: number }[] = [];
const offsets = [
  [6000, 0, -4000],
  [5000, 0, 0],
  [1000, 0, 5000],
  [1000, 0, -5000],
  [4000, 0, 2000],
  [-4000, 0, 1000],
  [-5000, 0, -5000],
  [0, 0, 0],
];
function createMesh(positions: BufferAttribute, x: number, y: number, z: number, color: number): void {
  const geometry = new BufferGeometry();
  const animated = positions.clone().setUsage(BufferUsage.DynamicDraw);
  const initial = positions.clone();
  geometry.setAttribute("position", animated);
  geometry.setAttribute("initialPosition", initial);
  let mesh: Points | undefined;
  offsets.forEach((offset, i) => {
    mesh = new Points(geometry, new PointsMaterial({ size: 30, color: i < offsets.length - 1 ? 0x252525 : color }));
    mesh.scale.setScalar(4.05);
    mesh.position.set(x + offset[0], y + offset[1], z + offset[2]);
    parent.add(mesh);
    clones.push({ mesh, speed: 0.5 + Math.random() });
  });
  if (mesh)
    meshes.push({
      mesh,
      positions: animated,
      initial,
      down: 0,
      up: 0,
      direction: 0,
      speed: 15,
      delay: Math.floor(200 + 200 * Math.random()),
      start: Math.floor(100 + 200 * Math.random()),
    });
}
const loader = new OBJLoader();
const models: [string, [number, number, number, number][]][] = [
  [
    "male02",
    [
      [-500, -350, 600, 0xff7744],
      [500, -350, 0, 0xff5522],
      [-250, -350, 1500, 0xff9922],
      [-250, -350, -1500, 0xff99ff],
    ],
  ],
  [
    "female02",
    [
      [-1000, -350, 0, 0xffdd44],
      [0, -350, 0, 0xffffff],
      [1000, -350, 400, 0xff4422],
      [250, -350, 1500, 0xff9955],
      [250, -350, 2500, 0xff77dd],
    ],
  ],
];
for (const [name, placements] of models)
  loader.load(
    `/examples/models/obj/${name}/${name}.obj`,
    (object) => {
      if (disposed) {
        disposeObject(object);
        return;
      }
      const attributes: BufferAttribute[] = [];
      object.traverse((child) => {
        if (child instanceof Mesh) {
          const attr = child.geometry.getAttribute("position");
          if (attr instanceof BufferAttribute) attributes.push(attr);
        }
      });
      const combined = new Float32Array(attributes.reduce((sum, attr) => sum + attr.array.length, 0));
      let offset = 0;
      for (const attr of attributes) {
        combined.set(attr.array, offset);
        offset += attr.array.length;
      }
      const positions = new BufferAttribute(combined, 3);
      for (const [x, y, z, color] of placements) createMesh(positions, x, y, z, color);
      disposeObject(object);
      pending--;
    },
    undefined,
    (error) => {
      if (disposed) return;
      canvas.dataset.state = "error";
      canvas.dataset.error = error instanceof Error ? error.message : String(error);
      console.error(error);
    },
  );
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  camera.lookAt(scene.position);
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  focus.uniforms!["screenWidth"].value = innerWidth * devicePixelRatio;
  focus.uniforms!["screenHeight"].value = innerHeight * devicePixelRatio;
}
function animate(): void {
  timer.update();
  const delta = Math.min(10 * timer.getDelta(), 2);
  parent.rotation.y -= 0.02 * delta;
  for (const clone of clones) clone.mesh.rotation.y -= 0.1 * delta * clone.speed;
  for (const state of meshes) {
    const { positions, initial } = state;
    if (state.start > 0) state.start--;
    else if (state.direction === 0) state.direction = -1;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        y = positions.getY(i),
        z = positions.getZ(i);
      if (state.direction < 0) {
        if (y > 0)
          positions.setXYZ(
            i,
            x + 1.5 * (0.5 - Math.random()) * state.speed * delta,
            y + 3 * (0.25 - Math.random()) * state.speed * delta,
            z + 1.5 * (0.5 - Math.random()) * state.speed * delta,
          );
        else state.down++;
      } else if (state.direction > 0) {
        const ix = initial.getX(i),
          iy = initial.getY(i),
          iz = initial.getZ(i);
        const dx = Math.abs(x - ix),
          dy = Math.abs(y - iy),
          dz = Math.abs(z - iz);
        if (dx + dy + dx > 1)
          positions.setXYZ(
            i,
            x - ((x - ix) / dx) * state.speed * delta * (0.85 - Math.random()),
            y - ((y - iy) / dy) * state.speed * delta * (1 + Math.random()),
            z - ((z - iz) / dz) * state.speed * delta * (0.85 - Math.random()),
          );
        else state.up++;
      }
    }
    if (state.down >= positions.count) {
      if (state.delay <= 0) {
        state.direction = 1;
        state.speed = 5;
        state.down = 0;
        state.delay = 320;
      } else state.delay--;
    }
    if (state.up >= positions.count) {
      if (state.delay <= 0) {
        state.direction = -1;
        state.speed = 15;
        state.up = 0;
        state.delay = 120;
      } else state.delay--;
    }
    positions.needsUpdate = true;
  }
  composer.render(0.01);
  if (!pending && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(++frames);
  stats.update();
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(animate);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  timer.dispose();
  stats.dom.remove();
  for (const pass of composer.passes) pass.dispose();
  composer.dispose();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
