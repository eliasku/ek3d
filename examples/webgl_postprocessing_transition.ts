import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderTransitionPass } from "ek3d/addons/postprocessing/RenderTransitionPass";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Object3D } from "ek3d/core/Object3D";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import type { Texture } from "ek3d/textures/Texture";
import { Timer } from "ek3d/core/Timer";
import { Scene } from "ek3d/scenes/Scene";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;

class FXScene {
  camera: PerspectiveCamera;
  scene: Scene;
  rotationSpeed: Vector3;
  mesh: InstancedMesh;
  constructor(geometry: BoxGeometry | IcosahedronGeometry, rotationSpeed: Vector3, backgroundColor: number) {
    this.camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.z = 20;

    this.scene = new Scene();
    this.scene.background = new Color(backgroundColor);
    this.scene.add(new AmbientLight(0xaaaaaa, 3));

    const light = new DirectionalLight(0xffffff, 3);
    light.position.set(0, 1, 4);
    this.scene.add(light);

    this.rotationSpeed = rotationSpeed;

    const color = geometry.type === "BoxGeometry" ? 0x0000ff : 0xff0000;
    const material = new MeshPhongMaterial({ color: color, flatShading: true });
    this.mesh = createInstancedMesh(geometry, material, 500);
    this.scene.add(this.mesh);
  }

  update(delta: number): void {
    this.mesh.rotation.x += delta * this.rotationSpeed.x;
    this.mesh.rotation.y += delta * this.rotationSpeed.y;
    this.mesh.rotation.z += delta * this.rotationSpeed.z;
  }

  resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}

function createInstancedMesh(
  geometry: BoxGeometry | IcosahedronGeometry,
  material: MeshPhongMaterial,
  count: number,
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, count);

  const dummy = new Object3D();
  const color = new Color();

  for (let i = 0; i < count; i++) {
    dummy.position.x = Math.random() * 100 - 50;
    dummy.position.y = Math.random() * 60 - 30;
    dummy.position.z = Math.random() * 80 - 40;

    dummy.rotation.x = Math.random() * 2 * Math.PI;
    dummy.rotation.y = Math.random() * 2 * Math.PI;
    dummy.rotation.z = Math.random() * 2 * Math.PI;

    dummy.scale.x = Math.random() * 2 + 1;

    if (geometry.type === "BoxGeometry") {
      dummy.scale.y = Math.random() * 2 + 1;
      dummy.scale.z = Math.random() * 2 + 1;
    } else {
      dummy.scale.y = dummy.scale.x;
      dummy.scale.z = dummy.scale.x;
    }

    dummy.updateMatrix();

    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color.setScalar(0.1 + 0.9 * Math.random()));
  }

  return mesh;
}

const fxSceneA = new FXScene(new BoxGeometry(2, 2, 2), new Vector3(1, 0.5, 0.3), 0xffffff);
const fxSceneB = new FXScene(new IcosahedronGeometry(1, 1), new Vector3(0.3, 0.5, 1), 0x000000);

const timer = new Timer();
timer.connect(document);

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const composer = new EffectComposer(renderer);

const renderTransitionPass = new RenderTransitionPass(fxSceneA.scene, fxSceneA.camera, fxSceneB.scene, fxSceneB.camera);

const textures: Texture[] = [];
const loader = new TextureLoader();
for (let i = 0; i < 6; i++) {
  textures[i] = await loader.loadAsync("/examples/textures/transition/transition" + (i + 1) + ".png");
}
renderTransitionPass.setTexture(textures[0]);
composer.addPass(renderTransitionPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

const params = {
  transitionAnimate: true,
  transition: 0,
  useTexture: true,
  texture: 0,
  threshold: 0.1,
};

// Instead of the TWEEN-based cycler: triangle wave over 4 s.

function publishState(): void {
  if (frames === publishedFrames) return;
  publishedFrames = frames;
  canvas.dataset.state = "rendered";
  canvas.dataset.transition = String(Math.round(params.transition * 100) / 100);
  canvas.dataset.texture = String(params.texture);
  canvas.dataset.frames = String(frames);
}

let frames = 0;
let publishedFrames = -1;
let elapsed = 0;

function animate(): void {
  timer.update();

  const delta = timer.getDelta();
  fxSceneA.update(delta);
  fxSceneB.update(delta);

  if (params.transitionAnimate) {
    elapsed += delta;

    // 2 s hold on each scene, 1.5 s transition, cycling textures when the direction flips.
    const prev = params.transition;
    const period = 7;
    const phase = elapsed % period;
    if (phase < 2) params.transition = 0;
    else if (phase < 3.5) params.transition = (phase - 2) / 1.5;
    else if (phase < 5.5) params.transition = 1;
    else params.transition = 1 - (phase - 5.5) / 1.5;

    renderTransitionPass.setTransition(params.transition);

    if (Math.round(prev * 100) / 100 === 0 && params.transition === 0 && elapsed > 1.9 && elapsed < 2.02) {
      params.texture = (params.texture + 1) % textures.length;
      renderTransitionPass.setTexture(textures[params.texture]);
    }
  }

  if (params.transition === 0) {
    renderer.render(fxSceneB.scene, fxSceneB.camera);
  } else if (params.transition === 1) {
    renderer.render(fxSceneA.scene, fxSceneA.camera);
  } else {
    composer.render();
  }

  publishState();
  frames++;
}

renderer.setAnimationLoop(animate);

// Page check hooks (instead of lil-gui): 1 toggles transition animation, 2 cycles texture, 3/4 threshold.

window.addEventListener("keydown", (event) => {
  if (event.code === "Digit1") params.transitionAnimate = !params.transitionAnimate;
  else if (event.code === "Digit2") {
    params.texture = (params.texture + 1) % textures.length;
    renderTransitionPass.setTexture(textures[params.texture]);
  } else if (event.code === "Digit3") params.useTexture = !params.useTexture;
  else if (event.code === "Digit4") params.threshold = 1 - params.threshold;
  if (event.code === "Digit3") renderTransitionPass.useTexture(params.useTexture);
});

function onWindowResize(): void {
  fxSceneA.resize();
  fxSceneB.resize();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    composer.dispose();
    renderer.setAnimationLoop(null);
    renderer.dispose();
    for (const texture of textures) texture.dispose();
  },
  { once: true },
);
