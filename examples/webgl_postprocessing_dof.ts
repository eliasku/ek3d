import { BokehPass } from "ek3d/addons/postprocessing/BokehPass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { CubeTextureLoader } from "ek3d/loaders/CubeTextureLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Mesh } from "ek3d/objects/Mesh";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { Scene } from "ek3d/scenes/Scene";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;

const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 3000);
camera.position.z = 200;

const scene = new Scene();

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

const renderer = new WebGLRenderer({
  getDFGLUT: () => dfgLUT,
  ltcTextures,
  canvas,
  preserveDrawingBuffer: true,
  shaders: { MeshNormalMaterial: normalShader, MeshBasicMaterial: basicShader, MeshDepthMaterial: depthShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const path = "/examples/textures/cube/SwedishRoyalCastle/";
const format = ".jpg";
const urls = [
  path + "px" + format,
  path + "nx" + format,
  path + "py" + format,
  path + "ny" + format,
  path + "pz" + format,
  path + "nz" + format,
];

const textureCube = await new CubeTextureLoader().loadAsync(urls);

const parameters = { color: 0xff4900, envMap: textureCube };

const geo = new SphereGeometry(1, 20, 10);

const xgrid = 14,
  ygrid = 9,
  zgrid = 14;
const nobjects = xgrid * ygrid * zgrid;

const materials = [] as MeshBasicMaterial[];

const s = 60;
let count = 0;

for (let i = 0; i < xgrid; i++) {
  for (let j = 0; j < ygrid; j++) {
    for (let k = 0; k < zgrid; k++) {
      const meshMaterial = new MeshBasicMaterial(parameters);
      const mesh = new Mesh(geo, meshMaterial);
      materials[count] = meshMaterial;

      const x = 200 * (i - xgrid / 2);
      const y = 200 * (j - ygrid / 2);
      const z = 200 * (k - zgrid / 2);

      mesh.position.set(x, y, z);
      mesh.scale.set(s, s, s);

      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();

      scene.add(mesh);
      count++;
    }
  }
}

renderer.autoClear = false;

// postprocessing

const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

let bokehPass = new BokehPass(scene, camera, {
  focus: 500.0,
  aperture: 5,
  maxblur: 0.01,
});

bokehPass.materialBokeh!.uniforms["aperture"].value = 5 * 0.00001;

composer.addPass(bokehPass);
composer.addPass(new OutputPass());

let mouseX = 0,
  mouseY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

// Page check hooks (instead of lil-gui): 1–4 tune focus/aperture/maxblur/switch blur.

function publishState(): void {
  if (frames === publishedFrames) return;
  publishedFrames = frames;
  canvas.dataset.state = "rendered";
  canvas.dataset.focus = String(bokehPass.uniforms["focus"].value);
  canvas.dataset.aperture = String(bokehPass.uniforms["aperture"].value);
  canvas.dataset.frames = String(frames);
}

let frames = 0;
let publishedFrames = -1;

function animate(): void {
  const time = Date.now() * 0.00005;

  camera.position.x += (mouseX - camera.position.x) * 0.036;
  camera.position.y += (-mouseY - camera.position.y) * 0.036;

  camera.lookAt(scene.position);

  for (let i = 0; i < nobjects; i++) {
    const h = ((360 * (i / nobjects + time)) % 360) / 360;
    materials[i].color.setHSL(h, 1, 0.5);
  }

  composer.render(0.1);
  publishState();
  frames++;
}

renderer.setAnimationLoop(animate);

window.addEventListener("keydown", (event) => {
  if (event.code === "Digit1") bokehPass.uniforms["focus"].value = Number(bokehPass.uniforms["focus"].value) + 50;
  else if (event.code === "Digit2") bokehPass.uniforms["focus"].value = Number(bokehPass.uniforms["focus"].value) - 50;
  else if (event.code === "Digit3")
    bokehPass.uniforms["aperture"].value = Number(bokehPass.uniforms["aperture"].value) + 0.000005;
  else if (event.code === "Digit4")
    bokehPass.uniforms["aperture"].value = Number(bokehPass.uniforms["aperture"].value) - 0.000005;
});

window.addEventListener("pointermove", (event) => {
  if (event.isPrimary === false) return;

  mouseX = event.clientX - windowHalfX;
  mouseY = event.clientY - windowHalfY;
});

function onWindowResize(): void {
  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;

  const widthRes = window.innerWidth;
  const heightRes = window.innerHeight;

  camera.aspect = widthRes / heightRes;
  camera.updateProjectionMatrix();

  renderer.setSize(widthRes, heightRes);
  composer.setSize(widthRes, heightRes);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    composer.dispose();
    bokehPass.dispose();
    geo.dispose();
    textureCube.dispose();
    for (const mat of materials) mat.dispose();
    bokehPass = null as never;
    renderer.dispose();
  },
  { once: true },
);
