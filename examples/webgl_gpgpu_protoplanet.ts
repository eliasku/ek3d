import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { GPUComputationRenderer } from "ek3d/addons/misc/GPUComputationRenderer";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import common from "ek3d/renderers/shaders/ShaderChunk/common.glsl";
import { Scene } from "ek3d/scenes/Scene";
import type { DataTexture } from "ek3d/textures/DataTexture";
import type { Texture } from "ek3d/textures/Texture";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing protoplanet canvas");
const canvas: HTMLCanvasElement = selected;
canvas.dataset.state = "loading";
const WIDTH = 64;
const PARTICLES = WIDTH * WIDTH;
const params = {
  gravityConstant: 100,
  density: 0.45,
  radius: 300,
  height: 8,
  exponent: 0.4,
  maxMass: 15,
  velocity: 70,
  velocityExponent: 0.2,
  randVelocity: 0.001,
};

function shader(id: string): string {
  const element = document.getElementById(id);
  if (!element?.textContent) throw new Error(`Missing shader: ${id}`);
  return element.textContent;
}

function fillTextures(position: DataTexture, velocity: DataTexture): void {
  const pos = position.image.data;
  const vel = velocity.image.data;
  if (!(pos instanceof Float32Array) || !(vel instanceof Float32Array))
    throw new Error("Expected floating point simulation textures");
  const maxMass = (params.maxMass * 1024) / PARTICLES;
  for (let k = 0; k < pos.length; k += 4) {
    let x: number, z: number, rr: number;
    do {
      x = Math.random() * 2 - 1;
      z = Math.random() * 2 - 1;
      rr = x * x + z * z;
    } while (rr > 1);
    rr = Math.sqrt(rr);
    const r = params.radius * Math.pow(rr, params.exponent);
    const speed = params.velocity * Math.pow(rr, params.velocityExponent);
    const vx = speed * z + (Math.random() * 2 - 1) * params.randVelocity;
    const vy = (Math.random() * 2 - 1) * params.randVelocity * 0.05;
    const vz = -speed * x + (Math.random() * 2 - 1) * params.randVelocity;
    x *= r;
    z *= r;
    pos[k] = x;
    pos[k + 1] = (Math.random() * 2 - 1) * params.height;
    pos[k + 2] = z;
    pos[k + 3] = 1;
    vel[k] = vx;
    vel[k + 1] = vy;
    vel[k + 2] = vz;
    vel[k + 3] = Math.random() * maxMass + 1;
  }
}

