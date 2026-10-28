import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Timer } from "ek3d/core/Timer";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Float32BufferAttribute, Uint8BufferAttribute } from "ek3d/core/BufferAttribute";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { DoubleSide } from "ek3d/constants";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing example canvas");
const canvas = selected;
let disposed = false;
let frames = 0;
const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 10);
camera.position.z = 2;
const scene = new Scene();
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
const gl = renderer.getContext();
const extension: { CLIP_DISTANCE0_WEBGL: number } | null = gl.getExtension("WEBGL_clip_cull_distance");
const timer = new Timer();
timer.connect(document);
const geometry = new BufferGeometry();
const positions: number[] = [];
const colors: number[] = [];
for (let i = 0; i < 600; i++) {
  positions.push(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
  colors.push(Math.random() * 255, Math.random() * 255, Math.random() * 255, Math.random() * 255);
}
geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
geometry.setAttribute("color", new Uint8BufferAttribute(colors, 4, true));
const time = { value: 1 };
const material = new ShaderMaterial({
  uniforms: { time },
  vertexShader: `
uniform float time;

varying vec4 vColor;

void main() {

  vColor = color;

  #ifdef USE_CLIP_DISTANCE
    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
    gl_ClipDistance[ 0 ] = worldPosition.x - sin( time ) * ( 0.5 );
  #endif

  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}
    `,
  fragmentShader: "varying vec4 vColor;\n\n\t\t\tvoid main() {\n\n\t\t\t\tgl_FragColor = vColor;\n\n\t\t\t}",
  side: DoubleSide,
  transparent: true,
  vertexColors: true,
});
material.extensions.clipCullDistance = true;
scene.add(new Mesh(geometry, material));
const controls = new OrbitControls(camera, canvas);
const stats = new Stats();
document.body.appendChild(stats.dom);
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();
if (extension === null) {
  const message = document.createElement("div");
  message.textContent = "WEBGL_clip_cull_distance not supported";
  message.style.cssText = "position:absolute;top:50%;width:100%;color:white;text-align:center";
  document.body.appendChild(message);
  canvas.dataset.state = "unsupported";
} else {
  gl.enable(extension.CLIP_DISTANCE0_WEBGL);
  renderer.setAnimationLoop(() => {
    timer.update();
    controls.update();
    stats.update();
    time.value = timer.getElapsed();
    renderer.render(scene, camera);
    canvas.dataset.state = "rendered";
    canvas.dataset.frames = String(++frames);
  });
}
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  controls.dispose();
  stats.dom.remove();
  timer.dispose();
  geometry.dispose();
  material.dispose();
  if (extension !== null) gl.disable(extension.CLIP_DISTANCE0_WEBGL);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
