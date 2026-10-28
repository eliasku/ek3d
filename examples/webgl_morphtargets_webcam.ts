import { GLTFLoader, type GLTF, type MeshoptDecoderLike } from "ek3d/addons/loaders/GLTFLoader";
import { KTX2Loader } from "ek3d/addons/loaders/KTX2Loader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ACESFilmicToneMapping, SRGBColorSpace } from "ek3d/constants";
import { Object3D } from "ek3d/core/Object3D";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { FileLoader } from "ek3d/loaders/FileLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import type { Material } from "ek3d/materials/Material";
import { MeshNormalMaterial } from "ek3d/materials/MeshNormalMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { Scene } from "ek3d/scenes/Scene";
import { VideoTexture } from "ek3d/textures/VideoTexture";
import type * as Vision from "./public/examples/libs/mediapipe/vision_bundle.mjs";
import { disposeObject } from "./dispose-object";
import { applyBlendshapes } from "./webgl_morphtargets_webcam_blendshapes";

const canvasElement = document.querySelector<HTMLCanvasElement>("#scene");
const statusElement = document.querySelector<HTMLElement>("#status");
if (!canvasElement || !statusElement) throw new Error("Missing webcam example elements");
const canvas: HTMLCanvasElement = canvasElement;
const status: HTMLElement = statusElement;
const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfgLUT,
  ltcTextures,
  shaders: {
    MeshBasicMaterial: basicShader,
    MeshNormalMaterial: normalShader,
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
    MeshLambertMaterial: lambertShader,
    PointsMaterial: pointsShader,
  },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
const camera = new PerspectiveCamera(63, window.innerWidth / window.innerHeight, 1, 10000);
const scene = new Scene();
scene.background = new Color(0x666666);
scene.scale.x = -1;
scene.add(new AmbientLight(0xffffff, 5));
const faceContainer = new Object3D();
faceContainer.matrixAutoUpdate = false;
faceContainer.matrix.makeTranslation(0, 0, -50);
faceContainer.matrixWorldNeedsUpdate = true;
scene.add(faceContainer);
const registration = new Object3D();
registration.scale.setScalar(0.958);
registration.rotation.x = Math.PI / 2;
registration.position.set(0, 0.12, 1.18);
faceContainer.add(registration);
const video = document.createElement("video");
video.playsInline = true;
video.muted = true;
const texture = new VideoTexture(video);
texture.colorSpace = SRGBColorSpace;
const videoMesh = new Mesh(
  new PlaneGeometry(1, 1),
  new MeshBasicMaterial({ map: texture, depthTest: false, depthWrite: false }),
);
videoMesh.position.z = -100;
videoMesh.renderOrder = -1;
scene.add(videoMesh);
const ktx2Loader = new KTX2Loader().detectSupport(renderer);
let landmarker: Vision.FaceLandmarker | undefined;
let gui: GUI | undefined;
let stream: MediaStream | undefined;
let gltf: GLTF | undefined;
let face: Mesh | undefined;
let eyeL: Object3D | undefined;
let eyeR: Object3D | undefined;
const replacedMaterials: Material[] = [];
let disposed = false;
canvas.dataset.state = "loading";

function reportError(error: unknown): void {
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  status.textContent = `Unable to run webcam tracking: ${canvas.dataset.error}`;
  console.error("Unable to run webcam tracking.", error);
}

function resize(): void {
  let width = window.innerWidth;
  let height = window.innerHeight;
  if (width / height > camera.aspect) width = height * camera.aspect;
  else height = width / camera.aspect;
  renderer.setSize(width, height);
}
function metadata(): void {
  if (!video.videoWidth || !video.videoHeight) return;
  camera.aspect = video.videoWidth / video.videoHeight;
  camera.updateProjectionMatrix();
  const height = 200 * Math.tan((63 * Math.PI) / 360);
  videoMesh.scale.set(height * camera.aspect, height, 1);
  resize();
}
function animate(): void {
  try {
    if (
      landmarker &&
      face?.morphTargetDictionary &&
      face.morphTargetInfluences &&
      eyeL &&
      eyeR &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      const results = landmarker.detectForVideo(video, performance.now());
      const pose = results.facialTransformationMatrixes[0];
      if (pose) {
        faceContainer.matrix.fromArray(pose.data);
        faceContainer.matrixWorldNeedsUpdate = true;
      }
      const blendshapes = results.faceBlendshapes[0];
      if (blendshapes)
        applyBlendshapes(blendshapes.categories, face.morphTargetDictionary, face.morphTargetInfluences, eyeL, eyeR);
    }
  } catch (error) {
    reportError(error);
    renderer.setAnimationLoop(null);
    return;
  }
  renderer.render(scene, camera);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}
