import { Reflector } from "ek3d/addons/objects/Reflector";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { CircleGeometry } from "ek3d/geometries/CircleGeometry";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { PointLight } from "ek3d/lights/PointLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Vector2 } from "ek3d/math/Vector2";
import { Object3D } from "ek3d/core/Object3D";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing mirror example canvas");
const canvas: HTMLCanvasElement = canvasSel;

let resolutionScale = 1; // render target scale factor in [ 0, 1 ]

const size = new Vector2();

// renderer
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);

// scene
const scene = new Scene();

// camera
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 500);
camera.position.set(0, 75, 160);

const cameraControls = new OrbitControls(camera, canvas);
cameraControls.target.set(0, 40, 0);
cameraControls.maxDistance = 400;
cameraControls.minDistance = 10;
cameraControls.update();

//

const planeGeo = new PlaneGeometry(100.1, 100.1);

// reflectors/mirrors

renderer.getDrawingBufferSize(size);
size.multiplyScalar(resolutionScale).round();

const groundMirror = new Reflector(new CircleGeometry(40, 64), {
  clipBias: 0.003,
  textureWidth: size.width,
  textureHeight: size.height,
  color: 0xb5b5b5,
});
groundMirror.position.y = 0.5;
groundMirror.rotateX(-Math.PI / 2);
scene.add(groundMirror);

const verticalMirror = new Reflector(new PlaneGeometry(100, 100), {
  clipBias: 0.003,
  textureWidth: size.width,
  textureHeight: size.height,
  color: 0xc1cbcb,
});
verticalMirror.position.y = 50;
verticalMirror.position.z = -50;
scene.add(verticalMirror);

const sphereGroup = new Object3D();
scene.add(sphereGroup);

const capMaterial = new MeshPhongMaterial({ color: 0xffffff, emissive: 0x8d8d8d });

const sphereCap = new Mesh(new CylinderGeometry(0.1, 15 * Math.cos((Math.PI / 180) * 30), 0.1, 24, 1), capMaterial);
sphereCap.position.y = -15 * Math.sin((Math.PI / 180) * 30) - 0.05;
sphereCap.rotateX(-Math.PI);

const halfSphere = new Mesh(
  new SphereGeometry(15, 24, 24, Math.PI / 2, Math.PI * 2, 0, (Math.PI / 180) * 120),
  capMaterial,
);
halfSphere.add(sphereCap);
halfSphere.rotateX((-Math.PI / 180) * 135);
halfSphere.rotateZ((-Math.PI / 180) * 20);
halfSphere.position.y = 7.5 + 15 * Math.sin((Math.PI / 180) * 30);

sphereGroup.add(halfSphere);

const smallSphereMaterial = new MeshPhongMaterial({ color: 0xffffff, emissive: 0x7b7b7b, flatShading: true });
const smallSphere = new Mesh(new IcosahedronGeometry(5, 0), smallSphereMaterial);
scene.add(smallSphere);

// walls
const wallTop = new Mesh(planeGeo, new MeshPhongMaterial({ color: 0xffffff }));
wallTop.position.y = 100;
wallTop.rotateX(Math.PI / 2);
scene.add(wallTop);

const wallBottom = new Mesh(planeGeo, new MeshPhongMaterial({ color: 0xffffff }));
wallBottom.rotateX(-Math.PI / 2);
scene.add(wallBottom);

const wallFront = new Mesh(planeGeo, new MeshPhongMaterial({ color: 0x7f7fff }));
wallFront.position.z = 50;
wallFront.position.y = 50;
wallFront.rotateY(Math.PI);
scene.add(wallFront);

const wallRight = new Mesh(planeGeo, new MeshPhongMaterial({ color: 0x00ff00 }));
wallRight.position.x = 50;
wallRight.position.y = 50;
wallRight.rotateY(-Math.PI / 2);
scene.add(wallRight);

const wallLeft = new Mesh(planeGeo, new MeshPhongMaterial({ color: 0xff0000 }));
wallLeft.position.x = -50;
wallLeft.position.y = 50;
wallLeft.rotateY(Math.PI / 2);
scene.add(wallLeft);

// lights
const mainLight = new PointLight(0xe7e7e7, 2.5, 250, 0);
mainLight.position.y = 60;
scene.add(mainLight);

const greenLight = new PointLight(0x00ff00, 0.5, 1000, 0);
greenLight.position.set(550, 50, 0);
scene.add(greenLight);

const redLight = new PointLight(0xff0000, 0.5, 1000, 0);
redLight.position.set(-550, 50, 0);
scene.add(redLight);

const blueLight = new PointLight(0xbbbbfe, 0.5, 1000, 0);
blueLight.position.set(0, 50, 550);
scene.add(blueLight);

// GUI

const params = {
  resolution: resolutionScale,
};

const gui = new GUI();

const folder = gui.addFolder("Mirrors");

folder.add(params, "resolution", 0.2, 1, 0.1).onChange(function (val) {
  resolutionScale = val as number;
  onWindowResize();
});

folder.open();

window.addEventListener("resize", onWindowResize);

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.getDrawingBufferSize(size);
  size.multiplyScalar(resolutionScale).round();

  groundMirror.getRenderTarget().setSize(size.width, size.height);
  verticalMirror.getRenderTarget().setSize(size.width, size.height);
}

let frames = 0;

function animate(): void {
  const timer = Date.now() * 0.01;

  sphereGroup.rotation.y -= 0.002;

  smallSphere.position.set(
    Math.cos(timer * 0.1) * 30,
    Math.abs(Math.cos(timer * 0.2)) * 20 + 5,
    Math.sin(timer * 0.1) * 30,
  );
  smallSphere.rotation.y = Math.PI / 2 - timer * 0.1;
  smallSphere.rotation.z = timer * 0.8;

  renderer.render(scene, camera);

  canvas.dataset.state = "rendered";
  canvas.dataset.resolution = String(resolutionScale);
  canvas.dataset.frames = String(++frames);
}

window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    renderer.setAnimationLoop(null);
    cameraControls.dispose();
    gui.destroy();
    groundMirror.dispose();
    groundMirror.geometry.dispose();
    verticalMirror.dispose();
    verticalMirror.geometry.dispose();
    planeGeo.dispose(); // shared by every wall
    sphereGroup.traverse((child) => {
      if (child instanceof Mesh) child.geometry.dispose();
    });
    capMaterial.dispose();
    smallSphere.geometry.dispose();
    smallSphereMaterial.dispose();
    for (const wall of [wallTop, wallBottom, wallFront, wallRight, wallLeft]) {
      (wall.material as MeshPhongMaterial).dispose();
    }
    renderer.dispose();
  },
  { once: true },
);
