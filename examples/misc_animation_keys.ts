import { AnimationClip } from "ek3d/animation/AnimationClip";
import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { ColorKeyframeTrack } from "ek3d/animation/tracks/ColorKeyframeTrack";
import { NumberKeyframeTrack } from "ek3d/animation/tracks/NumberKeyframeTrack";
import { QuaternionKeyframeTrack } from "ek3d/animation/tracks/QuaternionKeyframeTrack";
import { VectorKeyframeTrack } from "ek3d/animation/tracks/VectorKeyframeTrack";
import { AxesHelper } from "ek3d/helpers/AxesHelper";
import { Interpolation } from "ek3d/constants";
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
if (canvasSel === null) throw new Error("Missing animation keys example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const stats = new Stats();
document.body.appendChild(stats.dom);

const scene = new Scene();

const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(25, 25, 50);
camera.lookAt(scene.position);

const axesHelper = new AxesHelper(10);
scene.add(axesHelper);

const geometry = new BoxGeometry(5, 5, 5);
const material = new MeshBasicMaterial({ color: 0xffffff, transparent: true });
const mesh = new Mesh(geometry, material);
scene.add(mesh);

// create a keyframe track (i.e. a timed sequence of keyframes) for each animated property
// Note: the keyframe track type should correspond to the type of the property being animated

// POSITION
const positionKF = new VectorKeyframeTrack(".position", [0, 1, 2], [0, 0, 0, 30, 0, 0, 0, 0, 0]);

// SCALE
const scaleKF = new VectorKeyframeTrack(".scale", [0, 1, 2], [1, 1, 1, 2, 2, 2, 1, 1, 1]);

// ROTATION
// Rotation should be performed using quaternions, using a QuaternionKeyframeTrack
// Interpolating Euler angles (.rotation property) can be problematic and is currently not supported

// set up rotation about x axis
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

// COLOR
const colorKF = new ColorKeyframeTrack(
  ".material.color",
  [0, 1, 2],
  [1, 0, 0, 0, 1, 0, 0, 0, 1],
  Interpolation.Discrete,
);

// OPACITY
const opacityKF = new NumberKeyframeTrack(".material.opacity", [0, 1, 2], [1, 0, 1]);

// create an animation sequence with the tracks
// If a negative time value is passed, the duration will be calculated from the times of the passed tracks array
const clip = new AnimationClip("Action", 3, [scaleKF, positionKF, quaternionKF, colorKF, opacityKF]);

// setup the AnimationMixer
const mixer = new AnimationMixer(mesh);

// create a ClipAction and set it to play
const clipAction = mixer.clipAction(clip);
clipAction.play();

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader, LineBasicMaterial: basicShader },
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
