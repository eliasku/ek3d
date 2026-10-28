import type { Camera } from "../cameras/Camera";
import type { Intersection } from "../core/Raycaster";
import type { Raycaster } from "../core/Raycaster";
import { Vector3 } from "../math/Vector3";
import { Object3D } from "../core/Object3D";

export interface LODLevel {
  object: Object3D;
  distance: number;
  hysteresis: number;
}
const _v1 = /*@__PURE__*/ new Vector3();
const _v2 = /*@__PURE__*/ new Vector3();
/**
 * A component for providing a basic Level of Detail (LOD) mechanism.
 *
 * Every LOD level is associated with an object, and rendering can be switched
 * between them at the distances specified. Typically you would create, say,
 * three meshes, one for far away (low detail), one for mid range (medium
 * detail) and one for close up (high detail).
 *
 * ```typescript
 * import { IcosahedronGeometry } from 'ek3d/geometries/IcosahedronGeometry';
 * import { LOD } from 'ek3d/objects/LOD';
 * import { Mesh } from 'ek3d/objects/Mesh';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 *
 * const lod = new LOD();
 * const material = new MeshBasicMaterial( { color: 0xffff00 } );
 *
 * //Create spheres with 3 levels of detail and create new LOD levels for them
 * for( let i = 0; i < 3; i++ ) {
 *
 * 	const geometry = new IcosahedronGeometry( 10, 3 - i );
 * 	const mesh = new Mesh( geometry, material );
 * 	lod.addLevel( mesh, i * 75 );
 *
 * }
 *
 * scene.add( lod );
 * ```
 *
 */
export class LOD extends Object3D {
  isLOD: boolean;
  _currentLevel: number;

  autoUpdate: boolean;
  readonly levels: LODLevel[] = [];

  /**
   * Constructs a new LOD.
   */
  constructor() {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isLOD = true;
    /**
     * The current LOD index.
     *
     * @private
     * @default 0
     */
    this._currentLevel = 0;
    this.type = "LOD";
    Object.defineProperties(this, {
      /**
       * This array holds the LOD levels.
       *
       * @name LOD#levels
       */
      levels: {
        enumerable: true,
        value: this.levels,
        writable: false,
        configurable: false,
      },
    });
    /**
     * Whether the LOD object is updated automatically by the renderer per frame
     * or not. If set to `false`, you have to call {@link LOD#update} in the
     * render loop by yourself.
     *
     * @default true
     */
    this.autoUpdate = true;
  }
  copy(source: LOD): this {
    super.copy(source, false);
    const levels = (source as any).levels;
    for (let i = 0, l = levels.length; i < l; i++) {
      const level = levels[i];
      this.addLevel(level.object.clone(), level.distance, level.hysteresis);
    }
    this.autoUpdate = source.autoUpdate;
    return this;
  }
  /**
   * Adds a mesh that will display at a certain distance and greater. Typically
   * the further away the distance, the lower the detail on the mesh.
   *
   * @param object - The 3D object to display at this level.
   * @param [distance=0] - The distance at which to display this level of detail.
   * @param [hysteresis=0] - Threshold used to avoid flickering at LOD boundaries, as a fraction of distance.
   * @return A reference to this instance.
   */
  addLevel(object: Object3D, distance: number = 0, hysteresis: number = 0): this {
    distance = Math.abs(distance);
    const levels = (this as any).levels;
    let l: any;
    for (l = 0; l < levels.length; l++) {
      if (distance < levels[l].distance) {
        break;
      }
    }
    levels.splice(l, 0, { distance: distance, hysteresis: hysteresis, object: object });
    this.add(object);
    return this;
  }
  /**
   * Removes an existing level, based on the distance from the camera.
   * Returns `true` when the level has been removed. Otherwise `false`.
   *
   * @param distance - Distance of the level to remove.
   * @return Whether the level has been removed or not.
   */
  removeLevel(distance: number): boolean {
    const levels = (this as any).levels;
    for (let i = 0; i < levels.length; i++) {
      if (levels[i].distance === distance) {
        const removedElements = levels.splice(i, 1);
        this.remove(removedElements[0].object);
        return true;
      }
    }
    return false;
  }
  /**
   * Returns the currently active LOD level index.
   *
   * @return The current active LOD level index.
   */
  getCurrentLevel(): number {
    return this._currentLevel;
  }
  /**
   * Returns a reference to the first 3D object that is greater than
   * the given distance.
   *
   * @param distance - The LOD distance.
   * @return The found 3D object. `null` if no 3D object has been found.
   */
  getObjectForDistance(distance: number): Object3D | null {
    const levels = (this as any).levels;
    if (levels.length > 0) {
      let i: any, l: any;
      for (i = 1, l = levels.length; i < l; i++) {
        let levelDistance = levels[i].distance;
        if (levels[i].object.visible) {
          levelDistance -= levelDistance * levels[i].hysteresis;
        }
        if (distance < levelDistance) {
          break;
        }
      }
      return levels[i - 1].object;
    }
    return null;
  }
  /**
   * Computes intersection points between a casted ray and this LOD.
   *
   * @param raycaster - The raycaster.
   * @param intersects - The target array that holds the intersection points.
   */
  raycast(raycaster: Raycaster, intersects: Intersection[]) {
    const levels = (this as any).levels;
    if (levels.length > 0) {
      _v1.setFromMatrixPosition(this.matrixWorld);
      const distance = raycaster.ray.origin.distanceTo(_v1);
      this.getObjectForDistance(distance)!.raycast(raycaster, intersects);
    }
  }
  /**
   * Updates the LOD by computing which LOD level should be visible according
   * to the current distance of the given camera.
   *
   * @param camera - The camera the scene is rendered with.
   */
  update(camera: Camera & { zoom: number }) {
    const levels = (this as any).levels;
    if (levels.length > 1) {
      _v1.setFromMatrixPosition(camera.matrixWorld);
      _v2.setFromMatrixPosition(this.matrixWorld);
      const distance = _v1.distanceTo(_v2) / camera.zoom;
      levels[0].object.visible = true;
      let i: any, l: any;
      for (i = 1, l = levels.length; i < l; i++) {
        let levelDistance = levels[i].distance;
        if (levels[i].object.visible) {
          levelDistance -= levelDistance * levels[i].hysteresis;
        }
        if (distance >= levelDistance) {
          levels[i - 1].object.visible = false;
          levels[i].object.visible = true;
        } else {
          break;
        }
      }
      this._currentLevel = i - 1;
      for (; i < l; i++) {
        levels[i].object.visible = false;
      }
    }
  }
  toJSON(meta?: any) {
    const data = super.toJSON(meta);
    data.object.autoUpdate = this.autoUpdate;
    data.object.levels = [];
    const levels = (this as any).levels;
    for (let i = 0, l = levels.length; i < l; i++) {
      const level = levels[i];
      data.object.levels.push({
        object: level.object.uuid,
        distance: level.distance,
        hysteresis: level.hysteresis,
      });
    }
    return data;
  }
}
