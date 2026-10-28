import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { HDRCubeTextureLoader } from "ek3d/addons/loaders/HDRCubeTextureLoader";
import { UltraHDRLoader } from "ek3d/addons/loaders/UltraHDRLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ACESFilmicToneMapping, EquirectangularReflectionMapping } from "ek3d/constants";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { MeshPhysicalMaterial } from "ek3d/materials/MeshPhysicalMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import type { WebGLCubeRenderTarget } from "ek3d/renderers/WebGLCubeRenderTarget";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

export function startPMREM(cubemap: boolean): void {
  const selected = document.querySelector<HTMLCanvasElement>("#scene");
  if (!selected) throw new Error("Missing PMREM canvas");
  const canvas: HTMLCanvasElement = selected;
  const dfg = createDFGLUT();
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    createBackground: WebGLBackground,
    createEnvironments: WebGLEnvironments,
    getDFGLUT: () => dfg,
    shaders: { MeshPhysicalMaterial: physicalShader },
  });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = ACESFilmicToneMapping;
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.25, 20);
  camera.position.set(0, 0, 8);
  const controls = new OrbitControls(camera, canvas);
  controls.minDistance = 2;
  controls.maxDistance = 10;
  controls.update();
  let target: WebGLCubeRenderTarget | null = null;
  let disposed = false,
    loaded = false,
    frames = 0;
  canvas.dataset.state = "loading";
  function install(result: WebGLCubeRenderTarget): void {
    target = result;
    const envMap = result.texture;
    scene.background = envMap;
    scene.backgroundBlurriness = 0.5;
    const geometry = new SphereGeometry(0.4, 64, 64);
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 5; j++) {
        const mesh = new Mesh(geometry, new MeshPhysicalMaterial({ roughness: i / 5, metalness: j / 4, envMap }));
        mesh.position.set(i - 2.5, j - 2, 0);
        scene.add(mesh);
      }
    loaded = true;
  }
  function fail(cause: unknown): void {
    if (!disposed) {
      canvas.dataset.state = "error";
      console.error(cause);
    }
  }
  if (cubemap) {
    new HDRCubeTextureLoader().setPath("/examples/textures/cube/pisaHDR/").load(
      ["px.hdr", "nx.hdr", "py.hdr", "ny.hdr", "pz.hdr", "nz.hdr"],
      (map) => {
        if (!disposed) {
          const generator = new PMREMGenerator(renderer);
          install(generator.fromCubemap(map));
          generator.dispose();
        }
        map.dispose();
      },
      undefined,
      fail,
    );
  } else {
    new UltraHDRLoader().setPath("/examples/textures/equirectangular/").load(
      "royal_esplanade_2k.hdr.jpg",
      (map) => {
        if (!disposed) {
          map.mapping = EquirectangularReflectionMapping;
          const generator = new PMREMGenerator(renderer);
          install(generator.fromEquirectangular(map));
          generator.dispose();
        }
        map.dispose();
      },
      undefined,
      fail,
    );
  }
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
    canvas.dataset.frames = String(++frames);
    if (loaded) canvas.dataset.state = "rendered";
  });
  function resize(): void {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    disposed = true;
    window.removeEventListener("resize", resize);
    renderer.setAnimationLoop(null);
    controls.dispose();
    disposeObject(scene);
    target?.dispose();
    dfg.dispose();
    renderer.dispose();
  });
}
