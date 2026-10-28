import { TextGeometry } from "ek3d/addons/geometries/TextGeometry";
import { Stats } from "ek3d/addons/libs/Stats";
import { FontLoader } from "ek3d/addons/loaders/FontLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { AdditiveBlending } from "ek3d/constants";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Color } from "ek3d/math/Color";
import { Line } from "ek3d/objects/Line";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing custom lines canvas");
const canvas = selected;
let disposed = false,
  frames = 0;
canvas.dataset.state = "loading";
const camera = new PerspectiveCamera(30, innerWidth / innerHeight, 1, 10000);
camera.position.z = 400;
const scene = new Scene();
scene.background = new Color(0x050505);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
const uniforms = { amplitude: { value: 5 }, opacity: { value: 0.3 }, color: { value: new Color(0xffffff) } };
const material = new ShaderMaterial({
  uniforms,
  vertexShader: `uniform float amplitude; attribute vec3 displacement; attribute vec3 customColor; varying vec3 vColor;
    void main() { vColor = customColor; gl_Position = projectionMatrix * modelViewMatrix * vec4(position + amplitude * displacement, 1.0); }`,
  fragmentShader: `uniform vec3 color; uniform float opacity; varying vec3 vColor;
    void main() { gl_FragColor = vec4(vColor * color, opacity); }`,
  blending: AdditiveBlending,
  depthTest: false,
  transparent: true,
});
let line: Line | undefined;
let displacement: Float32BufferAttribute | undefined;
new FontLoader().load(
  "/examples/fonts/helvetiker_bold.typeface.json",
  (font) => {
    if (disposed) return;
    const geometry = new TextGeometry("three.js", {
      font,
      size: 50,
      depth: 15,
      curveSegments: 10,
      bevelThickness: 5,
      bevelSize: 1.5,
      bevelEnabled: true,
      bevelSegments: 10,
    });
    geometry.center();
    const count = geometry.attributes.position.count;
    displacement = new Float32BufferAttribute(count * 3, 3);
    geometry.setAttribute("displacement", displacement);
    const colors = new Float32BufferAttribute(count * 3, 3);
    geometry.setAttribute("customColor", colors);
    const color = new Color();
    for (let i = 0; i < count; i++) {
      color.setHSL(i / count, 0.5, 0.5);
      colors.setXYZ(i, color.r, color.g, color.b);
    }
    line = new Line(geometry, material);
    line.rotation.x = 0.2;
    scene.add(line);
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
  renderer.setSize(innerWidth, innerHeight);
}
function animate(): void {
  if (line && displacement) {
    const time = Date.now() * 0.001;
    line.rotation.y = 0.25 * time;
    uniforms.amplitude.value = Math.sin(0.5 * time);
    uniforms.color.value.offsetHSL(0.0005, 0, 0);
    for (let i = 0; i < displacement.count; i++)
      displacement.setXYZ(
        i,
        displacement.getX(i) + 0.3 * (0.5 - Math.random()),
        displacement.getY(i) + 0.3 * (0.5 - Math.random()),
        displacement.getZ(i) + 0.3 * (0.5 - Math.random()),
      );
    displacement.needsUpdate = true;
  }
  renderer.render(scene, camera);
  if (line && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
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
  if (!line) material.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
