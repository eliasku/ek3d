import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { Color } from "ek3d/math/Color";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing example canvas");
const canvas = selected;
let disposed = false;
let frames = 0;
const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.z = 2000;
const scene = new Scene();
scene.background = new Color(0xffffff);
const geometry = new SphereGeometry(15, 64, 32);
const vertexShader = `
void main() {

  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mvPosition;

}
  `;
const fragmentShader = `
void main() {

  if ( mod ( gl_FragCoord.x, 4.0001 ) < 1.0 || mod ( gl_FragCoord.y, 4.0001 ) < 1.0 )

    gl_FragColor = vec4( XXX, 1.0 );

  else

    gl_FragColor = vec4( 1.0 );

}
  `;
function createMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader: fragmentShader.replace("XXX", [Math.random(), Math.random(), Math.random()].join(",")),
  });
}
const meshes: Mesh<ShaderMaterial>[] = [];
for (let i = 0; i < 100; i++) {
  const mesh = new Mesh<ShaderMaterial>(geometry, createMaterial());
  mesh.position.set((0.5 - Math.random()) * 1000, (0.5 - Math.random()) * 1000, (0.5 - Math.random()) * 1000);
  scene.add(mesh);
  meshes.push(mesh);
}
const renderer = new WebGLRenderer({ canvas });
renderer.setPixelRatio(window.devicePixelRatio);
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();
const interval = window.setInterval(() => {
  for (const mesh of meshes) {
    mesh.material.dispose();
    mesh.material = createMaterial();
  }
  renderer.render(scene, camera);
  console.log("before", renderer.info.programs?.length);
  for (const mesh of meshes) mesh.material.dispose();
  console.log("after", renderer.info.programs?.length);
  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(++frames);
  canvas.dataset.programs = String(renderer.info.programs?.length);
}, 1000 / 60);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.clearInterval(interval);
  window.removeEventListener("resize", resize);
  for (const mesh of meshes) mesh.material.dispose();
  geometry.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
