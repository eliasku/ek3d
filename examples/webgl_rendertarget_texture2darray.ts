import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { WebGLArrayRenderTarget } from "ek3d/renderers/WebGLArrayRenderTarget";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PixelFormat } from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Vector2 } from "ek3d/math/Vector2";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { DataArrayTexture } from "ek3d/textures/DataArrayTexture";
import { Stats } from "ek3d/addons/libs/Stats";
import { loadZipRuntime } from "./zip-runtime";
const postVertexShader = `

	out vec2 vUv;

	void main()
	{
		vUv = uv;
		gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
	}

	`;
const postFragmentShader = `

	precision highp sampler2DArray;
	precision mediump float;

	in vec2 vUv;

	uniform sampler2DArray uTexture;
	uniform int uDepth;
	uniform float uIntensity;

	void main()
	{
		float voxel = texture(uTexture, vec3( vUv, uDepth )).r;
		gl_FragColor.r = voxel * uIntensity;
	}

	`;
const vertexShader = `
	uniform vec2 size;
	out vec2 vUv;

	void main() {

		gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		// Convert position.xy to 1.0-0.0

		vUv.xy = position.xy / size + 0.5;
		vUv.y = 1.0 - vUv.y; // original data is upside down

	}
	`;
const fragmentShader = `
	precision highp float;
	precision highp int;
	precision highp sampler2DArray;

	uniform sampler2DArray diffuse;
	in vec2 vUv;
	uniform int depth;

	void main() {

		vec4 color = texture( diffuse, vec3( vUv, depth ) );

		// lighten a bit
		gl_FragColor = vec4( color.rrr * 1.5, 1.0 );
	}
	`;
const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing array texture canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 2000);
camera.position.z = 70;
const scene = new Scene(),
  renderer = new WebGLRenderer({ canvas, shaders: {} });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
const renderTarget = new WebGLArrayRenderTarget(256, 256, 109);
renderTarget.texture.format = PixelFormat.Red;
const postScene = new Scene(),
  postCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postUniforms = {
  uTexture: { value: null as DataArrayTexture | null },
  uDepth: { value: 55 },
  uIntensity: { value: 1 },
};
const postMaterial = new ShaderMaterial({
  uniforms: postUniforms,
  vertexShader: postVertexShader,
  fragmentShader: postFragmentShader,
});
const postGeometry = new PlaneGeometry(2, 2);
postScene.add(new Mesh(postGeometry, postMaterial));
const gui = new GUI(),
  params = { intensity: 1 };
gui.add(params, "intensity", 0, 1, 0.01).onChange(() => {
  postUniforms.uIntensity.value = params.intensity;
});
gui.open();

let disposed = false,
  texture: DataArrayTexture | null = null,
  depthStep = 0.4;
const uniforms = {
  diffuse: { value: null as import("ek3d/textures/Texture").Texture | null },
  depth: { value: 55 },
  size: { value: new Vector2(50, 50) },
};
const material = new ShaderMaterial({ uniforms, vertexShader, fragmentShader });
const geometry = new PlaneGeometry(50, 50),
  mesh = new Mesh(geometry, material);
async function load(): Promise<void> {
  try {
    const [runtime, response] = await Promise.all([
      loadZipRuntime(),
      fetch("/examples/textures/3d/head256x256x109.zip"),
    ]);
    if (!response.ok) throw new Error(`Volume fetch failed: ${response.status}`);
    const zip = runtime.unzipSync(new Uint8Array(await response.arrayBuffer()));
    const data = zip["head256x256x109"];
    if (!data) throw new Error("Missing volume in archive");
    if (disposed) return;
    texture = new DataArrayTexture(data, 256, 256, 109);
    texture.format = PixelFormat.Red;
    texture.needsUpdate = true;
    postUniforms.uTexture.value = texture;
    uniforms.diffuse.value = renderTarget.texture;
    scene.add(mesh);
  } catch (error) {
    if (!disposed) {
      canvas.dataset.state = "error";
      console.error(error);
    }
  }
}
void load();
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  if (texture) {
    let value = uniforms.depth.value + depthStep;
    if (value > 109 || value < 0) {
      value = value > 109 ? 218 - value : -value;
      depthStep = -depthStep;
    }
    uniforms.depth.value = value;
  }
  if (texture) {
    postUniforms.uDepth.value = Math.floor(uniforms.depth.value);
    renderer.setRenderTarget(renderTarget, postUniforms.uDepth.value);
    renderer.render(postScene, postCamera);
    renderer.setRenderTarget(null);
  }
  renderer.render(scene, camera);
  stats.update();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  stats.dom.remove();
  geometry.dispose();
  material.dispose();
  texture?.dispose();
  gui.destroy();
  postGeometry.dispose();
  postMaterial.dispose();
  renderTarget.dispose();
  renderer.dispose();
});
