import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { KTX2Loader } from "ek3d/addons/loaders/KTX2Loader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { GLSL, TextureType } from "ek3d/constants";
import { InstancedBufferAttribute } from "ek3d/core/InstancedBufferAttribute";
import { InstancedBufferGeometry } from "ek3d/core/InstancedBufferGeometry";
import { getByteLength } from "ek3d/extras/TextureUtils";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Vector2 } from "ek3d/math/Vector2";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { CompressedArrayTexture } from "ek3d/textures/CompressedArrayTexture";
const vertexShader = `
	uniform vec2 size;
	attribute uint instancedIndex;
	flat out uint diffuseIndex;
	out vec2 vUv;

	void main() {

		vec3 translation = vec3(0, float(instancedIndex) * size.y - size.y, 0);
		gl_Position = projectionMatrix * modelViewMatrix * vec4( position + translation, 1.0 );

		diffuseIndex = instancedIndex;

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
	flat in uint diffuseIndex;

	out vec4 outColor;

	void main() {

		outColor = texture( diffuse, vec3( vUv, diffuseIndex ) );

	}
	`;
const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing texture layer canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 2000);
camera.position.z = 70;
const scene = new Scene(),
  renderer = new WebGLRenderer({ canvas, antialias: true, shaders: {} });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const loader = new KTX2Loader().setTranscoderPath("/libs/basis/").detectSupport(renderer),
  gui = new GUI();
let disposed = false,
  source: CompressedArrayTexture | null = null,
  target: CompressedArrayTexture | null = null;
let geometry: InstancedBufferGeometry | null = null,
  material: ShaderMaterial | null = null;
function render(): void {
  renderer.render(scene, camera);
}
async function init(): Promise<void> {
  try {
    const loaded = await loader.loadAsync("/examples/textures/spiritedaway.ktx2");
    if (disposed) {
      loaded.dispose();
      return;
    }
    if (!(loaded instanceof CompressedArrayTexture)) {
      loaded.dispose();
      throw new Error("Expected compressed texture array");
    }
    source = loaded;
    const { width, height, depth } = loaded.image;
    const layerBytes = getByteLength(width, height, loaded.format, loaded.type);
    const original = loaded.mipmaps[0];
    if (!original) throw new Error("Missing base mipmap");
    const sourceBytes = new Uint8Array(original.data.buffer, original.data.byteOffset, original.data.byteLength);
    const data = new Uint8Array(layerBytes * 3);
    data.set(sourceBytes.subarray(0, data.length));
    target = new CompressedArrayTexture([{ data, width, height }], width, height, 3, loaded.format, loaded.type);
    target.needsUpdate = true;
    const texture = target;
    const params = {
      srcLayer: 0,
      destLayer: 0,
      transfer(): void {
        data.set(
          sourceBytes.subarray(params.srcLayer * layerBytes, (params.srcLayer + 1) * layerBytes),
          params.destLayer * layerBytes,
        );
        texture.addLayerUpdate(params.destLayer);
        texture.needsUpdate = true;
        render();
      },
    };
    gui.add(params, "srcLayer", 0, depth - 1, 1);
    gui.add(params, "destLayer", 0, 2, 1);
    gui.add(params, "transfer");
    material = new ShaderMaterial({
      uniforms: { diffuse: { value: target }, size: { value: new Vector2(20, 10) } },
      vertexShader,
      fragmentShader,
      glslVersion: GLSL.GLSL3,
    });
    geometry = new InstancedBufferGeometry();
    const plane = new PlaneGeometry(20, 10);
    if (plane.index) geometry.setIndex(plane.index);
    for (const [name, attribute] of Object.entries(plane.attributes)) geometry.setAttribute(name, attribute);
    plane.dispose();
    geometry.instanceCount = 3;
    const indices = new InstancedBufferAttribute(new Uint16Array([0, 1, 2]), 1, false, 1);
    indices.gpuType = TextureType.Int;
    geometry.setAttribute("instancedIndex", indices);
    scene.add(new InstancedMesh(geometry, material, 3));
    render();
  } catch (error) {
    if (!disposed) {
      canvas.dataset.state = "error";
      console.error(error);
    }
  }
}
void init();
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  render();
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  gui.destroy();
  loader.dispose();
  source?.dispose();
  target?.dispose();
  geometry?.dispose();
  material?.dispose();
  renderer.dispose();
});
