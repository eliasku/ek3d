import { FirstPersonControls } from "ek3d/addons/controls/FirstPersonControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { SunLight } from "ek3d/addons/lights/SunLight";
import { Sky } from "ek3d/addons/objects/Sky";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ToneMapping } from "ek3d/constants";
import { Object3D } from "ek3d/core/Object3D";
import { Timer } from "ek3d/core/Timer";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { Material } from "ek3d/materials/Material";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { degToRad, seededRandom } from "ek3d/math/MathUtils";
import { Vector3 } from "ek3d/math/Vector3";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import type { WebGLCubeRenderTarget } from "ek3d/renderers/WebGLCubeRenderTarget";
import type { WebGLShaderDescriptor } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import opaqueFragment from "ek3d/renderers/shaders/ShaderChunk/opaque_fragment.glsl";
import tonemappingFragment from "ek3d/renderers/shaders/ShaderChunk/tonemapping_fragment.glsl";
import colorspaceFragment from "ek3d/renderers/shaders/ShaderChunk/colorspace_fragment.glsl";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing sunlight canvas");
const params = { showCascades: false, far: 1000, resolution: 2048, azimuth: 135, elevation: 10 };
const sunDay = new Color(0xfff2e3),
  sunDusk = new Color(0xff8a3d);
const fogDay = new Color(0xd8e2ea),
  fogDusk = new Color(0xd9a273);
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createShadowMap: WebGLShadowMap,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  shaders: { MeshStandardMaterial: standardShader, MeshDepthMaterial: depthShader },
  shaderChunks: { tonemapping_fragment: tonemappingFragment, colorspace_fragment: colorspaceFragment },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap!.enabled = true;
renderer.toneMapping = ToneMapping.ACESFilmic;
renderer.toneMappingExposure = 0.6;

const scene = new Scene();
const fog = new Fog(0x000000, 500, 4000);
scene.fog = fog;
scene.environmentIntensity = 0.5;
const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 5000);
camera.position.set(60, 8, 0);
camera.lookAt(-60, 8, 0);
const controls = new FirstPersonControls(camera, canvas);
controls.movementSpeed = 40;
controls.lookSpeed = 0.2;
const timer = new Timer();
const pmrem = new PMREMGenerator(renderer);
const sceneEnv = new Scene();
const sky = new Sky();
sky.scale.setScalar(9000);
sky.material.uniforms.turbidity.value = 3;
sky.material.uniforms.rayleigh.value = 2;
sky.material.uniforms.showSunDisc.value = false;
scene.add(sky);
const sun = new SunLight();
sun.castShadow = true;
sun.shadow.camera.far = params.far;
sun.shadow.mapSize.setScalar(params.resolution);
sun.shadow.normalBias = 0.05;
scene.add(sun);
let environment: WebGLCubeRenderTarget | undefined;
function updateSun(): void {
  sun.position.setFromSphericalCoords(1, degToRad(90 - params.elevation), degToRad(params.azimuth));
  const daylight = Math.min(1, params.elevation / 30);
  sun.color.lerpColors(sunDusk, sunDay, daylight);
  sun.intensity = 3 + daylight * 2;
  fog.color.lerpColors(fogDusk, fogDay, daylight);
  (sky.material.uniforms.sunPosition.value as Vector3).copy(sun.position);
  environment?.dispose();
  sceneEnv.add(sky);
  environment = pmrem.fromScene(sceneEnv);
  scene.add(sky);
  scene.environment = environment.texture;
}
updateSun();

const ground = new Mesh(new PlaneGeometry(10000, 10000), new MeshStandardMaterial({ color: 0xa39f8e }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const dummy = new Object3D();
const posts = new InstancedMesh(new BoxGeometry(1, 10, 1), new MeshStandardMaterial({ color: 0x475161 }), 120);
posts.castShadow = posts.receiveShadow = true;
scene.add(posts);
for (let i = 0; i < 60; i++) {
  for (const side of [-1, 1]) {
    dummy.position.set(30 - i * 17, 5, side * 13);
    dummy.updateMatrix();
    posts.setMatrixAt(i * 2 + (side + 1) / 2, dummy.matrix);
  }
}
const towers = new InstancedMesh(new BoxGeometry(10, 1, 10), new MeshStandardMaterial(), 60);
towers.castShadow = towers.receiveShadow = true;
scene.add(towers);
const towerColors = [new Color(0x08d9d6), new Color(0xff2e63)];
seededRandom(6);
for (let i = 0; i < 30; i++) {
  for (const side of [-1, 1]) {
    const height = 20 + seededRandom() * 40;
    dummy.position.set(-40 - i * 32 - seededRandom() * 10, height / 2, side * (38 + seededRandom() * 55));
    dummy.scale.y = height;
    dummy.updateMatrix();
    const index = i * 2 + (side + 1) / 2;
    towers.setMatrixAt(index, dummy.matrix);
    towers.setColorAt(index, towerColors[(i + (side + 1) / 2) % 2]);
  }
}

function tintCascades(shader: WebGLShaderDescriptor): void {
  shader.fragmentShader = shader.fragmentShader.replace(
    opaqueFragment,
    `${opaqueFragment}
    #if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
      float cascade = 0.0;
      for ( int i = 0; i < SUN_LIGHT_CASCADES; i ++ ) {
        cascade += step( sunShadowCascade[ i ].y, vSunShadowWorldPosition.w );
      }
      gl_FragColor.rgb *= 0.7 + 0.3 * cos( cascade * 1.2 + vec3( 0.0, 4.2, 2.1 ) );
    #endif
  `,
  );
}
const materials = [ground.material, posts.material, towers.material].flat();
const gui = new GUI();
gui
  .add(params, "showCascades")
  .name("show cascades")
  .onChange(() => {
    for (const material of materials) {
      if (params.showCascades) material.onBeforeCompile = tintCascades;
      else
        material.onBeforeCompile = function (shader, renderer) {
          Material.prototype.onBeforeCompile.call(this, shader, renderer);
        };
      material.needsUpdate = true;
    }
  });
gui
  .add(params, "far", 100, 3000)
  .step(1)
  .name("shadow far")
  .onChange(() => {
    sun.shadow.camera.far = params.far;
  });
gui
  .add(params, "resolution", [256, 512, 1024, 2048, 4096])
  .name("shadow resolution")
  .onChange(() => {
    sun.shadow.mapSize.setScalar(params.resolution);
  });
gui.add(params, "azimuth", 0, 360).onChange(updateSun);
gui.add(params, "elevation", 5, 80).onChange(updateSun);
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  timer.update();
  controls.update(timer.getDelta());
  renderer.render(scene, camera);
  canvas.dataset.state = "rendered";
});
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  timer.dispose();
  posts.dispose();
  towers.dispose();
  scene.environment = null;
  environment?.dispose();
  pmrem.dispose();
  sun.dispose();
  disposeObject(scene);
  renderer.dispose();
  dfg.dispose();
});
