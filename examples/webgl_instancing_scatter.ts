import { MeshSurfaceSampler } from "ek3d/addons/math/MeshSurfaceSampler";
import { GLTFLoader, type GLTF } from "ek3d/addons/loaders/GLTFLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { DynamicDrawUsage } from "ek3d/constants";
import type { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Object3D } from "ek3d/core/Object3D";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import type { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Vector3 } from "ek3d/math/Vector3";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { Mesh } from "ek3d/objects/Mesh";
import { Scene } from "ek3d/scenes/Scene";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing instancing scatter example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const dfgLUT = createDFGLUT();

const api = {
  count: 2000,
  distribution: "random",
  resample: resample,
  surfaceColor: 0xfff784,
  backgroundColor: 0xe39469,
};

let camera: PerspectiveCamera | undefined;
let scene: Scene | undefined;
let renderer: WebGLRenderer | undefined;
let stats: Stats | undefined;
let gui: GUI | undefined;

let stemMesh: InstancedMesh | undefined;
let blossomMesh: InstancedMesh | undefined;
let stemGeometry: BufferGeometry | undefined;
let blossomGeometry: BufferGeometry | undefined;
let stemMaterial: MeshStandardMaterial | undefined;
let blossomMaterial: MeshStandardMaterial | undefined;

let sampler: MeshSurfaceSampler | undefined;

const count = api.count;
const ages = new Float32Array(count);
const scales = new Float32Array(count);
const dummy = new Object3D();

const _position = new Vector3();
const _normal = new Vector3();
const _scale = new Vector3();

const surfaceGeometry = new TorusKnotGeometry(10, 3, 100, 16).toNonIndexed();
const surfaceMaterial = new MeshLambertMaterial({ color: api.surfaceColor, wireframe: false });
const surface = new Mesh(surfaceGeometry, surfaceMaterial);

// Source: https://gist.github.com/gre/1650294
function easeOutCubic(t: number): number {
  return --t * t * t + 1;
}

// Scaling curve causes particles to grow quickly, ease gradually into full scale, then
// disappear quickly. More of the particle's lifetime is spent around full scale.
function scaleCurve(t: number): number {
  return Math.abs(easeOutCubic((t > 0.5 ? 1 - t : t) * 2));
}

let disposed = false;
let frames = 0;

const loader = new GLTFLoader().setPath("/examples/models/gltf/Flower/");

loader.load(
  "Flower.glb",
  (gltf: GLTF) => {
    if (disposed) return;

    const sourceStem = gltf.scene.getObjectByName("Stem");
    const sourceBlossom = gltf.scene.getObjectByName("Blossom");
    if (!(sourceStem instanceof Mesh) || !(sourceBlossom instanceof Mesh)) {
      throw new Error("Flower.glb did not provide Stem and Blossom meshes");
    }

    stemGeometry = sourceStem.geometry.clone();
    blossomGeometry = sourceBlossom.geometry.clone();

    const defaultTransform = new Matrix4().makeRotationX(Math.PI).multiply(new Matrix4().makeScale(7, 7, 7));

    stemGeometry.applyMatrix4(defaultTransform);
    blossomGeometry.applyMatrix4(defaultTransform);

    stemMaterial = sourceStem.material as MeshStandardMaterial;
    blossomMaterial = sourceBlossom.material as MeshStandardMaterial;

    stemMesh = new InstancedMesh(stemGeometry, stemMaterial, count);
    blossomMesh = new InstancedMesh(blossomGeometry, blossomMaterial, count);

    // Assign random colors to the blossoms.
    const color = new Color();
    const blossomPalette = [0xf20587, 0xf2d479, 0xf2c879, 0xf2b077, 0xf24405];

    for (let i = 0; i < count; i++) {
      color.setHex(blossomPalette[Math.floor(Math.random() * blossomPalette.length)]);
      blossomMesh.setColorAt(i, color);
    }

    // Instance matrices will be updated every frame.
    stemMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    blossomMesh.instanceMatrix.setUsage(DynamicDrawUsage);

    resample();

    init();
  },
  undefined,
  (error: unknown) => {
    if (disposed) return;

    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  },
);

