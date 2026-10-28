import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { HorizontalBlurShader } from "ek3d/addons/shaders/HorizontalBlurShader";
import { VerticalBlurShader } from "ek3d/addons/shaders/VerticalBlurShader";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { CameraHelper } from "ek3d/helpers/CameraHelper";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshDepthMaterial } from "ek3d/materials/MeshDepthMaterial";
import { MeshNormalMaterial } from "ek3d/materials/MeshNormalMaterial";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Color } from "ek3d/math/Color";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvasSel) throw new Error("Missing contact shadow canvas");
const canvas: HTMLCanvasElement = canvasSel;
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  shaders: {
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
    MeshDepthMaterial: depthShader,
    MeshNormalMaterial: normalShader,
  },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0.5, 1, 2);
const scene = new Scene();
scene.background = new Color(0xffffff);
const controls = new OrbitControls(camera, canvas);
const stats = new Stats();
document.body.appendChild(stats.dom);
const state = {
  shadow: { blur: 3.5, darkness: 1, opacity: 1 },
  plane: { color: "#ffffff", opacity: 1 },
  showWireframe: false,
};
const geometries = [
  new BoxGeometry(0.4, 0.4, 0.4),
  new IcosahedronGeometry(0.3),
  new TorusKnotGeometry(0.4, 0.05, 256, 24, 1, 3),
];
const normalMaterial = new MeshNormalMaterial();
const meshes = geometries.map((geometry, i) => {
  const mesh = new Mesh(geometry, normalMaterial);
  const angle = (i / geometries.length) * Math.PI * 2;
  mesh.position.set(Math.cos(angle) / 2, 0.1, Math.sin(angle) / 2);
  scene.add(mesh);
  return mesh;
});
const shadowGroup = new Group();
shadowGroup.position.y = -0.3;
scene.add(shadowGroup);
const renderTarget = new WebGLRenderTarget(512, 512);
const renderTargetBlur = new WebGLRenderTarget(512, 512);
renderTarget.texture.generateMipmaps = false;
renderTargetBlur.texture.generateMipmaps = false;
const planeGeometry = new PlaneGeometry(2.5, 2.5).rotateX(Math.PI / 2);
const planeMaterial = new MeshBasicMaterial({
  map: renderTarget.texture,
  opacity: state.shadow.opacity,
  transparent: true,
  depthWrite: false,
});
const plane = new Mesh(planeGeometry, planeMaterial);
plane.renderOrder = 1;
plane.scale.y = -1;
shadowGroup.add(plane);
const horizontalBlurMaterial = new ShaderMaterial(HorizontalBlurShader);
horizontalBlurMaterial.depthTest = false;
const verticalBlurMaterial = new ShaderMaterial(VerticalBlurShader);
verticalBlurMaterial.depthTest = false;
const blurPlane = new Mesh(planeGeometry, horizontalBlurMaterial);
blurPlane.visible = false;
shadowGroup.add(blurPlane);
const fillPlaneMaterial = new MeshBasicMaterial({
  color: state.plane.color,
  opacity: state.plane.opacity,
  transparent: true,
  depthWrite: false,
});
const fillPlane = new Mesh(planeGeometry, fillPlaneMaterial);
fillPlane.rotateX(Math.PI);
shadowGroup.add(fillPlane);
const shadowCamera = new OrthographicCamera(-1.25, 1.25, 1.25, -1.25, 0, 0.3);
shadowCamera.rotation.x = Math.PI / 2;
shadowGroup.add(shadowCamera);
const cameraHelper = new CameraHelper(shadowCamera);
const depthMaterial = new MeshDepthMaterial();
const darkness = { value: state.shadow.darkness };
depthMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.darkness = darkness;
  shader.fragmentShader = `uniform float darkness;\n${shader.fragmentShader.replace("gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );", "gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );")}`;
};
depthMaterial.depthTest = false;
depthMaterial.depthWrite = false;
const gui = new GUI();
const shadowFolder = gui.addFolder("shadow");
shadowFolder.open();
const planeFolder = gui.addFolder("plane");
planeFolder.open();
shadowFolder.add(state.shadow, "blur", 0, 15, 0.1);
shadowFolder.add(state.shadow, "darkness", 1, 5, 0.1).onChange(() => {
  darkness.value = state.shadow.darkness;
});
shadowFolder.add(state.shadow, "opacity", 0, 1, 0.01).onChange(() => {
  planeMaterial.opacity = state.shadow.opacity;
});
planeFolder.addColor(state.plane, "color").onChange(() => {
  fillPlaneMaterial.color.set(state.plane.color);
});
planeFolder.add(state.plane, "opacity", 0, 1, 0.01).onChange(() => {
  fillPlaneMaterial.opacity = state.plane.opacity;
});
gui.add(state, "showWireframe").onChange(() => {
  if (state.showWireframe) scene.add(cameraHelper);
  else scene.remove(cameraHelper);
});
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
function blurShadow(amount: number): void {
  blurPlane.visible = true;
  blurPlane.material = horizontalBlurMaterial;
  horizontalBlurMaterial.uniforms.tDiffuse.value = renderTarget.texture;
  horizontalBlurMaterial.uniforms.h.value = amount / 256;
  renderer.setRenderTarget(renderTargetBlur);
  renderer.render(blurPlane, shadowCamera);
  blurPlane.material = verticalBlurMaterial;
  verticalBlurMaterial.uniforms.tDiffuse.value = renderTargetBlur.texture;
  verticalBlurMaterial.uniforms.v.value = amount / 256;
  renderer.setRenderTarget(renderTarget);
  renderer.render(blurPlane, shadowCamera);
  blurPlane.visible = false;
}
renderer.setAnimationLoop(() => {
  for (const mesh of meshes) {
    mesh.rotation.x += 0.01;
    mesh.rotation.y += 0.02;
  }
  const background = scene.background;
  scene.background = null;
  cameraHelper.visible = false;
  scene.overrideMaterial = depthMaterial;
  const clearAlpha = renderer.getClearAlpha();
  renderer.setClearAlpha(0);
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, shadowCamera);
  scene.overrideMaterial = null;
  cameraHelper.visible = true;
  blurShadow(state.shadow.blur);
  blurShadow(state.shadow.blur * 0.4);
  renderer.setRenderTarget(null);
  renderer.setClearAlpha(clearAlpha);
  scene.background = background;
  renderer.render(scene, camera);
  stats.update();
});
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  scene.remove(cameraHelper);
  planeMaterial.map = null;
  cameraHelper.dispose();
  disposeObject(scene, [depthMaterial, horizontalBlurMaterial, verticalBlurMaterial]);
  renderTarget.dispose();
  renderTargetBlur.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
