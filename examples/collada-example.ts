import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import type { ColladaKinematics } from "ek3d/addons/loaders/collada/ColladaComposer";
import { ColladaLoader, type ColladaResult } from "ek3d/addons/loaders/ColladaLoader";
import { KMZLoader } from "ek3d/addons/loaders/KMZLoader";
import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Timer } from "ek3d/core/Timer";
import type { Object3D } from "ek3d/core/Object3D";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { Color } from "ek3d/math/Color";
import { randInt } from "ek3d/math/MathUtils";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";
import { loadZipRuntime } from "./zip-runtime";

export function runColladaExample(mode: "elf" | "kinematics" | "skinning" | "kmz"): void {
  const element = document.querySelector<HTMLCanvasElement>("#scene");
  if (element === null) throw new Error("Missing Collada example canvas");
  const canvas: HTMLCanvasElement = element;
  const scene = new Scene();
  const camera = new PerspectiveCamera(
    mode === "skinning" ? 25 : mode === "kmz" ? 35 : 45,
    innerWidth / innerHeight,
    mode === "elf" ? 0.1 : 1,
    mode === "kmz" ? 500 : mode === "skinning" ? 1000 : 2000,
  );
  if (mode === "elf") {
    camera.position.set(8, 10, 8);
    camera.lookAt(0, 3, 0);
  }
  if (mode === "skinning") camera.position.set(15, 10, -15);
  if (mode === "kinematics") camera.position.set(2, 2, 3);
  if (mode === "kmz") {
    camera.position.set(0, 5, 10);
    scene.background = new Color(0x999999);
  }
  if (mode === "kinematics") scene.add(new HemisphereLight(0xfff7f7, 0x494966, 3));
  else {
    if (mode !== "kmz") scene.add(new AmbientLight(0xffffff, mode === "elf" ? 1 : 0.6));
    const light = new DirectionalLight(0xffffff, mode === "elf" ? 2.5 : 3);
    if (mode === "elf") light.position.set(1, 1, 0).normalize();
    else if (mode === "skinning") light.position.set(1.5, 1, -1.5);
    else light.position.set(0.5, 1, 0.5).normalize();
    scene.add(light);
  }
  if (mode !== "elf")
    scene.add(
      new GridHelper(
        mode === "kmz" ? 50 : mode === "skinning" ? 10 : 20,
        mode === "kmz" ? 50 : 20,
        mode === "kmz" ? 0xffffff : 0xc1c1c1,
        mode === "kmz" ? 0x7b7b7b : 0x8d8d8d,
      ),
    );
  const renderer = new WebGLRenderer({
    canvas,
    antialias: mode !== "elf",
    preserveDrawingBuffer: true,
    createBackground: WebGLBackground,
    shaders: {
      MeshBasicMaterial: basicShader,
      LineBasicMaterial: basicShader,
      MeshLambertMaterial: lambertShader,
      MeshPhongMaterial: phongShader,
    },
  });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  const controls = mode === "skinning" || mode === "kmz" ? new OrbitControls(camera, canvas) : undefined;
  if (controls !== undefined) {
    if (mode === "skinning") {
      controls.screenSpacePanning = true;
      controls.minDistance = 5;
      controls.maxDistance = 40;
      controls.target.set(0, 2, 0);
    }
    controls.update();
  }
  const timer = new Timer();
  timer.connect(document);
  const stats = mode === "kmz" ? undefined : new Stats();
  if (stats !== undefined) document.body.appendChild(stats.dom);
  let model: Object3D | undefined;
  let mixer: AnimationMixer | undefined;
  let kinematics: ColladaResult["kinematics"];
  let tweenStart = 0;
  let tweenDuration = 0;
  const from: Record<string, number> = {};
  const target: Record<string, number> = {};
  let disposed = false;
  let frames = 0;
  let loaded = false;
  canvas.dataset.state = "loading";
  function fail(error: unknown): void {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  }
  const manager = new LoadingManager(
    () => {
      loaded = true;
    },
    undefined,
    (url) => fail(`Failed to load ${url}`),
  );
  function accept(result: ColladaResult | null): void {
    if (result === null) {
      fail("Invalid Collada document");
      return;
    }
    if (disposed) {
      disposeObject(result.scene);
      return;
    }
    model = result.scene;
    if (mode === "kinematics") {
      model.scale.setScalar(10);
      model.updateMatrix();
      kinematics = result.kinematics;
    }
    if (mode === "skinning") {
      if (model.animations[0] === undefined) {
        fail("Collada animation missing");
        disposeObject(model);
        model = undefined;
        return;
      }
      mixer = new AnimationMixer(model);
      mixer.clipAction(model.animations[0]).play();
    }
    if (mode === "kmz") model.position.y = 0.5;
    scene.add(model);
  }
  if (mode === "kmz") {
    void loadZipRuntime().then((runtime) => {
      if (!disposed)
        new KMZLoader(manager).setZipRuntime(runtime).load("/examples/models/kmz/Box.kmz", accept, undefined, fail);
    }, fail);
  } else {
    const path =
      mode === "elf" ? "elf/elf.dae" : mode === "skinning" ? "stormtrooper/stormtrooper.dae" : "abb_irb52_7_120.dae";
    new ColladaLoader(manager).load(`/examples/models/collada/${path}`, accept, undefined, fail);
  }
  renderer.setAnimationLoop(() => {
    timer.update();
    const delta = timer.getDelta();
    if (mode === "elf" && model !== undefined) model.rotation.z += delta * 0.5;
    mixer?.update(delta);
    if (mode === "kinematics") {
      const now = performance.now();
      if (kinematics !== undefined && "joints" in kinematics) {
        const active = kinematics as Extract<ColladaKinematics, { joints: unknown }>;
        if (now >= tweenStart + tweenDuration) {
          tweenStart = now;
          tweenDuration = randInt(1000, 5000);
          for (const [key, joint] of Object.entries(active.joints)) {
            if (joint.static) continue;
            from[key] = target[key] ?? joint.zeroPosition;
            target[key] = randInt(joint.limits.min, joint.limits.max);
          }
        }
        const t = Math.min(1, (now - tweenStart) / tweenDuration);
        const eased = t * (2 - t);
        for (const key of Object.keys(target)) active.setJointValue(key, from[key] + (target[key] - from[key]) * eased);
      }
      const angle = Date.now() * 0.0001;
      camera.position.set(Math.cos(angle) * 20, 10, Math.sin(angle) * 20);
      camera.lookAt(0, 5, 0);
    }
    renderer.render(scene, camera);
    stats?.update();
    canvas.dataset.frames = String(++frames);
    if (loaded && model !== undefined && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  });
  function resize(): void {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("pagehide", (event) => {
    if (event.persisted || disposed) return;
    disposed = true;
    window.removeEventListener("resize", resize);
    renderer.setAnimationLoop(null);
    manager.abort();
    controls?.dispose();
    mixer?.stopAllAction();
    if (mixer !== undefined && model !== undefined) mixer.uncacheRoot(model);
    timer.disconnect();
    disposeObject(scene);
    stats?.dom.remove();
    renderer.dispose();
  });
}
