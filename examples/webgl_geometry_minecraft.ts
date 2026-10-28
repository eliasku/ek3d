import { FirstPersonControls } from "ek3d/addons/controls/FirstPersonControls";
import { ImprovedNoise } from "ek3d/addons/math/ImprovedNoise";
import { mergeGeometries } from "ek3d/addons/utils/BufferGeometryUtils";
import { SRGBColorSpace, DoubleSide, NearestFilter } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { Timer } from "ek3d/core/Timer";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { Scene } from "ek3d/scenes/Scene";

const element = document.querySelector<HTMLCanvasElement>("#scene");
if (element === null) throw new Error("Missing minecraft example canvas");
const canvas: HTMLCanvasElement = element;

const worldWidth = 128;
const worldDepth = 128;
const worldHalfWidth = worldWidth / 2;
const worldHalfDepth = worldDepth / 2;
const data = generateHeight(worldWidth, worldDepth);

const timer = new Timer();
timer.connect(document);

const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 20000);
camera.position.y = getY(worldHalfWidth, worldHalfDepth) * 100 + 100;

const scene = new Scene();
scene.background = new Color(0xbfd1e5);

// sides

const matrix = new Matrix4();

const pxGeometry = new PlaneGeometry(100, 100);
(pxGeometry.attributes.uv as BufferAttributeNarrow).array[1] = 0.5;
(pxGeometry.attributes.uv as BufferAttributeNarrow).array[3] = 0.5;
pxGeometry.rotateY(Math.PI / 2);
pxGeometry.translate(50, 0, 0);

const nxGeometry = new PlaneGeometry(100, 100);
(nxGeometry.attributes.uv as BufferAttributeNarrow).array[1] = 0.5;
(nxGeometry.attributes.uv as BufferAttributeNarrow).array[3] = 0.5;
nxGeometry.rotateY(-Math.PI / 2);
nxGeometry.translate(-50, 0, 0);

const pyGeometry = new PlaneGeometry(100, 100);
(pyGeometry.attributes.uv as BufferAttributeNarrow).array[5] = 0.5;
(pyGeometry.attributes.uv as BufferAttributeNarrow).array[7] = 0.5;
pyGeometry.rotateX(-Math.PI / 2);
pyGeometry.translate(0, 50, 0);

const pzGeometry = new PlaneGeometry(100, 100);
(pzGeometry.attributes.uv as BufferAttributeNarrow).array[1] = 0.5;
(pzGeometry.attributes.uv as BufferAttributeNarrow).array[3] = 0.5;
pzGeometry.translate(0, 0, 50);

const nzGeometry = new PlaneGeometry(100, 100);
(nzGeometry.attributes.uv as BufferAttributeNarrow).array[1] = 0.5;
(nzGeometry.attributes.uv as BufferAttributeNarrow).array[3] = 0.5;
nzGeometry.rotateY(Math.PI);
nzGeometry.translate(0, 0, -50);

const geometries: PlaneGeometry[] = [];

for (let z = 0; z < worldDepth; z++) {
  for (let x = 0; x < worldWidth; x++) {
    const h = getY(x, z);

    matrix.makeTranslation(x * 100 - worldHalfWidth * 100, h * 100, z * 100 - worldHalfDepth * 100);

    const px = getY(x + 1, z);
    const nx = getY(x - 1, z);
    const pz = getY(x, z + 1);
    const nz = getY(x, z - 1);

    geometries.push(pyGeometry.clone().applyMatrix4(matrix) as PlaneGeometry);

    if ((px !== h && px !== h + 1) || x === 0) {
      geometries.push(pxGeometry.clone().applyMatrix4(matrix) as PlaneGeometry);
    }

    if ((nx !== h && nx !== h + 1) || x === worldWidth - 1) {
      geometries.push(nxGeometry.clone().applyMatrix4(matrix) as PlaneGeometry);
    }

    if ((pz !== h && pz !== h + 1) || z === worldDepth - 1) {
      geometries.push(pzGeometry.clone().applyMatrix4(matrix) as PlaneGeometry);
    }

    if ((nz !== h && nz !== h + 1) || z === 0) {
      geometries.push(nzGeometry.clone().applyMatrix4(matrix) as PlaneGeometry);
    }
  }
}

const geometry = mergeGeometries(geometries)!;
geometry.computeBoundingSphere();

for (const g of geometries) g.dispose();
for (const g of [pxGeometry, nxGeometry, pyGeometry, pzGeometry, nzGeometry]) g.dispose();

const texture = await new TextureLoader().loadAsync("/examples/textures/minecraft/atlas.png");
texture.colorSpace = SRGBColorSpace;
texture.magFilter = NearestFilter;

const lambertMaterial = new MeshLambertMaterial({ map: texture, side: DoubleSide });
const mesh = new Mesh(geometry, lambertMaterial);
scene.add(mesh);

const ambientLight = new AmbientLight(0xeeeeee, 3);
scene.add(ambientLight);

const directionalLight = new DirectionalLight(0xffffff, 12);
directionalLight.position.set(1, 1, 0.5).normalize();
scene.add(directionalLight);

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshLambertMaterial: lambertShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new FirstPersonControls(camera, canvas);

controls.movementSpeed = 1000;
controls.lookSpeed = 0.2;
controls.lookVertical = true;

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function generateHeight(width: number, height: number): number[] {
  const heightData: number[] = [];
  const perlin = new ImprovedNoise();
  const size = width * height;
  const z = Math.random() * 100;

  let quality = 2;

  for (let j = 0; j < 4; j++) {
    if (j === 0) for (let i = 0; i < size; i++) heightData[i] = 0;

    for (let i = 0; i < size; i++) {
      const x = i % width;
      const y = Math.floor(i / width);
      heightData[i] += perlin.noise(x / quality, y / quality, z) * quality;
    }

    quality *= 4;
  }

  return heightData;
}

function getY(x: number, z: number): number {
  return Math.floor((data[x + z * worldWidth] ?? 0) * 0.15);
}

function render(): void {
  controls.update(timer.getDelta());
  renderer.render(scene, camera);
}

function publishState(): void {
  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}

function animate(): void {
  timer.update();

  render();
  publishState();
}

renderer.setAnimationLoop(animate);

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    timer.disconnect();
    controls.dispose();
    renderer.setAnimationLoop(null);
    geometry.dispose();
    lambertMaterial.dispose();
    texture.dispose();
    renderer.dispose();
  },
  { once: true },
);

/** uv attribute type shared by every side geometry of this page. */
type BufferAttributeNarrow = { array: number[] | Float32Array };
