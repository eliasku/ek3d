import type { Camera } from "../cameras/Camera";
import type { Object3D } from "./Object3D";
import type { Vector2 } from "../math/Vector2";
import type { Vector3 } from "../math/Vector3";
import { Ray } from "../math/Ray";
import { Layers } from "./Layers";
import { error } from "../utils";

/**
 * The intersection point of a raycaster intersection test.
 * - `distance`: The distance from the ray's origin to the intersection point.
 * - `distanceToRay`: Some 3D objects e.g. {@link Points} provide the distance of the
 * intersection to the nearest point on the ray. For other objects it will be `undefined`.
 * - `point`: The intersection point, in world coordinates.
 * - `face`: The face that has been intersected.
 * - `faceIndex`: The face index.
 * - `object`: The 3D object that has been intersected.
 * - `uv`: U,V coordinates at point of intersection.
 * - `uv1`: Second set of U,V coordinates at point of intersection.
 * - `normal`: Interpolated normal vector at point of intersection.
 * - `instanceId`: The index number of the instance where the ray
 * intersects the {@link InstancedMesh}.
 * - `batchId`: The index number of the instance where the ray
 * intersects the {@link BatchedMesh}.
 */
export interface Intersection {
  distance: number;
  point: Vector3;
  pointOnLine?: Vector3;
  object: Object3D;
  distanceToRay?: number;
  face?: { a: number; b: number; c: number; normal: Vector3; materialIndex: number } | null;
  faceIndex?: number | null;
  index?: number;
  barycoord?: Vector3 | null;
  uv?: Vector2;
  uv1?: Vector2;
  normal?: Vector3;
  instanceId?: number;
  batchId?: number;
}
/**
 * This class is designed to assist with raycasting. Raycasting is used for
 * mouse picking (working out what objects in the 3d space the mouse is over)
 * amongst other things.
 */
export class Raycaster {
  ray: Ray;
  near: number;
  far: number;
  camera: Camera | null;
  layers: Layers;
  params: {
    Mesh: Record<string, unknown>;
    Line: { threshold: number };
    Line2?: { threshold?: number };
    LOD: Record<string, unknown>;
    Points: { threshold: number };
    Sprite: Record<string, unknown>;
  };

  /**
   * Constructs a new raycaster.
   *
   * @param origin - The origin vector where the ray casts from.
   * @param direction - The (normalized) direction vector that gives direction to the ray.
   * @param [near=0] - All results returned are further away than near. Near can't be negative.
   * @param [far=Infinity] - All results returned are closer than far. Far can't be lower than near.
   */
  constructor(origin?: Vector3, direction?: Vector3, near: number = 0, far: number = Infinity) {
    /**
     * The ray used for raycasting.
     *
     */
    this.ray = new Ray(origin, direction);
    /**
     * All results returned are further away than near. Near can't be negative.
     *
     * @default 0
     */
    this.near = near;
    /**
     * All results returned are closer than far. Far can't be lower than near.
     *
     * @default Infinity
     */
    this.far = far;
    /**
     * The camera to use when raycasting against view-dependent objects such as
     * billboarded objects like sprites. This field can be set manually or
     * is set when calling `setFromCamera()`.
     *
     * @default null
     */
    this.camera = null;
    /**
     * Allows to selectively ignore 3D objects when performing intersection tests.
     * The following code example ensures that only 3D objects on layer `1` will be
     * honored by raycaster.
     * ```typescript
     * import { Raycaster } from 'ek3d/core/Raycaster';
     * import { Object3D } from 'ek3d/core/Object3D';
     *
     * const raycaster = new Raycaster();
     * const object = new Object3D();
     * raycaster.layers.set( 1 );
     * object.layers.enable( 1 );
     * ```
     *
     */
    this.layers = new Layers();
    /**
     * A parameter object that configures the raycasting. It has the structure:
     *
     * ```typescript
     * const params = {
     * 	Mesh: {},
     * 	Line: { threshold: 1 },
     * 	LOD: {},
     * 	Points: { threshold: 1 },
     * 	Sprite: {}
     * };
     * ```
     * Where `threshold` is the precision of the raycaster when intersecting objects, in world units.
     *
     */
    this.params = {
      Mesh: {},
      Line: { threshold: 1 },
      LOD: {},
      Points: { threshold: 1 },
      Sprite: {},
    };
  }
  /**
   * Updates the ray with a new origin and direction by copying the values from the arguments.
   *
   * @param origin - The origin vector where the ray casts from.
   * @param direction - The (normalized) direction vector that gives direction to the ray.
   */
  set(origin: Vector3, direction: Vector3) {
    // direction is assumed to be normalized (for accurate distance calculations)
    this.ray.set(origin, direction);
  }
  /**
   * Uses the given coordinates and camera to compute a new origin and direction for the internal ray.
   *
   * @param coords - 2D coordinates of the mouse, in normalized device coordinates (NDC).
   * X and Y components should be between `-1` and `1`.
   * @param camera - The camera from which the ray should originate.
   */
  setFromCamera(coords: Vector2, camera: Camera) {
    if ((camera as any).isPerspectiveCamera) {
      this.ray.origin.setFromMatrixPosition(camera.matrixWorld);
      this.ray.direction.set(coords.x, coords.y, 0.5).unproject(camera).sub(this.ray.origin).normalize();
      this.camera = camera;
    } else if ((camera as any).isOrthographicCamera) {
      this.ray.origin.set(coords.x, coords.y, camera.projectionMatrix.elements[14]).unproject(camera); // set origin in plane of camera
      this.ray.direction.set(0, 0, -1).transformDirection(camera.matrixWorld);
      this.camera = camera;
    } else {
      error("Raycaster: Unsupported camera type: " + camera.type);
    }
  }

