import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SRGBColorSpace } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { ImageBitmapLoader } from "ek3d/loaders/ImageBitmapLoader";
import { ImageLoader } from "ek3d/loaders/ImageLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Texture } from "ek3d/textures/Texture";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing ImageBitmap canvas");
const canvas: HTMLCanvasElement = canvasSel;
const camera = new PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 1500);
camera.position.set(0, 4, 7);
camera.lookAt(0, 0, 0);
const scene = new Scene();
const group = new Group();
scene.add(group);
const grid = new GridHelper(4, 12, 0x888888, 0x444444);
group.add(grid);
const cubes = new Group();
group.add(cubes);
const geometry = new BoxGeometry();
const materials: MeshBasicMaterial[] = [];
const bitmaps = new Set<ImageBitmap>();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader, LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
let disposed = false;
let frames = 0;
let imageCount = 0;
let bitmapCount = 0;
let closedCount = 0;
canvas.dataset.state = "loading";
const bitmapLoader = new ImageBitmapLoader().setOptions({ imageOrientation: "flipY" });
const imageLoader = new ImageLoader().setCrossOrigin("*");
const asset = "/examples/textures/planets/earth_atmos_2048.jpg";

function fail(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}

function addCube(image: HTMLImageElement | ImageBitmap, bitmap: boolean): void {
  if (disposed) {
    if (image instanceof ImageBitmap) image.close();
    return;
  }
  const texture = new Texture(image);
  texture.needsUpdate = true;
  texture.colorSpace = SRGBColorSpace;
  const material = new MeshBasicMaterial({ color: bitmap ? 0xffffff : 0xff8888, map: texture });
  materials.push(material);
  if (image instanceof ImageBitmap) {
    bitmaps.add(image);
    texture.onUpdate = () => {
      image.close();
      bitmaps.delete(image);
      texture.onUpdate = null;
      canvas.dataset.closedBitmaps = String(++closedCount);
    };
  }
  const cube = new Mesh(geometry, material);
  cube.position.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
  cube.rotation.set(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI);
  cubes.add(cube);
  if (bitmap) bitmapCount++;
  else imageCount++;
  canvas.dataset.images = String(imageCount);
  canvas.dataset.bitmaps = String(bitmapCount);
}

const timeouts = [300, 600, 900, 1300, 1600, 1900].map((delay, index) =>
  window.setTimeout(() => {
    if (disposed) return;
    const url = `${asset}?${performance.now()}`;
    if (index < 3) imageLoader.load(url, (image) => addCube(image, false), undefined, fail);
    else bitmapLoader.load(url, (image) => addCube(image, true), undefined, fail);
  }, delay),
);

function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  group.rotation.y = performance.now() / 3000;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (imageCount === 3 && bitmapCount === 3 && closedCount === 3 && canvas.dataset.state !== "error")
    canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  for (const timeout of timeouts) window.clearTimeout(timeout);
  bitmapLoader.abort();
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  for (const material of materials) {
    if (material.map) material.map.onUpdate = null;
    material.map?.dispose();
    material.dispose();
  }
  for (const bitmap of bitmaps) bitmap.close();
  bitmaps.clear();
  geometry.dispose();
  grid.geometry.dispose();
  grid.material.dispose();
  renderer.dispose();
});
