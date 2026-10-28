import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { SVGLoader } from "ek3d/addons/loaders/SVGLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ShapeGeometry } from "ek3d/geometries/ShapeGeometry";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { Color } from "ek3d/math/Color";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { disposeMaterial, disposeObject } from "./dispose-object";

const element = document.querySelector<HTMLCanvasElement>("#scene");
if (element === null) throw new Error("Missing SVG example canvas");
const canvas: HTMLCanvasElement = element;
const scene = new Scene();
scene.background = new Color(0xb0b0b0);
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 1, 1000);
camera.position.set(0, 0, 200);
const grid = new GridHelper(160, 10, 0x8d8d8d, 0xc1c1c1);
grid.rotation.x = Math.PI / 2;
scene.add(grid);
const root = new Group();
root.scale.set(0.25, -0.25, 0.25);
root.position.set(-70, 70, 0);
scene.add(root);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  shaders: { MeshBasicMaterial: basicShader, LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.screenSpacePanning = true;
const manager = new LoadingManager();
const loader = new SVGLoader(manager);
const options = {
  Tiger: "tiger.svg",
  "Joins and caps": "lineJoinsAndCaps.svg",
  Hexagon: "hexagon.svg",
  Energy: "energy.svg",
  "Test 1": "tests/1.svg",
  "Test 2": "tests/2.svg",
  "Test 3": "tests/3.svg",
  "Test 4": "tests/4.svg",
  "Test 5": "tests/5.svg",
  "Test 6": "tests/6.svg",
  "Test 7": "tests/7.svg",
  "Test 8": "tests/8.svg",
  "Test 9": "tests/9.svg",
  Units: "tests/units.svg",
  Ordering: "tests/ordering.svg",
  Defs: "tests/testDefs/Svg-defs.svg",
  Defs2: "tests/testDefs/Svg-defs2.svg",
  Defs3: "tests/testDefs/Wave-defs.svg",
  Defs4: "tests/testDefs/defs4.svg",
  Defs5: "tests/testDefs/defs5.svg",
  "Style CSS inside defs": "style-css-inside-defs.svg",
  "Styled Paths": "styled-paths.svg",
  "Multiple CSS classes": "multiple-css-classes.svg",
  "Zero Radius": "zero-radius.svg",
  "Styles in svg tag": "tests/styles.svg",
  "Round join": "tests/roundJoinPrecisionIssue.svg",
  "Ellipse Transformations": "tests/ellipseTransform.svg",
  singlePointTest: "singlePointTest.svg",
  singlePointTest2: "singlePointTest2.svg",
  singlePointTest3: "singlePointTest3.svg",
  emptyPath: "emptyPath.svg",
  emoji: "emoji.svg",
  blueprint: "blueprint.svg",
  wideStroke: "tests/wideStroke.svg",
  letter: "tests/letter.svg",
  closePathInitialPoint: "tests/closePathInitialPoint.svg",
  closePathOpenSubpath: "tests/closePathOpenSubpath.svg",
  useHref: "tests/useHref.svg",
};
const settings = {
  currentURL: "tiger.svg",
  drawFillShapes: true,
  drawStrokes: true,
  fillShapesWireframe: false,
  strokesWireframe: false,
};
const gui = new GUI();
gui.add(settings, "currentURL", options).name("SVG File").onChange(update);
gui.add(settings, "drawStrokes").name("Draw strokes").onChange(update);
gui.add(settings, "drawFillShapes").name("Draw fill shapes").onChange(update);
gui.add(settings, "strokesWireframe").name("Wireframe strokes").onChange(update);
gui.add(settings, "fillShapesWireframe").name("Wireframe fill shapes").onChange(update);
let disposed = false,
  request = 0,
  frames = 0;
function clear(): void {
  disposeObject(root);
  root.clear();
}
function update(): void {
  const current = ++request;
  clear();
  canvas.dataset.state = "loading";
  delete canvas.dataset.error;
  loader.load(
    `/examples/models/svg/${settings.currentURL}`,
    (data) => {
      if (disposed || current !== request) return;
      let order = 0;
      for (const path of data.paths) {
        if (settings.drawFillShapes) {
          const material = SVGLoader.createFillMaterial(path);
          if (material !== null) {
            material.wireframe = settings.fillShapesWireframe;
            const shapes = SVGLoader.createShapes(path);
            for (const shape of shapes) {
              const mesh = new Mesh(new ShapeGeometry(shape), material);
              mesh.renderOrder = order++;
              root.add(mesh);
            }
            if (shapes.length === 0) disposeMaterial(material);
          }
        }
        if (settings.drawStrokes) {
          const material = SVGLoader.createStrokeMaterial(path);
          if (material !== null) {
            material.wireframe = settings.strokesWireframe;
            let used = false;
            for (const subPath of path.subPaths) {
              const geometry = SVGLoader.pointsToStroke(subPath.getPoints(), path.userData.style);
              if (geometry !== null) {
                const mesh = new Mesh(geometry, material);
                mesh.renderOrder = order++;
                root.add(mesh);
                used = true;
              }
            }
            if (!used) disposeMaterial(material);
          }
        }
      }
      canvas.dataset.asset = settings.currentURL;
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
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  request++;
  manager.abort();
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  controls.dispose();
  gui.destroy();
  clear();
  grid.geometry.dispose();
  grid.material.dispose();
  renderer.dispose();
});
update();
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
});
