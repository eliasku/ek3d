import { FirstPersonControls } from "ek3d/addons/controls/FirstPersonControls";
import { LightProbeGridHelperWebGL } from "ek3d/addons/helpers/LightProbeGridHelperWebGL";
import { LightProbeGridWebGL } from "ek3d/addons/lighting/LightProbeGridWebGL";
import { SunLight } from "ek3d/addons/lights/SunLight";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { Sky } from "ek3d/addons/objects/Sky";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ToneMapping } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { Light } from "ek3d/lights/Light";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { Box3 } from "ek3d/math/Box3";
import { degToRad } from "ek3d/math/MathUtils";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import colorspaceFragment from "ek3d/renderers/shaders/ShaderChunk/colorspace_fragment.glsl";
import tonemappingFragment from "ek3d/renderers/shaders/ShaderChunk/tonemapping_fragment.glsl";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing Sponza canvas");
const canvas = selected;
const progress = document.querySelector<HTMLProgressElement>("#progress");
const scene = new Scene();
const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(-10.25, 4.99, 0.4);
camera.rotation.set(1.6505, -1.5008, 1.6507);
const sky = new Sky();
sky.scale.setScalar(450000);
sky.material.uniforms.turbidity.value = 10;
sky.material.uniforms.rayleigh.value = 2;
sky.material.uniforms.mieCoefficient.value = 0.005;
sky.material.uniforms.mieDirectionalG.value = 0.8;
sky.material.uniforms.showSunDisc.value = false;
scene.add(sky);
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createShadowMap: WebGLShadowMap,
  getDFGLUT: () => dfg,
  shaders: { MeshStandardMaterial: standardShader, MeshDepthMaterial: depthShader },
  shaderChunks: { tonemapping_fragment: tonemappingFragment, colorspace_fragment: colorspaceFragment },
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap!.enabled = true;
renderer.toneMapping = ToneMapping.ACESFilmic;
const controls = new FirstPersonControls(camera, canvas);
controls.movementSpeed = 2;
controls.lookSpeed = 0.2;
const timer = new Timer();
const manager = new LoadingManager();
manager.onProgress = (_url, loaded, total) => {
  if (progress) progress.value = (loaded / total) * 100;
};
manager.onLoad = () => {
  progress?.remove();
};
const params = {
  enabled: true,
  showProbes: false,
  probeSize: 0.2,
  boundsX: -0.5,
  boundsY: 6,
  boundsZ: -0.3,
  sizeX: 21,
  sizeY: 11,
  sizeZ: 9,
  countX: 10,
  countY: 7,
  countZ: 7,
  bounces: 1,
  lightAzimuth: -75,
  lightElevation: 60,
  lightIntensity: 100,
  shadows: true,
};
let probes: LightProbeGridWebGL | null = null;
let helper: LightProbeGridHelperWebGL | null = null;
let probeFar = 100;
let bakeIndex = 0;
let bakePass = 0;
let disposed = false;
let gui: GUI | undefined;
const sun = new SunLight(0xfff2dc, params.lightIntensity);
sun.castShadow = true;
sun.shadow.camera.far = 50;
sun.shadow.mapSize.setScalar(2048);
function updateLightPosition(): void {
  sun.position.setFromSphericalCoords(1, Math.PI / 2 - degToRad(params.lightElevation), degToRad(params.lightAzimuth));
  (sky.material.uniforms.sunPosition.value as Vector3).copy(sun.position);
}
function resetProbeBake(): void {
  bakeIndex = 0;
  bakePass = 0;
}
function createProbes(): void {
  if (helper) {
    scene.remove(helper);
    helper.dispose();
    helper = null;
  }
  if (probes) {
    scene.remove(probes);
    probes.dispose();
  }
  probes = new LightProbeGridWebGL(
    params.sizeX,
    params.sizeY,
    params.sizeZ,
    params.countX,
    params.countY,
    params.countZ,
  );
  probes.position.set(params.boundsX, params.boundsY, params.boundsZ);
  probes.visible = params.enabled;
  scene.add(probes);
  resetProbeBake();
}
function updateProbes(): void {
  if (!probes || bakePass > params.bounces) return;
  const resolution = probes.resolution;
  const total = resolution.x * resolution.y * resolution.z;
  const count = Math.min(4, total - bakeIndex);
  if (helper) helper.visible = false;
  try {
    probes.bake(renderer, scene, {
      cubemapSize: 32,
      near: 0.05,
      far: probeFar,
      start: bakeIndex,
      count,
      pass: bakePass,
    });
  } finally {
    if (helper) helper.visible = params.showProbes;
  }
  if (!helper) {
    helper = new LightProbeGridHelperWebGL(probes, params.probeSize);
    helper.visible = params.showProbes;
    scene.add(helper);
  }
  bakeIndex += count;
  if (bakeIndex === total) {
    bakeIndex = 0;
    bakePass++;
  }
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
canvas.dataset.state = "loading";
new GLTFLoader(manager).load(
  "/examples/models/gltf/Sponza/Sponza.gltf",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    const model = gltf.scene;
    const embeddedLights: Light[] = [];
    model.traverse((child) => {
      if (child instanceof Mesh) child.castShadow = child.receiveShadow = true;
      else if (child instanceof Light) embeddedLights.push(child);
    });
    for (const light of embeddedLights) light.parent?.remove(light);
    scene.add(model);
    const size = new Box3().setFromObject(model).getSize(new Vector3());
    probeFar = Math.max(size.x, size.y, size.z) * 2;
    scene.add(sun);
    updateLightPosition();
    gui = new GUI();
    gui
      .add(params, "enabled")
      .name("GI")
      .onChange(() => {
        if (probes) probes.visible = params.enabled;
      });
    gui
      .add(params, "lightAzimuth", -180, 180, 1)
      .name("Light Azimuth")
      .onChange(() => {
        updateLightPosition();
        resetProbeBake();
      });
    gui
      .add(params, "lightElevation", 5, 85, 1)
      .name("Light Elevation")
      .onChange(() => {
        updateLightPosition();
        resetProbeBake();
      });
    gui
      .add(params, "lightIntensity", 0, 100, 0.1)
      .name("Light Intensity")
      .onChange(() => {
        sun.intensity = params.lightIntensity;
        resetProbeBake();
      });
    gui
      .add(params, "shadows")
      .name("Shadows")
      .onChange(() => {
        renderer.shadowMap!.enabled = params.shadows;
        sun.castShadow = params.shadows;
        resetProbeBake();
      });
    gui.add(params, "countX", 2, 32, 1).name("Probes X").onFinishChange(createProbes);
    gui.add(params, "countY", 2, 16, 1).name("Probes Y").onFinishChange(createProbes);
    gui.add(params, "countZ", 2, 16, 1).name("Probes Z").onFinishChange(createProbes);
    gui.add(params, "bounces", 0, 2, 1).name("Bounces").onChange(resetProbeBake);
    gui
      .add(params, "showProbes")
      .name("Show Probes")
      .onChange(() => {
        if (helper) helper.visible = params.showProbes;
      });
    gui
      .add(params, "probeSize", 0.05, 2, 0.05)
      .name("Probe Size")
      .onChange(() => {
        if (!helper || !probes) return;
        scene.remove(helper);
        helper.dispose();
        helper = new LightProbeGridHelperWebGL(probes, params.probeSize);
        helper.visible = params.showProbes;
        scene.add(helper);
      });
    gui
      .add(
        {
          log: () => {
            console.log(
              "position:",
              camera.position.x.toFixed(2),
              camera.position.y.toFixed(2),
              camera.position.z.toFixed(2),
            );
            console.log(
              "rotation:",
              camera.rotation.x.toFixed(4),
              camera.rotation.y.toFixed(4),
              camera.rotation.z.toFixed(4),
            );
          },
        },
        "log",
      )
      .name("Log Camera");
    createProbes();
    canvas.dataset.state = "rendered";
    renderer.setAnimationLoop((timestamp) => {
      timer.update(timestamp);
      controls.update(timer.getDelta());
      updateProbes();
      renderer.render(scene, camera);
    });
  },
  undefined,
  (error) => {
    if (!disposed) {
      canvas.dataset.state = "error";
      canvas.dataset.error = String(error);
      console.error(error);
    }
  },
);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  manager.abort();
  window.removeEventListener("resize", resize);
  controls.dispose();
  timer.dispose();
  gui?.destroy();
  if (helper) {
    scene.remove(helper);
    helper.dispose();
  }
  if (probes) {
    scene.remove(probes);
    probes.dispose();
  }
  disposeObject(scene);
  sun.dispose();
  dfg.dispose();
  renderer.dispose();
});
