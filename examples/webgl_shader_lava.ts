import { BloomPass } from "ek3d/addons/postprocessing/BloomPass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { RepeatWrapping, SRGBColorSpace } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { TorusGeometry } from "ek3d/geometries/TorusGeometry";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

// Lava shader by TheGameMaker: https://irrlicht.sourceforge.net/phpBB2/viewtopic.php?t=21057

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing lava canvas");
const canvas: HTMLCanvasElement = selected;
let disposed = false;
let failed = false;
let loaded = 0;
canvas.dataset.state = "loading";
const loader = new TextureLoader();
function loadTexture(path: string) {
  return loader.load(
    path,
    (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      loaded++;
    },
    undefined,
    (error) => {
      if (disposed) return;
      failed = true;
      canvas.dataset.state = "error";
      canvas.dataset.error = String(error);
      console.error(error);
    },
  );
}
const cloudTexture = loadTexture("/examples/textures/lava/cloud.png");
const lavaTexture = loadTexture("/examples/textures/lava/lavatile.jpg");
cloudTexture.wrapS = cloudTexture.wrapT = RepeatWrapping;
lavaTexture.wrapS = lavaTexture.wrapT = RepeatWrapping;
lavaTexture.colorSpace = SRGBColorSpace;
const uniforms = {
  fogDensity: { value: 0.45 },
  fogColor: { value: new Vector3(0, 0, 0) },
  time: { value: 1 },
  uvScale: { value: new Vector2(3, 1) },
  texture1: { value: cloudTexture },
  texture2: { value: lavaTexture },
};
const material = new ShaderMaterial({
  uniforms,
  vertexShader: `uniform vec2 uvScale;
			varying vec2 vUv;

			void main()
			{

				vUv = uvScale * uv;
				vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
				gl_Position = projectionMatrix * mvPosition;

			}`,
  fragmentShader: `uniform float time;

			uniform float fogDensity;
			uniform vec3 fogColor;

			uniform sampler2D texture1;
			uniform sampler2D texture2;

			varying vec2 vUv;

			void main( void ) {

				vec2 position = - 1.0 + 2.0 * vUv;

				vec4 noise = texture2D( texture1, vUv );
				vec2 T1 = vUv + vec2( 1.5, - 1.5 ) * time * 0.02;
				vec2 T2 = vUv + vec2( - 0.5, 2.0 ) * time * 0.01;

				T1.x += noise.x * 2.0;
				T1.y += noise.y * 2.0;
				T2.x -= noise.y * 0.2;
				T2.y += noise.z * 0.2;

				float p = texture2D( texture1, T1 * 2.0 ).a;

				vec4 color = texture2D( texture2, T2 * 2.0 );
				vec4 temp = color * ( vec4( p, p, p, p ) * 2.0 ) + ( color * color - 0.1 );

				if( temp.r > 1.0 ) { temp.bg += clamp( temp.r - 2.0, 0.0, 100.0 ); }
				if( temp.g > 1.0 ) { temp.rb += temp.g - 1.0; }
				if( temp.b > 1.0 ) { temp.rg += temp.b - 1.0; }

				gl_FragColor = temp;

				float depth = gl_FragCoord.z / gl_FragCoord.w;
				const float LOG2 = 1.442695;
				float fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );
				fogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );

				gl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );

			}`,
});
const scene = new Scene();
const camera = new PerspectiveCamera(35, window.innerWidth / window.innerHeight, 1, 3000);
camera.position.z = 4;
const mesh = new Mesh(new TorusGeometry(0.65, 0.3, 30, 30), material);
mesh.rotation.x = 0.3;
scene.add(mesh);
const timer = new Timer();
timer.connect(document);
const renderer = new WebGLRenderer({ canvas });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.autoClear = false;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new BloomPass(1.25));
composer.addPass(new OutputPass());
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}
resize();
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  timer.update();
  const delta = 5 * timer.getDelta();
  uniforms.time.value += 0.2 * delta;
  mesh.rotation.y += 0.0125 * delta;
  mesh.rotation.x += 0.05 * delta;
  renderer.clear();
  composer.render(0.01);
  if (!failed && loaded === 2) canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  timer.dispose();
  for (const pass of composer.passes) pass.dispose();
  composer.dispose();
  disposeObject(scene);
  cloudTexture.dispose();
  lavaTexture.dispose();
  renderer.dispose();
});
