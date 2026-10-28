import { GLTFExporter } from "ek3d/addons/exporters/GLTFExporter";
import { GLTFLoader, type MeshoptDecoderLike } from "ek3d/addons/loaders/GLTFLoader";
import { KTX2Loader } from "ek3d/addons/loaders/KTX2Loader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import * as TextureUtils from "ek3d/addons/utils/WebGLTextureUtils";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import {
  ACESFilmicToneMapping,
  DoubleSide,
  LinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
} from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import type { Object3D } from "ek3d/core/Object3D";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { CircleGeometry } from "ek3d/geometries/CircleGeometry";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { LatheGeometry } from "ek3d/geometries/LatheGeometry";
import { OctahedronGeometry } from "ek3d/geometries/OctahedronGeometry";
import { RingGeometry } from "ek3d/geometries/RingGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { TetrahedronGeometry } from "ek3d/geometries/TetrahedronGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { AxesHelper } from "ek3d/helpers/AxesHelper";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { FileLoader } from "ek3d/loaders/FileLoader";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { Color } from "ek3d/math/Color";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Vector2 } from "ek3d/math/Vector2";
import { Group } from "ek3d/objects/Group";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { Line } from "ek3d/objects/Line";
import { LineLoop } from "ek3d/objects/LineLoop";
import { Mesh } from "ek3d/objects/Mesh";
import { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { Scene } from "ek3d/scenes/Scene";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import { DataTexture } from "ek3d/textures/DataTexture";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (canvas === null) throw new Error("Missing glTF exporter canvas");
const lut = createDFGLUT();
const ltc = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => lut,
  ltcTextures: ltc,
  shaders: {
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
    MeshLambertMaterial: lambertShader,
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
    PointsMaterial: pointsShader,
  },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
const scene1 = new Scene();
scene1.name = "Scene1";
const scene2 = new Scene();
scene2.name = "Scene2";
const root = new Group();
root.add(scene1, scene2);
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
camera.position.set(600, 400, 0);
camera.name = "PerspectiveCamera";
scene1.add(camera);
const ambient = new AmbientLight(0xcccccc);
ambient.name = "AmbientLight";
scene1.add(ambient);
const directional = new DirectionalLight(0xffffff, 3);
directional.target.position.set(0, 0, -1);
directional.add(directional.target);
directional.lookAt(-1, -1, 0);
directional.name = "DirectionalLight";
scene1.add(directional);
const grid = new GridHelper(2000, 20, 0xc1c1c1, 0x8d8d8d);
grid.position.y = -50;
grid.name = "Grid";
scene1.add(grid);
const axes = new AxesHelper(500);
axes.name = "AxesHelper";
scene1.add(axes);
const textures = new TextureLoader();
const mapGrid = textures.load("/examples/textures/uv_grid_opengl.jpg");
mapGrid.wrapS = mapGrid.wrapT = RepeatWrapping;
mapGrid.colorSpace = SRGBColorSpace;
const data = new Uint8Array(100 * 100 * 4);
for (let y = 0; y < 100; y++)
  for (let x = 0; x < 100; x++) {
    const i = 4 * (100 * y + x);
    data[i] = Math.round((255 * y) / 99);
    data[i + 1] = Math.round(255 - (255 * y) / 99);
    data[i + 3] = 255;
  }
const gradient = new DataTexture(data, 100, 100, RGBAFormat);
gradient.minFilter = gradient.magFilter = LinearFilter;
gradient.needsUpdate = true;
function addMesh(
  geometry: BufferGeometry,
  material: MeshBasicMaterial | MeshStandardMaterial | MeshLambertMaterial,
  x: number,
  z: number,
  name = "",
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, 0, z);
  mesh.name = name;
  scene1.add(mesh);
  return mesh;
}
addMesh(
  new IcosahedronGeometry(75, 0),
  new MeshBasicMaterial({ color: 0xffffff, map: mapGrid }),
  -200,
  200,
  "Icosahedron",
);
addMesh(
  new OctahedronGeometry(75, 1),
  new MeshBasicMaterial({ color: 0x0000ff, wireframe: true }),
  0,
  200,
  "Octahedron",
);
addMesh(
  new TetrahedronGeometry(75, 0),
  new MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 }),
  200,
  200,
  "Tetrahedron",
);
const sphere = addMesh(
  new SphereGeometry(70, 10, 10),
  new MeshStandardMaterial({
    color: 0xffff00,
    metalness: 0.5,
    roughness: 1,
    flatShading: true,
    map: gradient,
    bumpMap: mapGrid,
  }),
  0,
  0,
  "Sphere",
);
addMesh(
  new CylinderGeometry(10, 80, 100),
  new MeshStandardMaterial({ color: 0xff00ff, flatShading: true }),
  200,
  0,
  "Cylinder",
);
addMesh(
  new TorusKnotGeometry(50, 15, 40, 10),
  new MeshStandardMaterial({ color: 0xff0000, roughness: 1 }),
  -200,
  0,
  "Cylinder",
);
const wood = new MeshStandardMaterial({
  map: textures.load("/examples/textures/hardwood2_diffuse.jpg"),
  side: DoubleSide,
});
const cube = addMesh(new BoxGeometry(40, 100, 100), wood, -200, 400, "Cube");
const subCube = new Mesh(new BoxGeometry(40, 40, 40, 2, 2, 2), wood);
subCube.position.z = 50;
subCube.rotation.set(0, 45, 0);
subCube.name = "SubCube";
cube.add(subCube);
const group = new Group();
group.name = "Group";
const subGroup = new Group();
subGroup.name = "subGroup";
subGroup.position.y = 50;
group.add(subGroup);
scene1.add(group);
const groupCube = new Mesh(new BoxGeometry(30, 30, 30), wood);
groupCube.name = "Cube in group";
groupCube.position.z = 400;
subGroup.add(groupCube);
const linePositions = new Float32Array(300);
for (let i = 0; i < 100; i++) {
  linePositions[i * 3] = i;
  linePositions[i * 3 + 1] = Math.sin(i / 2) * 20;
}
const lineGeometry = new BufferGeometry();
lineGeometry.setAttribute("position", new BufferAttribute(linePositions, 3));
const line = new Line(lineGeometry, new LineBasicMaterial({ color: 0xffff00 }));
line.position.set(-50, 0, -200);
scene1.add(line);
const loopPositions = new Float32Array(15);
for (let i = 0; i < 5; i++) {
  const s = (i * Math.PI * 2) / 5;
  loopPositions[i * 3] = 70 * Math.sin(s);
  loopPositions[i * 3 + 1] = 70 * Math.cos(s);
}
const loopGeometry = new BufferGeometry();
loopGeometry.setAttribute("position", new BufferAttribute(loopPositions, 3));
const loop = new LineLoop(loopGeometry, new LineBasicMaterial({ color: 0xffff00 }));
loop.position.z = -200;
scene1.add(loop);
const pointPositions = new Float32Array(300);
for (let i = 0; i < 100; i++) {
  pointPositions[i * 3] = -50 + Math.random() * 100;
  pointPositions[i * 3 + 1] = Math.random() * 100;
  pointPositions[i * 3 + 2] = -50 + Math.random() * 100;
}
const pointGeometry = new BufferGeometry();
pointGeometry.setAttribute("position", new BufferAttribute(pointPositions, 3));
const points = new Points(pointGeometry, new PointsMaterial({ color: 0xffff00, size: 5 }));
points.name = "Points";
points.position.set(-200, 0, -200);
scene1.add(points);
const height = 1000;
const aspect = window.innerWidth / window.innerHeight;
const ortho = new OrthographicCamera(-height * aspect, height * aspect, height, -height, 0, 2000);
ortho.position.set(600, 400, 0);
ortho.lookAt(0, 0, 0);
ortho.name = "OrthographicCamera";
scene1.add(ortho);
const lambert = new MeshLambertMaterial({ color: 0xffff00, side: DoubleSide });
addMesh(new CircleGeometry(50, 20, 0, Math.PI * 2), lambert, 200, -400);
addMesh(new RingGeometry(10, 50, 20, 5, 0, Math.PI * 2), lambert, 0, -400);
addMesh(new CylinderGeometry(25, 75, 100, 40, 5), lambert, -200, -400);
const profile: Vector2[] = [];
for (let i = 0; i < 50; i++) profile.push(new Vector2(Math.sin(i * 0.2) * Math.sin(i * 0.1) * 15 + 50, (i - 5) * 2));
addMesh(new LatheGeometry(profile, 20), lambert, 200, 400);
const hidden = addMesh(new BoxGeometry(200, 200, 200), new MeshBasicMaterial({ color: 0xff0000 }), 0, 0, "CubeHidden");
hidden.visible = false;
const instanceMaterial = new MeshBasicMaterial({ color: 0xffffff });
const instances = new InstancedMesh(new BoxGeometry(10, 10, 10, 2, 2, 2), instanceMaterial, 50);
const matrix = new Matrix4();
const color = new Color();
for (let i = 0; i < 50; i++) {
  matrix.setPosition(Math.random() * 100 - 50, Math.random() * 100 - 50, Math.random() * 100 - 50);
  instances.setMatrixAt(i, matrix);
  instances.setColorAt(i, color.setHSL(i / 50, 1, 0.5));
}
instances.position.set(400, 0, 200);
scene1.add(instances);
const secondCube = new Mesh(new BoxGeometry(100, 100, 100), instanceMaterial);
secondCube.name = "Cube2ndScene";
scene2.add(secondCube);
const image = document.createElement("canvas");
image.width = image.height = 64;
const context = image.getContext("2d");
if (context === null) throw new Error("Unable to create WebP texture");
context.fillStyle = "#005BBB";
context.fillRect(0, 0, 64, 64);
context.fillStyle = "#FFD500";
context.fillRect(16, 16, 32, 32);
const webpTexture = new CanvasTexture(image);
webpTexture.userData.mimeType = "image/webp";
webpTexture.colorSpace = SRGBColorSpace;
const webpBox = addMesh(new BoxGeometry(100, 100, 100), new MeshBasicMaterial({ map: webpTexture }), 400, 0, "WebPBox");
let model: Object3D | null = null;
let coffeemat: Object3D | null = null;
let disposed = false;
new GLTFLoader().load(
  "/examples/models/gltf/ShaderBall.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    model = gltf.scene;
    model.scale.setScalar(50);
    model.position.set(200, -40, -200);
    scene1.add(model);
  },
  undefined,
  console.error,
);
const ktx2Loader = new KTX2Loader().setTranscoderPath("/libs/basis/").detectSupport(renderer);
// The vendor decoder is served untransformed as a public asset, not a bundled module.
async function loadCompressed(): Promise<void> {
  const source = (await new FileLoader()
    .setPath("/examples/libs/")
    .setResponseType("text")
    .loadAsync("meshopt_decoder.module.js")) as unknown as string;
  const decoderURL = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  let decoder: MeshoptDecoderLike;
  try {
    decoder = ((await import(/* @vite-ignore */ decoderURL)) as { MeshoptDecoder: MeshoptDecoderLike }).MeshoptDecoder;
  } finally {
    URL.revokeObjectURL(decoderURL);
  }
  if (disposed) return;
  const loader = new GLTFLoader().setPath("/examples/models/gltf/");
  loader.setKTX2Loader(ktx2Loader);
  loader.setMeshoptDecoder(decoder);
  loader.load(
    "coffeemat.glb",
    (gltf) => {
      if (disposed) {
        disposeObject(gltf.scene);
        return;
      }
      coffeemat = gltf.scene;
      coffeemat.position.set(400, 0, -200);
      scene1.add(coffeemat);
    },
    undefined,
    console.error,
  );
}
void loadCompressed().catch(console.error);
const link = document.createElement("a");
link.style.display = "none";
document.body.appendChild(link);
let url: string | null = null;
function exportGLTF(input: Object3D | Object3D[]): void {
  new GLTFExporter().setTextureUtils(TextureUtils).parse(
    input,
    (result) => {
      if (disposed) return;
      const binary = result instanceof ArrayBuffer;
      const data = binary ? result : JSON.stringify(result, null, 2);
      if (!binary) console.log(data);
      if (url !== null) URL.revokeObjectURL(url);
      url = URL.createObjectURL(new Blob([data], { type: binary ? "application/octet-stream" : "text/plain" }));
      link.href = url;
      link.download = binary ? "scene.glb" : "scene.gltf";
      link.click();
    },
    (error) => console.error("An error happened during parsing", error),
    { trs: params.trs, onlyVisible: params.onlyVisible, binary: params.binary, maxTextureSize: params.maxTextureSize },
  );
}
const params = {
  trs: false,
  onlyVisible: true,
  binary: false,
  maxTextureSize: 4096,
  exportScene1: () => exportGLTF(scene1),
  exportScenes: () => exportGLTF([scene1, scene2]),
  exportSphere: () => exportGLTF(sphere),
  exportModel: () => {
    if (model !== null) exportGLTF(model);
  },
  exportObjects: () => exportGLTF([sphere, grid]),
  exportSceneObject: () => exportGLTF([scene1, grid]),
  exportCompressedObject: () => {
    if (coffeemat !== null) exportGLTF([coffeemat]);
  },
  exportWebPModel: () => exportGLTF(webpBox),
};
const gui = new GUI();
const settings = gui.addFolder("Settings");
settings.add(params, "trs").name("Use TRS");
settings.add(params, "onlyVisible").name("Only Visible Objects");
settings.add(params, "binary").name("Binary (GLB)");
settings.add(params, "maxTextureSize", 2, 8192).name("Max Texture Size").step(1);
const exports = gui.addFolder("Export");
exports.add(params, "exportScene1").name("Export Scene 1");
exports.add(params, "exportScenes").name("Export Scene 1 and 2");
exports.add(params, "exportSphere").name("Export Sphere");
exports.add(params, "exportModel").name("Export Model");
exports.add(params, "exportObjects").name("Export Sphere With Grid");
exports.add(params, "exportSceneObject").name("Export Scene 1 and Object");
exports.add(params, "exportCompressedObject").name("Export Coffeemat (from compressed data)");
exports.add(params, "exportWebPModel").name("Export WebP Model (EXT_texture_webp)");
gui.open();
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  const timer = Date.now() * 0.0001;
  camera.position.x = Math.cos(timer) * 800;
  camera.position.z = Math.sin(timer) * 800;
  camera.lookAt(scene1.position);
  renderer.render(scene1, camera);
});
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    window.removeEventListener("resize", resize);
    renderer.setAnimationLoop(null);
    gui.destroy();
    ktx2Loader.dispose();
    disposeObject(root);
    lut.dispose();
    ltc.LTC_FLOAT_1.dispose();
    ltc.LTC_FLOAT_2.dispose();
    ltc.LTC_HALF_1.dispose();
    ltc.LTC_HALF_2.dispose();
    renderer.dispose();
    if (url !== null) URL.revokeObjectURL(url);
    link.remove();
  },
  { once: true },
);
