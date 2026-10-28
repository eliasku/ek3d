import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { VOXLoader, buildData3DTexture } from "ek3d/addons/loaders/VOXLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BackSide, GLSL3 } from "ek3d/constants";
import { Object3D } from "ek3d/core/Object3D";
import { Timer } from "ek3d/core/Timer";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { Vector3 } from "ek3d/math/Vector3";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import type { Data3DTexture } from "ek3d/textures/Data3DTexture";
import { disposeObject } from "./dispose-object";
const vertexShader = `
					in vec3 position;
					in mat4 instanceMatrix;

					uniform mat4 modelMatrix;
					uniform mat4 modelViewMatrix;
					uniform mat4 projectionMatrix;
					uniform vec3 cameraPos;

					out vec4 vScreenPosition;
					out mat4 vInstanceToViewMatrix;

					void main() {
						vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4( position, 1.0 );

						gl_Position = projectionMatrix * mvPosition;
						vScreenPosition = vec4( gl_Position.xy, 0.0, gl_Position.w );
						vInstanceToViewMatrix = modelViewMatrix * instanceMatrix;
					}
				`;
const fragmentShader = `
					precision highp float;
					precision highp sampler3D;

					uniform mat4 viewMatrix;
					uniform mat4 modelViewMatrix;
					uniform mat4 projectionMatrix;

					in vec4 vScreenPosition;
					in mat4 vInstanceToViewMatrix;

					out vec4 color;

					uniform sampler3D map;

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

					void main() {

						// perform w divide in the fragment shader to avoid interpolation artifacts
						vec2 screenUv = vScreenPosition.xy / vScreenPosition.w;
						mat4 invProjectionMatrix = inverse( projectionMatrix );
						mat4 invInstanceToViewMatrix = inverse( vInstanceToViewMatrix );
						
						// get camera ray
						vec4 temp;
						vec3 camRayOrigin, camRayEnd;
						temp = invProjectionMatrix * vec4( screenUv, - 1.0, 1.0 );
						camRayOrigin = temp.xyz / temp.w;

						temp = invProjectionMatrix * vec4( screenUv, 1.0, 1.0 );
						camRayEnd = temp.xyz / temp.w;
						
						// get local ray
						vec3 instRayOrigin, instRayDirection, instRayEnd;
						instRayOrigin = ( invInstanceToViewMatrix * vec4( camRayOrigin, 1.0 ) ).xyz;
						instRayEnd = ( invInstanceToViewMatrix * vec4( camRayEnd, 1.0 ) ).xyz;
						instRayDirection = normalize( instRayEnd - instRayOrigin );

						// calculate the start of the ray at the box edge
						vec2 bounds = hitBox( instRayOrigin, instRayDirection );

						if ( bounds.x > bounds.y ) discard;

						bounds.x = max( bounds.x, 0.0 );

						float stepSize = ( bounds.y - bounds.x ) / 100.0;

						vec3 p;

						// march through the volume
						for ( float i = 0.0; i < 100.0; i += 1.0 ) {

							float t = bounds.x + i * stepSize;
							p = instRayOrigin + t * instRayDirection;
							float d = sample1( p + 0.5 );

							if ( d > 0.5 ) {

								color.rgb = p * 2.0;
								color.a = 1.;
								break;

							}

						}

						if ( color.a == 0.0 ) discard;

						// calculate the final point in the ndc coords
						vec4 ndc = projectionMatrix * vInstanceToViewMatrix * vec4( p, 1.0 );
						ndc /= ndc.w;

						// map the ndc coordinate to depth
						// https://stackoverflow.com/questions/10264949/glsl-gl-fragcoord-z-calculation-and-setting-gl-fragdepth
						float far = gl_DepthRange.far;
						float near = gl_DepthRange.near;
						gl_FragDepth = ( ( ( far - near ) * ndc.z ) + near + far ) / 2.0;

					}
				`;
const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing volume instancing canvas");
const canvas: HTMLCanvasElement = selected;
const renderer = new WebGLRenderer({ canvas, shaders: {} });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const scene = new Scene(),
  camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 0, 4);
const controls = new OrbitControls(camera, canvas);
controls.autoRotate = true;
controls.autoRotateSpeed = -1;
controls.enableDamping = true;
const timer = new Timer();
timer.connect(document);
const textures: Data3DTexture[] = [];
let disposed = false;
new VOXLoader().load(
  "/examples/models/vox/menger.vox",
  (result) => {
    if (disposed) {
      if (result?.scene) disposeObject(result.scene);
      return;
    }
    if (!result || result.chunks.length === 0) {
      if (result?.scene) disposeObject(result.scene);
      canvas.dataset.state = "error";
      console.error(new Error("Volume instancing: VOX asset contains no models"));
      return;
    }
    for (const chunk of result.chunks) {
      const texture = buildData3DTexture(chunk);
      textures.push(texture);
      const uniforms = { map: { value: texture }, cameraPos: { value: new Vector3() } };
      const material = new RawShaderMaterial({
        glslVersion: GLSL3,
        uniforms,
        vertexShader,
        fragmentShader,
        side: BackSide,
      });
      const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), material, 50000);
      mesh.onBeforeRender = () => {
        uniforms.cameraPos.value.copy(camera.position);
      };
      const transform = new Object3D();
      for (let i = 0; i < mesh.count; i++) {
        transform.position.random().subScalar(0.5).multiplyScalar(150);
        transform.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
      }
      scene.add(mesh);
    }
    if (result.scene) disposeObject(result.scene);
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
  controls.update(timer.getDelta());
  renderer.render(scene, camera);
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  timer.disconnect();
  controls.dispose();
  disposeObject(scene);
  for (const texture of textures) texture.dispose();
  renderer.dispose();
});
