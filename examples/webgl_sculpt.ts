import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GLTFExporter } from "ek3d/addons/exporters/GLTFExporter";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Sculptor, type SculptorTool } from "ek3d/addons/misc/Sculptor";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DoubleSide } from "ek3d/constants";
import { CircleGeometry } from "ek3d/geometries/CircleGeometry";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { RingGeometry } from "ek3d/geometries/RingGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { Matrix3 } from "ek3d/math/Matrix3";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing sculpt canvas");
const canvas: HTMLCanvasElement = selected;
canvas.dataset.state = "loading";
let disposed = false,
  frames = 0,
  releasedPointerId: number | null = null;
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  getDFGLUT: () => dfg,
  shaders: { MeshBasicMaterial: basicShader, MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const scene = new Scene();
scene.background = new Color(0x222222);
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 4);
scene.add(new AmbientLight(0x404040));
const light = new DirectionalLight(0xffffff, 2);
light.position.set(1, 1.5, 2);
const backLight = new DirectionalLight(0x88aaff, 0.5);
backLight.position.set(-1, -0.5, -1);
scene.add(light, backLight);
const initialGeometry = new IcosahedronGeometry(1, 50);
const material = new MeshStandardMaterial({ color: 0xcc6644, roughness: 0.4, metalness: 0.1 });
const mesh = new Mesh(initialGeometry, material);
scene.add(mesh);
const sculptor = new Sculptor(mesh, camera);
initialGeometry.dispose();
sculptor.connect(canvas);
sculptor.addEventListener("start", () => {
  releasedPointerId = null;
  controls.enabled = false;
});
sculptor.addEventListener("end", () => {
  controls.enabled = true;
});

const cursorMaterial = new MeshBasicMaterial({
  color: 0xcc0000,
  side: DoubleSide,
  depthTest: false,
  depthWrite: false,
});
const cursorRing = new Mesh(new RingGeometry(0.95, 1, 48), cursorMaterial);
const cursorDot = new Mesh(new CircleGeometry(1, 16), cursorMaterial);
const cursorGroup = new Group();
cursorGroup.add(cursorRing, cursorDot);
cursorGroup.visible = false;
cursorGroup.renderOrder = cursorRing.renderOrder = cursorDot.renderOrder = 1;
scene.add(cursorGroup);
const pointer = new Vector2(),
  normal = new Vector3(),
  normalMatrix = new Matrix3();
const forward = new Vector3(0, 0, 1),
  mouse = new Vector3(),
  mouseOffset = new Vector3();
function updateCursorScale(radius: number): void {
  cursorGroup.scale.setScalar(radius);
  cursorDot.scale.setScalar(2.5 / sculptor.getSize());
}
function updateCursorPosition(): void {
  if (sculptor.domElement === null) {
    cursorGroup.visible = false;
    return;
  }
  const hovering = !sculptor.isSculpting();
  if (hovering) sculptor.pickFromPointer(pointer.x, pointer.y);
  const hit = sculptor.hasHit();
  if (hit) {
    mesh.updateWorldMatrix(true, false);
    sculptor.getHitPoint(cursorGroup.position).applyMatrix4(mesh.matrixWorld);
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    sculptor.getHitNormal(normal).applyNormalMatrix(normalMatrix);
    cursorGroup.quaternion.setFromUnitVectors(forward, normal);
    updateCursorScale(sculptor.getWorldRadius());
  } else {
    const rect = canvas.getBoundingClientRect();
    const x = ((pointer.x - rect.left) / rect.width) * 2 - 1;
    const offsetX = ((pointer.x + sculptor.getSize() - rect.left) / rect.width) * 2 - 1;
    const y = -((pointer.y - rect.top) / rect.height) * 2 + 1;
    camera.updateWorldMatrix(true, false);
    mouse.set(x, y, 0.5).unproject(camera);
    mouseOffset.set(offsetX, y, 0.5).unproject(camera);
    cursorGroup.position.copy(mouse);
    camera.getWorldQuaternion(cursorGroup.quaternion);
    updateCursorScale(mouse.distanceTo(mouseOffset));
  }
  cursorMaterial.color.setHex(hit && hovering ? 0xcc0000 : 0xcc6600);
  cursorRing.visible = hovering;
  cursorDot.visible = true;
  cursorGroup.visible = true;
}
function updateCursor(event: PointerEvent): void {
  pointer.set(event.clientX, event.clientY);
  if (event.buttons > 0 && !sculptor.isSculpting()) {
    cursorGroup.visible = false;
    return;
  }
  updateCursorPosition();
}
function pointerUp(event: PointerEvent): void {
  if (sculptor.isSculpting()) return;
  releasedPointerId = event.pointerId;
  updateCursor(event);
}
function pointerCancel(): void {
  releasedPointerId = null;
  cursorGroup.visible = false;
}
function lostCapture(event: PointerEvent): void {
  if (event.pointerId === releasedPointerId) {
    releasedPointerId = null;
    return;
  }
  cursorGroup.visible = false;
}
function pointerLeave(): void {
  if (!sculptor.isSculpting()) cursorGroup.visible = false;
}
canvas.addEventListener("pointerup", pointerUp);
canvas.addEventListener("pointercancel", pointerCancel);
canvas.addEventListener("lostpointercapture", lostCapture);
// Sculptor must receive pointerdown before controls.
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
canvas.addEventListener("pointermove", updateCursor);
canvas.addEventListener("pointerleave", pointerLeave);
controls.addEventListener("change", () => {
  if (cursorGroup.visible && !sculptor.isSculpting()) updateCursorPosition();
});

