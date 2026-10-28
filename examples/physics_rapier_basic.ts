import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { RoundedBoxGeometry } from "ek3d/addons/geometries/RoundedBoxGeometry";
import { RapierHelper } from "ek3d/addons/helpers/RapierHelper";
import { Stats } from "ek3d/addons/libs/Stats";
import { RapierPhysics } from "ek3d/addons/physics/RapierPhysics";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Wrapping } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
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
if (selected === null) throw new Error("Missing Rapier basic canvas");
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
  const floor = new Mesh<MeshStandardMaterial>(
    new BoxGeometry(10, 0.5, 10),
    new MeshStandardMaterial({ color: 0xffffff }),
  );
  floor.receiveShadow = true;
  floor.position.y = -0.25;
  floor.userData.physics = { mass: 0 };
  scene.add(floor);
  const texture = new TextureLoader().load(
    "/examples/textures/grid.png",
    (map) => {
      if (disposed) {
        map.dispose();
        return;
      }
      floor.material.needsUpdate = true;
    },
    undefined,
    (error) => {
      if (disposed) return;
      canvas.dataset.state = "error";
      canvas.dataset.error = String(error);
      console.error(error);
      dispose();
    },
  );
  texture.wrapS = texture.wrapT = Wrapping.Repeat;
  texture.repeat.set(20, 20);
  floor.material.map = texture;
  physics.addScene(scene);
  const helper = new RapierHelper(physics.world);
  scene.add(helper);
  const geometries = [new BoxGeometry(1, 1, 1), new SphereGeometry(0.5), new RoundedBoxGeometry(1, 1, 1, 2, 0.25)];
  const bodies = new Set<Mesh<MeshStandardMaterial>>();
  cleanup.push(() => {
    for (const mesh of bodies) {
      scene.remove(mesh);
      mesh.material.dispose();
    }
    for (const geometry of geometries) geometry.dispose();
  });
  function addBody(): void {
    const geometry = geometries[Math.floor(Math.random() * geometries.length)]!;
    const mesh = new Mesh<MeshStandardMaterial>(
      geometry,
      new MeshStandardMaterial({ color: Math.floor(Math.random() * 0xffffff) }),
    );
    mesh.castShadow = true;
    mesh.position.set(Math.random() * 2 - 1, Math.random() * 3 + 6, Math.random() * 2 - 1);
    scene.add(mesh);
    bodies.add(mesh);
    physics.addMesh(mesh, 1, 0.5);
  }
  addBody();
  const interval = setInterval(addBody, 1000);
  cleanup.push(() => clearInterval(interval));
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
  controls.enableDamping = true;
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
    for (const mesh of bodies) {
      if (mesh.position.y < -10) {
        scene.remove(mesh);
        physics.removeMesh(mesh);
        mesh.material.dispose();
        bodies.delete(mesh);
      }
    }
    helper.update();
    controls.update();
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