function init(): void {
  const stem = stemMesh;
  const blossom = blossomMesh;
  if (stem === undefined || blossom === undefined) throw new Error("scatter meshes were not created");

  camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(25, 25, 25);
  camera.lookAt(0, 0, 0);

  //

  scene = new Scene();
  scene.background = new Color(api.backgroundColor);

  const pointLight = new PointLight(0xaa8899, 2.5, 0, 0);
  pointLight.position.set(50, -25, 75);
  scene.add(pointLight);

  scene.add(new AmbientLight(0xffffff, 3));

  //

  scene.add(stem);
  scene.add(blossom);

  scene.add(surface);

  //

  gui = new GUI();
  gui.add(api, "count", 0, count).onChange(() => {
    stem.count = api.count;
    blossom.count = api.count;
  });

  gui.add(api, "distribution").options(["random", "weighted"]).onChange(resample);
  gui.add(api, "resample");

  //

  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    getDFGLUT: () => dfgLUT,
    shaders: {
      MeshStandardMaterial: standardShader,
      MeshLambertMaterial: lambertShader,
    },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);

  //

  stats = new Stats();
  document.body.appendChild(stats.dom);

  //

  window.addEventListener("resize", onWindowResize);
  window.addEventListener(
    "pagehide",
    () => {
      disposed = true;
      window.removeEventListener("resize", onWindowResize);
      renderer?.setAnimationLoop(null);
      gui?.destroy();
      stemMesh?.dispose();
      blossomMesh?.dispose();
      stemGeometry?.dispose();
      blossomGeometry?.dispose();
      stemMaterial?.dispose();
      blossomMaterial?.dispose();
      surface.geometry.dispose();
      surfaceMaterial.dispose();
      stats?.dom.remove();
      dfgLUT.dispose();
      renderer?.dispose();
    },
    { once: true },
  );
}

function resample(): void {
  const stem = stemMesh;
  const blossom = blossomMesh;
  if (stem === undefined || blossom === undefined) return;

  const positionAttribute = surface.geometry.getAttribute("position");
  if (positionAttribute === undefined) throw new Error("surface geometry has no position attribute");

  console.info(`Sampling ${count} points from a surface with ${positionAttribute.count} vertices...`);

  //

  console.time(".build()");

  sampler = new MeshSurfaceSampler(surface).setWeightAttribute(api.distribution === "weighted" ? "uv" : null).build();

  console.timeEnd(".build()");

  //

  console.time(".sample()");

  for (let i = 0; i < count; i++) {
    ages[i] = Math.random();
    scales[i] = scaleCurve(ages[i]);

    resampleParticle(i);
  }

  console.timeEnd(".sample()");

  stem.instanceMatrix.needsUpdate = true;
  blossom.instanceMatrix.needsUpdate = true;

  canvas.dataset.distribution = api.distribution;
  canvas.dataset.samples = String(count);
}

function resampleParticle(i: number): void {
  const stem = stemMesh;
  const blossom = blossomMesh;
  if (stem === undefined || blossom === undefined || sampler === undefined) return;

  sampler.sample(_position, _normal);
  _normal.add(_position);

  dummy.position.copy(_position);
  dummy.scale.set(scales[i], scales[i], scales[i]);
  dummy.lookAt(_normal);
  dummy.updateMatrix();

  stem.setMatrixAt(i, dummy.matrix);
  blossom.setMatrixAt(i, dummy.matrix);
}

function updateParticle(i: number): void {
  const stem = stemMesh;
  const blossom = blossomMesh;
  if (stem === undefined || blossom === undefined) return;

  // Update lifecycle.

  ages[i] += 0.005;

  if (ages[i] >= 1) {
    ages[i] = 0.001;
    scales[i] = scaleCurve(ages[i]);

    resampleParticle(i);

    return;
  }

  // Update scale.

  const prevScale = scales[i];
  scales[i] = scaleCurve(ages[i]);
  _scale.set(scales[i] / prevScale, scales[i] / prevScale, scales[i] / prevScale);

  // Update transform.

  stem.getMatrixAt(i, dummy.matrix);
  dummy.matrix.scale(_scale);
  stem.setMatrixAt(i, dummy.matrix);
  blossom.setMatrixAt(i, dummy.matrix);
}

function onWindowResize(): void {
  if (camera === undefined || renderer === undefined) return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

//

function animate(): void {
  render();

  stats?.update();
}

function render(): void {
  const stem = stemMesh;
  const blossom = blossomMesh;
  if (scene === undefined || camera === undefined || renderer === undefined) return;

  if (stem !== undefined && blossom !== undefined) {
    const time = Date.now() * 0.001;

    scene.rotation.x = Math.sin(time / 4);
    scene.rotation.y = Math.sin(time / 2);

    for (let i = 0; i < api.count; i++) {
      updateParticle(i);
    }

    stem.instanceMatrix.needsUpdate = true;
    blossom.instanceMatrix.needsUpdate = true;

    stem.computeBoundingSphere();
    blossom.computeBoundingSphere();
  }

  renderer.render(scene, camera);

  frames++;
  canvas.dataset.frames = String(frames);
  canvas.dataset.state = "rendered";
  if (stemMesh !== undefined) canvas.dataset.loaded = "true";
}
