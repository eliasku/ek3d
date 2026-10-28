import { Side, ColorSpace } from "ek3d/constants";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BufferAttribute, Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { PointLight } from "ek3d/lights/PointLight";
import { BufferGeometryLoader } from "ek3d/loaders/BufferGeometryLoader";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { SpriteMaterial } from "ek3d/materials/SpriteMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { Sprite } from "ek3d/objects/Sprite";
import { Scene } from "ek3d/scenes/Scene";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { spriteShader } from "ek3d/renderers/shaders/SpriteShader";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Lut } from "ek3d/addons/math/Lut";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (canvas === null) throw new Error("Missing lookup table example canvas");
const scene = new Scene();
scene.background = new Color(0xffffff);
const uiScene = new Scene();
const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 1, 100);
camera.position.set(0, 0, 10);
scene.add(camera);
camera.add(new PointLight(0xffffff, 3, 0, 0));
const uiCamera = new OrthographicCamera(-1, 1, 1, -1, 1, 2);
uiCamera.position.set(0.5, 0, 1);
const lut = new Lut();
const map = new CanvasTexture(lut.createCanvas());
map.colorSpace = ColorSpace.SRGB;
const spriteMaterial = new SpriteMaterial({ map });
const sprite = new Sprite(spriteMaterial);
sprite.scale.x = 0.125;
uiScene.add(sprite);
const material = new MeshLambertMaterial({ side: Side.Double, color: 0xf5f5f5, vertexColors: true });
const mesh = new Mesh(new BufferGeometry(), material);
scene.add(mesh);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  shaders: { MeshLambertMaterial: lambertShader, SpriteMaterial: spriteShader },
});
renderer.autoClear = false;
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.addEventListener("change", render);
const params = { colorMap: "rainbow" };
const gui = new GUI();
gui.add(params, "colorMap", ["rainbow", "cooltowarm", "blackbody", "grayscale"]).onChange(() => {
  updateColors();
  render();
});
let disposed = false;
let loaded = false;

function render(): void {
  renderer.clear();
  renderer.render(scene, camera);
  renderer.render(uiScene, uiCamera);
}

function updateColors(): void {
  lut.setColorMap(params.colorMap).setMax(2000).setMin(0);
  if (loaded) {
    const pressures = mesh.geometry.getAttribute("pressure") as BufferAttribute;
    const colors = mesh.geometry.getAttribute("color") as BufferAttribute;
    const color = new Color();
    for (let i = 0; i < pressures.count; i++) {
      color.copy(lut.getColor(pressures.getX(i))).convertSRGBToLinear();
      colors.setXYZ(i, color.r, color.g, color.b);
    }
    colors.needsUpdate = true;
  }
  lut.updateCanvas(map.image as HTMLCanvasElement);
  map.needsUpdate = true;
}

new BufferGeometryLoader().load("/examples/models/json/pressure.json", (geometry) => {
  if (disposed) {
    geometry.dispose();
    return;
  }
  geometry.center();
  geometry.computeVertexNormals();
  const positions = geometry.getAttribute("position") as BufferAttribute;
  const colors = new Float32Array(positions.count * 3);
  colors.fill(1);
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  mesh.geometry.dispose();
  mesh.geometry = geometry;
  loaded = true;
  updateColors();
  render();
});
function onResize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  render();
}
window.addEventListener("resize", onResize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", onResize);
  controls.removeEventListener("change", render);
  controls.dispose();
  gui.destroy();
  mesh.geometry.dispose();
  material.dispose();
  map.dispose();
  spriteMaterial.dispose();
  renderer.dispose();
});
render();