function start(): void {
  const renderer = new WebGLRenderer({ canvas, preserveDrawingBuffer: true, shaderChunks: { common } });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  const scene = new Scene();
  const camera = new PerspectiveCamera(75, innerWidth / innerHeight, 5, 15000);
  camera.position.set(0, 120, 400);
  const controls = new OrbitControls(camera, canvas);
  controls.minDistance = 100;
  controls.maxDistance = 1000;
  const gpu = new GPUComputationRenderer(WIDTH, WIDTH, renderer);
  const positionTexture = gpu.createTexture();
  const velocityTexture = gpu.createTexture();
  fillTextures(positionTexture, velocityTexture);
  const velocity = gpu.addVariable("textureVelocity", shader("computeShaderVelocity"), velocityTexture);
  const position = gpu.addVariable("texturePosition", shader("computeShaderPosition"), positionTexture);
  gpu.setVariableDependencies(velocity, [position, velocity]);
  gpu.setVariableDependencies(position, [position, velocity]);
  const gravityConstant = { value: params.gravityConstant };
  const density = { value: params.density };
  velocity.material.uniforms.gravityConstant = gravityConstant;
  velocity.material.uniforms.density = density;
  const error = gpu.init();
  if (error !== null) {
    gpu.dispose();
    controls.dispose();
    renderer.dispose();
    throw new Error(error);
  }

  const geometry = new BufferGeometry();
  const positions = new Float32Array(PARTICLES * 3);
  const uvs = new Float32Array(PARTICLES * 2);
  for (let i = 0; i < PARTICLES; i++) {
    positions[i * 3] = (Math.random() * 2 - 1) * params.radius;
    positions[i * 3 + 2] = (Math.random() * 2 - 1) * params.radius;
    uvs[i * 2] = (i % WIDTH) / (WIDTH - 1);
    uvs[i * 2 + 1] = Math.floor(i / WIDTH) / (WIDTH - 1);
  }
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  const uniforms: {
    texturePosition: { value: Texture | null };
    textureVelocity: { value: Texture | null };
    cameraConstant: { value: number };
    density: { value: number };
  } = {
    texturePosition: { value: null },
    textureVelocity: { value: null },
    cameraConstant: { value: 0 },
    density,
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: shader("particleVertexShader"),
    fragmentShader: shader("particleFragmentShader"),
  });
  const particles = new Points(geometry, material);
  particles.matrixAutoUpdate = false;
  particles.updateMatrix();
  scene.add(particles);

  function restartSimulation(): void {
    const pos = gpu.createTexture();
    const vel = gpu.createTexture();
    try {
      fillTextures(pos, vel);
      for (const target of position.renderTargets) gpu.renderTexture(pos, target);
      for (const target of velocity.renderTargets) gpu.renderTexture(vel, target);
    } finally {
      pos.dispose();
      vel.dispose();
    }
  }
  function updateDynamic(): void {
    gravityConstant.value = params.gravityConstant;
    density.value = params.density;
  }
  const gui = new GUI({ width: 280 });
  const dynamic = gui.addFolder("Dynamic parameters");
  dynamic.add(params, "gravityConstant", 0, 1000, 0.05).onChange(updateDynamic);
  dynamic.add(params, "density", 0, 10, 0.001).onChange(updateDynamic);
  const fixed = gui.addFolder("Static parameters");
  fixed.add(params, "radius", 10, 1000, 1);
  fixed.add(params, "height", 0, 50, 0.01);
  fixed.add(params, "exponent", 0, 2, 0.001);
  fixed.add(params, "maxMass", 1, 50, 0.1);
  fixed.add(params, "velocity", 0, 150, 0.1);
  fixed.add(params, "velocityExponent", 0, 1, 0.01);
  fixed.add(params, "randVelocity", 0, 50, 0.1);
  fixed.add({ restartSimulation }, "restartSimulation");
  dynamic.open();
  fixed.open();
  const stats = new Stats();
  document.body.appendChild(stats.dom);
  let frames = 0;
  let disposed = false;
  function resize(): void {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    uniforms.cameraConstant.value = innerHeight / (Math.tan((Math.PI / 180) * 0.5 * camera.fov) / camera.zoom);
  }
  resize();
  window.addEventListener("resize", resize);
  renderer.setAnimationLoop(() => {
    try {
      gpu.compute();
      uniforms.texturePosition.value = gpu.getCurrentRenderTarget(position).texture;
      uniforms.textureVelocity.value = gpu.getCurrentRenderTarget(velocity).texture;
      renderer.render(scene, camera);
      stats.update();
      canvas.dataset.state = "rendered";
      canvas.dataset.frames = String(++frames);
    } catch (error) {
      renderer.setAnimationLoop(null);
      canvas.dataset.state = "error";
      canvas.dataset.error = String(error);
      console.error(error);
    }
  });
  window.addEventListener("pagehide", (event) => {
    if (event.persisted || disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    window.removeEventListener("resize", resize);
    controls.dispose();
    gui.destroy();
    stats.dom.remove();
    geometry.dispose();
    material.dispose();
    gpu.dispose();
    renderer.dispose();
    canvas.dataset.state = "disposed";
  });
}

try {
  start();
} catch (error) {
  canvas.dataset.state = "error";
  canvas.dataset.error = String(error);
  console.error(error);
}
