import { SelectionBox } from "ek3d/addons/interactive/SelectionBox";
import { SelectionHelper } from "ek3d/addons/interactive/SelectionHelper";
import { PCFShadowMap } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { Stats } from "ek3d/addons/libs/Stats";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { Scene } from "ek3d/scenes/Scene";

const container = document.createElement("div");
document.body.appendChild(container);

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing boxselection example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.z = 50;

const scene = new Scene();
scene.background = new Color(0xf0f0f0);

scene.add(new AmbientLight(0xaaaaaa));

const light = new SpotLight(0xffffff, 10000);
light.position.set(0, 25, 50);
light.angle = Math.PI / 5;

light.castShadow = true;
light.shadow.camera.near = 10;
light.shadow.camera.far = 100;
light.shadow.mapSize.width = 1024;
light.shadow.mapSize.height = 1024;

scene.add(light);

const geometry = new BoxGeometry();
const objects: Mesh[] = [];

for (let i = 0; i < 200; i++) {
  const object = new Mesh(geometry, new MeshLambertMaterial({ color: Math.random() * 0xffffff }));

  object.position.x = Math.random() * 80 - 40;
  object.position.y = Math.random() * 45 - 25;
  object.position.z = Math.random() * 45 - 25;

  object.rotation.x = Math.random() * 2 * Math.PI;
  object.rotation.y = Math.random() * 2 * Math.PI;
  object.rotation.z = Math.random() * 2 * Math.PI;

  object.scale.x = Math.random() * 2 + 1;
  object.scale.y = Math.random() * 2 + 1;
  object.scale.z = Math.random() * 2 + 1;

  object.castShadow = true;
  object.receiveShadow = true;

  scene.add(object);
  objects.push(object);
}

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createShadowMap: WebGLShadowMap,
  shaders: { MeshLambertMaterial: lambertShader, MeshDepthMaterial: depthShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);

const shadowMap = renderer.shadowMap;
if (shadowMap === null) throw new Error("the shadow map system failed to install");
shadowMap.enabled = true;
shadowMap.type = PCFShadowMap;

const stats = new Stats();
document.body.appendChild(stats.dom);

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);

function animate(): void {
  renderer.render(scene, camera);

  stats.update();

  canvas.dataset.state = "rendered";
  // count highlighted boxes through material emissive
  let highlighted = 0;
  for (const object of objects) {
    if ((object.material as MeshLambertMaterial).emissive.getHex() !== 0) highlighted++;
  }
  canvas.dataset.highlighted = String(highlighted);
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}

const selectionBox = new SelectionBox(camera, scene);
const helper = new SelectionHelper(renderer, "selectBox");

document.addEventListener("pointerdown", function (event) {
  for (const item of selectionBox.collection) {
    (item as Mesh<MeshLambertMaterial>).material.emissive.set(0x000000);
  }

  selectionBox.startPoint.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1,
    0.5,
  );
});

document.addEventListener("pointermove", function (event) {
  if (helper.isDown) {
    for (let i = 0; i < selectionBox.collection.length; i++) {
      (selectionBox.collection[i] as Mesh<MeshLambertMaterial>).material.emissive.set(0x000000);
    }

    selectionBox.endPoint.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1,
      0.5,
    );

    const allSelected = selectionBox.select();

    for (let i = 0; i < allSelected.length; i++) {
      (allSelected[i] as Mesh<MeshLambertMaterial>).material.emissive.set(0xffffff);
    }
  }
});

document.addEventListener("pointerup", function (event) {
  selectionBox.endPoint.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1,
    0.5,
  );

  const allSelected = selectionBox.select();

  for (let i = 0; i < allSelected.length; i++) {
    (allSelected[i] as Mesh<MeshLambertMaterial>).material.emissive.set(0xffffff);
  }
});

window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    helper.dispose();
    renderer.setAnimationLoop(null);
    for (const object of objects) (object.material as MeshLambertMaterial).dispose();
    geometry.dispose();
    stats.dom.remove();
    renderer.dispose();
  },
  { once: true },
);
