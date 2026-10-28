import { BufferGeometry } from "../../core/BufferGeometry";
import type { Object3D } from "../../core/Object3D";
import { Mesh } from "../../objects/Mesh";

const raycastMesh = Symbol("needle:raycast-mesh");
type RaycastObject = Object3D & { [raycastMesh]?: BufferGeometry };

/** Returns the low-poly geometry registered for an object, if present. */
export function getRaycastMesh(obj: Object3D): BufferGeometry | null {
  const geometry = (obj as RaycastObject)[raycastMesh];
  return geometry instanceof BufferGeometry ? geometry : null;
}

/** Keeps the first low-poly geometry for subsequent raycasts. */
export function registerRaycastMesh(obj: Object3D, geom: BufferGeometry): void {
  if ((obj.type !== "Mesh" && obj.type !== "SkinnedMesh") || getRaycastMesh(obj)) return;
  const clone = new BufferGeometry();
  for (const key in geom.attributes) clone.setAttribute(key, geom.attributes[key]);
  const index = geom.getIndex();
  if (index) clone.setIndex(index);
  clone.userData = { isRaycastMesh: true };
  (obj as RaycastObject)[raycastMesh] = clone;
}

let originalRaycast: typeof Mesh.prototype.raycast | null = null;

/** Enables or disables raycasting against registered low-poly geometries globally. */
export function useRaycastMeshes(enabled: boolean = true): void {
  if (enabled) {
    if (originalRaycast) return;
    const original = (originalRaycast = Object.getOwnPropertyDescriptor(Mesh.prototype, "raycast")!
      .value as typeof Mesh.prototype.raycast);
    Mesh.prototype.raycast = function (raycaster, intersects) {
      const proxy = getRaycastMesh(this);
      if (!proxy || !this.isMesh) {
        original.call(this, raycaster, intersects);
        return;
      }
      const geometry = this.geometry;
      this.geometry = proxy;
      try {
        original.call(this, raycaster, intersects);
      } finally {
        this.geometry = geometry;
      }
    };
  } else if (originalRaycast) {
    Mesh.prototype.raycast = originalRaycast;
    originalRaycast = null;
  }
}
