import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { VDBLoader } from "ek3d/addons/loaders/VDBLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Side, GLSL } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { Box3 } from "ek3d/math/Box3";
import { Color } from "ek3d/math/Color";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { loadZlibDecoder } from "./fflate";

const vertexShader = `
  in vec3 position;
  uniform mat4 modelMatrix;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform vec3 cameraPos;
  out vec3 vOrigin;
  out vec3 vDirection;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
    vOrigin = vec3( inverse( modelMatrix ) * vec4( cameraPos, 1.0 ) ).xyz;
    vDirection = position - vOrigin;
    gl_Position = projectionMatrix * mvPosition;
  }
`;
const fragmentShader = `
  precision highp float;
  precision highp sampler3D;
  in vec3 vOrigin;
  in vec3 vDirection;
  out vec4 color;
  uniform vec3 base;
  uniform sampler3D map;
  uniform float threshold;
  uniform float range;
  uniform float opacity;
  uniform float steps;
  vec2 hitBox( vec3 orig, vec3 dir ) {
    vec3 invDir = 1.0 / dir;
    vec3 tminTmp = ( vec3( - 0.5 ) - orig ) * invDir;
    vec3 tmaxTmp = ( vec3( 0.5 ) - orig ) * invDir;
    vec3 tmin = min( tminTmp, tmaxTmp );
    vec3 tmax = max( tminTmp, tmaxTmp );
    return vec2( max( tmin.x, max( tmin.y, tmin.z ) ), min( tmax.x, min( tmax.y, tmax.z ) ) );
  }
  float density( vec3 p ) {
    return smoothstep( threshold - range, threshold + range, texture( map, p + 0.5 ).r );
  }
  void main() {
    vec3 rayDir = normalize( vDirection );
    vec2 bounds = hitBox( vOrigin, rayDir );
    if ( bounds.x > bounds.y ) discard;
    bounds.x = max( bounds.x, 0.0 );
    float stepSize = ( bounds.y - bounds.x ) / steps;
    float jitter = fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
    vec3 p = vOrigin + ( bounds.x + jitter * stepSize ) * rayDir;
    vec4 ac = vec4( 0.0 );
    for ( float i = 0.0; i < steps; i += 1.0 ) {
      float d = density( p ) * opacity;
      ac.rgb += ( 1.0 - ac.a ) * d * base;
      ac.a += ( 1.0 - ac.a ) * d;
      if ( ac.a >= 0.95 ) break;
      p += rayDir * stepSize;
    }
    color = ac;
    if ( color.a == 0.0 ) discard;
  }
`;

const selected = document.querySelector<HTMLCanvasElement>("#scene");
const info = document.querySelector<HTMLElement>("#info");
if (!selected || !info) throw new Error("Missing VDB example elements");
const canvas: HTMLCanvasElement = selected;
const infoElement: HTMLElement = info;
const renderer = new WebGLRenderer({ canvas, createBackground: WebGLBackground, shaders: {} });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new Scene();
scene.background = new Color(0x2b3a4a);
const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
const controls = new OrbitControls(camera, canvas);
controls.autoRotate = true;
const manager = new LoadingManager();
const gui = new GUI();
const parameters = { threshold: 0.1, range: 0.1, opacity: 0.03, steps: 100 };
const uniforms = {
  base: { value: new Color(0xf0e0d0) },
  map: { value: null },
  cameraPos: { value: new Vector3() },
  threshold: { value: parameters.threshold },
  range: { value: parameters.range },
  opacity: { value: parameters.opacity },
  steps: { value: parameters.steps },
};
function update(): void {
  uniforms.threshold.value = parameters.threshold;
  uniforms.range.value = parameters.range;
  uniforms.opacity.value = parameters.opacity;
  uniforms.steps.value = parameters.steps;
}
gui.add(parameters, "threshold", 0, 1, 0.01).onChange(update);
gui.add(parameters, "range", 0, 1, 0.01).onChange(update);
gui.add(parameters, "opacity", 0, 1, 0.01).onChange(update);
gui.add(parameters, "steps", 0, 400, 1).onChange(update);
let mesh: Mesh<RawShaderMaterial> | null = null;
let disposed = false;
let loaded = false;
let frames = 0;
canvas.dataset.state = "loading";

async function load(): Promise<void> {
  try {
    const runtime = await loadZlibDecoder();
    if (disposed) return;
    const grids = await new VDBLoader(manager, runtime)
      .setGridNames(["density"])
      .loadAsync("/examples/models/vdb/smoke.vdb");
    if (disposed) {
      for (const grid of grids) grid.texture?.dispose();
      return;
    }
    const grid = grids[0];
    if (!grid?.texture) {
      for (const item of grids) item.texture?.dispose();
      throw new Error("Smoke VDB has no populated density grid");
    }
    for (const item of grids.slice(1)) item.texture?.dispose();
    const center = grid.bbox.getCenter(new Vector3());
    const size = grid.bbox.getSize(new Vector3()).addScalar(1);
    const material = new RawShaderMaterial({
      glslVersion: GLSL.GLSL3,
      uniforms: { ...uniforms, map: { value: grid.texture } },
      vertexShader,
      fragmentShader,
      side: Side.Back,
      transparent: true,
      premultipliedAlpha: true,
    });
    mesh = new Mesh(new BoxGeometry(1, 1, 1), material);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(grid.transform).multiply(new Matrix4().makeTranslation(center.x, center.y, center.z).scale(size));
    mesh.updateMatrixWorld(true);
    scene.add(mesh);
    const box = new Box3().setFromObject(mesh);
    const radius = box.getSize(new Vector3()).length() / 2;
    box.getCenter(controls.target);
    camera.position.copy(controls.target).add(new Vector3(0, 0, radius * 2));
    update();
    const image = grid.texture.image;
    infoElement.textContent = `smoke - ${grid.name} - ${image.width}x${image.height}x${image.depth}`;
    loaded = true;
  } catch (error) {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    infoElement.textContent = `Unable to load smoke: ${canvas.dataset.error}`;
    console.error(error);
  }
}
void load();
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  controls.update();
  uniforms.cameraPos.value.copy(camera.position);
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (loaded) canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  manager.abort();
  controls.dispose();
  gui.destroy();
  if (mesh) {
    mesh.geometry.dispose();
    mesh.material.uniforms.map.value.dispose();
    mesh.material.dispose();
  }
  renderer.dispose();
});
