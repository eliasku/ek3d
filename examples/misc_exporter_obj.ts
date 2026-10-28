import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { OBJExporter } from "ek3d/addons/exporters/OBJExporter";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing OBJ exporter canvas");
const canvas = selected;
canvas.dataset.state = "loading";
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshLambertMaterial: lambertShader, PointsMaterial: pointsShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 1, 1000);
camera.position.set(0, 0, 400);
const scene = new Scene();
scene.add(new AmbientLight(0xffffff));
const light = new DirectionalLight(0xffffff, 2.5);
light.position.set(0, 1, 1);
scene.add(light);
const controls = new OrbitControls(camera, canvas);
controls.enablePan = false;
const gui = new GUI();
let frames = 0;
let disposed = false;

function triangle(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([-50, -50, 0, 50, -50, 0, 50, 50, 0], 3));
  geometry.computeVertexNormals();
  return geometry;
}
function addGeometry(type: number): void {
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const child = scene.children[i];
    if (child instanceof Mesh || child instanceof Points) {
      scene.remove(child);
      disposeObject(child);
    }
  }
  if (type === 6) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 100, 0, 0, 100, 100, 0, 0, 100, 0], 3));
    geometry.setAttribute("color", new Float32BufferAttribute([0.5, 0, 0, 0.5, 0, 0, 0, 0.5, 0, 0, 0.5, 0], 3));
    const points = new Points(geometry, new PointsMaterial({ size: 10, vertexColors: true }));
    points.name = "point cloud";
    scene.add(points);
  } else {
    const geometries =
      type === 1
        ? [triangle()]
        : type === 2
          ? [new BoxGeometry(100, 100, 100)]
          : type === 3
            ? [new CylinderGeometry(50, 50, 100, 30, 1)]
            : [triangle(), new BoxGeometry(100, 100, 100), new CylinderGeometry(50, 50, 100, 30, 1)];
    geometries.forEach((geometry, index) => {
      const mesh = new Mesh(geometry, new MeshLambertMaterial({ color: 0x00cc00 }));
      if (type === 4 || type === 5) mesh.position.x = (index - 1) * 200;
      if (type === 5) mesh.rotation.y = Math.PI / 4;
      scene.add(mesh);
    });
  }
}
function exportToObj(): void {
  scene.updateMatrixWorld(true);
  const url = URL.createObjectURL(new Blob([new OBJExporter().parse(scene)], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "object.obj";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
const params = {
  addTriangle: () => addGeometry(1),
  addCube: () => addGeometry(2),
  addCylinder: () => addGeometry(3),
  addMultiple: () => addGeometry(4),
  addTransformed: () => addGeometry(5),
  addPoints: () => addGeometry(6),
  exportToObj,
};
const geometryFolder = gui.addFolder("Geometry Selection");
geometryFolder.add(params, "addTriangle").name("Triangle");
geometryFolder.add(params, "addCube").name("Cube");
geometryFolder.add(params, "addCylinder").name("Cylinder");
geometryFolder.add(params, "addMultiple").name("Multiple objects");
geometryFolder.add(params, "addTransformed").name("Transformed objects");
geometryFolder.add(params, "addPoints").name("Point Cloud");
gui.addFolder("Export").add(params, "exportToObj").name("Export OBJ");
gui.open();
addGeometry(1);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
