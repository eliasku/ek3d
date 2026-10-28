import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { RapierHelper } from "ek3d/addons/helpers/RapierHelper";
import { Stats } from "ek3d/addons/libs/Stats";
import { RapierPhysics, type RapierBody } from "ek3d/addons/physics/RapierPhysics";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { CapsuleGeometry } from "ek3d/geometries/CapsuleGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";
import { loadRapier } from "./rapier-runtime";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing Rapier joints canvas");
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

async function init(): Promise<void> {
  canvas.dataset.state = "loading";
  const runtime = await loadRapier();
  if (disposed) return;
  const physics = RapierPhysics(runtime);
  cleanup.push(() => physics.dispose());
  const scene = new Scene();
  cleanup.push(() => disposeObject(scene));
  scene.background = new Color(0xbfd1e5);
  const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 3, 10);
  scene.add(new HemisphereLight(0x555555, 0xffffff));
  const light = new DirectionalLight(0xffffff, 4);
  light.position.set(0, 12.5, 12.5);
  light.castShadow = true;
  light.shadow.radius = 3;
  light.shadow.blurSamples = 8;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.left = light.shadow.camera.bottom = -10;
  light.shadow.camera.right = light.shadow.camera.top = 10;
  light.shadow.camera.near = 1;
  light.shadow.camera.far = 50;
  scene.add(light);
  cleanup.push(() => light.shadow.dispose());
  const pivot = new Mesh(new SphereGeometry(0.5), new MeshStandardMaterial({ color: 0xff0000 }));
  pivot.position.y = 6;
  pivot.userData.physics = { mass: 0 };
  scene.add(pivot);
  physics.addScene(scene);
  const helper = new RapierHelper(physics.world);
  scene.add(helper);
  function addLink(link: Mesh, x: number): Mesh {
    const mesh = new Mesh(new CapsuleGeometry(0.25, 1.8), new MeshStandardMaterial({ color: 0xcccc00 }));
    mesh.rotateZ(Math.PI * 0.5);
    mesh.position.set(x + 0.9, 5.8, 0);
    scene.add(mesh);
    physics.addMesh(mesh, 1, 0.5);
    const joint = physics.RAPIER.JointData.spherical(
      new physics.RAPIER.Vector3(0, link === pivot ? -0.5 : -1.15, 0),
      new physics.RAPIER.Vector3(0, 1.15, 0),
    );
    const body1 = link.userData.physics.body as RapierBody;
    const body2 = mesh.userData.physics.body as RapierBody;
    body2.setAngularDamping(10);
    physics.world.createImpulseJoint(joint, body1, body2, true);
    return mesh;
  }
  const link1 = addLink(pivot, 0);
  const link2 = addLink(link1, 2);
  addLink(link2, 4);
  const dfg = createDFGLUT();
  cleanup.push(() => dfg.dispose());
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    createBackground: WebGLBackground,
    createShadowMap: WebGLShadowMap,
    getDFGLUT: () => dfg,
    shaders: { MeshStandardMaterial: standardShader, LineBasicMaterial: basicShader, MeshDepthMaterial: depthShader },
  });
  cleanup.push(() => renderer.dispose());
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  if (renderer.shadowMap === null) throw new Error("Missing shadow renderer");
  renderer.shadowMap.enabled = true;
  const controls = new OrbitControls(camera, canvas);
  cleanup.push(() => controls.dispose());
  controls.target.set(0, 2, 0);
  controls.update();
  const stats = new Stats();
  document.body.appendChild(stats.dom);
  cleanup.push(() => stats.dom.remove());
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
    helper.update();
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
