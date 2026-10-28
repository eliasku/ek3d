import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GLTFLoader, type GLTF, type GLTFParser } from "ek3d/addons/loaders/GLTFLoader";
import { HDRLoader } from "ek3d/addons/loaders/HDRLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { ACESFilmicToneMapping, EquirectangularReflectionMapping } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import type { Material } from "ek3d/materials/Material";
import { Mesh } from "ek3d/objects/Mesh";
import type { Object3D } from "ek3d/core/Object3D";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import type { DataTexture } from "ek3d/textures/DataTexture";
import { Scene } from "ek3d/scenes/Scene";
import { disposeMaterial, disposeObject } from "./dispose-object";

/** Root-level `KHR_materials_variants` definition, mirrored into `gltf.userData`. */
interface VariantsExtension {
  variants: Array<{ name: string }>;
}

/** Per-primitive `KHR_materials_variants` mapping list. */
interface VariantsMappingDefinition {
  mappings: Array<{ material: number; variants: number[] }>;
}

/** The material slot a mesh had before variant selection touched it. */
interface VariantMeshUserData {
  originalMaterial?: Material | Material[];
  gltfExtensions?: { KHR_materials_variants?: VariantsMappingDefinition };
}

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing gltf variants example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const dfgLUT = createDFGLUT();

const state = { variant: "midnight" };

const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.25, 20);
camera.position.set(2.5, 1.5, 3.0);

const scene = new Scene();

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfgLUT,
  shaders: {
    MeshStandardMaterial: standardShader,
  },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;

let environment: DataTexture | null = null;
let model: Object3D | null = null;
let gui: GUI | null = null;
let disposed = false;
let loaded = false;
let frames = 0;
let variantRequest = 0;
// Materials the parser created for variant mappings; they are not part of the scene graph's
// original material slots, so teardown must release them explicitly.
const variantMaterials = new Set<Material>();

const controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
controls.addEventListener("change", render); // use if there is no animation loop
controls.minDistance = 2;
controls.maxDistance = 10;
controls.target.set(0, 0.5, -0.2);
controls.update();

init();

function init(): void {
  new HDRLoader().setPath("/examples/textures/equirectangular/").load(
    "quarry_01_1k.hdr",
    function (texture: DataTexture) {
      // A response arriving after pagehide must not resurrect disposed renderer state.
      if (disposed) {
        texture.dispose();
        return;
      }

      environment = texture;
      texture.mapping = EquirectangularReflectionMapping;

      scene.background = texture;
      scene.environment = texture;

      render();

      // model

      const loader = new GLTFLoader().setPath("/examples/models/gltf/MaterialsVariantsShoe/glTF/");
      loader.load(
        "MaterialsVariantsShoe.gltf",
        function (gltf: GLTF) {
          if (disposed) {
            disposeObject(gltf.scene);
            return;
          }

          gltf.scene.scale.set(10.0, 10.0, 10.0);

          model = gltf.scene;
          scene.add(model);

          // Details of the KHR_materials_variants extension used here can be found below
          // https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_variants
          const parser = gltf.parser;
          const variantsExtension = getVariantsExtension(gltf);
          if (variantsExtension === undefined) {
            reportError(new Error("KHR_materials_variants is missing from the glTF root"));
            return;
          }

          gui = new GUI();

          const variants = variantsExtension.variants.map((variant) => variant.name);
          const variantsCtrl = gui.add(state, "variant", variants).name("Variant");

          selectVariant(parser, variantsExtension, state.variant).catch(reportError);

          variantsCtrl.onChange((value: unknown) => {
            selectVariant(parser, variantsExtension, String(value)).catch(reportError);
          });

          loaded = true;
          render();
        },
        undefined,
        reportError,
      );
    },
    undefined,
    reportError,
  );
}

function getVariantsExtension(gltf: GLTF): VariantsExtension | undefined {
  const extensions: { KHR_materials_variants?: VariantsExtension } | undefined = gltf.userData.gltfExtensions;
  return extensions?.KHR_materials_variants;
}

function reportError(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}

async function selectVariant(parser: GLTFParser, extension: VariantsExtension, variantName: string): Promise<void> {
  if (model === null) return;

  const variantIndex = extension.variants.findIndex((v) => v.name.includes(variantName));
  if (variantIndex < 0) throw new Error("Unknown material variant: " + variantName);

  // A newer selection or pagehide invalidates this run before it commits materials.
  const request = ++variantRequest;

  const meshes: Mesh[] = [];
  model.traverse((object: Object3D) => {
    if (object instanceof Mesh) meshes.push(object);
  });

  for (const mesh of meshes) {
    const userData: VariantMeshUserData = mesh.userData;
    const meshVariantDef = userData.gltfExtensions?.KHR_materials_variants;
    if (meshVariantDef === undefined) continue;

    // Remember the glTF default material once; it is restored for variants without a mapping and
    // stays owned by this page even after a variant replaces the mesh slot.
    if (userData.originalMaterial === undefined) {
      userData.originalMaterial = mesh.material;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        variantMaterials.add(material);
    }
    const original = userData.originalMaterial;

    const mapping = meshVariantDef.mappings.find((entry) => entry.variants.includes(variantIndex));

    if (mapping !== undefined) {
      const material: Material = await parser.getDependency("material", mapping.material);
      // A late response after pagehide owns its maps; release them now. A stale response is left to
      // the parser cache (still live) and released at teardown with the other page materials.
      if (disposed) {
        disposeMaterial(material);
        return;
      }

      variantMaterials.add(material);
      if (request !== variantRequest) return;

      mesh.material = material;
      parser.assignFinalMaterial(mesh);
      // assignFinalMaterial may swap in a derived material (tangents, vertex colors); own it too.
      if (mesh.material !== material) variantMaterials.add(mesh.material);
    } else {
      mesh.material = original;
    }

    if (request !== variantRequest) return;
    render();
  }

  if (request !== variantRequest) return;
  canvas.dataset.variant = variantName;
}

function render(): void {
  if (disposed) return;

  renderer.render(scene, camera);

  canvas.dataset.frames = String(++frames);
  if (loaded) canvas.dataset.state = "rendered";
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  render();
}

window.addEventListener("resize", onWindowResize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", onWindowResize);
  controls.removeEventListener("change", render);
  controls.dispose();
  gui?.destroy();
  // Graph materials plus every replaced original/variant material and their maps.
  disposeObject(scene, variantMaterials);
  variantMaterials.clear();
  environment?.dispose();
  dfgLUT.dispose();
  renderer.dispose();
});
