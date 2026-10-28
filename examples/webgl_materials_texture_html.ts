import { InteractionManager } from "ek3d/addons/interaction/InteractionManager";
import { RoundedBoxGeometry } from "ek3d/addons/geometries/RoundedBoxGeometry";
import { RoomEnvironment } from "ek3d/addons/environments/RoomEnvironment";
import { ToneMapping } from "ek3d/constants";
import { HTMLTexture } from "ek3d/textures/HTMLTexture";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { Color } from "ek3d/math/Color";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { FileLoader } from "ek3d/loaders/FileLoader";
import { Scene } from "ek3d/scenes/Scene";

/**
 * The `html-in-canvas` polyfill is vendor runtime (user decision): fetched
 * from the upstream CDN URL and imported through a Blob URL, like the page's
 * upstream importmap mapping 'three-html-render/polyfill'.
 */
const polyfillUrl = "https://cdn.jsdelivr.net/npm/three-html-render/dist/polyfill.mjs";

/** Polyfill runtime surface used by the page. */
interface PolyfillModule {
  installHtmlInCanvasPolyfill(): unknown;
  uninstallHtmlInCanvasPolyfill(): unknown;
}

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing texture html example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const info = document.getElementById("info") as HTMLElement | null;

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

let camera: PerspectiveCamera;
let scene: Scene;
let renderer: WebGLRenderer;
let mesh: Mesh;
let interactions: InteractionManager;

async function init(): Promise<void> {
  const source = (await new FileLoader().setResponseType("text").loadAsync(polyfillUrl)) as unknown as string;
  const polyfill = (await import(
    URL.createObjectURL(new Blob([source], { type: "text/javascript" }))
  )) as PolyfillModule;

  if (!("requestPaint" in HTMLCanvasElement.prototype)) {
    polyfill.installHtmlInCanvasPolyfill();
    if (info !== null) {
      info.innerHTML +=
        '<br><a href="https://github.com/WICG/html-in-canvas" target="_blank">HTML-in-Canvas API</a> not available. Using <a href="https://github.com/repalash/three-html-render" target="_blank">polyfill</a>.';
    }
  }

  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    createEnvironments: WebGLEnvironments,
    getDFGLUT: () => dfgLUT,
    ltcTextures,
    shaders: {
      MeshStandardMaterial: standardShader,
      MeshBasicMaterial: basicShader,
      PointsMaterial: pointsShader,
      MeshLambertMaterial: lambertShader,
    },
  });

  renderer.toneMapping = ToneMapping.Neutral;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 2000);
  camera.position.z = 500;

  scene = new Scene();
  scene.background = new Color(0xaaaaaa);

  const environment = new RoomEnvironment();
  const pmremGenerator = new PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(environment, 0.02).texture;
  environment.dispose();

  // HTML element

  const element = document.createElement("div");
  element.id = "draw_element";
  element.innerHTML = `
					Hello world!<br>I'm multi-line, <b>formatted</b>,
					rotated text with emoji (&#128512;), RTL text
					<span dir=rtl>من فارسی صحبت میکنم</span>,
					vertical text,
					<p style="writing-mode: vertical-rl;">
					这是垂直文本
					</p>
					an inline image (<img width="150" src="/examples/textures/758px-Canestra_di_frutta_(Caravaggio).jpg">), and
					<svg width="50" height="50">
					<circle cx="25" cy="25" r="20" fill="green" />
					<text x="25" y="30" font-size="15" text-anchor="middle" fill="#fff">
						SVG
					</text>
					</svg>!
					<br>
					<input type="text" placeholder="Type here...">
					<button>Click me</button>
				`;

  const geometry = new RoundedBoxGeometry(200, 200, 200, 10, 10);

  const material = new MeshStandardMaterial({ roughness: 0, metalness: 0.5 });
  material.map = new HTMLTexture(element);

  mesh = new Mesh(geometry, material);
  scene.add(mesh);

  // Interaction

  interactions = new InteractionManager();
  interactions.connect(renderer, camera);
  interactions.add(mesh);

  // Button click handler

  element.querySelector("button")!.addEventListener("click", function (this: HTMLButtonElement) {
    this.textContent = "Clicked!";
  });

  window.addEventListener("resize", onWindowResize);

  renderer.setAnimationLoop(animate);
}

void init();

function onWindowResize(): void {
  (camera as PerspectiveCamera).aspect = window.innerWidth / window.innerHeight;
  (camera as PerspectiveCamera).updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(time: number): void {
  mesh.rotation.x = Math.sin(time * 0.0005) * 0.5;
  mesh.rotation.y = Math.cos(time * 0.0008) * 0.5;

  interactions.update();

  renderer.render(scene, camera);

  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}
