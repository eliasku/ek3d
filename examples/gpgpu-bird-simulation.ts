import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { GPUComputationRenderer, type GPUComputationVariable } from "ek3d/addons/misc/GPUComputationRenderer";
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
import type { DataTexture } from "ek3d/textures/DataTexture";
import { fragmentShaderPosition, fragmentShaderVelocity } from "./gpgpu-bird-shaders";

import {
  fragmentShaderPosition as gltfPosition,
  fragmentShaderVelocity as gltfVelocity,
} from "./gpgpu-bird-gltf-shaders";

export class BirdSimulation {
  scene: Scene;
  gui: GUI;
  compute: GPUComputationRenderer;
  position: GPUComputationVariable;
  velocity: GPUComputationVariable;
  private camera: PerspectiveCamera;
  private renderScene: Scene;
  private dfg: DataTexture;
  private renderer: WebGLRenderer;
  private computation: GPUComputationRenderer;
  private positionUniforms: { time: { value: number }; delta: { value: number } };
  private velocityUniforms: {
    time: { value: number };
    delta: { value: number };
    testing: { value: number };
    separationDistance: { value: number };
    alignmentDistance: { value: number };
    cohesionDistance: { value: number };
    freedomFactor: { value: number };
    predator: { value: Vector3 };
  };
  private controls: GUI;
  private params: { separation: number; alignment: number; cohesion: number; freedom: number };
  private mouseX: number;
  private mouseY: number;
  private last: number;
  private frames: number;

  constructor(
    private canvas: HTMLCanvasElement,
    width: number,
    background: number,
    antialias: boolean,
  ) {
    this.camera = new PerspectiveCamera(75, innerWidth / innerHeight, 1, 3000);
    this.camera.position.z = 350;
    this.renderScene = new Scene();
    this.renderScene.background = new Color(background);
    this.renderScene.fog = new Fog(background, 100, 1000);
    this.dfg = createDFGLUT();
    this.renderer = new WebGLRenderer({
      canvas,
      antialias,
      createBackground: WebGLBackground,
      getDFGLUT: this.getDFGLUT.bind(this),
      shaders: { MeshStandardMaterial: standardShader },
    });
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setSize(innerWidth, innerHeight);
    this.computation = new GPUComputationRenderer(width, width, this.renderer);
    const positionTexture = this.computation.createTexture(),
      velocityTexture = this.computation.createTexture();
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
    this.velocity = this.computation.addVariable(
      "textureVelocity",
      width === 64 ? gltfVelocity : fragmentShaderVelocity,
      velocityTexture,
    );
    this.position = this.computation.addVariable(
      "texturePosition",
      width === 64 ? gltfPosition : fragmentShaderPosition,
      positionTexture,
    );
    this.computation.setVariableDependencies(this.velocity, [this.position, this.velocity]);
    this.computation.setVariableDependencies(this.position, [this.position, this.velocity]);
    this.positionUniforms = { time: { value: 0 }, delta: { value: 0 } };
    this.velocityUniforms = {
      time: { value: 1 },
      delta: { value: 0 },
      testing: { value: 1 },
      separationDistance: { value: 20 },
      alignmentDistance: { value: 20 },
      cohesionDistance: { value: 20 },
      freedomFactor: { value: 0.75 },
      predator: { value: new Vector3() },
    };
    Object.assign(this.position.material.uniforms, this.positionUniforms);
    Object.assign(this.velocity.material.uniforms, this.velocityUniforms);
    this.velocity.material.defines.BOUNDS = "800.00";
    this.velocity.wrapS = this.velocity.wrapT = this.position.wrapS = this.position.wrapT = Wrapping.Repeat;
    const error = this.computation.init();
    if (error !== null) {
      this.computation.dispose();
      this.renderer.dispose();
      this.dfg.dispose();
      throw new Error(error);
    }
    this.controls = new GUI();
    this.params = { separation: 20, alignment: 20, cohesion: 20, freedom: 0.75 };
    this.update = this.update.bind(this);
    this.controls.add(this.params, "separation", 0, 100, 1).onChange(this.update);
    this.controls.add(this.params, "alignment", 0, 100, 0.001).onChange(this.update);
    this.controls.add(this.params, "cohesion", 0, 100, 0.025).onChange(this.update);
    this.controls.close();
    this.mouseX = 0;
    this.mouseY = 0;
    this.last = performance.now();
    this.frames = 0;
    canvas.style.touchAction = "none";
    this.pointer = this.pointer.bind(this);
    this.resize = this.resize.bind(this);
    canvas.addEventListener("pointermove", this.pointer);
    window.addEventListener("resize", this.resize);
    this.scene = this.renderScene;
    this.gui = this.controls;
    this.compute = this.computation;
    this.start = this.start.bind(this);
    this.dispose = this.dispose.bind(this);
  }

  private getDFGLUT() {
    return this.dfg;
  }

  private update(): void {
    this.velocityUniforms.separationDistance.value = this.params.separation;
    this.velocityUniforms.alignmentDistance.value = this.params.alignment;
    this.velocityUniforms.cohesionDistance.value = this.params.cohesion;
    this.velocityUniforms.freedomFactor.value = this.params.freedom;
  }

  private pointer(event: PointerEvent): void {
    if (event.isPrimary) {
      this.mouseX = event.clientX - innerWidth / 2;
      this.mouseY = event.clientY - innerHeight / 2;
    }
  }

  private resize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  private animate(draw: (now: number, delta: number) => void): void {
    const now = performance.now(),
      delta = Math.min((now - this.last) / 1000, 1);
    this.last = now;
    this.positionUniforms.time.value = this.velocityUniforms.time.value = now;
    this.positionUniforms.delta.value = this.velocityUniforms.delta.value = delta;
    this.velocityUniforms.predator.value.set(this.mouseX / innerWidth, -this.mouseY / innerHeight, 0);
    this.mouseX = this.mouseY = 10000;
    this.computation.compute();
    draw(now, delta);
    this.renderer.render(this.renderScene, this.camera);
    this.canvas.dataset.frames = String(++this.frames);
    this.canvas.dataset.state = "rendered";
  }

  start(draw: (now: number, delta: number) => void): void {
    this.renderer.setAnimationLoop(this.animate.bind(this, draw));
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.canvas.removeEventListener("pointermove", this.pointer);
    window.removeEventListener("resize", this.resize);
    this.controls.destroy();
    this.computation.dispose();
    this.renderer.dispose();
    this.dfg.dispose();
  }
}
