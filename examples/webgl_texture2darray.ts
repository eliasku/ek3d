import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { GLSL3, RedFormat } from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Vector2 } from "ek3d/math/Vector2";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { DataArrayTexture } from "ek3d/textures/DataArrayTexture";
import { Stats } from "ek3d/addons/libs/Stats";
import { loadZipRuntime } from "./zip-runtime";
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

	out vec4 outColor;

	void main() {

		vec4 color = texture( diffuse, vec3( vUv, depth ) );

		// lighten a bit
		outColor = vec4( color.rrr * 1.5, 1.0 );

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

let disposed = false,
  texture: DataArrayTexture | null = null,
  depthStep = 0.4;
const uniforms = {
  diffuse: { value: null as import("ek3d/textures/Texture").Texture | null },
  depth: { value: 55 },
  size: { value: new Vector2(50, 50) },
};
const material = new ShaderMaterial({ uniforms, vertexShader, fragmentShader, glslVersion: GLSL3 });
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
    texture.format = RedFormat;
    texture.needsUpdate = true;
    uniforms.diffuse.value = texture;
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
  renderer.dispose();
});
