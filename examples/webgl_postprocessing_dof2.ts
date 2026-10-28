import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { FullScreenQuad } from "ek3d/addons/postprocessing/Pass";
import { BokehDepthShader, BokehShader } from "ek3d/addons/shaders/BokehShader2";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DoubleSide, HalfFloatType } from "ek3d/constants";
import { Raycaster } from "ek3d/core/Raycaster";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { BufferGeometryLoader } from "ek3d/loaders/BufferGeometryLoader";
import { CubeTextureLoader } from "ek3d/loaders/CubeTextureLoader";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { cloneUniforms } from "ek3d/renderers/shaders/UniformsUtils";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing depth-of-field canvas");
const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 1, 3000);
camera.position.set(0, 150, 450);
const scene = new Scene();
scene.add(camera);
const renderer = new WebGLRenderer({
  canvas,
  createBackground: WebGLBackground,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
const depthUniforms = cloneUniforms(BokehDepthShader.uniforms);
depthUniforms["mNear"].value = camera.near;
depthUniforms["mFar"].value = camera.far;
const depth = new ShaderMaterial({
  uniforms: depthUniforms,
  vertexShader: BokehDepthShader.vertexShader,
  fragmentShader: BokehDepthShader.fragmentShader,
});
let disposed = false;
const cube = new CubeTextureLoader().load(
  ["posx", "negx", "posy", "negy", "posz", "negz"].map((face) => `/examples/textures/cube/Bridge2/${face}.jpg`),
  (texture) => {
    if (disposed) texture.dispose();
  },
);
scene.background = cube;
const leafGeometry = new PlaneGeometry(10, 10, 1, 1);
const leafMaterial = new MeshPhongMaterial({
  color: 0xffffff * 0.4,
  shininess: 0.5,
  specular: 0xffffff,
  envMap: cube,
  side: DoubleSide,
  forceSinglePass: true,
});
const leaves: { mesh: Mesh; dx: number; dz: number; rx: number; ry: number; rz: number }[] = [];
for (let i = 0; i < 100; i++) {
  const mesh = new Mesh(leafGeometry, leafMaterial);
  mesh.rotation.set(Math.random(), Math.random(), Math.random());
  mesh.position.set(Math.random() * 150, Math.random() * 300, Math.random() * 150);
  scene.add(mesh);
  leaves.push({
    mesh,
    dx: Math.random() - 0.5,
    dz: Math.random() - 0.5,
    rx: Math.random() * 0.1,
    ry: Math.random() * 0.1,
    rz: Math.random() * 0.1,
  });
}
new BufferGeometryLoader().load(
  "/examples/models/json/suzanne_buffergeometry.json",
  (geometry) => {
    if (disposed) {
      geometry.dispose();
      return;
    }
    geometry.computeVertexNormals();
    const material = new MeshPhongMaterial({
      specular: 0xffffff,
      envMap: cube,
      shininess: 50,
      reflectivity: 1,
      flatShading: true,
    });
    for (let i = 0; i < 20; i++) {
      const mesh = new Mesh(geometry, material);
      mesh.position.set(
        Math.sin((i / 20) * Math.PI * 2) * 200,
        Math.sin((i / 20) * Math.PI * 3) * 20,
        Math.cos((i / 20) * Math.PI * 2) * 200,
      );
      mesh.rotation.y = (i / 20) * Math.PI * 2;
      mesh.scale.setScalar(30);
      scene.add(mesh);
    }
  },
  undefined,
  (error) => {
    if (!disposed) console.error(error);
  },
);
const sphere = new SphereGeometry(1, 20, 20);
for (let i = 0; i < 20; i++) {
  const mesh = new Mesh(
    sphere,
    new MeshPhongMaterial({ color: 0xffffff * Math.random(), shininess: 0.5, specular: 0xffffff, envMap: cube }),
  );
  mesh.position.set((Math.random() - 0.5) * 200, Math.random() * 50, (Math.random() - 0.5) * 200);
  mesh.scale.setScalar(10);
  scene.add(mesh);
}
scene.add(new AmbientLight(0xcccccc));
const light1 = new DirectionalLight(0xffffff, 6);
light1.position.set(2, 1.2, 10).normalize();
scene.add(light1);
const light2 = new DirectionalLight(0xffffff, 3);
light2.position.set(-2, 1.2, -10).normalize();
scene.add(light2);
const colorTarget = new WebGLRenderTarget(innerWidth, innerHeight, { type: HalfFloatType });
const depthTarget = new WebGLRenderTarget(innerWidth, innerHeight, { type: HalfFloatType });
const uniforms = cloneUniforms(BokehShader.uniforms);
uniforms["tColor"].value = colorTarget.texture;
uniforms["tDepth"].value = depthTarget.texture;
uniforms["textureWidth"].value = innerWidth;
uniforms["textureHeight"].value = innerHeight;
const settings = { rings: 3, samples: 4 };
const bokeh = new ShaderMaterial({
  uniforms,
  vertexShader: BokehShader.vertexShader,
  fragmentShader: BokehShader.fragmentShader,
  defines: { RINGS: settings.rings, SAMPLES: settings.samples },
});
const quad = new FullScreenQuad(bokeh);
const params = {
  enabled: true,
  jsDepthCalculation: true,
  shaderFocus: false,
  fstop: 2.2,
  maxblur: 1,
  showFocus: false,
  focalDepth: 2.8,
  manualdof: false,
  vignetting: false,
  depthblur: false,
  threshold: 0.5,
  gain: 2,
  bias: 0.5,
  fringe: 0.7,
  focalLength: 35,
  noise: true,
  pentagon: false,
  dithering: 0.0001,
};
function updateMaterial(): void {
  for (const [key, value] of Object.entries(params)) if (key in uniforms) uniforms[key].value = value;
  uniforms["znear"].value = camera.near;
  uniforms["zfar"].value = camera.far;
  camera.setFocalLength(params.focalLength);
}
function updateShader(): void {
  bokeh.defines!.RINGS = settings.rings;
  bokeh.defines!.SAMPLES = settings.samples;
  bokeh.needsUpdate = true;
}
const gui = new GUI();
gui.add(params, "enabled").onChange(updateMaterial);
gui.add(params, "jsDepthCalculation").onChange(updateMaterial);
gui.add(params, "shaderFocus").onChange(updateMaterial);
gui.add(params, "focalDepth", 0, 200).listen().onChange(updateMaterial);
gui.add(params, "fstop", 0.1, 22, 0.001).onChange(updateMaterial);
gui.add(params, "maxblur", 0, 5, 0.025).onChange(updateMaterial);
gui.add(params, "showFocus").onChange(updateMaterial);
gui.add(params, "manualdof").onChange(updateMaterial);
gui.add(params, "vignetting").onChange(updateMaterial);
gui.add(params, "depthblur").onChange(updateMaterial);
gui.add(params, "threshold", 0, 1, 0.001).onChange(updateMaterial);
gui.add(params, "gain", 0, 100, 0.001).onChange(updateMaterial);
gui.add(params, "bias", 0, 3, 0.001).onChange(updateMaterial);
gui.add(params, "fringe", 0, 5, 0.001).onChange(updateMaterial);
gui.add(params, "focalLength", 16, 80, 0.001).onChange(updateMaterial);
gui.add(params, "noise").onChange(updateMaterial);
gui.add(params, "dithering", 0, 0.001, 0.0001).onChange(updateMaterial);
gui.add(params, "pentagon").onChange(updateMaterial);
gui.add(settings, "rings", 1, 8).step(1).onChange(updateShader);
gui.add(settings, "samples", 1, 13).step(1).onChange(updateShader);
updateMaterial();
const stats = new Stats();
document.body.appendChild(stats.dom);
const mouse = new Vector2();
const raycaster = new Raycaster();
const target = new Vector3(0, 20, -50);
let distance = 100;
function pointer(event: PointerEvent): void {
  if (!event.isPrimary) return;
  mouse.set((event.clientX / innerWidth) * 2 - 1, 1 - (event.clientY / innerHeight) * 2);
  uniforms["focusCoords"].value.set(event.clientX / innerWidth, 1 - event.clientY / innerHeight);
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  colorTarget.setSize(innerWidth, innerHeight);
  depthTarget.setSize(innerWidth, innerHeight);
  uniforms["textureWidth"].value = innerWidth;
  uniforms["textureHeight"].value = innerHeight;
  renderer.setSize(innerWidth, innerHeight);
}
canvas.style.touchAction = "none";
canvas.addEventListener("pointermove", pointer);
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  const time = Date.now() * 0.00015;
  camera.position.set(Math.cos(time) * 400, Math.sin(time / 1.4) * 100, Math.sin(time) * 500);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  if (params.jsDepthCalculation) {
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects(scene.children, true)[0];
    distance += ((hit ? hit.distance : 1000) - distance) * 0.03;
    const x = Math.max(0, Math.min(1, (distance - camera.near) / (camera.far - camera.near)));
    const smooth = x * x * (3 - 2 * x);
    const focal = (-camera.far * camera.near) / ((1 - smooth) * (camera.far - camera.near) - camera.far);
    uniforms["focalDepth"].value = focal;
    params.focalDepth = focal;
  }
  for (const leaf of leaves) {
    leaf.mesh.rotation.x += leaf.rx;
    leaf.mesh.rotation.y += leaf.ry;
    leaf.mesh.rotation.z += leaf.rz;
    leaf.mesh.position.y -= 2;
    leaf.mesh.position.x += leaf.dx;
    leaf.mesh.position.z += leaf.dz;
    if (leaf.mesh.position.y < 0) leaf.mesh.position.y += 300;
  }
  if (params.enabled) {
    renderer.setRenderTarget(colorTarget);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = depth;
    renderer.setRenderTarget(depthTarget);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    renderer.setRenderTarget(null);
    quad.render(renderer);
  } else {
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(scene, camera);
  }
  stats.update();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  canvas.removeEventListener("pointermove", pointer);
  gui.destroy();
  stats.dom.remove();
  quad.dispose();
  bokeh.dispose();
  depth.dispose();
  colorTarget.dispose();
  depthTarget.dispose();
  disposeObject(scene);
  cube.dispose();
  renderer.dispose();
});
