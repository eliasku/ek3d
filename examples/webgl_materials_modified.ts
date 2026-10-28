import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshNormalMaterial } from "ek3d/materials/MeshNormalMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import beginVertex from "ek3d/renderers/shaders/ShaderChunk/begin_vertex.glsl";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing modified material canvas");
const canvas = selected;
const scene = new Scene();
const camera = new PerspectiveCamera(27, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 20;
const renderer = new WebGLRenderer({ canvas, antialias: true, shaders: { MeshNormalMaterial: normalShader } });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 10;
controls.maxDistance = 50;
const stats = new Stats();
document.body.appendChild(stats.dom);
const manager = new LoadingManager();
let disposed = false,
  frames = 0;
const time = { value: 0 };
canvas.dataset.state = "loading";
function buildTwistMaterial(amount: number): MeshNormalMaterial {
  const material = new MeshNormalMaterial();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.time = time;
    shader.vertexShader =
      "uniform float time;\n" +
      shader.vertexShader.replace(
        beginVertex,
        [
          `float theta = sin( time + position.y ) / ${amount.toFixed(1)};`,
          "float c = cos( theta );",
          "float s = sin( theta );",
          "mat3 m = mat3( c, 0, s, 0, 1, 0, -s, 0, c );",
          "vec3 transformed = vec3( position ) * m;",
          "vNormal = vNormal * m;",
        ].join("\n"),
      );
  };
  material.customProgramCacheKey = () => amount.toFixed(1);
  return material;
}
new GLTFLoader(manager).load(
  "/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    const original = gltf.scene.children[0];
    if (!(original instanceof Mesh)) {
      disposeObject(gltf.scene);
      canvas.dataset.state = "error";
      canvas.dataset.error = "Missing source mesh";
      return;
    }
    for (const [x, amount] of [
      [-3.5, 2],
      [3.5, -2],
    ]) {
      const mesh = new Mesh(original.geometry, buildTwistMaterial(amount));
      mesh.position.set(x, -0.5, 0);
      scene.add(mesh);
    }
    scene.add(gltf.scene);
    gltf.scene.visible = false;
    canvas.dataset.state = "rendered";
  },
  undefined,
  (error) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    console.error(error);
  },
);
renderer.setAnimationLoop(() => {
  time.value = performance.now() / 1000;
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
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
  manager.abort();
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
});
