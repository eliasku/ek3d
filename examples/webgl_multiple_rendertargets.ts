import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { GLSL3, NearestFilter, RepeatWrapping, SRGBColorSpace } from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvasSel) throw new Error("Missing multiple render targets canvas");
const canvas: HTMLCanvasElement = canvasSel;
const renderer = new WebGLRenderer({ canvas });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const renderTarget = new WebGLRenderTarget(
  window.innerWidth * window.devicePixelRatio,
  window.innerHeight * window.devicePixelRatio,
  {
    count: 2,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
  },
);
renderTarget.textures[0].name = "diffuse";
renderTarget.textures[1].name = "normal";
const scene = new Scene();
scene.background = new Color(0x222222);
const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 50);
camera.position.z = 4;
let disposed = false;
const diffuse = new TextureLoader().load(
  "/examples/textures/hardwood2_diffuse.jpg",
  (loaded) => {
    if (disposed) loaded.dispose();
    else render();
  },
  undefined,
  (error) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  },
);
diffuse.wrapS = RepeatWrapping;
diffuse.wrapT = RepeatWrapping;
diffuse.colorSpace = SRGBColorSpace;
const material = new RawShaderMaterial({
  name: "G-Buffer Shader",
  vertexShader: `in vec3 position;
in vec3 normal;
in vec2 uv;
out vec3 vNormal;
out vec2 vUv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vec3 transformedNormal = normalMatrix * normal;
  vNormal = normalize(transformedNormal);
  gl_Position = projectionMatrix * mvPosition;
}`,
  fragmentShader: `precision highp float;
precision highp int;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormal;
uniform sampler2D tDiffuse;
uniform vec2 repeat;
in vec3 vNormal;
in vec2 vUv;
void main() {
  gColor = texture(tDiffuse, vUv * repeat);
  gNormal = vec4(normalize(vNormal), 0.0);
}`,
  uniforms: { tDiffuse: { value: diffuse }, repeat: { value: new Vector2(5, 0.5) } },
  glslVersion: GLSL3,
});
scene.add(new Mesh(new TorusKnotGeometry(1, 0.3, 128, 32), material));
const postScene = new Scene();
const postCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(
  new Mesh(
    new PlaneGeometry(2, 2),
    new RawShaderMaterial({
      name: "Post-FX Shader",
      vertexShader: `in vec3 position;
in vec2 uv;
out vec2 vUv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `precision highp float;
precision highp int;
vec4 LinearTosRGB(in vec4 value) {
  return vec4(mix(pow(value.rgb, vec3(0.41666)) * 1.055 - vec3(0.055), value.rgb * 12.92, vec3(lessThanEqual(value.rgb, vec3(0.0031308)))), value.a);
}
layout(location = 0) out vec4 pc_FragColor;
in vec2 vUv;
uniform sampler2D tDiffuse;
uniform sampler2D tNormal;
void main() {
  vec4 diffuse = texture(tDiffuse, vUv);
  vec4 normal = texture(tNormal, vUv);
  pc_FragColor = mix(diffuse, normal, step(0.5, vUv.x));
  pc_FragColor.a = 1.0;
  pc_FragColor = LinearTosRGB(pc_FragColor);
}`,
      uniforms: { tDiffuse: { value: renderTarget.textures[0] }, tNormal: { value: renderTarget.textures[1] } },
      glslVersion: GLSL3,
    }),
  ),
);
const parameters = { samples: 4, wireframe: false };
const gui = new GUI();
gui.add(parameters, "samples", 0, 4).step(1);
gui.add(parameters, "wireframe");
gui.onChange(render);
const controls = new OrbitControls(camera, canvas);
controls.addEventListener("change", render);
function render(): void {
  renderTarget.samples = parameters.samples;
  material.wireframe = parameters.wireframe;
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCamera);
}
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  const dpr = renderer.getPixelRatio();
  renderTarget.setSize(window.innerWidth * dpr, window.innerHeight * dpr);
  render();
}
window.addEventListener("resize", resize);
let cleaned = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || cleaned) return;
  cleaned = true;
  disposed = true;
  window.removeEventListener("resize", resize);
  controls.removeEventListener("change", render);
  controls.dispose();
  gui.destroy();
  disposeObject(scene);
  disposeObject(postScene);
  diffuse.dispose();
  renderTarget.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
render();
