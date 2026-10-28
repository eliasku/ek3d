import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { ImprovedNoise } from "ek3d/addons/math/ImprovedNoise";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Side, GLSL, TextureFilter, PixelFormat } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
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

					uniform sampler3D map;

					uniform float threshold;
					uniform float steps;
					uniform bool refine;

					#define REFINEMENT_STEPS 4

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

					#define epsilon .0001

					vec3 normal( vec3 coord ) {
						if ( coord.x < epsilon ) return vec3( 1.0, 0.0, 0.0 );
						if ( coord.y < epsilon ) return vec3( 0.0, 1.0, 0.0 );
						if ( coord.z < epsilon ) return vec3( 0.0, 0.0, 1.0 );
						if ( coord.x > 1.0 - epsilon ) return vec3( - 1.0, 0.0, 0.0 );
						if ( coord.y > 1.0 - epsilon ) return vec3( 0.0, - 1.0, 0.0 );
						if ( coord.z > 1.0 - epsilon ) return vec3( 0.0, 0.0, - 1.0 );

						float step = 0.01;
						float x = sample1( coord + vec3( - step, 0.0, 0.0 ) ) - sample1( coord + vec3( step, 0.0, 0.0 ) );
						float y = sample1( coord + vec3( 0.0, - step, 0.0 ) ) - sample1( coord + vec3( 0.0, step, 0.0 ) );
						float z = sample1( coord + vec3( 0.0, 0.0, - step ) ) - sample1( coord + vec3( 0.0, 0.0, step ) );

						return normalize( vec3( x, y, z ) );
					}

					void main(){

						vec3 rayDir = normalize( vDirection );
						vec2 bounds = hitBox( vOrigin, rayDir );

						if ( bounds.x > bounds.y ) discard;

						bounds.x = max( bounds.x, 0.0 );

						float stepSize = ( bounds.y - bounds.x ) / steps;

						for ( float i = 0.0; i < steps; i += 1.0 ) {

							float t = bounds.x + i * stepSize;
							vec3 p = vOrigin + t * rayDir;
							float d = sample1( p + 0.5 );

							if ( d > threshold ) {

								if ( refine ) {

									// The surface lies between the previous ray parameter i.e. (t - stepSize)
									// and the current ray parameter (t). Bisect that interval to localize
									// the crossing precisely.

									float t0 = max( t - stepSize, bounds.x );
									float t1 = t;

									for ( int j = 0; j < REFINEMENT_STEPS; j ++ ) {

										float tm = ( t0 + t1 ) * 0.5;
										float dm = sample1( vOrigin + tm * rayDir + 0.5 );

										bool isGreater = dm > threshold;
										t1 = isGreater ? tm : t1;
										t0 = isGreater ? t0 : tm;

									}

									p = vOrigin + t1 * rayDir;

								}

								color.rgb = normal( p + 0.5 ) * 0.5 + ( p * 1.5 + 0.25 );
								color.a = 1.;
								break;

							}

						}

						if ( color.a == 0.0 ) discard;

					}
				`;
const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing volume canvas");
const canvas: HTMLCanvasElement = selected;
const renderer = new WebGLRenderer({ canvas, shaders: {} });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const scene = new Scene();
const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 2);
const controls = new OrbitControls(camera, canvas);

const size = 128,
  data = new Uint8Array(size * size * size),
  noise = new ImprovedNoise(),
  vector = new Vector3();
let i = 0;
for (let z = 0; z < size; z++)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      vector.set(x, y, z).divideScalar(size);
      data[i++] = noise.noise(vector.x * 6.5, vector.y * 6.5, vector.z * 6.5) * 128 + 128;
    }
const texture = new Data3DTexture(data, size, size, size);
texture.format = PixelFormat.Red;
texture.minFilter = TextureFilter.Linear;
texture.magFilter = TextureFilter.Linear;
texture.unpackAlignment = 1;
texture.needsUpdate = true;
const uniforms = {
  map: { value: texture },
  cameraPos: { value: new Vector3() },
  threshold: { value: 0.6 },
  steps: { value: 200 },
  refine: { value: true },
};
const material = new RawShaderMaterial({
  glslVersion: GLSL.GLSL3,
  uniforms,
  vertexShader,
  fragmentShader,
  side: Side.Back,
  transparent: false,
});
const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);
scene.add(mesh);
const gui = new GUI();
const params = { threshold: 0.6, steps: 200, refine: true };
const update = (): void => {
  uniforms.threshold.value = params.threshold;
  uniforms.steps.value = params.steps;
  uniforms.refine.value = params.refine;
};
gui.add(params, "threshold", 0, 1, 0.01).onChange(update);
gui.add(params, "steps", 0, 300, 1).onChange(update);
gui.add(params, "refine").onChange(update);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  uniforms.cameraPos.value.copy(camera.position);

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