window.addEventListener("resize", resize);
video.addEventListener("loadedmetadata", metadata);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  video.removeEventListener("loadedmetadata", metadata);
  renderer.setAnimationLoop(null);
  stream?.getTracks().forEach((track) => track.stop());
  video.pause();
  video.srcObject = null;
  landmarker?.close();
  gui?.destroy();
  const cleanupRoot = new Object3D();
  cleanupRoot.add(scene);
  if (gltf) cleanupRoot.add(gltf.scene);
  disposeObject(cleanupRoot, replacedMaterials);
  ktx2Loader.dispose();
  dfgLUT.dispose();
  ltcTextures.LTC_FLOAT_1.dispose();
  ltcTextures.LTC_FLOAT_2.dispose();
  ltcTextures.LTC_HALF_1.dispose();
  ltcTextures.LTC_HALF_2.dispose();
  renderer.dispose();
});
renderer.setAnimationLoop(animate);

async function init(): Promise<void> {
  try {
    const source = (await new FileLoader()
      .setPath("/examples/libs/")
      .setResponseType("text")
      .loadAsync("meshopt_decoder.module.js")) as unknown as string;
    const blob = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    let decoder: MeshoptDecoderLike;
    try {
      // The decoder is an untransformed vendor asset outside the package graph.
      const module = (await import(/* @vite-ignore */ blob)) as { MeshoptDecoder: MeshoptDecoderLike };
      decoder = module.MeshoptDecoder;
    } finally {
      URL.revokeObjectURL(blob);
    }
    if (disposed) return;
    const loaded = await new GLTFLoader()
      .setKTX2Loader(ktx2Loader)
      .setMeshoptDecoder(decoder)
      .loadAsync("/examples/models/gltf/facecap.glb");
    if (disposed) {
      disposeObject(loaded.scene);
      return;
    }
    gltf = loaded;
    const group = loaded.scene.getObjectByName("grp_transform");
    const head = group?.getObjectByName("mesh_2");
    const teeth = group?.getObjectByName("mesh_3");
    const left = group?.getObjectByName("eyeLeft");
    const right = group?.getObjectByName("eyeRight");
    if (
      !group ||
      !(head instanceof Mesh) ||
      !(teeth instanceof Mesh) ||
      !left ||
      !right ||
      !head.morphTargetDictionary ||
      !head.morphTargetInfluences
    )
      throw new Error("Face Cap model is missing its face, eyes, teeth or morph targets");
    registration.add(group);
    for (const mesh of [head, teeth]) {
      replacedMaterials.push(...(Array.isArray(mesh.material) ? mesh.material : [mesh.material]));
      mesh.material = new MeshNormalMaterial();
    }
    face = head;
    eyeL = left;
    eyeR = right;
    gui = new GUI();
    gui.close();
    for (const [key, value] of Object.entries(head.morphTargetDictionary)) {
      gui
        .add(head.morphTargetInfluences as unknown as Record<string, number>, String(value), 0, 1, 0.01)
        .name(key.replace("blendShape1.", ""))
        .listen();
    }
    canvas.dataset.guiControllers = String(gui.controllers.length);
    // Public vendor modules are fetched as text so Vite does not transform them.
    const visionSource = (await new FileLoader()
      .setPath("/examples/libs/mediapipe/")
      .setResponseType("text")
      .loadAsync("vision_bundle.mjs")) as unknown as string;
    if (disposed) return;
    const visionBlob = URL.createObjectURL(new Blob([visionSource], { type: "text/javascript" }));
    let vision: typeof Vision;
    try {
      vision = (await import(/* @vite-ignore */ visionBlob)) as typeof Vision;
    } finally {
      URL.revokeObjectURL(visionBlob);
    }
    if (disposed) return;
    const fileset = await vision.FilesetResolver.forVisionTasks("/examples/libs/mediapipe/wasm");
    if (disposed) return;
    const created = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/examples/libs/mediapipe/face_landmarker.task", delegate: "GPU" },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: "VIDEO",
      numFaces: 1,
    });
    if (disposed) {
      created.close();
      return;
    }
    landmarker = created;
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error("Camera access is unavailable; use a secure context and a supported browser.");
    const captured = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    if (disposed) {
      captured.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = captured;
    video.srcObject = stream;
    await video.play();
  } catch (error) {
    if (!disposed) reportError(error);
  }
}
void init();
