import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { AmmoPhysics, type AmmoRuntime } from "ek3d/addons/physics/AmmoPhysics";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BufferUsage } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { ShadowMaterial } from "ek3d/materials/ShadowMaterial";
import { Color } from "ek3d/math/Color";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Vector3 } from "ek3d/math/Vector3";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { shadowShader } from "ek3d/renderers/shaders/ShadowShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

type AmmoFactory = (options: { locateFile(path: string): string }) => Promise<AmmoRuntime>;
const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing Ammo instancing canvas");
const canvas: HTMLCanvasElement = selected;
let disposed = false;
const cleanup: (() => void)[] = [];
function dispose(): void {
  if (disposed) return;
  disposed = true;
  for (const release of cleanup.reverse()) release();
  cleanup.length = 0;
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) dispose();
});

async function loadAmmo(): Promise<AmmoRuntime> {
  const script = document.createElement("script");
  script.src = "/examples/libs/ammo.wasm.js";
  await new Promise<void>((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Ammo runtime"));
    document.head.appendChild(script);
  });
  const factory: unknown = (window as Window & { Ammo?: unknown }).Ammo;
  if (typeof factory !== "function") throw new Error("Invalid Ammo runtime factory");
  return (factory as AmmoFactory)({ locateFile: () => "/examples/libs/ammo.wasm.wasm" });
}

async function init(): Promise<void> {
  canvas.dataset.state = "loading";
  const ammo = await loadAmmo();
  if (disposed) return;
  const physics = AmmoPhysics(ammo);
  cleanup.push(() => physics.dispose());
  const scene = new Scene();
  cleanup.push(() => disposeObject(scene));
  scene.background = new Color(0x666666);
  const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(-1, 1.5, 2);
  camera.lookAt(0, 0.5, 0);
  scene.add(new HemisphereLight());
  const light = new DirectionalLight(0xffffff, 3);
  light.position.set(5, 5, 5);
  light.castShadow = true;
  light.shadow.camera.zoom = 2;
  scene.add(light);
  cleanup.push(() => light.shadow.dispose());
  const plane = new Mesh(new PlaneGeometry(10, 10), new ShadowMaterial({ color: 0x444444 }));
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);
  const floor = new Mesh(new BoxGeometry(10, 5, 10), new MeshBasicMaterial({ color: 0x666666 }));
  floor.position.y = -2.5;
  floor.userData.physics = { mass: 0 };
  floor.visible = false;
  scene.add(floor);
  const material = new MeshLambertMaterial();
  const boxes = new InstancedMesh(new BoxGeometry(0.075, 0.075, 0.075), material, 400);
  const spheres = new InstancedMesh(new IcosahedronGeometry(0.05, 4), material, 400);
  cleanup.push(() => {
    boxes.dispose();
    spheres.dispose();
  });
  const matrix = new Matrix4();
  const color = new Color();
  for (const mesh of [boxes, spheres]) {
    mesh.instanceMatrix.setUsage(BufferUsage.DynamicDraw);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.physics = { mass: 1 };
    scene.add(mesh);
    for (let i = 0; i < mesh.count; i++) {
      matrix.setPosition(Math.random() - 0.5, Math.random() * 2, Math.random() - 0.5);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.setHex(0xffffff * Math.random()));
    }
  }
  physics.addScene(scene);
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    createBackground: WebGLBackground,
    createShadowMap: WebGLShadowMap,
    shaders: {
      MeshBasicMaterial: basicShader,
      MeshLambertMaterial: lambertShader,
      ShadowMaterial: shadowShader,
      MeshDepthMaterial: depthShader,
    },
  });
  cleanup.push(() => renderer.dispose());
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  if (renderer.shadowMap === null) throw new Error("Missing shadow renderer");
  renderer.shadowMap.enabled = true;
  const stats = new Stats();
  document.body.appendChild(stats.dom);
  cleanup.push(() => stats.dom.remove());
  const controls = new OrbitControls(camera, canvas);
  cleanup.push(() => controls.dispose());
  controls.target.y = 0.5;
  controls.update();
  const position = new Vector3();
  const interval = setInterval(() => {
    for (const mesh of [boxes, spheres]) {
      position.set(0, Math.random() + 1, 0);
      physics.setMeshPosition(mesh, position, Math.floor(Math.random() * mesh.count));
    }
  }, 1000 / 60);
  cleanup.push(() => clearInterval(interval));
  function resize(): void {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener("resize", resize);
  cleanup.push(() => {
    window.removeEventListener("resize", resize);
    renderer.setAnimationLoop(null);
  });
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
    stats.update();
    canvas.dataset.state = "rendered";
  });
}

void init().catch((error: unknown) => {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
  dispose();
});
