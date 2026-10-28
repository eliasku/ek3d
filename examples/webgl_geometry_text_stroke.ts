import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { FontLoader } from "ek3d/addons/loaders/FontLoader";
import type { Font, FontDirection } from "ek3d/addons/loaders/FontLoader";
import { SVGStroke } from "ek3d/addons/utils/SVGStroke";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DoubleSide } from "ek3d/constants";
import { ShapeGeometry } from "ek3d/geometries/ShapeGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Color } from "ek3d/math/Color";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing stroke text canvas");
const scene = new Scene();
scene.background = new Color(0xf0f0f0);
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 1, 10000);
camera.position.set(0, -400, 1000);
const renderer = new WebGLRenderer({ canvas, antialias: true, shaders: { MeshBasicMaterial: basicShader } });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0, 0);
controls.update();
const color = new Color(0x006699);
const dark = new MeshBasicMaterial({ color, side: DoubleSide });
const lite = new MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: DoubleSide });
let disposed = false;
let loaded = false;
canvas.dataset.state = "loading";

function generateStrokeText(font: Font, message: string, direction: FontDirection): Group {
  const shapes = font.generateShapes(message, 80, direction);
  const geometry = new ShapeGeometry(shapes);
  geometry.computeBoundingBox();
  const xMid = -0.5 * (geometry.boundingBox!.max.x - geometry.boundingBox!.min.x);
  geometry.translate(xMid, 0, 0);
  const group = new Group();
  const text = new Mesh(geometry, lite);
  text.position.z = -150;
  group.add(text);
  const contours = [...shapes, ...shapes.flatMap((shape) => shape.holes)];
  const style = SVGStroke.getStrokeStyle(5, color.getStyle());
  for (const contour of contours) {
    const stroke = SVGStroke.pointsToStroke(contour.getPoints(), style);
    if (stroke === null) continue;
    stroke.translate(xMid, 0, 0);
    group.add(new Mesh(stroke, dark));
  }
  return group;
}

function render(): void {
  if (disposed) return;
  renderer.render(scene, camera);
  if (loaded) canvas!.dataset.state = "rendered";
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  render();
}
controls.addEventListener("change", render);
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  controls.removeEventListener("change", render);
  controls.dispose();
  scene.traverse((object) => {
    if (object instanceof Mesh) object.geometry.dispose();
  });
  dark.dispose();
  lite.dispose();
  renderer.dispose();
});
new FontLoader().load(
  "/examples/fonts/MPLUSRounded1c/MPLUSRounded1c-Regular.typeface.json",
  (font) => {
    if (disposed) return;
    const english = generateStrokeText(font, "   Three.js\nStroke text.", "ltr");
    const hebrew = generateStrokeText(font, "טקסט קו", "rtl");
    const chinese = generateStrokeText(font, "文字描邊", "tb");
    english.position.x = -100;
    hebrew.position.set(-100, -300, 0);
    chinese.position.set(300, -300, 0);
    scene.add(english, hebrew, chinese);
    loaded = true;
    render();
  },
  undefined,
  (error) => {
    if (disposed) return;
    canvas!.dataset.state = "error";
    canvas!.dataset.error = String(error);
    console.error(error);
  },
);
render();
