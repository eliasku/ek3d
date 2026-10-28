import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { OBJLoader } from "ek3d/addons/loaders/OBJLoader";
import { VelocityShader } from "ek3d/addons/shaders/VelocityShader";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import {
  BackSide,
  BasicDepthPacking,
  DoubleSide,
  FrontSide,
  RGBADepthPacking,
  RGBDepthPacking,
  RGDepthPacking,
} from "ek3d/constants";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import type { Material } from "ek3d/materials/Material";
import { MeshDepthMaterial } from "ek3d/materials/MeshDepthMaterial";
import { MeshNormalMaterial } from "ek3d/materials/MeshNormalMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Vector2 } from "ek3d/math/Vector2";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { cloneUniforms } from "ek3d/renderers/shaders/UniformsUtils";
import type { Texture } from "ek3d/textures/Texture";
import { Scene } from "ek3d/scenes/Scene";
import { disposeMaterial, disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing channels canvas");
const canvas: HTMLCanvasElement = selected;
const scene = new Scene();
const perspective = new PerspectiveCamera(45, innerWidth / innerHeight, 500, 3000);
perspective.position.z = 1500;
const ortho = new OrthographicCamera(
  (-500 * innerWidth) / innerHeight,
  (500 * innerWidth) / innerHeight,
  500,
  -500,
  1000,
  2500,
);
ortho.position.z = 1500;
scene.add(perspective, ortho);
scene.add(new AmbientLight(0xffffff, 0.3));
const light = new PointLight(0xff0000, 1.5, 0, 0);
light.position.z = 2500;
scene.add(light);
const cameraLight = new PointLight(0xff6666, 3, 0, 0);
perspective.add(cameraLight);
const blueLight = new PointLight(0x0000ff, 1.5, 0, 0);
blueLight.position.set(-1000, 0, 1000);
scene.add(blueLight);
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  getDFGLUT: () => dfg,
  shaders: { MeshStandardMaterial: standardShader, MeshNormalMaterial: normalShader, MeshDepthMaterial: depthShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controlsPerspective = new OrbitControls(perspective, canvas);
controlsPerspective.minDistance = 1000;
controlsPerspective.maxDistance = 2400;
controlsPerspective.enableDamping = true;
const controlsOrtho = new OrbitControls(ortho, canvas);
controlsOrtho.minZoom = 0.5;
controlsOrtho.maxZoom = 1.5;
controlsOrtho.enableDamping = true;
const manager = new LoadingManager();
let disposed = false;
canvas.dataset.state = "loading";
function fail(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(error);
  console.error(error);
}
function releaseLateTexture(texture: Texture): void {
  if (disposed) texture.dispose();
}
const textureLoader = new TextureLoader(manager);
const normalMap = textureLoader.load("/examples/models/obj/ninja/normal.png", releaseLateTexture, undefined, fail);
const aoMap = textureLoader.load("/examples/models/obj/ninja/ao.jpg", releaseLateTexture, undefined, fail);
const displacementMap = textureLoader.load(
  "/examples/models/obj/ninja/displacement.jpg",
  releaseLateTexture,
  undefined,
  fail,
);
const displacement = { displacementMap, displacementScale: 2.436143, displacementBias: -0.428408, side: DoubleSide };
const velocity = Object.assign(
  new ShaderMaterial({ ...VelocityShader, uniforms: cloneUniforms(VelocityShader.uniforms), side: DoubleSide }),
  { displacementMap },
);
velocity.uniforms.displacementMap.value = displacementMap;
velocity.uniforms.displacementScale.value = displacement.displacementScale;
velocity.uniforms.displacementBias.value = displacement.displacementBias;
const materials: Record<string, Material> = {
  standard: new MeshStandardMaterial({
    ...displacement,
    color: 0xffffff,
    metalness: 0.5,
    roughness: 0.6,
    aoMap,
    normalMap,
    normalScale: new Vector2(1, -1),
  }),
  normal: new MeshNormalMaterial({ ...displacement, normalMap, normalScale: new Vector2(1, -1) }),
  velocity,
  depthBasic: new MeshDepthMaterial({ ...displacement, depthPacking: BasicDepthPacking }),
  depthRGBA: new MeshDepthMaterial({ ...displacement, depthPacking: RGBADepthPacking }),
  depthRGB: new MeshDepthMaterial({ ...displacement, depthPacking: RGBDepthPacking }),
  depthRG: new MeshDepthMaterial({ ...displacement, depthPacking: RGDepthPacking }),
};
const params = { material: "normal", camera: "perspective", side: "double" };
const sides = { front: FrontSide, back: BackSide, double: DoubleSide };
let mesh: Mesh<Material> | undefined;
const previousWorld = new Matrix4();
new OBJLoader(manager).load(
  "/examples/models/obj/ninja/ninjaHead_Low.obj",
  (group) => {
    if (disposed) {
      disposeObject(group);
      return;
    }
    const original = group.children[0];
    if (!(original instanceof Mesh)) {
      disposeObject(group);
      fail(new Error("Ninja model has no mesh"));
      return;
    }
    original.geometry.center();
    mesh = new Mesh<Material>(original.geometry, materials.normal);
    mesh.scale.multiplyScalar(25);
    scene.add(mesh);
    group.remove(original);
    for (const item of Array.isArray(original.material) ? original.material : [original.material])
      disposeMaterial(item);
    disposeObject(group);
    if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  },
  undefined,
  fail,
);
const stats = new Stats();
document.body.appendChild(stats.dom);
const gui = new GUI();
gui.add(params, "material", Object.keys(materials));
gui.add(params, "camera", ["perspective", "ortho"]);
gui.add(params, "side", ["front", "back", "double"]);
function resize(): void {
  const aspect = innerWidth / innerHeight;
  perspective.aspect = aspect;
  perspective.updateProjectionMatrix();
  ortho.left = -500 * aspect;
  ortho.right = 500 * aspect;
  ortho.top = 500;
  ortho.bottom = -500;
  ortho.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  stats.begin();
  if (mesh) {
    const material = materials[params.material];
    const side = sides[params.side as keyof typeof sides];
    if (material.side !== side) {
      material.side = side;
      material.needsUpdate = true;
    }
    mesh.material = material;
  }
  const camera = params.camera === "perspective" ? perspective : ortho;
  controlsPerspective.update();
  controlsOrtho.update();
  velocity.uniforms.previousProjectionViewMatrix.value.copy(velocity.uniforms.currentProjectionViewMatrix.value);
  velocity.uniforms.currentProjectionViewMatrix.value.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
  velocity.uniforms.modelMatrixPrev.value.copy(previousWorld);
  renderer.render(scene, camera);
  if (mesh) previousWorld.copy(mesh.matrixWorld);
  stats.end();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  manager.abort();
  controlsPerspective.dispose();
  controlsOrtho.dispose();
  gui.destroy();
  stats.dom.remove();
  disposeObject(scene, Object.values(materials));
  light.dispose();
  blueLight.dispose();
  cameraLight.dispose();
  dfg.dispose();
  renderer.dispose();
});
