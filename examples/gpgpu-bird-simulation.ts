import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { GPUComputationRenderer } from "ek3d/addons/misc/GPUComputationRenderer";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Wrapping } from "ek3d/constants";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { fragmentShaderPosition, fragmentShaderVelocity } from "./gpgpu-bird-shaders";

import {
  fragmentShaderPosition as gltfPosition,
  fragmentShaderVelocity as gltfVelocity,
} from "./gpgpu-bird-gltf-shaders";

export function createBirdSimulation(canvas: HTMLCanvasElement, width: number, background: number, antialias: boolean) {
  const camera = new PerspectiveCamera(75, innerWidth / innerHeight, 1, 3000);
  camera.position.z = 350;
  const scene = new Scene();
  scene.background = new Color(background);
  scene.fog = new Fog(background, 100, 1000);
  const dfg = createDFGLUT();
  const renderer = new WebGLRenderer({
    canvas,
    antialias,
    createBackground: WebGLBackground,
    getDFGLUT: () => dfg,
    shaders: { MeshStandardMaterial: standardShader },
  });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  const compute = new GPUComputationRenderer(width, width, renderer);
  const positionTexture = compute.createTexture(),
    velocityTexture = compute.createTexture();
  const positions = positionTexture.image.data,
    velocities = velocityTexture.image.data;
  if (!(positions instanceof Float32Array) || !(velocities instanceof Float32Array))
    throw new Error("Invalid simulation textures");
  for (let i = 0; i < positions.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      positions[i + j] = Math.random() * 800 - 400;
      velocities[i + j] = (Math.random() - 0.5) * 10;
    }
    positions[i + 3] = velocities[i + 3] = 1;
  }
  const velocity = compute.addVariable(
    "textureVelocity",
    width === 64 ? gltfVelocity : fragmentShaderVelocity,
    velocityTexture,
  );
  const position = compute.addVariable(
    "texturePosition",
    width === 64 ? gltfPosition : fragmentShaderPosition,
    positionTexture,
  );
  compute.setVariableDependencies(velocity, [position, velocity]);
  compute.setVariableDependencies(position, [position, velocity]);
  const positionUniforms = { time: { value: 0 }, delta: { value: 0 } };
  const velocityUniforms = {
    time: { value: 1 },
    delta: { value: 0 },
    testing: { value: 1 },
    separationDistance: { value: 20 },
    alignmentDistance: { value: 20 },
    cohesionDistance: { value: 20 },
    freedomFactor: { value: 0.75 },
    predator: { value: new Vector3() },
  };
  Object.assign(position.material.uniforms, positionUniforms);
  Object.assign(velocity.material.uniforms, velocityUniforms);
  velocity.material.defines.BOUNDS = "800.00";
  velocity.wrapS = velocity.wrapT = position.wrapS = position.wrapT = Wrapping.Repeat;
  const error = compute.init();
  if (error !== null) {
    compute.dispose();
    renderer.dispose();
    dfg.dispose();
    throw new Error(error);
  }
  const gui = new GUI();
  const params = { separation: 20, alignment: 20, cohesion: 20, freedom: 0.75 };
  function update(): void {
    velocityUniforms.separationDistance.value = params.separation;
    velocityUniforms.alignmentDistance.value = params.alignment;
    velocityUniforms.cohesionDistance.value = params.cohesion;
    velocityUniforms.freedomFactor.value = params.freedom;
  }
  gui.add(params, "separation", 0, 100, 1).onChange(update);
  gui.add(params, "alignment", 0, 100, 0.001).onChange(update);
  gui.add(params, "cohesion", 0, 100, 0.025).onChange(update);
  gui.close();
  let mouseX = 0,
    mouseY = 0,
    last = performance.now(),
    frames = 0;
  canvas.style.touchAction = "none";
  function pointer(event: PointerEvent): void {
    if (event.isPrimary) {
      mouseX = event.clientX - innerWidth / 2;
      mouseY = event.clientY - innerHeight / 2;
    }
  }
  function resize(): void {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  canvas.addEventListener("pointermove", pointer);
  window.addEventListener("resize", resize);
  function start(draw: (now: number, delta: number) => void): void {
    renderer.setAnimationLoop(() => {
      const now = performance.now(),
        delta = Math.min((now - last) / 1000, 1);
      last = now;
      positionUniforms.time.value = velocityUniforms.time.value = now;
      positionUniforms.delta.value = velocityUniforms.delta.value = delta;
      velocityUniforms.predator.value.set(mouseX / innerWidth, -mouseY / innerHeight, 0);
      mouseX = mouseY = 10000;
      compute.compute();
      draw(now, delta);
      renderer.render(scene, camera);
      canvas.dataset.frames = String(++frames);
      canvas.dataset.state = "rendered";
    });
  }
  function dispose(): void {
    renderer.setAnimationLoop(null);
    canvas.removeEventListener("pointermove", pointer);
    window.removeEventListener("resize", resize);
    gui.destroy();
    compute.dispose();
    renderer.dispose();
    dfg.dispose();
  }
  return { scene, gui, compute, position, velocity, start, dispose };
}
