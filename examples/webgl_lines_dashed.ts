import { hilbert3D } from "ek3d/addons/utils/GeometryUtils";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { CatmullRomCurve3 } from "ek3d/extras/curves/CatmullRomCurve3";
import { LineDashedMaterial } from "ek3d/materials/LineDashedMaterial";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { Line } from "ek3d/objects/Line";
import { LineSegments } from "ek3d/objects/LineSegments";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { dashedShader } from "ek3d/renderers/shaders/DashedShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Fog } from "ek3d/scenes/Fog";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing dashed lines canvas");
const canvas = selected;
const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 1, 200);
camera.position.z = 150;
const scene = new Scene();
scene.background = new Color(0x111111);
scene.fog = new Fog(0x111111, 150, 200);
const points = hilbert3D(new Vector3(), 25, 1);
const spline = new CatmullRomCurve3(points);
const line = new Line(
  new BufferGeometry().setFromPoints(spline.getPoints(points.length * 6)),
  new LineDashedMaterial({ color: 0xffffff, dashSize: 1, gapSize: 0.5 }),
);
line.computeLineDistances();
scene.add(line);
const h = 25;
const geometry = new BufferGeometry();
geometry.setAttribute(
  "position",
  new Float32BufferAttribute(
    [
      -h,
      -h,
      -h,
      -h,
      h,
      -h,
      -h,
      h,
      -h,
      h,
      h,
      -h,
      h,
      h,
      -h,
      h,
      -h,
      -h,
      h,
      -h,
      -h,
      -h,
      -h,
      -h,
      -h,
      -h,
      h,
      -h,
      h,
      h,
      -h,
      h,
      h,
      h,
      h,
      h,
      h,
      h,
      h,
      h,
      -h,
      h,
      h,
      -h,
      h,
      -h,
      -h,
      h,
      -h,
      -h,
      -h,
      -h,
      -h,
      h,
      -h,
      h,
      -h,
      -h,
      h,
      h,
      h,
      h,
      -h,
      h,
      h,
      h,
      h,
      -h,
      -h,
      h,
      -h,
      h,
    ],
    3,
  ),
);
const box = new LineSegments(geometry, new LineDashedMaterial({ color: 0xffaa00, dashSize: 3, gapSize: 1 }));
box.computeLineDistances();
scene.add(box);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  shaders: { LineDashedMaterial: dashedShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
let frames = 0;
let disposed = false;
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
function animate(): void {
  const time = Date.now() * 0.00025;
  line.rotation.x = line.rotation.y = time;
  box.rotation.x = box.rotation.y = time;
  renderer.render(scene, camera);
  canvas.dataset.state = "rendered";
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
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
