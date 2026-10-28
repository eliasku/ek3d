import { Side } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import type { Texture } from "ek3d/textures/Texture";
import { birdVS, birdFS } from "./gpgpu-bird-shaders";
import { createBirdSimulation } from "./gpgpu-bird-simulation";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing flock canvas");
const width = 32,
  count = width * width;
const geometry = new BufferGeometry();
const positions = new Float32Array(count * 9 * 3),
  colors = new Float32Array(count * 9 * 3),
  references = new Float32Array(count * 9 * 2),
  vertices = new Float32Array(count * 9);
const bird = [0, 0, -20, 0, 4, -20, 0, 0, 30, 0, 0, -15, -20, 0, 0, 0, 0, 15, 0, 0, 15, 20, 0, 0, 0, 0, -15];
for (let i = 0; i < count; i++) positions.set(bird, i * bird.length);
for (let i = 0; i < count * 9; i++) {
  const index = Math.floor(i / 9),
    color = new Color(0x666666 + (index / count) * 0x666666);
  colors.set([color.r, color.g, color.b], i * 3);
  references.set([(index % width) / width, Math.floor(index / width) / width], i * 2);
  vertices[i] = i % 9;
}
geometry.setAttribute("position", new BufferAttribute(positions, 3));
geometry.setAttribute("birdColor", new BufferAttribute(colors, 3));
geometry.setAttribute("reference", new BufferAttribute(references, 2));
geometry.setAttribute("birdVertex", new BufferAttribute(vertices, 1));
geometry.scale(0.2, 0.2, 0.2);
const uniforms = {
  color: { value: new Color(0xff2200) },
  texturePosition: { value: null as Texture | null },
  textureVelocity: { value: null as Texture | null },
  time: { value: 1 },
  delta: { value: 0 },
};
const material = new ShaderMaterial({ uniforms, vertexShader: birdVS, fragmentShader: birdFS, side: Side.Double });
try {
  const sim = createBirdSimulation(canvas, width, 0xffffff, false);
  const mesh = new Mesh(geometry, material);
  mesh.rotation.y = Math.PI / 2;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  sim.scene.add(mesh);
  window.addEventListener(
    "pagehide",
    (event) => {
      if (event.persisted) return;
      sim.dispose();
      geometry.dispose();
      material.dispose();
    },
    { once: false },
  );
  sim.start((now, delta) => {
    uniforms.time.value = now;
    uniforms.delta.value = delta;
    uniforms.texturePosition.value = sim.compute.getCurrentRenderTarget(sim.position).texture;
    uniforms.textureVelocity.value = sim.compute.getCurrentRenderTarget(sim.velocity).texture;
  });
} catch (error) {
  geometry.dispose();
  material.dispose();
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}
