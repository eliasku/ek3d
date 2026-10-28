import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { HDRLoader } from "ek3d/addons/loaders/HDRLoader";
import { ToneMapping, Mapping, TextureType, PixelFormat } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import { DataTexture } from "ek3d/textures/DataTexture";

export interface HDRExampleExporter {
  extension: string;
  mime: string;
  environment: string;
  texture(texture: DataTexture, type: string, compression: string): Promise<Uint8Array>;
  target(renderer: WebGLRenderer, target: WebGLRenderTarget, type: string, compression: string): Promise<Uint8Array>;
}

export function startHDRExporterExample(exporter: HDRExampleExporter): void {
  const selected = document.querySelector<HTMLCanvasElement>("#scene");
  if (!selected) throw new Error("Missing exporter example canvas");
  const canvas = selected;
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    createBackground: WebGLBackground,
    createEnvironments: WebGLEnvironments,
    shaders: { MeshBasicMaterial: basicShader },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = exporter.extension === "ktx2" ? ToneMapping.AgX : ToneMapping.No;
  const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(10, 0, 0);
  const scene = new Scene();
  const renderTarget = new WebGLRenderTarget(1024, 512, { type: TextureType.HalfFloat });
  const controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
  controls.enableDamping = true;
  controls.rotateSpeed = -0.25;
  const size = 800,
    radius = 320,
    factor = (Math.PI * 0.5) / radius;
  const data = new Float32Array(4 * size * size);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const x = j - size / 2,
        y = i - size / 2,
        index = (i * size + j) * 4;
      const inside = Math.hypot(x, y) < radius;
      data[index] = 0.5 + 0.5 * (inside ? Math.sin(x * factor) : 0);
      data[index + 1] = 0.5 + 0.5 * (inside ? Math.sin(y * factor) : 0);
      data[index + 2] = 0.5 + 0.5 * (inside ? Math.cos(x * factor) : 1);
      data[index + 3] = 1;
    }
  }
  const texture = new DataTexture(data, size, size, PixelFormat.RGBA, TextureType.Float);
  texture.needsUpdate = true;
  const material = new MeshBasicMaterial({ map: texture });
  const geometry = new PlaneGeometry(50, 50);
  const mesh = new Mesh(geometry, material);
  mesh.visible = false;
  scene.add(mesh);
  let environment: DataTexture | null = null;
  let disposed = false,
    frames = 0;
  const params = { target: "render-target", type: "HalfFloatType", compression: "ZIP", export: exportFile };
  const gui = new GUI();
  if (exporter.extension === "exr") {
    const input = gui.addFolder("Input");
    input.add(params, "target", ["render-target", "data-texture"]).onChange(swapScene);
    const options = gui.addFolder("Output Options");
    options.add(params, "type", ["FloatType", "HalfFloatType"]);
    options.add(params, "compression", ["ZIP", "ZIPS", "RLE", "PIZ", "NONE"]);
  } else {
    gui.add(params, "target", ["render-target", "data-texture"]).onChange(swapScene);
  }
  gui.add(params, "export").name(`Export ${exporter.extension.toUpperCase()}`);
  gui.open();
  new HDRLoader().load(
    `/examples/textures/equirectangular/${exporter.environment}`,
    (loaded) => {
      if (disposed) {
        loaded.dispose();
        return;
      }
      loaded.mapping = Mapping.EquirectangularReflection;
      environment = loaded;
      if (params.target === "render-target") scene.background = loaded;
      canvas.dataset.state = "rendered";
    },
    undefined,
    (error: unknown) => {
      if (disposed) return;
      canvas.dataset.state = "error";
      canvas.dataset.error = error instanceof Error ? error.message : String(error);
      console.error(error);
    },
  );
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
    canvas.dataset.frames = String(++frames);
  });
  function swapScene(): void {
    const target = params.target === "render-target";
    camera.position.set(target ? 10 : 0, 0, target ? 0 : 70);
    controls.enabled = target;
    scene.background = target ? environment : new Color(0, 0, 0);
    mesh.visible = !target;
    if (exporter.extension === "ktx2") renderer.toneMapping = target ? ToneMapping.AgX : ToneMapping.No;
  }
  async function exportFile(): Promise<void> {
    try {
      let result: Uint8Array;
      if (params.target === "render-target") {
        const exportCamera = camera.clone();
        exportCamera.aspect = renderTarget.width / renderTarget.height;
        exportCamera.updateProjectionMatrix();
        renderer.setRenderTarget(renderTarget);
        try {
          renderer.render(scene, exportCamera);
        } finally {
          renderer.setRenderTarget(null);
        }
        result = await exporter.target(renderer, renderTarget, params.type, params.compression);
      } else {
        result = await exporter.texture(texture, params.type, params.compression);
      }
      const url = URL.createObjectURL(new Blob([Uint8Array.from(result).buffer], { type: exporter.mime }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${params.target}.${exporter.extension}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      canvas.dataset.error = error instanceof Error ? error.message : String(error);
      console.error(error);
    }
  }
  function resize(): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("pagehide", (event) => {
    if (event.persisted || disposed) return;
    disposed = true;
    window.removeEventListener("resize", resize);
    renderer.setAnimationLoop(null);
    controls.dispose();
    gui.destroy();
    geometry.dispose();
    material.dispose();
    texture.dispose();
    environment?.dispose();
    renderTarget.dispose();
    renderer.dispose();
  });
}
