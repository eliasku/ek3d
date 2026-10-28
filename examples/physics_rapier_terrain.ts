import type { RapierBody } from "ek3d/addons/physics/RapierPhysics";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { RapierPhysics } from "ek3d/addons/physics/RapierPhysics";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { Timer } from "ek3d/core/Timer";
import { RepeatWrapping } from "ek3d/constants";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { Color } from "ek3d/math/Color";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";
import { loadRapier } from "./rapier-runtime";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing Rapier canvas");
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
  scene.background = new Color(0xbfd1e5);
  cleanup.push(() => disposeObject(scene));
  const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.2, 2000);

  const light = new DirectionalLight(0xffffff, 3);
  light.position.set(100, 100, 50);
  light.castShadow = true;
  light.shadow.camera.left = -50;
  light.shadow.camera.right = 50;
  light.shadow.camera.top = 50;
  light.shadow.camera.bottom = -50;
  light.shadow.camera.near = 200 / 30;
  light.shadow.camera.far = 200;
  light.shadow.mapSize.set(2048, 2048);

  scene.add(light);
  cleanup.push(() => light.shadow.dispose());
  const dfg = createDFGLUT();
  cleanup.push(() => dfg.dispose());
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    createBackground: WebGLBackground,
    createEnvironments: WebGLEnvironments,
    createShadowMap: WebGLShadowMap,
    getDFGLUT: () => dfg,
    shaders: { MeshPhongMaterial: phongShader, LineBasicMaterial: basicShader, MeshDepthMaterial: depthShader },
  });
  cleanup.push(() => renderer.dispose());
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  if (!renderer.shadowMap) throw new Error("Missing shadow renderer");
  renderer.shadowMap.enabled = true;
  const controls = new OrbitControls(camera, canvas);
  cleanup.push(() => controls.dispose());
  controls.enableZoom = false;
  const stats = new Stats();
  document.body.appendChild(stats.dom);
  cleanup.push(() => stats.dom.remove());
  function resize(): void {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener("resize", resize);
  cleanup.push(() => window.removeEventListener("resize", resize));
  const width = 128,
    depth = 128,
    minHeight = -2,
    maxHeight = 8;
  const heights = new Float32Array(width * depth);
  for (let j = 0; j < depth; j++) {
    for (let i = 0; i < width; i++) {
      const radius = Math.sqrt(((i - width / 2) / (width / 2)) ** 2 + ((j - depth / 2) / (depth / 2)) ** 2);
      heights[j * width + i] = (Math.sin(radius * 12) + 1) * 0.5 * (maxHeight - minHeight) + minHeight;
    }
  }
  camera.position.set(0, heights[width / 2 + (depth / 2) * width] * (maxHeight - minHeight) + 5, 50);
  camera.lookAt(0, 0, 0);
  controls.update();
  const geometry = new PlaneGeometry(100, 100, width - 1, depth - 1);
  geometry.rotateX(-Math.PI / 2);
  const vertices = geometry.getAttribute("position") as BufferAttribute;
  for (let i = 0; i < heights.length; i++) vertices.setY(i, heights[i]);
  geometry.computeVertexNormals();
  const material = new MeshPhongMaterial({ color: 0xc7c7c7 });
  const terrain = new Mesh(geometry, material);
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  scene.add(terrain);
  new TextureLoader().load("/examples/textures/grid.png", (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(width - 1, depth - 1);
    material.map = texture;
    material.needsUpdate = true;
  });
  scene.add(new AmbientLight(0xbbbbbb));
  physics.addHeightfield(terrain, width - 1, depth - 1, heights, { x: 100, y: 1, z: 100 });
  const objects: Mesh[] = [];
  let time = 0,
    nextSpawn = 3;
  const timer = new Timer();
  timer.connect(document);
  cleanup.push(() => timer.dispose());
  function spawn(): void {
    const type = Math.ceil(Math.random() * 3);
    const size = 3;
    const radius = 1 + Math.random() * size;
    const shape =
      type === 1
        ? new SphereGeometry(radius, 20, 20)
        : type === 2
          ? new BoxGeometry(radius, 1 + Math.random() * size, 1 + Math.random() * size)
          : new CylinderGeometry(radius, radius, 1 + Math.random() * size, 20, 1);
    const object = new Mesh(shape, new MeshPhongMaterial({ color: Math.floor(Math.random() * (1 << 24)) }));
    object.position.set(
      (Math.random() - 0.5) * width * 0.6,
      maxHeight + size + 15 + Math.random() * 5,
      (Math.random() - 0.5) * depth * 0.6,
    );
    object.castShadow = true;
    object.receiveShadow = true;
    scene.add(object);
    physics.addMesh(object, size * 5, 0.3);
    objects.push(object);
    nextSpawn = time + 0.5;
  }
  cleanup.push(() => renderer.setAnimationLoop(null));
  renderer.setAnimationLoop(() => {
    timer.update();
    const delta = timer.getDelta();
    if (objects.length < 30 && time > nextSpawn) spawn();
    for (let i = objects.length - 1; i >= 0; i--) {
      const object = objects[i];
      if (object.position.y < minHeight - 10) {
        physics.removeMesh(object);
        scene.remove(object);
        disposeObject(object);
        objects.splice(i, 1);
      } else if (object.position.y > 1) {
        const body = object.userData.physics.body as RapierBody;
        body.wakeUp();
        const velocity = body.linvel();
        if (Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2) < 0.5)
          body.applyImpulse({ x: 0, y: -2, z: 0 }, true);
      }
    }
    time += delta;
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
