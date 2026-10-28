import { Refractor } from "ek3d/addons/objects/Refractor";
import { WaterRefractionShader } from "ek3d/addons/shaders/WaterRefractionShader";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { PointLight } from "ek3d/lights/PointLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Wrapping } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Scene } from "ek3d/scenes/Scene";
import type { Texture } from "ek3d/textures/Texture";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing refraction example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const timer = new Timer();
timer.connect(document);

// scene
const scene = new Scene();

// camera
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 500);
camera.position.set(0, 75, 160);

// refractor

const refractor = new Refractor(new PlaneGeometry(90, 90), {
  color: 0xcbcbcb,
  textureWidth: 1024,
  textureHeight: 1024,
  shader: WaterRefractionShader,
});

refractor.position.set(0, 50, 0);

scene.add(refractor);

// load dudv map for distortion effect

const loader = new TextureLoader();
const dudvMap: Texture = await loader.loadAsync("/examples/textures/waterdudv.jpg");

dudvMap.wrapS = dudvMap.wrapT = Wrapping.Repeat;
refractor.material.uniforms.tDudv.value = dudvMap;

//

const sphereMaterial = new MeshPhongMaterial({ color: 0xffffff, emissive: 0x333333, flatShading: true });
const smallSphere = new Mesh(new IcosahedronGeometry(5, 0), sphereMaterial);
scene.add(smallSphere);

// walls

const planeGeo = new PlaneGeometry(100.1, 100.1);
const wallMaterial = new MeshPhongMaterial({ color: 0xffffff });

const planeTop = new Mesh(planeGeo, wallMaterial);
planeTop.position.y = 100;
planeTop.rotateX(Math.PI / 2);
scene.add(planeTop);

const planeBottom = new Mesh(planeGeo, wallMaterial);
planeBottom.rotateX(-Math.PI / 2);
scene.add(planeBottom);

const backMaterial = new MeshPhongMaterial({ color: 0x7f7fff });
const planeBack = new Mesh(planeGeo, backMaterial);
planeBack.position.z = -50;
planeBack.position.y = 50;
scene.add(planeBack);

const rightMaterial = new MeshPhongMaterial({ color: 0x00ff00 });
const planeRight = new Mesh(planeGeo, rightMaterial);
planeRight.position.x = 50;
planeRight.position.y = 50;
planeRight.rotateY(-Math.PI / 2);
scene.add(planeRight);

const leftMaterial = new MeshPhongMaterial({ color: 0xff0000 });
const planeLeft = new Mesh(planeGeo, leftMaterial);
planeLeft.position.x = -50;
planeLeft.position.y = 50;
planeLeft.rotateY(Math.PI / 2);
scene.add(planeLeft);

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

// controls
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 40, 0);
controls.maxDistance = 400;
controls.minDistance = 10;
controls.update();

window.addEventListener("resize", onWindowResize);

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

let frames = 0;

function animate(): void {
  timer.update();

  const time = timer.getElapsed();

  refractor.material.uniforms.time.value = time;

  smallSphere.position.set(Math.cos(time) * 30, Math.abs(Math.cos(time * 2)) * 20 + 5, Math.sin(time) * 30);
  smallSphere.rotation.y = Math.PI / 2 - time;
  smallSphere.rotation.z = time * 8;

  renderer.render(scene, camera);

  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(++frames);
}

window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    renderer.setAnimationLoop(null);
    timer.dispose();
    controls.dispose();
    refractor.dispose();
    refractor.geometry.dispose();
    dudvMap.dispose();
    smallSphere.geometry.dispose();
    sphereMaterial.dispose();
    planeGeo.dispose();
    for (const material of [wallMaterial, backMaterial, rightMaterial, leftMaterial]) material.dispose();
    renderer.dispose();
  },
  { once: true },
);
