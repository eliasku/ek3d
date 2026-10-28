import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DoubleSide } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometryLoader } from "ek3d/loaders/BufferGeometryLoader";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing wireframe canvas");
const canvas: HTMLCanvasElement = selected;
const scene = new Scene();
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 500);
camera.position.z = 200;
const renderer = new WebGLRenderer({ canvas, antialias: true, shaders: { MeshBasicMaterial: basicShader } });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.enablePan = false;
controls.enableZoom = false;
controls.addEventListener("change", render);
const params = { thickness: 1 };
const material = new ShaderMaterial({
  uniforms: { thickness: { value: params.thickness } },
  vertexShader: `attribute vec3 center;
varying vec3 vCenter;
void main() {
  vCenter = center;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
  fragmentShader: `uniform float thickness;
varying vec3 vCenter;
void main() {
  vec3 afwidth = fwidth(vCenter.xyz);
  vec3 edge3 = smoothstep((thickness - 1.0) * afwidth, thickness * afwidth, vCenter.xyz);
  float edge = 1.0 - min(min(edge3.x, edge3.y), edge3.z);
  gl_FragColor.rgb = gl_FrontFacing ? vec3(0.9, 0.9, 1.0) : vec3(0.4, 0.4, 0.5);
  gl_FragColor.a = edge;
}`,
  side: DoubleSide,
  alphaToCoverage: true,
});
const gui = new GUI();
gui.add(params, "thickness", 0, 4).onChange(() => {
  material.uniforms.thickness.value = params.thickness;
  render();
});
const manager = new LoadingManager();
let disposed = false;
canvas.dataset.state = "loading";
new BufferGeometryLoader(manager).load(
  "/examples/models/json/WaltHeadLo_buffergeometry.json",
  (geometry) => {
    if (disposed) {
      geometry.dispose();
      return;
    }
    geometry.deleteAttribute("normal");
    geometry.deleteAttribute("uv");
    const centers = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < geometry.attributes.position.count; i++) centers[i * 3 + (i % 3)] = 1;
    geometry.setAttribute("center", new BufferAttribute(centers, 3));
    const left = new Mesh(geometry, new MeshBasicMaterial({ color: 0xe0e0ff, wireframe: true }));
    left.position.x = -40;
    const right = new Mesh(geometry, material);
    right.position.x = 40;
    scene.add(left, right);
    canvas.dataset.state = "rendered";
    render();
  },
  undefined,
  (error) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    console.error(error);
  },
);
function render(): void {
  if (!disposed) renderer.render(scene, camera);
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  render();
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  manager.abort();
  controls.dispose();
  gui.destroy();
  disposeObject(scene, [material]);
  renderer.dispose();
});
render();
