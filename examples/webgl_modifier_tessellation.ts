import { TrackballControls } from "ek3d/addons/controls/TrackballControls";
import { TextGeometry } from "ek3d/addons/geometries/TextGeometry";
import { FontLoader } from "ek3d/addons/loaders/FontLoader";
import { Stats } from "ek3d/addons/libs/Stats";
import { TessellateModifier } from "ek3d/addons/modifiers/TessellateModifier";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing tessellation canvas");
const canvas: HTMLCanvasElement = selected;
canvas.dataset.state = "loading";
let disposed = false,
  loaded = false,
  failed = false,
  frames = 0;
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 10000);
camera.position.set(-100, 100, 200);
const scene = new Scene();
scene.background = new Color(0x050505);
const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new TrackballControls(camera, canvas);
const stats = new Stats();
document.body.appendChild(stats.dom);
const uniforms = { amplitude: { value: 0 } };
new FontLoader().load(
  "/examples/fonts/helvetiker_bold.typeface.json",
  (font) => {
    if (disposed) return;
    const text = new TextGeometry("THREE.JS", {
      font,
      size: 40,
      depth: 5,
      curveSegments: 3,
      bevelThickness: 2,
      bevelSize: 1,
      bevelEnabled: true,
    });
    text.center();
    const geometry = new TessellateModifier(8, 6).modify(text);
    text.dispose();
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3),
      displacement = new Float32Array(count * 3);
    const color = new Color();
    for (let i = 0; i < count; i += 3) {
      color.setHSL(0.2 * Math.random(), 0.5 + 0.5 * Math.random(), 0.5 + 0.5 * Math.random());
      const d = 10 * (0.5 - Math.random());
      for (let j = 0; j < 3; j++) {
        const k = (i + j) * 3;
        colors.set([color.r, color.g, color.b], k);
        displacement.set([d, d, d], k);
      }
    }
    geometry.setAttribute("customColor", new BufferAttribute(colors, 3));
    geometry.setAttribute("displacement", new BufferAttribute(displacement, 3));
    const material = new ShaderMaterial({
      uniforms,
      vertexShader: `
    uniform float amplitude;
    attribute vec3 customColor;
    attribute vec3 displacement;
    varying vec3 vNormal;
    varying vec3 vColor;
    void main() {
      vNormal = normal;
      vColor = customColor;
      vec3 newPosition = position + normal * amplitude * displacement;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }`,
      fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vColor;
    void main() {
      float directional = max(dot(vNormal, normalize(vec3(1.0))), 0.0);
      gl_FragColor = vec4((directional + 0.4) * vColor, 1.0);
    }`,
    });
    scene.add(new Mesh(geometry, material));
    loaded = true;
  },
  undefined,
  (error: unknown) => {
    if (disposed) return;
    failed = true;
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    console.error(error);
  },
);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  uniforms.amplitude.value = 1 + Math.sin(Date.now() * 0.0005);
  controls.update();
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  if (!failed) canvas.dataset.state = loaded ? "rendered" : "loading";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
