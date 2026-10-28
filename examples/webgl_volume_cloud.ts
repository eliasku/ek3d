import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { ImprovedNoise } from "ek3d/addons/math/ImprovedNoise";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Side, GLSL, TextureFilter, PixelFormat, ColorSpace } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import { Data3DTexture } from "ek3d/textures/Data3DTexture";
import { disposeObject } from "./dispose-object";
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

					uniform mat4 modelViewMatrix;
					uniform mat4 projectionMatrix;

					in vec3 vOrigin;
					in vec3 vDirection;

					out vec4 color;

					uniform vec3 base;
					uniform sampler3D map;

					uniform float threshold;
					uniform float range;
					uniform float opacity;
					uniform float steps;
					uniform float frame;

					uint wang_hash(uint seed)
					{
							seed = (seed ^ 61u) ^ (seed >> 16u);
							seed *= 9u;
							seed = seed ^ (seed >> 4u);
							seed *= 0x27d4eb2du;
							seed = seed ^ (seed >> 15u);
							return seed;
					}

					float randomFloat(inout uint seed)
					{
							return float(wang_hash(seed)) / 4294967296.;
					}

					vec2 hitBox( vec3 orig, vec3 dir ) {
						const vec3 box_min = vec3( - 0.5 );
						const vec3 box_max = vec3( 0.5 );
						vec3 inv_dir = 1.0 / dir;
						vec3 tmin_tmp = ( box_min - orig ) * inv_dir;
						vec3 tmax_tmp = ( box_max - orig ) * inv_dir;
						vec3 tmin = min( tmin_tmp, tmax_tmp );
						vec3 tmax = max( tmin_tmp, tmax_tmp );
						float t0 = max( tmin.x, max( tmin.y, tmin.z ) );
						float t1 = min( tmax.x, min( tmax.y, tmax.z ) );
						return vec2( t0, t1 );
					}

					float sample1( vec3 p ) {
						return texture( map, p ).r;
					}

					float shading( vec3 coord ) {
						float step = 0.01;
						return sample1( coord + vec3( - step ) ) - sample1( coord + vec3( step ) );
					}

					vec4 linearToSRGB( in vec4 value ) {
						return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
					}

					void main(){
						vec3 rayDir = normalize( vDirection );
						vec2 bounds = hitBox( vOrigin, rayDir );

						if ( bounds.x > bounds.y ) discard;

						bounds.x = max( bounds.x, 0.0 );

						float stepSize = ( bounds.y - bounds.x ) / steps;

						// Jitter

						// Nice little seed from
						// https://blog.demofox.org/2020/05/25/casual-shadertoy-path-tracing-1-basic-camera-diffuse-emissive/
						uint seed = uint( gl_FragCoord.x ) * uint( 1973 ) + uint( gl_FragCoord.y ) * uint( 9277 ) + uint( frame ) * uint( 26699 );
						vec3 size = vec3( textureSize( map, 0 ) );
						float randNum = randomFloat( seed ) * 2.0 - 1.0;
						vec3 p = vOrigin + bounds.x * rayDir;
						p += rayDir * randNum * ( 1.0 / size );

						//

						vec4 ac = vec4( base, 0.0 );

						for ( float i = 0.0; i < steps; i += 1.0 ) {

							float t = bounds.x + i * stepSize;

							float d = sample1( p + 0.5 );

							d = smoothstep( threshold - range, threshold + range, d ) * opacity;

							float col = shading( p + 0.5 ) * 3.0 + ( ( p.x + p.y ) * 0.25 ) + 0.2;

							ac.rgb += ( 1.0 - ac.a ) * d * col;

							ac.a += ( 1.0 - ac.a ) * d;

							if ( ac.a >= 0.95 ) break;

							p += rayDir * stepSize;

						}

						color = linearToSRGB( ac );

						if ( color.a == 0.0 ) discard;

					}
				`;
const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing volume canvas");
const canvas: HTMLCanvasElement = selected;
const renderer = new WebGLRenderer({ canvas, shaders: { MeshBasicMaterial: basicShader } });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const scene = new Scene();
const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 1.5);
const controls = new OrbitControls(camera, canvas);
const skyCanvas = document.createElement("canvas");
skyCanvas.width = 1;
skyCanvas.height = 32;
const context = skyCanvas.getContext("2d");
if (!context) throw new Error("Missing 2D context");
const gradient = context.createLinearGradient(0, 0, 0, 32);
gradient.addColorStop(0, "#014a84");
gradient.addColorStop(0.5, "#0561a0");
gradient.addColorStop(1, "#437ab6");
context.fillStyle = gradient;
context.fillRect(0, 0, 1, 32);
const skyMap = new CanvasTexture(skyCanvas);
skyMap.colorSpace = ColorSpace.SRGB;
scene.add(new Mesh(new SphereGeometry(10), new MeshBasicMaterial({ map: skyMap, side: Side.Back })));

const size = 128,
  data = new Uint8Array(size * size * size),
  noise = new ImprovedNoise(),
  vector = new Vector3();
let i = 0;
for (let z = 0; z < size; z++)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d =
        1 -
        vector
          .set(x, y, z)
          .subScalar(size / 2)
          .divideScalar(size)
          .length();
      data[i++] = (128 + 128 * noise.noise((x * 0.05) / 1.5, y * 0.05, (z * 0.05) / 1.5)) * d * d;
    }
const texture = new Data3DTexture(data, size, size, size);
texture.format = PixelFormat.Red;
texture.minFilter = TextureFilter.Linear;
texture.magFilter = TextureFilter.Linear;
texture.unpackAlignment = 1;
texture.needsUpdate = true;
const uniforms = {
  base: { value: new Color(0x798aa0) },
  map: { value: texture },
  cameraPos: { value: new Vector3() },
  threshold: { value: 0.25 },
  opacity: { value: 0.25 },
  range: { value: 0.1 },
  steps: { value: 100 },
  frame: { value: 0 },
};
const material = new RawShaderMaterial({
  glslVersion: GLSL.GLSL3,
  uniforms,
  vertexShader,
  fragmentShader,
  side: Side.Back,
  transparent: true,
});
const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);
scene.add(mesh);
const gui = new GUI();
const params = { threshold: 0.25, opacity: 0.25, range: 0.1, steps: 100 };
const update = (): void => {
  uniforms.threshold.value = params.threshold;
  uniforms.opacity.value = params.opacity;
  uniforms.range.value = params.range;
  uniforms.steps.value = params.steps;
};
gui.add(params, "threshold", 0, 1, 0.01).onChange(update);
gui.add(params, "opacity", 0, 1, 0.01).onChange(update);
gui.add(params, "range", 0, 1, 0.01).onChange(update);
gui.add(params, "steps", 0, 200, 1).onChange(update);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  uniforms.cameraPos.value.copy(camera.position);
  mesh.rotation.y = -performance.now() / 7500;
  uniforms.frame.value++;
  renderer.render(scene, camera);
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  controls.dispose();
  gui.destroy();
  disposeObject(scene);
  texture.dispose();
  renderer.dispose();
});
