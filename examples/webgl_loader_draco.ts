import { DRACOLoader } from "ek3d/addons/loaders/DRACOLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing draco loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;

let camera!: PerspectiveCamera;
let scene!: Scene;
let renderer!: WebGLRenderer;

// Configure and create Draco decoder.
const dracoLoader = new DRACOLoader();
let meshBunny: Mesh | undefined;

init();

function init(): void {
  camera = new PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 15);
  camera.position.set(3, 0.25, 3);

  scene = new Scene();
  scene.background = new Color(0x443333);
  scene.fog = new Fog(0x443333, 1, 4);

  // Ground
  const plane = new Mesh(new PlaneGeometry(8, 8), new MeshLambertMaterial({ color: 0xcbcbcb }));
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.03;
  plane.receiveShadow = true;
  scene.add(plane);

  // Lights
  const hemiLight = new HemisphereLight(0x8d7c7c, 0x494966, 3);
  scene.add(hemiLight);

  const spotLight = new SpotLight();
  spotLight.intensity = 7;
  spotLight.angle = Math.PI / 16;
  spotLight.penumbra = 0.5;
  spotLight.castShadow = true;
  spotLight.shadow.radius = 8;
  spotLight.position.set(-1, 1, 1);
  scene.add(spotLight);

  const dfgLUT = createDFGLUT();
  const ltcTextures = createLTCTextures();

  // renderer
  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    createShadowMap: WebGLShadowMap,
    getDFGLUT: () => dfgLUT,
    ltcTextures,
    shaders: {
      MeshLambertMaterial: lambertShader,
      MeshStandardMaterial: standardShader,
      MeshDepthMaterial: depthShader,
      MeshBasicMaterial: basicShader,
      LineBasicMaterial: basicShader,
    },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);

  const shadowMap = renderer.shadowMap;
  if (shadowMap === null) throw new Error("the shadow map system failed to install");
  shadowMap.enabled = true;

  dracoLoader.load("/examples/models/draco/bunny.drc", function (geometry) {
    geometry.computeVertexNormals();

    const material = new MeshStandardMaterial({ color: 0xa5a5a5 });
    meshBunny = new Mesh(geometry, material);
    meshBunny.castShadow = true;
    meshBunny.receiveShadow = true;
    scene.add(meshBunny);

    // Release decoder resources.
    dracoLoader.dispose();
  });

  window.addEventListener("resize", onWindowResize);
  window.addEventListener(
    "pagehide",
    () => {
      window.removeEventListener("resize", onWindowResize);
      renderer.setAnimationLoop(null);
      dracoLoader.dispose();
      meshBunny?.geometry.dispose();
      if (meshBunny) (meshBunny.material as MeshStandardMaterial).dispose();
      renderer.dispose();
    },
    { once: true },
  );
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(): void {
  const timer = Date.now() * 0.0003;

  camera.position.x = Math.sin(timer) * 0.5;
  camera.position.z = Math.cos(timer) * 0.5;
  camera.lookAt(0, 0.1, 0);

  renderer.render(scene, camera);

  canvas.dataset.state = "rendered";
  canvas.dataset.bunnyLoaded = String(meshBunny !== undefined);
}
