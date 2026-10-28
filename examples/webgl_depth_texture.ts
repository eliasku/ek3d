import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PixelFormat, TextureType, TextureFilter } from "ek3d/constants";
import { Object3D } from "ek3d/core/Object3D";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { Scene } from "ek3d/scenes/Scene";
import { DepthTexture } from "ek3d/textures/DepthTexture";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvasSel) throw new Error("Missing depth texture canvas");
const canvas: HTMLCanvasElement = canvasSel;
const renderer = new WebGLRenderer({ canvas });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);
camera.position.z = 4;
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
const stats = new Stats();
document.body.appendChild(stats.dom);
const params = { format: PixelFormat.Depth, type: TextureType.UnsignedShort, samples: 0 };
let target: WebGLRenderTarget;
function setupRenderTarget(): void {
  if (target) {
    target.depthTexture?.dispose();
    target.dispose();
  }
  const dpr = renderer.getPixelRatio();
  target = new WebGLRenderTarget(window.innerWidth * dpr, window.innerHeight * dpr);
  target.texture.minFilter = TextureFilter.Nearest;
  target.texture.magFilter = TextureFilter.Nearest;
  target.texture.generateMipmaps = false;
  target.stencilBuffer = Number(params.format) === PixelFormat.DepthStencil;
  target.samples = Number(params.samples);
  target.depthTexture = new DepthTexture(1, 1);
  target.depthTexture.format = Number(params.format);
  target.depthTexture.type = Number(params.type);
}
setupRenderTarget();
const scene = new Scene();
const mesh = new InstancedMesh(new TorusKnotGeometry(1, 0.3, 128, 64), new MeshBasicMaterial({ color: "blue" }), 50);
const dummy = new Object3D();
for (let i = 0; i < 50; i++) {
  const r = Math.random() * 2 * Math.PI;
  const z = Math.random() * 2 - 1;
  const zScale = Math.sqrt(1 - z * z) * 5;
  dummy.position.set(Math.cos(r) * zScale, Math.sin(r) * zScale, z * 5);
  dummy.rotation.set(Math.random(), Math.random(), Math.random());
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}
scene.add(mesh);
const postCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postMaterial = new ShaderMaterial({
  vertexShader: `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform float cameraNear;
uniform float cameraFar;
float readDepth(sampler2D depthSampler, vec2 coord) {
  float fragCoordZ = texture2D(depthSampler, coord).x;
  float viewZ = (cameraNear * cameraFar) / ((cameraFar - cameraNear) * fragCoordZ - cameraFar);
  return (viewZ + cameraNear) / (cameraNear - cameraFar);
}
void main() { float depth = readDepth(tDepth, vUv); gl_FragColor = vec4(1.0 - vec3(depth), 1.0); }`,
  uniforms: {
    cameraNear: { value: camera.near },
    cameraFar: { value: camera.far },
    tDiffuse: { value: null },
    tDepth: { value: null },
  },
});
const postScene = new Scene();
postScene.add(new Mesh(new PlaneGeometry(2, 2), postMaterial));
const gui = new GUI({ width: 300 });
gui
  .add(params, "format", { DepthFormat: PixelFormat.Depth, DepthStencilFormat: PixelFormat.DepthStencil })
  .onChange(setupRenderTarget);
gui
  .add(params, "type", {
    UnsignedShortType: TextureType.UnsignedShort,
    UnsignedIntType: TextureType.UnsignedInt,
    FloatType: TextureType.Float,
  })
  .onChange(setupRenderTarget);
gui.add(params, "samples", 0, 16, 1).onChange(setupRenderTarget);
gui.open();
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  const dpr = renderer.getPixelRatio();
  target.setSize(window.innerWidth * dpr, window.innerHeight * dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  postMaterial.uniforms.tDiffuse.value = target.texture;
  postMaterial.uniforms.tDepth.value = target.depthTexture;
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCamera);
  controls.update();
  stats.update();
});
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  mesh.dispose();
  disposeObject(scene);
  disposeObject(postScene);
  target.depthTexture?.dispose();
  target.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
