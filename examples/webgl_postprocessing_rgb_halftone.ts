import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { HalftonePass } from "ek3d/addons/postprocessing/HalftonePass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Color } from "ek3d/math/Color";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { PointLight } from "ek3d/lights/PointLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { Group } from "ek3d/objects/Group";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Timer } from "ek3d/core/Timer";
import { Scene } from "ek3d/scenes/Scene";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (canvas === null) throw new Error("Missing rgb halftone example canvas");

const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const timer = new Timer();
timer.connect(document);

const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.z = 12;

const rotationSpeed = Math.PI / 64;

// camera controls

const controls = new OrbitControls(camera, renderer.domElement as HTMLCanvasElement);
controls.target.set(0, 0, 0);
controls.update();

// scene

const scene = new Scene();
const background = new Color(0x444444);
scene.background = background;

const group = new Group();
const floor = new Mesh(new BoxGeometry(100, 1, 100), new MeshPhongMaterial({}));
floor.position.y = -10;
const light = new PointLight(0xffffff, 250);
light.position.y = 2;
group.add(floor, light);
scene.add(group);

const material = new ShaderMaterial({
  uniforms: {},
  vertexShader: `
varying vec2 vUV;
varying vec3 vNormal;

void main() {

	vUV = uv;
	vNormal = vec3( normal );
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}
`,
  fragmentShader: `
varying vec2 vUV;
varying vec3 vNormal;

void main() {

	vec4 c = vec4( abs( vNormal ) + vec3( vUV, 0.0 ), 0.0 );
	gl_FragColor = c;

}
`,
});

const cubeGeometry = new BoxGeometry(2, 2, 2);

for (let i = 0; i < 50; ++i) {
  // fill scene with coloured cubes
  const mesh = new Mesh(cubeGeometry, material);
  mesh.position.set(Math.random() * 16 - 8, Math.random() * 16 - 8, Math.random() * 16 - 8);
  mesh.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
  group.add(mesh);
}

// post-processing

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);

const params = {
  shape: 1,
  radius: 4,
  rotateR: Math.PI / 12,
  rotateB: (Math.PI / 12) * 2,
  rotateG: (Math.PI / 12) * 3,
  scatter: 0,
  blending: 1,
  blendingMode: 1,
  greyscale: false,
  disable: false,
};
const halftonePass = new HalftonePass(params);
composer.addPass(renderPass);
composer.addPass(halftonePass);

// Page check hooks (in place of the upstream GUI): Digit1/2/3 tweak uniforms, Digit4 toggles disable.
window.addEventListener("keydown", (event) => {
  if (event.code === "Digit1")
    halftonePass.uniforms["shape"].value = (Number(halftonePass.uniforms["shape"].value) % 5) + 1;
  else if (event.code === "Digit2")
    halftonePass.uniforms["radius"].value = Number(halftonePass.uniforms["radius"].value) + 2;
  else if (event.code === "Digit3")
    halftonePass.uniforms["scatter"].value = 1 - Number(halftonePass.uniforms["scatter"].value);
  else if (event.code === "Digit4") halftonePass.uniforms["disable"].value = !halftonePass.uniforms["disable"].value;
});

window.addEventListener("resize", () => {
  // resize composer
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

let publishedFrames = -1;

function animate(): void {
  timer.update();

  const delta = timer.getDelta();

  group.rotation.y += delta * rotationSpeed;

  composer.render(delta);

  if (frames !== publishedFrames) {
    publishedFrames = frames;
    canvas!.dataset.state = "rendered";
    canvas!.dataset.frames = String(frames);
    canvas!.dataset.shape = String(halftonePass.uniforms["shape"].value);
    canvas!.dataset.radius = String(halftonePass.uniforms["radius"].value);
    canvas!.dataset.disable = String(!!halftonePass.uniforms["disable"].value);
  }
  frames++;
}

let frames = 0;

renderer.setAnimationLoop(animate);

window.addEventListener(
  "pagehide",
  () => {
    composer.dispose();
    cubeGeometry.dispose();
    floor.geometry.dispose();
    renderer.setAnimationLoop(null);
    renderer.dispose();
  },
  { once: true },
);
