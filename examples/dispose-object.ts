import type { Object3D } from "ek3d/core/Object3D";
import type { Material } from "ek3d/materials/Material";
import { Texture } from "ek3d/textures/Texture";

interface DisposalState {
  geometries: Set<{ dispose(): void }>;
  textures: Set<Texture>;
  bitmaps: Set<ImageBitmap>;
}

function createState(): DisposalState {
  return { geometries: new Set(), textures: new Set(), bitmaps: new Set() };
}

/** Releases one material and each texture it references exactly once for this state. */
function disposeMaterialInto(material: Material, state: DisposalState): void {
  for (const value of Object.values(material)) {
    if (!(value instanceof Texture) || state.textures.has(value)) continue;
    state.textures.add(value);

    const image: unknown = value.image;
    if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap && !state.bitmaps.has(image)) {
      state.bitmaps.add(image);
      image.close();
    }

    value.dispose();
  }

  material.dispose();
}

/** Releases a single material (and its maps) that never entered the scene graph. */
export function disposeMaterial(material: Material): void {
  disposeMaterialInto(material, createState());
}

/**
 * Releases the GPU resources of a loaded object graph: geometries, materials and the textures
 * they reference, plus any decoded `ImageBitmap`. `extraMaterials` covers materials the graph no
 * longer references (for example slots replaced after loading); both sources are deduplicated.
 */
export function disposeObject(target: Object3D, extraMaterials: Iterable<Material> = []): void {
  const state = createState();
  const materials = new Set<Material>(extraMaterials);

  target.traverse((child) => {
    const renderable = child as Object3D & {
      geometry?: { dispose(): void };
      material?: Material | Material[];
      skeleton?: { dispose(): void };
    };

    renderable.skeleton?.dispose();
    if (renderable.geometry !== undefined) state.geometries.add(renderable.geometry);

    if (renderable.material !== undefined) {
      for (const material of Array.isArray(renderable.material) ? renderable.material : [renderable.material]) {
        materials.add(material);
      }
    }
  });

  for (const material of materials) disposeMaterialInto(material, state);

  for (const geometry of state.geometries) geometry.dispose();
}
