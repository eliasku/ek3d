import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { TextureType, PixelFormat, ColorSpace } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { InterleavedBufferAttribute } from "ek3d/core/InterleavedBufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { DataTexture } from "ek3d/textures/DataTexture";
import type { Texture } from "ek3d/textures/Texture";
import beginVertex from "ek3d/renderers/shaders/ShaderChunk/begin_vertex.glsl";
import { disposeObject } from "./dispose-object";
import { birdDeclarations, birdTransform } from "./gpgpu-bird-gltf-shaders";
import { createBirdSimulation } from "./gpgpu-bird-simulation";

const selected = Math.floor(Math.random() * 2);
const models = ["Parrot.glb", "Flamingo.glb"],
  colors = [0xccffff, 0xffdeff],
  sizes = [0.2, 0.1];
const canvasElement = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvasElement) throw new Error("Missing model flock canvas");
const canvas: HTMLCanvasElement = canvasElement;
const width = 64,
  count = width * width;
let disposed = false;
let cleanup: (() => void) | undefined;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  cleanup?.();
});
canvas.dataset.state = "loading";
new GLTFLoader().load(
  `/examples/models/gltf/${models[selected]}`,
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    try {
      const source = gltf.scene.children[0];
      if (!(source instanceof Mesh) || !gltf.animations[0]) throw new Error("Invalid bird model");
      const base = source.geometry,
        position = base.getAttribute("position"),
        color = base.getAttribute("color"),
        index = base.index;
      const morph: unknown = base.morphAttributes.position;
      if (
        !(position instanceof BufferAttribute || position instanceof InterleavedBufferAttribute) ||
        !(color instanceof BufferAttribute || color instanceof InterleavedBufferAttribute) ||
        !index ||
        !Array.isArray(morph) ||
        !morph.length ||
        !morph.every(
          (attribute: unknown) =>
            attribute instanceof BufferAttribute || attribute instanceof InterleavedBufferAttribute,
        )
      )
        throw new Error("Bird model is missing geometry or morph targets");
      const morphTargets: (BufferAttribute | InterleavedBufferAttribute)[] = morph;
      const duration = Math.round(gltf.animations[0].duration * 60);
      if (duration < 1) throw new Error("Invalid bird animation duration");
      const textureWidth = 2 ** Math.ceil(Math.log2(position.count)),
        textureHeight = 2 ** Math.ceil(Math.log2(duration));
      const data = new Float32Array(4 * textureWidth * textureHeight);
      for (let frame = 0; frame < duration; frame++) {
        const phase = (frame / duration) * morphTargets.length,
          current = morphTargets[Math.floor(phase)],
          next = morphTargets[(Math.floor(phase) + 1) % morphTargets.length],
          t = phase % 1;
        for (let vertex = 0; vertex < position.count; vertex++) {
          const offset = (frame * textureWidth + vertex) * 4;
          data[offset] = current.getX(vertex) * (1 - t) + next.getX(vertex) * t;
          data[offset + 1] = current.getY(vertex) * (1 - t) + next.getY(vertex) * t;
          data[offset + 2] = current.getZ(vertex) * (1 - t) + next.getZ(vertex) * t;
          data[offset + 3] = 1;
        }
      }
      const animation = new DataTexture(data, textureWidth, textureHeight, PixelFormat.RGBA, TextureType.Float);
      animation.needsUpdate = true;
      const total = position.count * count;
      const positions = new Float32Array(total * 3),
        colorsArray = new Float32Array(total * 3),
        references = new Float32Array(total * 4),
        seeds = new Float32Array(total * 4),
        indices = new Uint32Array(index.count * count);
      for (let bird = 0; bird < count; bird++) {
        const random = Math.random();
        for (let v = 0; v < position.count; v++) {
          const i = bird * position.count + v;
          positions.set([position.getX(v), position.getY(v), position.getZ(v)], i * 3);
          colorsArray.set([color.getX(v), color.getY(v), color.getZ(v)], i * 3);
          references.set(
            [(bird % width) / width, Math.floor(bird / width) / width, v / textureWidth, duration / textureHeight],
            i * 4,
          );
          seeds.set([bird, random, Math.random(), Math.random()], i * 4);
        }
        for (let i = 0; i < index.count; i++) indices[bird * index.count + i] = index.getX(i) + bird * position.count;
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.setAttribute("color", new BufferAttribute(colorsArray, 3));
      geometry.setAttribute("birdColor", new BufferAttribute(colorsArray, 3));
      geometry.setAttribute("reference", new BufferAttribute(references, 4));
      geometry.setAttribute("seeds", new BufferAttribute(seeds, 4));
      geometry.setIndex(new BufferAttribute(indices, 1));
      const indicesPerBird = index.count;
      disposeObject(gltf.scene);
      const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 });
      const uniforms = {
        texturePosition: { value: null as Texture | null },
        textureVelocity: { value: null as Texture | null },
        textureAnimation: { value: animation },
        time: { value: 1 },
        size: { value: sizes[selected] },
        delta: { value: 0 },
      };
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace("#define STANDARD", "#define STANDARD" + birdDeclarations)
          .replace(beginVertex, birdTransform);
      };
      const sim = (() => {
        try {
          return createBirdSimulation(canvas, width, colors[selected], true);
        } catch (error) {
          geometry.dispose();
          material.dispose();
          animation.dispose();
          throw error;
        }
      })();
      const hemi = new HemisphereLight(colors[selected], 0xffffff, 4.5);
      hemi.color.setHSL(0.6, 1, 0.6, ColorSpace.SRGB);
      hemi.groundColor.setHSL(0.095, 1, 0.75, ColorSpace.SRGB);
      hemi.position.set(0, 50, 0);
      const light = new DirectionalLight(0x00ced1, 2);
      light.color.setHSL(0.1, 1, 0.95, ColorSpace.SRGB);
      light.position.set(-1, 1.75, 1).multiplyScalar(30);
      sim.scene.add(hemi, light);
      const mesh = new Mesh(geometry, material);
      mesh.rotation.y = Math.PI / 2;
      mesh.castShadow = mesh.receiveShadow = true;
      sim.scene.add(mesh);
      const params = { size: sizes[selected], count: Math.floor(count / 4) };
      function update(): void {
        uniforms.size.value = params.size;
        geometry.setDrawRange(0, indicesPerBird * params.count);
      }
      update();
      sim.gui.add(params, "size", 0, 1, 0.01).onChange(update);
      sim.gui.add(params, "count", 0, count, 1).onChange(update);
      cleanup = () => {
        sim.dispose();
        geometry.dispose();
        material.dispose();
        animation.dispose();
      };
      canvas.dataset.asset = models[selected];
      sim.start((now, delta) => {
        uniforms.time.value = now / 1000;
        uniforms.delta.value = delta;
        uniforms.texturePosition.value = sim.compute.getCurrentRenderTarget(sim.position).texture;
        uniforms.textureVelocity.value = sim.compute.getCurrentRenderTarget(sim.velocity).texture;
      });
    } catch (error) {
      disposeObject(gltf.scene);
      canvas.dataset.state = "error";
      canvas.dataset.error = error instanceof Error ? error.message : String(error);
      console.error(error);
    }
  },
  undefined,
  (error) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  },
);
