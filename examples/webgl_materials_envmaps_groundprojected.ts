import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GroundedSkybox } from "ek3d/addons/objects/GroundedSkybox";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { DRACOLoader } from "ek3d/addons/loaders/DRACOLoader";
import { DRACO_GLTF_CONFIG } from "ek3d/addons/loaders/DRACOLoader";
import { HDRLoader } from "ek3d/addons/loaders/HDRLoader";
import { ToneMapping, Mapping, Blending } from "ek3d/constants";
import { degToRad } from "ek3d/math/MathUtils";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshPhysicalMaterial } from "ek3d/materials/MeshPhysicalMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import type { DataTexture } from "ek3d/textures/DataTexture";
import { Scene } from "ek3d/scenes/Scene";
import type { Object3D } from "ek3d/core/Object3D";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing ground-projected envmaps example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const params = {
  height: 15,
  radius: 100,
  enabled: true,
};

let camera!: PerspectiveCamera;
let scene!: Scene;
let renderer!: WebGLRenderer;
let controls!: OrbitControls<PerspectiveCamera>;

let skybox: GroundedSkybox | undefined;

// Upstream fires init().then(render) without awaiting; a rejection surfaces through the
// browser as an unhandled rejection, matching upstream behavior.
void init().then(render);

async function init(): Promise<void> {
  camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.set(-20, 7, 20);
  camera.lookAt(0, 4, 0);

  scene = new Scene();

  const hdrLoader = new HDRLoader().setPath("/examples/textures/equirectangular/");
  const envMap: DataTexture = await hdrLoader.loadAsync("blouberg_sunrise_2_1k.hdr");
  envMap.mapping = Mapping.EquirectangularReflection;

  skybox = new GroundedSkybox(envMap, params.height, params.radius);
  skybox.position.y = params.height - 0.01;
  scene.add(skybox);

  scene.environment = envMap;

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_GLTF_CONFIG);

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  const shadow = new TextureLoader().load("/examples/models/gltf/ferrari_ao.png");

  function carGltfLoad(gltf: { scene: Object3D }) {
    const carModel = gltf.scene.children[0] as Object3D;
    carModel.scale.multiplyScalar(4);
    carModel.rotation.y = Math.PI;

    const bodyMaterial = new MeshPhysicalMaterial({
      color: 0x000000,
      metalness: 1.0,
      roughness: 0.8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.2,
    });
    const detailsMaterial = new MeshStandardMaterial({ color: 0xffffff, metalness: 1.0, roughness: 0.5 });
    const glassMaterial = new MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.25,
      roughness: 0,
      transmission: 1.0,
    });

    const named = (name: string) => {
      const found = carModel.getObjectByName(name);
      if (found === undefined) throw new Error("missing ferrari part: " + name);
      return found as Object3D & { material: unknown };
    };
    named("body").material = bodyMaterial;
    named("rim_fl").material = detailsMaterial;
    named("rim_fr").material = detailsMaterial;
    named("rim_rr").material = detailsMaterial;
    named("rim_rl").material = detailsMaterial;
    named("trim").material = detailsMaterial;
    named("glass").material = glassMaterial;

    // shadow
    const mesh = new Mesh(
      new PlaneGeometry(0.655 * 4, 1.3 * 4),
      new MeshBasicMaterial({
        map: shadow,
        blending: Blending.Multiply,
        toneMapped: false,
        transparent: true,
        premultipliedAlpha: true,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    carModel.add(mesh);

    scene.add(carModel);

    render();
  }

  loader.load("/examples/models/gltf/ferrari.glb", carGltfLoad as never);

  const dfgLUT = createDFGLUT();
  const ltcTextures = createLTCTextures();

  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    createBackground: WebGLBackground,
    createEnvironments: WebGLEnvironments,
    getDFGLUT: () => dfgLUT,
    ltcTextures,
    shaders: {
      MeshStandardMaterial: standardShader,
      MeshPhysicalMaterial: physicalShader,
      MeshBasicMaterial: basicShader,
      PointsMaterial: pointsShader,
      MeshLambertMaterial: lambertShader,
      MeshPhongMaterial: phongShader,
      LineBasicMaterial: basicShader,
    },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = ToneMapping.ACESFilmic;

  controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
  controls.addEventListener("change", render);
  controls.target.set(0, 2, 0);
  controls.maxPolarAngle = degToRad(90);
  controls.maxDistance = 80;
  controls.minDistance = 20;
  controls.enablePan = false;
  controls.update();

  window.addEventListener("resize", onWindowResize);

  const gui = new GUI();

  gui
    .add(params, "enabled")
    .name("Grounded")
    .onChange(function (value) {
      if (value) {
        scene.add(skybox as never);
        scene.background = null;
      } else {
        scene.remove(skybox as never);
        scene.background = scene.environment as never;
      }

      render();
    });

  gui.open();
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  render();
}

function render(): void {
  renderer.render(scene, camera);
}