  /**
   * Checks all intersection between the ray and the object with or without the
   * descendants. Intersections are returned sorted by distance, closest first.
   *
   * `Raycaster` delegates to the `raycast()` method of the passed 3D object, when
   * evaluating whether the ray intersects the object or not. This allows meshes to respond
   * differently to ray casting than lines or points.
   *
   * Note that for meshes, faces must be pointed towards the origin of the ray in order
   * to be detected; intersections of the ray passing through the back of a face will not
   * be detected. To raycast against both faces of an object, you'll want to set  {@link Material#side}
   * to `THREE.DoubleSide`.
   *
   * Note that a ray hitting a triangle mesh exactly along an edge shared by two faces may be
   * reported by both faces, resulting in two coincident intersections (identical point and
   * distance) in the returned array.
   *
   * @param object - The 3D object to check for intersection with the ray.
   * @param [recursive=true] - If set to `true`, it also checks all descendants.
   * Otherwise it only checks intersection with the object.
   * @param [intersects=[]] The target array that holds the result of the method.
   * @return An array holding the intersection points.
   */
  intersectObject(object: Object3D, recursive: boolean = true, intersects: Intersection[] = []): Intersection[] {
    intersect(object, this, intersects, recursive);
    intersects.sort(ascSort);
    return intersects;
  }
  /**
   * Checks all intersection between the ray and the objects with or without
   * the descendants. Intersections are returned sorted by distance, closest first.
   *
   * @param objects - The 3D objects to check for intersection with the ray.
   * @param [recursive=true] - If set to `true`, it also checks all descendants.
   * Otherwise it only checks intersection with the object.
   * @param [intersects=[]] The target array that holds the result of the method.
   * @return An array holding the intersection points.
   */
  intersectObjects(objects: Object3D[], recursive: boolean = true, intersects: Intersection[] = []): Intersection[] {
    for (let i = 0, l = objects.length; i < l; i++) {
      intersect(objects[i], this, intersects, recursive);
    }
    intersects.sort(ascSort);
    return intersects;
  }
}
function ascSort(a: Intersection, b: Intersection) {
  return a.distance - b.distance;
}
function intersect(object: Object3D, raycaster: Raycaster, intersects: Intersection[], recursive: boolean) {
  let propagate = true;
  if (object.layers.test(raycaster.layers)) {
    const result = object.raycast(raycaster, intersects);
    if (result === false) propagate = false;
  }
  if (propagate === true && recursive === true) {
    const children = object.children;
    for (let i = 0, l = children.length; i < l; i++) {
      intersect(children[i], raycaster, intersects, true);
    }
  }
}
