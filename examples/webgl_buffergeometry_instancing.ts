import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { InstancedBufferAttribute } from "ek3d/core/InstancedBufferAttribute";
import { InstancedBufferGeometry } from "ek3d/core/InstancedBufferGeometry";
import { Vector4 } from "ek3d/math/Vector4";
import { Side } from "ek3d/constants";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Stats } from "ek3d/addons/libs/Stats";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing instancing canvas");
const canvas: HTMLCanvasElement = canvasSel;
let disposed = false;
let frames = 0;
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 1, 10);
camera.position.z = 2;
const scene = new Scene();
const instances = 50000;
const offsets = new Float32Array(instances * 3);
const colors = new Float32Array(instances * 4);
const starts = new Float32Array(instances * 4);
const ends = new Float32Array(instances * 4);
const vector = new Vector4();
for (let i = 0; i < instances; i++) {
  offsets.set([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5], i * 3);
  colors.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  vector.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
  starts.set([vector.x, vector.y, vector.z, vector.w], i * 4);
  vector.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
  ends.set([vector.x, vector.y, vector.z, vector.w], i * 4);
}
const geometry = new InstancedBufferGeometry();
geometry.instanceCount = instances;
geometry.setAttribute("position", new Float32BufferAttribute([0.025, -0.025, 0, -0.025, 0.025, 0, 0, 0, 0.025], 3));
geometry.setAttribute("offset", new InstancedBufferAttribute(offsets, 3));
geometry.setAttribute("color", new InstancedBufferAttribute(colors, 4));
geometry.setAttribute("orientationStart", new InstancedBufferAttribute(starts, 4));
geometry.setAttribute("orientationEnd", new InstancedBufferAttribute(ends, 4));
const material = new RawShaderMaterial({
  uniforms: { time: { value: 1 }, sineTime: { value: 1 } },
  vertexShader: /* glsl */ `
    precision highp float;
    uniform float sineTime;
    uniform mat4 modelViewMatrix, projectionMatrix;
    attribute vec3 position, offset;
    attribute vec4 color, orientationStart, orientationEnd;
    varying vec3 vPosition;
    varying vec4 vColor;
    void main() {
      vPosition = offset * max(abs(sineTime * 2.0 + 1.0), 0.5) + position;
      vec4 orientation = normalize(mix(orientationStart, orientationEnd, sineTime));
      vec3 vcV = cross(orientation.xyz, vPosition);
      vPosition = vcV * (2.0 * orientation.w) + (cross(orientation.xyz, vcV) * 2.0 + vPosition);
      vColor = color;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform float time;
    varying vec3 vPosition;
    varying vec4 vColor;
    void main() {
      vec4 color = vec4(vColor);
      color.r += sin(vPosition.x * 10.0 + time) * 0.5;
      gl_FragColor = color;
    }
  `,
  side: Side.Double,
  forceSinglePass: true,
  transparent: true,
});
const mesh = new Mesh(geometry, material);
scene.add(mesh);
const renderer = new WebGLRenderer({ canvas, preserveDrawingBuffer: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const gui = new GUI({ width: 350 });
gui.add(geometry, "instanceCount", 0, instances);
const stats = new Stats();
document.body.appendChild(stats.dom);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  const time = performance.now();
  mesh.rotation.y = time * 0.0005;
  material.uniforms.time.value = time * 0.005;
  material.uniforms.sineTime.value = Math.sin(material.uniforms.time.value * 0.05);
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  stats.update();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  gui.destroy();
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
