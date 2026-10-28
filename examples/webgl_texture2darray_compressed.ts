import { KTX2Loader } from "ek3d/addons/loaders/KTX2Loader";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { GLSL } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Vector2 } from "ek3d/math/Vector2";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import type { Texture } from "ek3d/textures/Texture";
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
		outColor = vec4( color.rgb + .2, 1.0 );

	}
	`;
const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing compressed texture canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 2000);
camera.position.z = 70;
const scene = new Scene(),
  renderer = new WebGLRenderer({ canvas, shaders: {} });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const loader = new KTX2Loader().setTranscoderPath("/libs/basis/").detectSupport(renderer),
  timer = new Timer(),
  stats = new Stats();
timer.connect(document);
document.body.appendChild(stats.dom);
let disposed = false,
  texture: Texture | null = null,
  depth = 1;
const uniforms = {
  diffuse: { value: null as Texture | null },
  depth: { value: 55 },
  size: { value: new Vector2(50, 25) },
};
const material = new ShaderMaterial({ uniforms, vertexShader, fragmentShader, glslVersion: GLSL.GLSL3 });
const geometry = new PlaneGeometry(50, 25),
  mesh = new Mesh(geometry, material);
loader.load(
  "/examples/textures/spiritedaway.ktx2",
  (value) => {
    if (disposed) {
      value.dispose();
      return;
    }
    texture = value;
    uniforms.diffuse.value = value;
    scene.add(mesh);
  },
  undefined,
  (error) => {
    if (!disposed) {
      canvas.dataset.state = "error";
      console.error(error);
    }
  },
);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  timer.update();
  if (texture) {
    depth += timer.getDelta() * 10;
    uniforms.depth.value = depth % 5;
  }
  renderer.render(scene, camera);
  stats.update();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  timer.disconnect();
  stats.dom.remove();
  loader.dispose();
  texture?.dispose();
  geometry.dispose();
  material.dispose();
  renderer.dispose();
});
