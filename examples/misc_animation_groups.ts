import { AnimationClip } from "ek3d/animation/AnimationClip";
import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { AnimationObjectGroup } from "ek3d/animation/AnimationObjectGroup";
import { ColorKeyframeTrack } from "ek3d/animation/tracks/ColorKeyframeTrack";
import { NumberKeyframeTrack } from "ek3d/animation/tracks/NumberKeyframeTrack";
import { QuaternionKeyframeTrack } from "ek3d/animation/tracks/QuaternionKeyframeTrack";
import { InterpolateDiscrete } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Quaternion } from "ek3d/math/Quaternion";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { Stats } from "ek3d/addons/libs/Stats";
import { Timer } from "ek3d/core/Timer";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing animation groups example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const stats = new Stats();
document.body.appendChild(stats.dom);

const scene = new Scene();

const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(50, 50, 100);
camera.lookAt(scene.position);

// all objects of this animation group share a common animation state

const animationGroup = new AnimationObjectGroup();

const geometry = new BoxGeometry(5, 5, 5);
const material = new MeshBasicMaterial({ transparent: true });

for (let i = 0; i < 5; i++) {
  for (let j = 0; j < 5; j++) {
    const mesh = new Mesh(geometry, material);

    mesh.position.x = 32 - 16 * i;
    mesh.position.y = 0;
    mesh.position.z = 32 - 16 * j;

    scene.add(mesh);
    animationGroup.add(mesh);
  }
}

// create some keyframe tracks

const xAxis = new Vector3(1, 0, 0);
const qInitial = new Quaternion().setFromAxisAngle(xAxis, 0);
const qFinal = new Quaternion().setFromAxisAngle(xAxis, Math.PI);
const quaternionKF = new QuaternionKeyframeTrack(
  ".quaternion",
  [0, 1, 2],
  [
    qInitial.x,
    qInitial.y,
    qInitial.z,
    qInitial.w,
    qFinal.x,
    qFinal.y,
    qFinal.z,
    qFinal.w,
    qInitial.x,
    qInitial.y,
    qInitial.z,
    qInitial.w,
  ],
);

const colorKF = new ColorKeyframeTrack(".material.color", [0, 1, 2], [1, 0, 0, 0, 1, 0, 0, 0, 1], InterpolateDiscrete);
const opacityKF = new NumberKeyframeTrack(".material.opacity", [0, 1, 2], [1, 0, 1]);

// create clip

const clip = new AnimationClip("default", 3, [quaternionKF, colorKF, opacityKF]);

// apply the animation group to the mixer as the root object

const mixer = new AnimationMixer(animationGroup);

const clipAction = mixer.clipAction(clip);
clipAction.play();

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const timer = new Timer();
timer.connect(document);

function animate(): void {
  timer.update();

  const delta = timer.getDelta();

  mixer.update(delta);

  renderer.render(scene, camera);

  stats.update();

  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}

renderer.setAnimationLoop(animate);

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    timer.disconnect();
    clipAction.stop();
    geometry.dispose();
    material.dispose();
    stats.dom.remove();
    renderer.setAnimationLoop(null);
    renderer.dispose();
  },
  { once: true },
);
