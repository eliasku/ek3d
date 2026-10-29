import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import type { BufferAttribute } from "../../core/BufferAttribute";
import { Mesh } from "../../objects/Mesh";
import { SphereGeometry } from "../../geometries/SphereGeometry";
import { Vector3 } from "../../math/Vector3";
import type { Texture } from "../../textures/Texture";

/**
 * A ground-projected skybox.
 *
 * By default the object is centered at the camera, so it is often helpful to set
 * `skybox.position.y = height` to put the ground at the origin.
 *
 * ```ts
 * const height = 15, radius = 100;
 *
 * const skybox = new GroundedSkybox( envMap, height, radius );
 * skybox.position.y = height;
 * scene.add( skybox );
 * ```
 *
 * @augments Mesh
 */
export class GroundedSkybox extends Mesh<MeshBasicMaterial> {
  /**
   * Constructs a new ground-projected skybox.
   *
   * @param map - The environment map to use.
   * @param height - The height is how far the camera that took the photo was above the ground.
   * A larger value will magnify the downward part of the image.
   * @param radius - The radius of the skybox. Must be large enough to ensure the scene's camera stays inside.
   * @param resolution - The geometry resolution of the skybox.
   */
  constructor(map: Texture, height: number, radius: number, resolution: number = 128) {
    if (height <= 0 || radius <= 0 || resolution <= 0) {
      throw new Error("THREE.GroundedSkybox: height, radius, and resolution must be positive.");
    }

    const geometry = new SphereGeometry(radius, 2 * resolution, resolution);
    geometry.scale(1, 1, -1);

    const pos = geometry.getAttribute("position") as BufferAttribute;
    const tmp = new Vector3();

    for (let i = 0; i < pos.count; ++i) {
      tmp.fromBufferAttribute(pos, i);
      if (tmp.y < 0) {
        // Smooth out the transition from flat floor to sphere:
        const y1 = (-height * 3) / 2;
        const f = tmp.y < y1 ? -height / tmp.y : 1 - (tmp.y * tmp.y) / (3 * y1 * y1);
        tmp.multiplyScalar(f);
        tmp.toArray(pos.array, 3 * i);
      }
    }

    pos.needsUpdate = true;

    super(geometry, new MeshBasicMaterial({ map, depthWrite: false }));
  }
}
