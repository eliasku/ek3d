import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import type { AnimationAction } from "ek3d/animation/AnimationAction";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { HDRLoader } from "ek3d/addons/loaders/HDRLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import {
  ACESFilmicToneMapping,
  EquirectangularReflectionMapping,
  PCFShadowMap,
  RepeatWrapping,
  SRGBColorSpace,
} from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { SkeletonHelper } from "ek3d/helpers/SkeletonHelper";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { PointLight } from "ek3d/lights/PointLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { Quaternion } from "ek3d/math/Quaternion";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import type { Texture } from "ek3d/textures/Texture";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing animation canvas");
const timer = new Timer();
timer.connect(document);
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 2, -5);
const scene = new Scene();
scene.background = new Color(0x5e5d5d);
scene.fog = new Fog(0x5e5d5d, 2, 20);
const group = new Group();
const follow = new Group();
scene.add(group, follow);
const light = new DirectionalLight(0xffffff, 5);
light.position.set(-2, 5, -3);
light.castShadow = true;
light.shadow.camera.top = light.shadow.camera.right = 2;
light.shadow.camera.bottom = light.shadow.camera.left = -2;
light.shadow.camera.near = 3;
light.shadow.camera.far = 8;
light.shadow.mapSize.set(1024, 1024);
follow.add(light, light.target);
const dfg = createDFGLUT();
const ltc = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createShadowMap: WebGLShadowMap,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  ltcTextures: ltc,
  shaders: {
    MeshStandardMaterial: standardShader,
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
    MeshDepthMaterial: depthShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;
if (renderer.shadowMap) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
}
const orbit = new OrbitControls<PerspectiveCamera>(camera, canvas);
orbit.target.set(0, 1, 0);
orbit.enableDamping = true;
orbit.enablePan = false;
orbit.maxPolarAngle = Math.PI / 2 - 0.05;
orbit.update();
const settings = { show_skeleton: false, fixe_transition: true };
const key = [0, 0, 0];
const ease = new Vector3();
const position = new Vector3();
const up = new Vector3(0, 1, 0);
const rotate = new Quaternion();
type State = "Idle" | "Walk" | "Run";
let current: State = "Idle";
let actions: Record<State, AnimationAction> | undefined;
let mixer: AnimationMixer | undefined;
let floor: Mesh | undefined;
let environment: Texture | undefined;
let gui: GUI | undefined;
let disposed = false;
new HDRLoader().load(
  "/examples/textures/equirectangular/lobe.hdr",
  (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    environment = texture;
    texture.mapping = EquirectangularReflectionMapping;
    scene.environment = texture;
    scene.environmentIntensity = 1.5;
    const loader = new TextureLoader();
    const disposeStale = (map: Texture): void => {
      if (disposed) map.dispose();
    };
    const diffuse = loader.load("/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg", disposeStale);
    diffuse.colorSpace = SRGBColorSpace;
    const normal = loader.load("/examples/textures/floors/FloorsCheckerboard_S_Normal.jpg", disposeStale);
    for (const map of [diffuse, normal]) {
      map.repeat.set(16, 16);
      map.wrapS = map.wrapT = RepeatWrapping;
      map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }
    const geometry = new PlaneGeometry(50, 50, 50, 50);
    geometry.rotateX(-Math.PI / 2);
    floor = new Mesh(
      geometry,
      new MeshStandardMaterial({
        map: diffuse,
        normalMap: normal,
        normalScale: new Vector2(0.5, 0.5),
        color: 0x404040,
        depthWrite: false,
        roughness: 0.85,
      }),
    );
    floor.receiveShadow = true;
    scene.add(floor);
    const bulb = new PointLight(0xffee88, 2, 500, 2);
    bulb.add(
      new Mesh(
        new SphereGeometry(0.05, 16, 8),
        new MeshStandardMaterial({ emissive: 0xffffee, emissiveIntensity: 1, color: 0x000000 }),
      ),
    );
    bulb.position.set(1, 0.1, -3);
    bulb.castShadow = true;
    floor.add(bulb);
    new GLTFLoader().load(
      "/examples/models/gltf/Soldier.glb",
      (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }
        const model = gltf.scene;
        group.add(model);
        model.rotation.y = Math.PI;
        group.rotation.y = Math.PI;
        model.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if (!(material instanceof MeshStandardMaterial)) continue;
            material.metalness = 1;
            material.color.set(1, 1, 1);
            if (object.name === "vanguard_Mesh") {
              object.castShadow = true;
              object.receiveShadow = true;
              material.roughness = 0.2;
              material.metalnessMap = material.map;
            } else {
              material.roughness = 0;
              material.transparent = true;
              material.opacity = 0.8;
            }
          }
        });
        const skeleton = new SkeletonHelper(model);
        skeleton.setColors(new Color(0xe000ff), new Color(0x00e0ff));
        skeleton.visible = false;
        scene.add(skeleton);
        gui = new GUI({ width: 310 });
        gui.add(settings, "show_skeleton").onChange(() => {
          skeleton.visible = settings.show_skeleton;
        });
        gui.add(settings, "fixe_transition");
        mixer = new AnimationMixer(model);
        actions = {
          Idle: mixer.clipAction(gltf.animations[0]),
          Walk: mixer.clipAction(gltf.animations[3]),
          Run: mixer.clipAction(gltf.animations[1]),
        };
        for (const [name, action] of Object.entries(actions)) {
          action.enabled = true;
          action.setEffectiveTimeScale(1);
          if (name !== "Idle") action.setEffectiveWeight(0);
        }
        actions.Idle.play();
      },
      undefined,
      (error: unknown) => console.error(error),
    );
  },
  undefined,
  (error: unknown) => console.error(error),
);
function update(delta: number): void {
  if (!actions || !floor) {
    orbit.update();
    return;
  }
  const next: State = key[0] || key[1] ? (key[2] ? "Run" : "Walk") : "Idle";
  if (next !== current) {
    const action = actions[next];
    const old = actions[current];
    current = next;
    if (settings.fixe_transition) {
      action.reset();
      action.weight = 1;
      action.stopFading();
      old.stopFading();
      if (next !== "Idle") action.time = (old.time * action.getClip().duration) / old.getClip().duration;
      old._scheduleFading(0.5, old.getEffectiveWeight(), 0);
      action._scheduleFading(0.5, action.getEffectiveWeight(), 1);
      action.play();
    } else {
      action.enabled = true;
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(1);
      old.fadeOut(0.5);
      action.reset().fadeIn(0.5).play();
    }
  }
  if (current !== "Idle") {
    ease.set(key[1], 0, key[0]).multiplyScalar((current === "Run" ? 5 : 1.8) * delta);
    const azimuth = orbit.getAzimuthalAngle();
    const angle = Math.atan2(ease.x, ease.z) + azimuth;
    rotate.setFromAxisAngle(up, Math.atan2(Math.sin(angle), Math.cos(angle)));
    ease.applyAxisAngle(up, azimuth);
    position.add(ease);
    camera.position.add(ease);
    group.position.copy(position);
    group.quaternion.rotateTowards(rotate, 0.05);
    orbit.target.copy(position).add(up);
    follow.position.copy(position);
    const dx = position.x - floor.position.x;
    const dz = position.z - floor.position.z;
    if (Math.abs(dx) > 12.5) floor.position.x += dx;
    if (Math.abs(dz) > 12.5) floor.position.z += dz;
  }
  mixer?.update(delta);
  orbit.update();
}
function onKey(event: KeyboardEvent): void {
  const down = event.type === "keydown";
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
    case "KeyZ":
      key[0] = down ? -1 : key[0] < 0 ? 0 : key[0];
      break;
    case "ArrowDown":
    case "KeyS":
      key[0] = down ? 1 : key[0] > 0 ? 0 : key[0];
      break;
    case "ArrowLeft":
    case "KeyA":
    case "KeyQ":
      key[1] = down ? -1 : key[1] < 0 ? 0 : key[1];
      break;
    case "ArrowRight":
    case "KeyD":
      key[1] = down ? 1 : key[1] > 0 ? 0 : key[1];
      break;
    case "ShiftLeft":
    case "ShiftRight":
      key[2] = down ? 1 : 0;
      break;
  }
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
document.addEventListener("keydown", onKey);
document.addEventListener("keyup", onKey);
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  timer.update();
  update(timer.getDelta());
  renderer.render(scene, camera);
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  document.removeEventListener("keydown", onKey);
  document.removeEventListener("keyup", onKey);
  window.removeEventListener("resize", resize);
  timer.dispose();
  mixer?.stopAllAction();
  orbit.dispose();
  gui?.destroy();
  disposeObject(scene);
  environment?.dispose();
  renderer.dispose();
  dfg.dispose();
  for (const texture of Object.values(ltc)) texture.dispose();
});
