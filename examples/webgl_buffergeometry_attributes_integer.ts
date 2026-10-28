import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { Color } from "ek3d/math/Color";
import { Fog } from "ek3d/scenes/Fog";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Float32BufferAttribute, Int16BufferAttribute } from "ek3d/core/BufferAttribute";
import { TextureType, Side, GLSL } from "ek3d/constants";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { disposeObject } from "./dispose-object";
import type { Texture } from "ek3d/textures/Texture";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing BufferGeometry example canvas");
const canvas: HTMLCanvasElement = canvasSel;
let disposed = false;
let frames = 0;
let pendingTextures = 3;
canvas.dataset.state = "loading";

let camera!: PerspectiveCamera;
let scene!: Scene;
let renderer!: WebGLRenderer;
let mesh!: Mesh<ShaderMaterial>;

init();

function init(): void {
  camera = new PerspectiveCamera(27, window.innerWidth / window.innerHeight, 1, 3500);
  camera.position.z = 2500;

  scene = new Scene();
  scene.background = new Color(0x050505);
  scene.fog = new Fog(0x050505, 2000, 3500);

  // geometry

  const triangles = 10000;

  const geometry = new BufferGeometry();

  const positions = [];
  const uvs = [];
  const textureIndices = [];

  const n = 800,
    n2 = n / 2; // triangles spread in the cube
  const d = 50,
    d2 = d / 2; // individual triangle size

  for (let i = 0; i < triangles; i++) {
    // positions

    const x = Math.random() * n - n2;
    const y = Math.random() * n - n2;
    const z = Math.random() * n - n2;

    const ax = x + Math.random() * d - d2;
    const ay = y + Math.random() * d - d2;
    const az = z + Math.random() * d - d2;

    const bx = x + Math.random() * d - d2;
    const by = y + Math.random() * d - d2;
    const bz = z + Math.random() * d - d2;

    const cx = x + Math.random() * d - d2;
    const cy = y + Math.random() * d - d2;
    const cz = z + Math.random() * d - d2;

    positions.push(ax, ay, az);
    positions.push(bx, by, bz);
    positions.push(cx, cy, cz);

    // uvs

    uvs.push(0, 0);
    uvs.push(0.5, 1);
    uvs.push(1, 0);

    // texture indices

    const t = i % 3;
    textureIndices.push(t, t, t);
  }

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  const textureIndex = new Int16BufferAttribute(textureIndices, 1);
  textureIndex.gpuType = TextureType.Int;
  geometry.setAttribute("textureIndex", textureIndex);

  geometry.computeBoundingSphere();

  // material

  const map1 = loadTexture("/examples/textures/crate.gif");
  const map2 = loadTexture("/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg");
  const map3 = loadTexture("/examples/textures/terrain/grasslight-big.jpg");

  const material = new ShaderMaterial({
    uniforms: {
      uTextures: {
        value: [map1, map2, map3],
      },
    },
    vertexShader: /* glsl */ `
						in int textureIndex;

						flat out int vIndex; // "flat" indicates that the value will not be interpolated (required for integer attributes)
						out vec2 vUv;

						void main()	{

							vIndex = textureIndex;
							vUv = uv;

							gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

						}
					`,
    fragmentShader: /* glsl */ `
						flat in int vIndex;
						in vec2 vUv;

						uniform sampler2D uTextures[ 3 ];

						out vec4 outColor;

						void main()	{

							if ( vIndex == 0 ) outColor = texture( uTextures[ 0 ], vUv );
							else if ( vIndex == 1 ) outColor = texture( uTextures[ 1 ], vUv );
							else if ( vIndex == 2 ) outColor = texture( uTextures[ 2 ], vUv );

						}
					`,
    side: Side.Double,
    glslVersion: GLSL.GLSL3,
  });

  // mesh

  mesh = new Mesh(geometry, material);
  scene.add(mesh);

  // renderer

  renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  window.addEventListener("resize", onWindowResize);
}

function animate(): void {
  const time = Date.now() * 0.001;

  mesh.rotation.x = time * 0.25;
  mesh.rotation.y = time * 0.5;

  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (pendingTextures === 0 && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
}

function loadTexture(url: string): Texture {
  return new TextureLoader().load(
    url,
    (texture) => {
      if (disposed) texture.dispose();
      pendingTextures--;
    },
    undefined,
    (error) => {
      if (disposed) return;
      canvas.dataset.state = "error";
      canvas.dataset.error = String(error);
      console.error(error);
    },
  );
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
  for (const texture of mesh.material.uniforms.uTextures.value as Texture[]) texture.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
