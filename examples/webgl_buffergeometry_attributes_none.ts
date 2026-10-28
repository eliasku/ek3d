import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { Color } from "ek3d/math/Color";
import { Fog } from "ek3d/scenes/Fog";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { DoubleSide } from "ek3d/constants";
import { GLSL3 } from "ek3d/constants";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing BufferGeometry example canvas");
const canvas: HTMLCanvasElement = canvasSel;
let disposed = false;
let frames = 0;

let camera!: PerspectiveCamera;
let scene!: Scene;
let renderer!: WebGLRenderer;
let mesh!: Mesh;

init();

function init(): void {
  camera = new PerspectiveCamera(27, window.innerWidth / window.innerHeight, 1, 3500);
  camera.position.z = 4;

  scene = new Scene();
  scene.background = new Color(0x050505);
  scene.fog = new Fog(0x050505, 2000, 3500);

  // geometry

  const triangleCount = 10000;
  const vertexCountPerTriangle = 3;
  const vertexCount = triangleCount * vertexCountPerTriangle;

  const geometry = new BufferGeometry();
  geometry.setDrawRange(0, vertexCount);

  // material

  const material = new RawShaderMaterial({
    uniforms: {
      seed: { value: 42 },
    },
    vertexShader:
      "\n\n\t\t\tuniform mat4 modelViewMatrix;\n\t\t\tuniform mat4 projectionMatrix;\n\n\t\t\tuniform float seed;\n\n\t\t\tconst uint ieeeMantissa = 0x007FFFFFu;\n\t\t\tconst uint ieeeOne = 0x3F800000u;\n\n\t\t\tuint hash(uint x) {\n\t\t\t\tx += ( x << 10u );\n\t\t\t\tx ^= ( x >>  6u );\n\t\t\t\tx += ( x <<  3u );\n\t\t\t\tx ^= ( x >> 11u );\n\t\t\t\tx += ( x << 15u );\n\t\t\t\treturn x;\n\t\t\t}\n\n\t\t\tuint hash(uvec2 v) { return hash( v.x ^ hash(v.y) ); }\n\n\t\t\tfloat hashNoise(vec2 xy) {\n\t\t\t\tuint m = hash(floatBitsToUint(xy));\n\n\t\t\t\tm &= ieeeMantissa;\n\t\t\t\tm |= ieeeOne;\n\n\t\t\t\treturn uintBitsToFloat( m ) - 1.0;\n\t\t\t}\n\n\t\t\tfloat pseudoRandom(float lower, float delta, in vec2 xy) {\n\t\t\t\treturn lower + delta*hashNoise(xy);\n\t\t\t}\n\n\t\t\tvec3 pseudoRandomVec3(float lower, float upper, int index) {\n\t\t\t\tfloat delta = upper - lower;\n\t\t\t\tfloat x = pseudoRandom(lower, delta, vec2(index, 0));\n\t\t\t\tfloat y = pseudoRandom(lower, delta, vec2(index, 1));\n\t\t\t\tfloat z = pseudoRandom(lower, delta, vec2(index, 2));\n\t\t\t\treturn vec3(x, y, z);\n\t\t\t}\n\n\t\t\tout vec3 vColor;\n\n\t\t\tvoid main()\t{\n\n\t\t\t\tconst float scale = 1.0/64.0;\n\t\t\t\tvec3 position = pseudoRandomVec3(-1.0, +1.0, gl_VertexID/3) + scale * pseudoRandomVec3(-1.0, +1.0, gl_VertexID);\n\t\t\t\tvec3 color = pseudoRandomVec3(0.25, 1.0, gl_VertexID/3);\n\t\t\t\tgl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0 );\n\t\t\t\tvColor = color;\n\n\t\t\t}\n\t\t",
    fragmentShader:
      "\n\n\t\t\tprecision mediump float;\n\n\t\t\tin vec3 vColor;\n\n\t\t\tout vec4 fColor;\n\n\t\t\tvoid main()\t{\n\n\t\t\t\tfColor = vec4(vColor, 1);\n\n\t\t\t}\n\t\t",
    side: DoubleSide,
    glslVersion: GLSL3,
  });

  // mesh

  mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // renderer

  renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  window.addEventListener("resize", onWindowResize);
}

function animate(time: number): void {
  mesh.rotation.x = (time / 1000.0) * 0.25;
  mesh.rotation.y = (time / 1000.0) * 0.5;

  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", onWindowResize);
  renderer.setAnimationLoop(null);

  disposeObject(scene);

  renderer.dispose();
  canvas.dataset.state = "disposed";
});
