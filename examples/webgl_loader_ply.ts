import { PLYLoader } from "ek3d/addons/loaders/PLYLoader";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing PLY loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const camera = new PerspectiveCamera(35, window.innerWidth / window.innerHeight, 1, 15);
camera.position.set(3, 0.15, 3);

const cameraTarget = new Vector3(0, -0.1, 0);

const scene = new Scene();
scene.background = new Color(0x72645b);
scene.fog = new Fog(0x72645b, 2, 15);

// Ground

const planeGeometry = new PlaneGeometry(40, 40);
const planeMaterial = new MeshPhongMaterial({ color: 0xcbcbcb, specular: 0x474747 });
const plane = new Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.position.y = -0.5;
plane.receiveShadow = true;
scene.add(plane);

// PLY files

const models: Mesh[] = [];
let pending = 2;
let loadError: unknown = null;
let disposed = false;
let frames = 0;

function loadModel(path: string, file: string, place: (mesh: Mesh) => void): void {
  new PLYLoader().setPath(path).load(
    file,
    (geometry) => {
      // A response arriving after pagehide must not resurrect disposed renderer state.
      if (disposed) {
        geometry.dispose();
        return;
      }

      geometry.computeVertexNormals();

      const mesh = new Mesh(geometry, new MeshStandardMaterial({ color: 0x009cff, flatShading: true }));
      place(mesh);

      mesh.castShadow = true;
      mesh.receiveShadow = true;

      scene.add(mesh);
      models.push(mesh);

      pending--;
      if (pending === 0) canvas.dataset.loaded = "true";
    },
    undefined,
    (error) => {
      if (disposed) return;

      loadError = error;
      canvas.dataset.state = "error";
      canvas.dataset.error = error instanceof Error ? error.message : String(error);
      console.error(error);
    },
  );
}

loadModel("/examples/models/ply/ascii/", "dolphins.ply", (mesh) => {
  mesh.position.y = -0.2;
  mesh.position.z = 0.3;
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.multiplyScalar(0.001);
});

loadModel("/examples/models/ply/binary/", "Lucy100k.ply", (mesh) => {
  mesh.position.x = -0.2;
  mesh.position.y = -0.02;
  mesh.position.z = -0.2;
  mesh.scale.multiplyScalar(0.0006);
});

// Lights

const hemisphereLight = new HemisphereLight(0x8d7c7c, 0x494966, 3);
scene.add(hemisphereLight);

const lights = [addShadowedLight(1, 1, 1, 0xffffff, 3.5), addShadowedLight(0.5, 1, -1, 0xffd500, 3)];

function addShadowedLight(x: number, y: number, z: number, color: number, intensity: number): DirectionalLight {
  const directionalLight = new DirectionalLight(color, intensity);
  directionalLight.position.set(x, y, z);
  scene.add(directionalLight);

  directionalLight.castShadow = true;

  const d = 1;
  directionalLight.shadow.camera.left = -d;
  directionalLight.shadow.camera.right = d;
  directionalLight.shadow.camera.top = d;
  directionalLight.shadow.camera.bottom = -d;

  directionalLight.shadow.camera.near = 1;
  directionalLight.shadow.camera.far = 4;

  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;

  directionalLight.shadow.bias = -0.001;

  return directionalLight;
}

// Renderer

// MeshStandardMaterial declares a dfgLUT uniform, so the renderer needs its lookup texture.
const dfgLUT = createDFGLUT();

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createShadowMap: WebGLShadowMap,
  getDFGLUT: () => dfgLUT,
  shaders: {
    MeshPhongMaterial: phongShader,
    MeshStandardMaterial: standardShader,
    MeshDepthMaterial: depthShader,
  },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const shadowMap = renderer.shadowMap;
if (shadowMap === null) throw new Error("the shadow map system failed to install");
shadowMap.enabled = true;

// Stats

const stats = new Stats();
document.body.appendChild(stats.dom);

renderer.setAnimationLoop(animate);

function animate(): void {
  render();
  stats.update();
}

function render(): void {
  const timer = Date.now() * 0.0005;

  camera.position.x = Math.sin(timer) * 2.5;
  camera.position.z = Math.cos(timer) * 2.5;

  camera.lookAt(cameraTarget);

  renderer.render(scene, camera);

  frames++;
  canvas.dataset.models = String(models.length);
  canvas.dataset.frames = String(frames);

  if (loadError === null && canvas.dataset.loaded === "true") canvas.dataset.state = "rendered";
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    window.removeEventListener("resize", onWindowResize);
    renderer.setAnimationLoop(null);
    for (const mesh of models) {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
    }
    for (const light of lights) light.dispose();
    stats.dom.remove();
    planeGeometry.dispose();
    planeMaterial.dispose();
    dfgLUT.dispose();
    renderer.dispose();
  },
  { once: true },
);
