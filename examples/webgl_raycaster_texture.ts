import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Wrapping, ColorSpace, Mapping } from "ek3d/constants";
import { Raycaster } from "ek3d/core/Raycaster";
import type { BufferGeometry } from "ek3d/core/BufferGeometry";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { CircleGeometry } from "ek3d/geometries/CircleGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import { Texture } from "ek3d/textures/Texture";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing raycaster texture canvas");
const canvas: HTMLCanvasElement = selected;
const scene = new Scene();
scene.background = new Color(0xeeeeee);
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 1, 1000);
camera.position.set(-30, 40, 50);
camera.lookAt(scene.position);
const renderer = new WebGLRenderer({ canvas, shaders: { MeshBasicMaterial: basicShader } });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);

const drawing = document.createElement("canvas");
drawing.width = drawing.height = 1024;
const context = drawing.getContext("2d");
if (!context) throw new Error("Cannot create texture canvas");
const ctx: CanvasRenderingContext2D = context;
const background = new Image();
let disposed = false;
let loaded = false;
let xCross = 0;
let yCross = 0;
let crossMax = 40;
let crossMin = 4;
let crossThickness = 4;
const textures: Texture[] = [];
function draw(): void {
  ctx.clearRect(0, 0, drawing.width, drawing.height);
  if (loaded) ctx.drawImage(background, 0, 0);
  ctx.lineWidth = crossThickness * 3;
  ctx.strokeStyle = "#ffff00";
  ctx.beginPath();
  ctx.moveTo(xCross - crossMax - 2, yCross - crossMax - 2);
  ctx.lineTo(xCross - crossMin, yCross - crossMin);
  ctx.moveTo(xCross + crossMin, yCross + crossMin);
  ctx.lineTo(xCross + crossMax + 2, yCross + crossMax + 2);
  ctx.moveTo(xCross - crossMax - 2, yCross + crossMax + 2);
  ctx.lineTo(xCross - crossMin, yCross + crossMin);
  ctx.moveTo(xCross + crossMin, yCross - crossMin);
  ctx.lineTo(xCross + crossMax + 2, yCross - crossMax - 2);
  ctx.stroke();
  for (const texture of textures) texture.needsUpdate = true;
}
function makeTexture(wrapping: Wrapping): Texture {
  const texture = new Texture(drawing, Mapping.UV, wrapping, wrapping);
  texture.colorSpace = ColorSpace.SRGB;
  textures.push(texture);
  return texture;
}
function mapGeometry(geometry: BufferGeometry, shift: number): void {
  const uv = geometry.getAttribute("uv");
  if (!(uv instanceof BufferAttribute)) throw new Error("Missing geometry UVs");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - shift) * 2, (uv.getY(i) - shift) * 2);
}
const cubeTexture = makeTexture(Wrapping.Repeat);
const planeTexture = makeTexture(Wrapping.MirroredRepeat);
const circleTexture = makeTexture(Wrapping.Repeat);
const cubeGeometry = new BoxGeometry(20, 20, 20);
const planeGeometry = new PlaneGeometry(25, 25, 1, 1);
const circleGeometry = new CircleGeometry(25, 40, 0, Math.PI * 2);
mapGeometry(cubeGeometry, 0);
mapGeometry(planeGeometry, 0);
mapGeometry(circleGeometry, 0.25);
const cube = new Mesh(cubeGeometry, new MeshBasicMaterial({ map: cubeTexture }));
const plane = new Mesh(planeGeometry, new MeshBasicMaterial({ map: planeTexture }));
const circle = new Mesh(circleGeometry, new MeshBasicMaterial({ map: circleTexture }));
cube.position.set(4, -5, 0);
plane.position.set(-16, -5, 0);
circle.position.set(24, -5, 0);
scene.add(cube, plane, circle);
draw();
background.onload = () => {
  if (disposed) return;
  loaded = true;
  drawing.width = background.naturalWidth;
  drawing.height = background.naturalHeight;
  const radius = Math.ceil(Math.min(drawing.width, drawing.height / 30));
  crossMax = Math.ceil(0.70710678 * radius);
  crossMin = Math.ceil(crossMax / 10);
  crossThickness = Math.ceil(crossMax / 10);
  draw();
};
background.onerror = () => {
  if (!disposed) console.error("Failed to load UV grid texture");
};
background.src = "/examples/textures/uv_grid_opengl.jpg";

const params = {
  wrapS: Wrapping.Repeat,
  wrapT: Wrapping.Repeat,
  offsetX: 0,
  offsetY: 0,
  repeatX: 1,
  repeatY: 1,
  rotation: 0,
};
const wrapping = {
  RepeatWrapping: Wrapping.Repeat,
  ClampToEdgeWrapping: Wrapping.ClampToEdge,
  MirroredRepeatWrapping: Wrapping.MirroredRepeat,
};
const gui = new GUI();
gui.title("Circle Texture Settings");
gui.add(params, "wrapS", wrapping).onChange(() => {
  circleTexture.wrapS = params.wrapS;
  circleTexture.needsUpdate = true;
});
gui.add(params, "wrapT", wrapping).onChange(() => {
  circleTexture.wrapT = params.wrapT;
  circleTexture.needsUpdate = true;
});
gui.add(params, "offsetX", 0, 5);
gui.add(params, "offsetY", 0, 5);
gui.add(params, "repeatX", 0, 5);
gui.add(params, "repeatY", 0, 5);
gui.add(params, "rotation", 0, 2 * Math.PI);
gui.open();
const pointer = new Vector2();
const raycaster = new Raycaster();
function onMouseMove(event: MouseEvent): void {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const intersection = raycaster.intersectObjects(scene.children, false)[0];
  if (intersection?.uv && intersection.object instanceof Mesh) {
    const material = intersection.object.material as MeshBasicMaterial;
    material.map?.transformUv(intersection.uv);
    xCross = intersection.uv.x * drawing.width;
    yCross = intersection.uv.y * drawing.height;
    draw();
  }
}
function onResize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
canvas.addEventListener("mousemove", onMouseMove);
window.addEventListener("resize", onResize);
renderer.setAnimationLoop(() => {
  circleTexture.offset.set(params.offsetX, params.offsetY);
  circleTexture.repeat.set(params.repeatX, params.repeatY);
  circleTexture.rotation = params.rotation;
  renderer.render(scene, camera);
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  background.onload = null;
  background.onerror = null;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", onResize);
  canvas.removeEventListener("mousemove", onMouseMove);
  gui.destroy();
  disposeObject(scene);
  renderer.dispose();
});