const link = document.createElement("a");
link.style.display = "none";
document.body.appendChild(link);
function exportGLTF(): void {
  const snapshot = mesh.clone();
  snapshot.geometry = sculptor.getGeometry();
  new GLTFExporter().parse(
    snapshot,
    (result) => {
      snapshot.geometry.dispose();
      if (disposed) return;
      if (!(result instanceof ArrayBuffer)) {
        console.error("Expected binary glTF output");
        return;
      }
      const url = URL.createObjectURL(new Blob([result], { type: "application/octet-stream" }));
      link.href = url;
      link.download = "sculpt.glb";
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        if (link.href === url) link.removeAttribute("href");
      }, 0);
    },
    (error) => {
      snapshot.geometry.dispose();
      console.error(error);
    },
    { binary: true },
  );
}
const params = {
  tool: sculptor.getTool(),
  size: sculptor.getSize(),
  strength: sculptor.getStrength(),
  detail: sculptor.getDetail(),
  negative: sculptor.getNegative(),
  wireframe: false,
  export: exportGLTF,
};
const gui = new GUI();
gui
  .add(params, "tool", ["clay", "brush", "inflate", "smooth", "flatten", "pinch", "crease", "drag", "scale"])
  .onChange(() => {
    sculptor.setTool(params.tool as SculptorTool);
    params.size = sculptor.getSize();
    params.strength = sculptor.getStrength();
    params.negative = sculptor.getNegative();
    sizeController.updateDisplay();
    strengthController.updateDisplay();
    negativeController.updateDisplay();
    updateToolControllers();
  });
const sizeController = gui.add(params, "size", 5, 500, 1).onChange(() => sculptor.setSize(params.size));
const strengthController = gui.add(params, "strength", 0, 1).onChange(() => sculptor.setStrength(params.strength));
gui.add(params, "detail", 0, 1).onChange(() => sculptor.setDetail(params.detail));
const negativeController = gui.add(params, "negative").onChange(() => sculptor.setNegative(params.negative));
gui.add(params, "wireframe").onChange(() => {
  material.wireframe = params.wireframe;
});
gui.add(params, "export");
function updateToolControllers(): void {
  const tool = sculptor.getTool();
  const hasStrength = tool !== "drag" && tool !== "scale";
  strengthController.enable(hasStrength);
  negativeController.enable(tool !== "smooth" && hasStrength);
}
updateToolControllers();
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  canvas.removeEventListener("pointerup", pointerUp);
  canvas.removeEventListener("pointercancel", pointerCancel);
  canvas.removeEventListener("lostpointercapture", lostCapture);
  canvas.removeEventListener("pointermove", updateCursor);
  canvas.removeEventListener("pointerleave", pointerLeave);
  sculptor.dispose();
  controls.dispose();
  gui.destroy();
  link.remove();
  disposeObject(scene);
  dfg.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
