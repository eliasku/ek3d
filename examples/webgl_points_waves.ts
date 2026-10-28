import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Color } from "ek3d/math/Color";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { Stats } from "ek3d/addons/libs/Stats";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (canvas === null) throw new Error("Missing point-wave canvas");
const separation = 100;
const amountX = 50;
const amountY = 50;
const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.z = 1000;
const scene = new Scene();
const positions = new Float32Array(amountX * amountY * 3);
const scales = new Float32Array(amountX * amountY);
for (let ix = 0; ix < amountX; ix++) {
  for (let iy = 0; iy < amountY; iy++) {
    const index = ix * amountY + iy;
    positions[index * 3] = ix * separation - (amountX * separation) / 2;
    positions[index * 3 + 2] = iy * separation - (amountY * separation) / 2;
    scales[index] = 1;
  }
}
const position = new BufferAttribute(positions, 3);
const scale = new BufferAttribute(scales, 1);
const geometry = new BufferGeometry();
geometry.setAttribute("position", position);
geometry.setAttribute("scale", scale);
const material = new ShaderMaterial({
  uniforms: { color: { value: new Color(0xffffff) } },
  vertexShader: `
    attribute float scale;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = scale * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    void main() {
      if (length(gl_PointCoord - vec2(0.5, 0.5)) > 0.475) discard;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
});
scene.add(new Points(geometry, material));
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const stats = new Stats();
document.querySelector("#wrapper")!.appendChild(stats.dom);
let mouseX = 0;
let mouseY = 0;
let count = 0;
let frames = 0;
let disposed = false;
canvas.style.touchAction = "none";
canvas.addEventListener("pointermove", onPointerMove);
window.addEventListener("resize", onResize);
renderer.setAnimationLoop(() => {
  camera.position.x += (mouseX - camera.position.x) * 0.05;
  camera.position.y += (-mouseY - camera.position.y) * 0.05;
  camera.lookAt(scene.position);
  for (let ix = 0; ix < amountX; ix++) {
    for (let iy = 0; iy < amountY; iy++) {
      const index = ix * amountY + iy;
      positions[index * 3 + 1] = Math.sin((ix + count) * 0.3) * 50 + Math.sin((iy + count) * 0.5) * 50;
      scales[index] = (Math.sin((ix + count) * 0.3) + 1) * 20 + (Math.sin((iy + count) * 0.5) + 1) * 20;
    }
  }
  position.needsUpdate = true;
  scale.needsUpdate = true;
  renderer.render(scene, camera);
  count += 0.1;
  stats.update();
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
});

function onPointerMove(event: PointerEvent): void {
  if (!event.isPrimary) return;
  mouseX = event.clientX - window.innerWidth / 2;
  mouseY = event.clientY - window.innerHeight / 2;
}

function onResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  canvas.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("resize", onResize);
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
