import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { HemisphereLightHelper } from "ek3d/helpers/HemisphereLightHelper";
import { DirectionalLightHelper } from "ek3d/helpers/DirectionalLightHelper";
import { BackSide } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { Color } from "ek3d/math/Color";
import { Fog } from "ek3d/scenes/Fog";
import { Mesh } from "ek3d/objects/Mesh";
import { Timer } from "ek3d/core/Timer";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing hemisphere lights example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const timer = new Timer();
timer.connect(document);

const camera = new PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 5000);
camera.position.set(0, 0, 250);

const scene = new Scene();
const backgroundColor = new Color().setHSL(0.6, 0, 1);
scene.background = backgroundColor;
scene.fog = new Fog(backgroundColor, 1, 5000);

// LIGHTS

const hemiLight = new HemisphereLight(0xffffff, 0xffffff, 2);
hemiLight.color.setHSL(0.6, 1, 0.6);
hemiLight.groundColor.setHSL(0.095, 1, 0.75);
hemiLight.position.set(0, 50, 0);
scene.add(hemiLight);

const hemiLightHelper = new HemisphereLightHelper(hemiLight, 10);
scene.add(hemiLightHelper);

const dirLight = new DirectionalLight(0xffffff, 3);
dirLight.color.setHSL(0.1, 1, 0.95);
dirLight.position.set(-1, 1.75, 1);
dirLight.position.multiplyScalar(30);
scene.add(dirLight);

dirLight.castShadow = true;

dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;

const d = 50;

dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;

dirLight.shadow.camera.far = 3500;
dirLight.shadow.bias = -0.0001;

const dirLightHelper = new DirectionalLightHelper(dirLight, 10);
scene.add(dirLightHelper);

// GROUND

const groundGeo = new PlaneGeometry(10000, 10000);
const groundMat = new MeshLambertMaterial({ color: 0xffffff });
groundMat.color.setHSL(0.095, 1, 0.75);

const ground = new Mesh(groundGeo, groundMat);
ground.position.y = -33;
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// SKYDOME

const vertexShader = `
	varying vec3 vWorldPosition;

	void main() {

		vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
		vWorldPosition = worldPosition.xyz;

		gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

	}`;

const fragmentShader = `
	uniform vec3 topColor;
	uniform vec3 bottomColor;
	uniform float offset;
	uniform float exponent;

	varying vec3 vWorldPosition;

	void main() {

		float h = normalize( vWorldPosition + offset ).y;
		gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h , 0.0), exponent ), 0.0 ) ), 1.0 );

	}`;

const uniforms: Record<string, { value: unknown }> = {
  topColor: { value: new Color(0x0077ff) },
  bottomColor: { value: new Color(0xffffff) },
  offset: { value: 33 },
  exponent: { value: 0.6 },
};
uniforms["topColor"]!.value = (uniforms["topColor"]!.value as Color).copy(hemiLight.color);

scene.fog.color.copy(uniforms["bottomColor"]!.value as Color);

const skyGeo = new SphereGeometry(4000, 32, 15);
const skyMat = new ShaderMaterial({
  uniforms: uniforms,
  vertexShader: vertexShader,
  fragmentShader: fragmentShader,
  side: BackSide,
});

const sky = new Mesh(skyGeo, skyMat);
scene.add(sky);

// MODEL

const mixers: AnimationMixer[] = [];

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createShadowMap: WebGLShadowMap,
  getDFGLUT: () => dfgLUT,
  ltcTextures,
  shaders: {
    MeshLambertMaterial: lambertShader,
    MeshDepthMaterial: depthShader,
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
    MeshStandardMaterial: standardShader,
  },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const shadowMap = renderer.shadowMap;
if (shadowMap === null) throw new Error("the shadow map system failed to install");
shadowMap.enabled = true;

const stats = new Stats();
document.body.appendChild(stats.dom);

const params = {
  toggleHemisphereLight: function () {
    hemiLight.visible = !hemiLight.visible;
    hemiLightHelper.visible = !hemiLightHelper.visible;
  },
  toggleDirectionalLight: function () {
    dirLight.visible = !dirLight.visible;
    dirLightHelper.visible = !dirLightHelper.visible;
  },
  shadowIntensity: 1,
};

const gui = new GUI();

gui.add(params, "toggleHemisphereLight").name("toggle hemisphere light");
gui.add(params, "toggleDirectionalLight").name("toggle directional light");
gui
  .add(params, "shadowIntensity", 0, 1)
  .name("shadow intensity")
  .onChange((value) => {
    dirLight.shadow.intensity = value as number;
  });
gui.open();

new GLTFLoader().load("/examples/models/gltf/Flamingo.glb", function (gltf) {
  const mesh = gltf.scene.children[0] as Mesh;

  const s = 0.35;
  mesh.scale.set(s, s, s);
  mesh.position.y = 15;
  mesh.rotation.y = -1;

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  scene.add(mesh);

  const mixer = new AnimationMixer(mesh);
  mixer.clipAction(gltf.animations[0]).setDuration(1).play();
  mixers.push(mixer);

  render();
});

function publishState(): void {
  frames++;
  canvas.dataset.frames = String(frames);
}

function animate(): void {
  timer.update();

  const delta = timer.getDelta();

  for (let i = 0; i < mixers.length; i++) {
    mixers[i].update(delta);
  }

  render();
  publishState();

  stats.update();
}

function render(): void {
  renderer.render(scene, camera);

  canvas.dataset.state = "rendered";
  canvas.dataset.hemi = String(hemiLight.visible);
  canvas.dataset.dir = String(dirLight.visible);
}

let frames = 0;

renderer.setAnimationLoop(animate);
publishState();

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    timer.disconnect();
    gui.destroy();
    stats.dom.remove();
    renderer.setAnimationLoop(null);
    for (const mixer of mixers) mixer.stopAllAction();
    groundGeo.dispose();
    skyGeo.dispose();
    groundMat.dispose();
    renderer.dispose();
  },
  { once: true },
);
