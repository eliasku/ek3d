import { TrackballControls } from "ek3d/addons/controls/TrackballControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PDBLoader } from "ek3d/addons/loaders/PDBLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvasSel) throw new Error("Missing molecule example canvas");
const canvas: HTMLCanvasElement = canvasSel;
const scene = new Scene();
scene.background = new Color(0x050505);
const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 1, 5000);
camera.position.z = 1000;
scene.add(camera);
const light1 = new DirectionalLight(0xffffff, 2.5);
light1.position.set(1, 1, 1);
const light2 = new DirectionalLight(0xffffff, 1.5);
light2.position.set(-1, -1, 1);
scene.add(light1, light2);
const root = new Group();
scene.add(root);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new TrackballControls(camera, canvas);
controls.minDistance = 500;
controls.maxDistance = 2000;
const molecules = {
  Ethanol: "ethanol.pdb",
  Aspirin: "aspirin.pdb",
  Caffeine: "caffeine.pdb",
  Nicotine: "nicotine.pdb",
  LSD: "lsd.pdb",
  Cocaine: "cocaine.pdb",
  Cholesterol: "cholesterol.pdb",
  Lycopene: "lycopene.pdb",
  Glucose: "glucose.pdb",
  "Aluminium oxide": "Al2O3.pdb",
  Cubane: "cubane.pdb",
  Copper: "cu.pdb",
  Fluorite: "caf2.pdb",
  Salt: "nacl.pdb",
  "YBCO superconductor": "ybco.pdb",
  Buckyball: "buckyball.pdb",
  Graphite: "graphite.pdb",
};
const params = { molecule: "caffeine.pdb" };
const gui = new GUI();
gui.add(params, "molecule", molecules).onChange((value) => loadMolecule(String(value)));
gui.open();
const loader = new PDBLoader();
let request = 0,
  frames = 0;
let disposed = false;
function clear(): void {
  disposeObject(root);
  root.clear();
}
function loadMolecule(file: string): void {
  const current = ++request;
  clear();
  canvas.dataset.state = "loading";
  delete canvas.dataset.error;
  loader.load(
    `/examples/models/pdb/${file}`,
    (pdb) => {
      const { geometryAtoms, geometryBonds } = pdb;
      if (disposed || current !== request) {
        geometryAtoms.dispose();
        geometryBonds.dispose();
        return;
      }
      const box = new BoxGeometry(1, 1, 1);
      const sphere = new IcosahedronGeometry(1, 3);
      geometryAtoms.computeBoundingBox();
      const offset = geometryAtoms.boundingBox!.getCenter(new Vector3()).negate();
      geometryAtoms.translate(offset.x, offset.y, offset.z);
      geometryBonds.translate(offset.x, offset.y, offset.z);
      const positions = geometryAtoms.getAttribute("position");
      const colors = geometryAtoms.getAttribute("color");
      if (!(positions instanceof BufferAttribute) || !(colors instanceof BufferAttribute))
        throw new Error("PDB loader returned invalid atom attributes");
      for (let i = 0; i < positions.count; i++) {
        const color = new Color().setRGB(colors.getX(i), colors.getY(i), colors.getZ(i));
        const object = new Mesh(sphere, new MeshPhongMaterial({ color }));
        object.position.set(positions.getX(i), positions.getY(i), positions.getZ(i)).multiplyScalar(75);
        object.scale.multiplyScalar(25);
        root.add(object);
      }
      const bonds = geometryBonds.getAttribute("position");
      if (!(bonds instanceof BufferAttribute)) throw new Error("PDB loader returned invalid bond attributes");
      const start = new Vector3(),
        end = new Vector3();
      for (let i = 0; i < bonds.count; i += 2) {
        start.set(bonds.getX(i), bonds.getY(i), bonds.getZ(i)).multiplyScalar(75);
        end.set(bonds.getX(i + 1), bonds.getY(i + 1), bonds.getZ(i + 1)).multiplyScalar(75);
        const object = new Mesh(box, new MeshPhongMaterial({ color: 0xffffff }));
        object.position.copy(start).lerp(end, 0.5);
        object.scale.set(5, 5, start.distanceTo(end));
        object.lookAt(end);
        root.add(object);
      }
      if (positions.count === 0) sphere.dispose();
      if (bonds.count === 0) box.dispose();
      geometryAtoms.dispose();
      geometryBonds.dispose();
      canvas.dataset.asset = file;
      canvas.dataset.state = "rendered";
    },
    undefined,
    (error) => {
      if (disposed || current !== request) return;
      canvas.dataset.state = "error";
      canvas.dataset.error = error instanceof Error ? error.message : String(error);
      console.error(error);
    },
  );
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  controls.handleResize();
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  request++;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  controls.dispose();
  gui.destroy();
  clear();
  renderer.dispose();
});
loadMolecule(params.molecule);
renderer.setAnimationLoop(() => {
  controls.update();
  const time = Date.now() * 0.0004;
  root.rotation.x = time;
  root.rotation.y = time * 0.7;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
});
