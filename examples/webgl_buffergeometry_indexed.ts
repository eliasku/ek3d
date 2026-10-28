import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { Color } from "ek3d/math/Color";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { SRGBColorSpace } from "ek3d/constants";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { DoubleSide } from "ek3d/constants";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Stats } from "ek3d/addons/libs/Stats";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { disposeObject } from "./dispose-object";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing BufferGeometry example canvas");
const canvas: HTMLCanvasElement = canvasSel;
let disposed = false;
let frames = 0;
let gui!: GUI;

let camera!: PerspectiveCamera;
let scene!: Scene;
let renderer!: WebGLRenderer;
let stats!: Stats;

let mesh!: Mesh;

init();

function init(): void {
  camera = new PerspectiveCamera(27, window.innerWidth / window.innerHeight, 1, 3500);
  camera.position.z = 64;

  scene = new Scene();
  scene.background = new Color(0x050505);

  const light = new HemisphereLight();
  light.intensity = 3;
  scene.add(light);

  const geometry = new BufferGeometry();

  const indices = [];

  const vertices = [];
  const normals = [];
  const colors = [];

  const size = 20;
  const segments = 10;

  const halfSize = size / 2;
  const segmentSize = size / segments;

  const _color = new Color();

  // generate vertices, normals and color data for a simple grid geometry

  for (let i = 0; i <= segments; i++) {
    const y = i * segmentSize - halfSize;

    for (let j = 0; j <= segments; j++) {
      const x = j * segmentSize - halfSize;

      vertices.push(x, -y, 0);
      normals.push(0, 0, 1);

      const r = x / size + 0.5;
      const g = y / size + 0.5;

      _color.setRGB(r, g, 1, SRGBColorSpace);

      colors.push(_color.r, _color.g, _color.b);
    }
  }

  // generate indices (data for element array buffer)

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + (j + 1);
      const b = i * (segments + 1) + j;
      const c = (i + 1) * (segments + 1) + j;
      const d = (i + 1) * (segments + 1) + (j + 1);

      // generate two faces (triangles) per iteration

      indices.push(a, b, d); // face one
      indices.push(b, c, d); // face two
    }
  }

  geometry.setIndex(indices);
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));

  const material = new MeshPhongMaterial({
    side: DoubleSide,
    vertexColors: true,
  });

  mesh = new Mesh(geometry, material);
  scene.add(mesh);

  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    shaders: { MeshPhongMaterial: phongShader },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);

  stats = new Stats();
  document.body.appendChild(stats.dom);

  gui = new GUI();
  gui.add(material, "wireframe");

  window.addEventListener("resize", onWindowResize);
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(): void {
  const time = Date.now() * 0.001;

  mesh.rotation.x = time * 0.25;
  mesh.rotation.y = time * 0.5;

  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";

  stats.update();
}

window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", onWindowResize);
  renderer.setAnimationLoop(null);

  gui.destroy();
  stats.dom.remove();
  disposeObject(scene);

  renderer.dispose();
  canvas.dataset.state = "disposed";
});
