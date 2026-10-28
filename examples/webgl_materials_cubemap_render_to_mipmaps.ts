import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { CubeCamera } from "ek3d/cameras/CubeCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Side, Mapping, TextureType, TextureFilter, ColorSpace, Blending, PixelFormat } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { CubeTextureLoader } from "ek3d/loaders/CubeTextureLoader";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLCubeRenderTarget } from "ek3d/renderers/WebGLCubeRenderTarget";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing cubemap canvas");
const canvas: HTMLCanvasElement = selected;
const scene = new Scene();
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 1, 10000);
camera.position.z = 500;
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minPolarAngle = Math.PI / 4;
controls.maxPolarAngle = Math.PI / 1.5;
const manager = new LoadingManager();
let disposed = false;
let loaded = false;
let failed = false;
let frames = 0;
let target: WebGLCubeRenderTarget | undefined;
canvas.dataset.state = "loading";
const urls = ["px", "nx", "py", "ny", "pz", "nz"].map((face) => `/examples/textures/cube/Park3Med/${face}.jpg`);
const texture = new CubeTextureLoader(manager).load(
  urls,
  (source) => {
    if (disposed) {
      source.dispose();
      return;
    }
    target = new WebGLCubeRenderTarget(512, {
      magFilter: TextureFilter.Linear,
      minFilter: TextureFilter.LinearMipmapLinear,
      generateMipmaps: false,
      type: TextureType.HalfFloat,
      format: PixelFormat.RGBA,
      colorSpace: ColorSpace.LinearSRGB,
      depthBuffer: false,
    });
    for (let i = 0; i < Math.log2(512) + 1; i++) target.texture.mipmaps.push({});
    target.texture.mapping = Mapping.CubeReflection;
    const geometry = new BoxGeometry(5, 5, 5);
    const material = new ShaderMaterial({
      name: "CubemapFilterShader",
      uniforms: { cubeTexture: { value: source }, mipIndex: { value: 0 } },
      vertexShader: `varying vec3 vWorldDirection;
void main() {
  vWorldDirection = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w;
}`,
      fragmentShader: `uniform samplerCube cubeTexture;
uniform float mipIndex;
varying vec3 vWorldDirection;
void main() {
  vec4 color = vec4(1.0, 0.0, 0.0, 1.0);
  if (mipIndex == 0.0) color.rgb = vec3(1.0, 1.0, 1.0);
  else if (mipIndex == 1.0) color.rgb = vec3(0.0, 0.0, 1.0);
  else if (mipIndex == 2.0) color.rgb = vec3(0.0, 1.0, 1.0);
  else if (mipIndex == 3.0) color.rgb = vec3(0.0, 1.0, 0.0);
  else if (mipIndex == 4.0) color.rgb = vec3(1.0, 1.0, 0.0);
  gl_FragColor = textureCube(cubeTexture, normalize(vWorldDirection), 0.0) * color;
}`,
      side: Side.Back,
      blending: Blending.No,
    });
    const mesh = new Mesh(geometry, material);
    const cubeCamera = new CubeCamera(1, 10, target);
    const mipmapCount = Math.floor(Math.log2(Math.max(target.width, target.height)));
    for (let mipmap = 0; mipmap < mipmapCount; mipmap++) {
      material.uniforms.mipIndex.value = mipmap;
      material.needsUpdate = true;
      target.viewport.set(0, 0, target.width >> mipmap, target.height >> mipmap);
      cubeCamera.activeMipmapLevel = mipmap;
      cubeCamera.update(renderer, mesh);
    }
    geometry.dispose();
    material.dispose();
    const sphere = new SphereGeometry(100, 128, 128);
    const leftMaterial = new MeshBasicMaterial({ color: 0xffffff, envMap: source });
    const left = new Mesh(sphere, leftMaterial);
    left.position.x = -100;
    const rightMaterial = leftMaterial.clone();
    rightMaterial.envMap = target.texture;
    const right = new Mesh(sphere, rightMaterial);
    right.position.x = 100;
    scene.add(left, right);
    loaded = true;
  },
  undefined,
  (error) => {
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
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (loaded && !failed) canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  manager.abort();
  controls.dispose();
  disposeObject(scene);
  texture.dispose();
  target?.dispose();
  renderer.dispose();
});
