import { RoomEnvironment } from "ek3d/addons/environments/RoomEnvironment";
import { ToneMapping, ColorSpace, BufferUsage } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { Object3D } from "ek3d/core/Object3D";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing instancing dynamic example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

let camera!: PerspectiveCamera;
let scene!: Scene;
let renderer!: WebGLRenderer;
let mesh!: InstancedMesh;

let timer!: Timer;

// TWEEN is vendor runtime (user decision); the 2 s Sinusoidal.In color tween over
// animation.t is reproduced locally, matching the upstream transition behavior.
const animation = { t: 0, tweenStart: -1 };

const amount = 100;

const count = Math.pow(amount, 2);
const dummy = new Object3D();

const seeds: number[] = [];
const baseColors: number[] = [];

const color = new Color();
const colors = [new Color(0x00ffff), new Color(0xffff00), new Color(0xff00ff)];
let currentColorIndex = 0;
let nextColorIndex = 1;

const maxDistance = 75;
const cameraTarget = new Vector3();

init();

function init(): void {
  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    createEnvironments: WebGLEnvironments,
    getDFGLUT: () => dfgLUT,
    ltcTextures,
    shaders: {
      MeshStandardMaterial: standardShader,
      MeshBasicMaterial: basicShader,
      PointsMaterial: pointsShader,
      MeshLambertMaterial: lambertShader,
    },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = ToneMapping.Neutral;
  renderer.setAnimationLoop(animate);

  camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(10, 10, 10);
  camera.lookAt(0, 0, 0);

  const pmremGenerator = new PMREMGenerator(renderer);

  scene = new Scene();
  scene.background = new Color(0xadd8e6);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

  timer = new Timer();
  timer.connect(document);

  const loader = new TextureLoader();
  const texture = loader.load("/examples/textures/edge3.jpg");
  texture.colorSpace = ColorSpace.SRGB;

  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial({ map: texture });

  mesh = new InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(BufferUsage.DynamicDraw); // will be updated every frame
  scene.add(mesh);

  let i = 0;
  const offset = (amount - 1) / 2;

  for (let x = 0; x < amount; x++) {
    for (let z = 0; z < amount; z++) {
      dummy.position.set(offset - x, 0, offset - z);
      dummy.scale.set(1, 2, 1);

      dummy.updateMatrix();

      color.setHSL(1, 0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5);
      baseColors.push(color.getHex());

      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.multiply(colors[0]));

      i++;

      seeds.push(Math.random());
    }
  }

  window.addEventListener("resize", onWindowResize);
  window.addEventListener(
    "pagehide",
    () => {
      window.removeEventListener("resize", onWindowResize);
      clearInterval(tweenInterval);
      timer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.dispose();
    },
    { once: true },
  );

  // tween for animating color transition
  tweenInterval = setInterval(startTween, 3000);
}

let tweenInterval: ReturnType<typeof setInterval>;

function startTween(): void {
  animation.tweenStart = timer.getElapsed();
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

//

function animate(): void {
  timer.update();

  const time = timer.getElapsed();

  updateTween();

  // animate camera

  camera.position.x = Math.sin(time / 4) * 10;
  camera.position.z = Math.cos(time / 4) * 10;
  camera.position.y = 8 + Math.cos(time / 2) * 2;

  cameraTarget.x = Math.sin(time / 4) * -8;
  cameraTarget.z = Math.cos(time / 2) * -8;

  camera.lookAt(cameraTarget);

  camera.up.x = Math.sin(time / 400);

  // animate instance positions and colors

  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, dummy.matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

    dummy.position.y = Math.abs(Math.sin((time + seeds[i]) * 2 + seeds[i]));

    dummy.updateMatrix();

    mesh.setMatrixAt(i, dummy.matrix);

    // colors

    if (animation.t > 0) {
      const currentColor = colors[currentColorIndex];
      const nextColor = colors[nextColorIndex];

      const f = dummy.position.length() / maxDistance;

      if (f <= animation.t) {
        color.set(baseColors[i]).multiply(nextColor);
      } else {
        color.set(baseColors[i]).multiply(currentColor);
      }

      mesh.setColorAt(i, color);
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (animation.t > 0 && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  renderer.render(scene, camera);

  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}

function updateTween(): void {
  if (animation.tweenStart < 0) return;

  const raw = (timer.getElapsed() - animation.tweenStart) / 2;

  if (raw >= 1) {
    animation.t = 0;
    currentColorIndex = nextColorIndex;
    nextColorIndex++;

    if (nextColorIndex >= colors.length) nextColorIndex = 0;
    return;
  }

  // Sinusoidal.In
  animation.t = 1 - Math.cos((raw * Math.PI) / 2);
}
