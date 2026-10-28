import { UnrealBloomPass } from "ek3d/addons/postprocessing/UnrealBloomPass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { ShaderPass } from "ek3d/addons/postprocessing/ShaderPass";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { RoomEnvironment } from "ek3d/addons/environments/RoomEnvironment";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Layers } from "ek3d/core/Layers";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { Raycaster } from "ek3d/core/Raycaster";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { TextureType, ToneMapping } from "ek3d/constants";
import type { Material } from "ek3d/materials/Material";
import type { Object3D } from "ek3d/core/Object3D";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing selective bloom example canvas");
const canvas: HTMLCanvasElement = canvasSel;

let camera!: PerspectiveCamera;
let scene!: Scene;
let renderer!: WebGLRenderer;
let controls!: OrbitControls<PerspectiveCamera>;
let renderPass!: RenderPass;
let composer!: EffectComposer;
let bloomComposer!: EffectComposer;
let finalComposer!: EffectComposer;
let bloomPass!: UnrealBloomPass;
let mixPass!: ShaderPass;

const BLOOM_SCENE = 1;

const raycaster = new Raycaster();
const mouse = new Vector2();

const vertexShaderSource = `
varying vec2 vUv;

void main() {

	vUv = uv;

	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}`;

const fragmentShaderSource = `
uniform sampler2D baseTexture;
uniform sampler2D bloomTexture;
uniform float bloomStrength;

varying vec2 vUv;

void main() {

	gl_FragColor = ( texture2D( baseTexture, vUv ) + texture2D( bloomTexture, vUv ) * bloomStrength );

}`;

const bloomLayer = new Layers();
bloomLayer.set(BLOOM_SCENE);

const params = {
  threshold: 0,
  strength: 1,
  radius: 0.5,
  exposure: 1,
};

const darkMaterial = new MeshBasicMaterial({ color: 0x000000 });
const materials: Record<string, Material> = {};

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

let needsUpdate = false;

init();

function init(): void {
  camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 200);
  camera.position.set(0, 0, 20);
  camera.lookAt(0, 0, 0);

  scene = new Scene();

  renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    preserveDrawingBuffer: true,
    createEnvironments: WebGLEnvironments,
    getDFGLUT: () => dfgLUT,
    ltcTextures,
    shaders: {
      MeshStandardMaterial: standardShader,
      MeshBasicMaterial: basicShader,
      MeshLambertMaterial: lambertShader,
    },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = ToneMapping.Neutral;

  const pmremGenerator = new PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

  controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
  controls.maxPolarAngle = Math.PI * 0.5;
  controls.minDistance = 1;
  controls.maxDistance = 100;
  controls.addEventListener("change", () => (needsUpdate = true));

  renderPass = new RenderPass(scene, camera);

  bloomPass = new UnrealBloomPass(new Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  bloomPass.threshold = params.threshold;
  bloomPass.strength = params.strength;
  bloomPass.radius = params.radius;

  const bloomRenderTarget = new WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: TextureType.HalfFloat,
  });
  bloomComposer = new EffectComposer(renderer, bloomRenderTarget);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(renderPass);
  bloomComposer.addPass(bloomPass);

  mixPass = new ShaderPass(
    new ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture },
        bloomStrength: { value: params.strength },
      },
      vertexShader: vertexShaderSource,
      fragmentShader: fragmentShaderSource,
      defines: {},
    }),
    "baseTexture",
  );
  mixPass.needsSwap = true;

  const outputPass = new OutputPass();

  const finalRenderTarget = new WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: TextureType.HalfFloat,
    samples: 4,
  });
  finalComposer = new EffectComposer(renderer, finalRenderTarget);
  finalComposer.addPass(renderPass);
  finalComposer.addPass(mixPass);
  finalComposer.addPass(outputPass);

  window.addEventListener("pointerdown", onPointerDown);

  window.onresize = function (): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);

    bloomComposer.setSize(width, height);
    finalComposer.setSize(width, height);

    render();
  };

  window.addEventListener(
    "pagehide",
    () => {
      window.removeEventListener("pointerdown", onPointerDown);
      controls.dispose();
      composer?.dispose();
      bloomComposer.dispose();
      finalComposer.dispose();
      renderer.dispose();
    },
    { once: true },
  );

  composer = new EffectComposer(renderer);
  composer.addPass(renderPass);

  const gui = new GUI();

  const bloomFolder = gui.addFolder("bloom");

  bloomFolder.add(params, "threshold", 0.0, 1.0).onChange(function (value) {
    bloomPass.threshold = value as number;
    render();
  });

  bloomFolder.add(params, "strength", 0.0, 3).onChange(function (value) {
    bloomPass.strength = value as number;
    (mixPass.material as ShaderMaterial).uniforms!["bloomStrength"].value = bloomPass.strength;

    render();
  });

  bloomFolder
    .add(params, "radius", 0.0, 1.0)
    .step(0.01)
    .onChange(function (value) {
      bloomPass.radius = value as number;
      render();
    });

  const toneMappingFolder = gui.addFolder("tone mapping");

  toneMappingFolder.add(params, "exposure", 0.1, 2).onChange(function (value) {
    renderer.toneMappingExposure = Math.pow(value as number, 4.0);
    render();
  });

  setupScene();

  // Continuous orbit updates render without a fixed loop (upstream renders on control change).
  renderer.setAnimationLoop(function () {
    if (needsUpdate) {
      needsUpdate = false;
    }
    controls.update();
    render();
  });
}

function onPointerDown(event: PointerEvent): void {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, false);
  if (intersects.length > 0) {
    const object = intersects[0].object;
    object.layers.toggle(BLOOM_SCENE);
    render();
  }
}

function setupScene(): void {
  scene.traverse(disposeMaterial);
  scene.children.length = 0;

  const geometry = new IcosahedronGeometry(1, 15);

  for (let i = 0; i < 50; i++) {
    const color = new Color();
    color.setHSL(Math.random(), 0.7, Math.random() * 0.2 + 0.05);

    const sphere = new Mesh(geometry, new MeshStandardMaterial({ color: color, roughness: 1, metalness: 1 }));
    sphere.position.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
    sphere.position.normalize().multiplyScalar(Math.random() * 4.0 + 2.0);
    sphere.scale.setScalar(Math.random() * Math.random() + 0.5);
    scene.add(sphere);

    if (Math.random() < 0.25) sphere.layers.enable(BLOOM_SCENE);
  }

  render();
}

function disposeMaterial(obj: Object3D): void {
  const mesh = obj as Mesh;
  if (mesh.material) {
    (mesh.material as unknown as { dispose: () => void }).dispose();
  }
}

function render(): void {
  scene.traverse(darkenNonBloomed);
  bloomComposer.render();
  scene.traverse(restoreMaterial);

  // render the entire scene, then render bloom scene on top
  finalComposer.render();

  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}

function darkenNonBloomed(obj: Object3D): void {
  const mesh = obj as Mesh;
  if (mesh.isMesh === true && bloomLayer.test(mesh.layers) === false) {
    materials[obj.uuid] = mesh.material as Material;
    mesh.material = darkMaterial;
  }
}

function restoreMaterial(obj: Object3D): void {
  if (materials[obj.uuid]) {
    (obj as Mesh).material = materials[obj.uuid];
    delete materials[obj.uuid];
  }
}
