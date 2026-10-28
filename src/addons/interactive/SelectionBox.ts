import { OrthographicCamera } from "../../cameras/OrthographicCamera";
import { Frustum } from "../../math/Frustum";
import { Matrix4 } from "../../math/Matrix4";
import { Quaternion } from "../../math/Quaternion";
import { Vector3 } from "../../math/Vector3";
import type { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import type { Sphere } from "../../math/Sphere";
import type { Object3D } from "../../core/Object3D";
import type { BatchedMesh } from "../../objects/BatchedMesh";
import type { InstancedMesh } from "../../objects/InstancedMesh";
import type { Scene } from "../../scenes/Scene";

const _frustum = new Frustum();
const _center = new Vector3();

const _tmpPoint = new Vector3();

const _vecNear = new Vector3();
const _vecTopLeft = new Vector3();
const _vecTopRight = new Vector3();
const _vecDownRight = new Vector3();
const _vecDownLeft = new Vector3();

const _vecFarTopLeft = new Vector3();
const _vecFarTopRight = new Vector3();
const _vecFarDownRight = new Vector3();
const _vecFarDownLeft = new Vector3();

const _vectemp1 = new Vector3();
const _vectemp2 = new Vector3();
const _vectemp3 = new Vector3();

const _matrix = new Matrix4();
const _quaternion = new Quaternion();
const _scale = new Vector3();

/** The camera types whose selection frustum can be built. */
type SelectionCamera = PerspectiveCamera | OrthographicCamera;

/**
 * This class can be used to select 3D objects in a scene with a selection box.
 * It is recommended to visualize the selected area with the help of {@link SelectionHelper}.
 *
 * ```typescript
 * const selectionBox = new SelectionBox( camera, scene );
 * const selectedObjects = selectionBox.select( startPoint, endPoint );
 * ```
 */
export class SelectionBox {
  /**
   * The camera the scene is rendered with.
   */
  camera: SelectionCamera;

  /**
   * The scene.
   */
  scene: Scene;

  /**
   * The start point of the selection.
   */
  startPoint: Vector3;

  /**
   * The end point of the selection.
   */
  endPoint: Vector3;

  /**
   * The selected 3D objects.
   */
  collection: Object3D[];

  /**
   * The selected instance IDs of instanced meshes.
   */
  instances: Record<string, number[]>;

  /**
   * The selected batches of batched meshes.
   */
  batches: Record<string, number[]>;

  /**
   * How deep the selection frustum of perspective cameras should extend.
   */
  deep: number;

  /**
   * Constructs a new selection box.
   *
   * @param camera - The camera the scene is rendered with.
   * @param scene - The scene.
   * @param deep - How deep the selection frustum of perspective cameras should extend.
   */
  constructor(camera: SelectionCamera, scene: Scene, deep: number = Number.MAX_VALUE) {
    this.camera = camera;
    this.scene = scene;
    this.startPoint = new Vector3();
    this.endPoint = new Vector3();
    this.collection = [];
    this.instances = {};
    this.batches = {};
    this.deep = deep;
  }

  /**
   * This method selects 3D objects in the scene based on the given start
   * and end point. If no parameters are provided, the method uses the start
   * and end values of the respective members.
   *
   * @param startPoint - The start point.
   * @param endPoint - The end point.
   * @return The selected 3D objects.
   */
  select(startPoint?: Vector3, endPoint?: Vector3): Object3D[] {
    this.startPoint = startPoint ?? this.startPoint;
    this.endPoint = endPoint ?? this.endPoint;
    this.collection = [];

    this._updateFrustum(this.startPoint, this.endPoint);
    this._searchChildInFrustum(_frustum, this.scene);

    return this.collection;
  }

  // private

  _updateFrustum(startPoint?: Vector3, endPoint?: Vector3): void {
    const start = startPoint ?? this.startPoint;
    const end = endPoint ?? this.endPoint;

    // Avoid invalid frustum

    if (start.x === end.x) {
      end.x += Number.EPSILON;
    }

    if (start.y === end.y) {
      end.y += Number.EPSILON;
    }

    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();

    if (this.camera.isPerspectiveCamera) {
      _tmpPoint.copy(start);
      _tmpPoint.x = Math.min(start.x, end.x);
      _tmpPoint.y = Math.max(start.y, end.y);
      end.x = Math.max(start.x, end.x);
      end.y = Math.min(start.y, end.y);

      _vecNear.setFromMatrixPosition(this.camera.matrixWorld);
      _vecTopLeft.copy(_tmpPoint);
      _vecTopRight.set(end.x, _tmpPoint.y, 0);
      _vecDownRight.copy(end);
      _vecDownLeft.set(_tmpPoint.x, end.y, 0);

      _vecTopLeft.unproject(this.camera);
      _vecTopRight.unproject(this.camera);
      _vecDownRight.unproject(this.camera);
      _vecDownLeft.unproject(this.camera);

      _vectemp1.copy(_vecTopLeft).sub(_vecNear);
      _vectemp2.copy(_vecTopRight).sub(_vecNear);
      _vectemp3.copy(_vecDownRight).sub(_vecNear);
      _vectemp1.normalize();
      _vectemp2.normalize();
      _vectemp3.normalize();

      _vectemp1.multiplyScalar(this.deep);
      _vectemp2.multiplyScalar(this.deep);
      _vectemp3.multiplyScalar(this.deep);
      _vectemp1.add(_vecNear);
      _vectemp2.add(_vecNear);
      _vectemp3.add(_vecNear);

      const planes = _frustum.planes;

      planes[0].setFromCoplanarPoints(_vecNear, _vecTopLeft, _vecTopRight);
      planes[1].setFromCoplanarPoints(_vecNear, _vecTopRight, _vecDownRight);
      planes[2].setFromCoplanarPoints(_vecDownRight, _vecDownLeft, _vecNear);
      planes[3].setFromCoplanarPoints(_vecDownLeft, _vecTopLeft, _vecNear);
      planes[4].setFromCoplanarPoints(_vecTopRight, _vecDownRight, _vecDownLeft);
      planes[5].setFromCoplanarPoints(_vectemp3, _vectemp2, _vectemp1);
      planes[5].normal.multiplyScalar(-1);
    } else if (this.camera.type === "OrthographicCamera") {
      const left = Math.min(start.x, end.x);
      const top = Math.max(start.y, end.y);
      const right = Math.max(start.x, end.x);
      const down = Math.min(start.y, end.y);

      _vecTopLeft.set(left, top, -1);
      _vecTopRight.set(right, top, -1);
      _vecDownRight.set(right, down, -1);
      _vecDownLeft.set(left, down, -1);

      _vecFarTopLeft.set(left, top, 1);
      _vecFarTopRight.set(right, top, 1);
      _vecFarDownRight.set(right, down, 1);
      _vecFarDownLeft.set(left, down, 1);

      _vecTopLeft.unproject(this.camera);
      _vecTopRight.unproject(this.camera);
      _vecDownRight.unproject(this.camera);
      _vecDownLeft.unproject(this.camera);

      _vecFarTopLeft.unproject(this.camera);
      _vecFarTopRight.unproject(this.camera);
      _vecFarDownRight.unproject(this.camera);
      _vecFarDownLeft.unproject(this.camera);

      const planes = _frustum.planes;

      planes[0].setFromCoplanarPoints(_vecTopLeft, _vecFarTopLeft, _vecFarTopRight);
      planes[1].setFromCoplanarPoints(_vecTopRight, _vecFarTopRight, _vecFarDownRight);
      planes[2].setFromCoplanarPoints(_vecFarDownRight, _vecFarDownLeft, _vecDownLeft);
      planes[3].setFromCoplanarPoints(_vecFarDownLeft, _vecFarTopLeft, _vecTopLeft);
      planes[4].setFromCoplanarPoints(_vecTopRight, _vecDownRight, _vecDownLeft);
      planes[5].setFromCoplanarPoints(_vecFarDownRight, _vecFarTopRight, _vecFarTopLeft);
      planes[5].normal.multiplyScalar(-1);
    } else {
      console.error("THREE.SelectionBox: Unsupported camera type.");
    }
  }

  _searchChildInFrustum(frustum: Frustum, object: Object3D): void {
    const meshLike = object as Object3D & {
      isMesh?: boolean | undefined;
      isLine?: boolean | undefined;
      isPoints?: boolean | undefined;
      isInstancedMesh?: boolean | undefined;
      isBatchedMesh?: boolean | undefined;
      geometry?: { boundingSphere: Sphere | null; computeBoundingSphere(): void };
      getMatrixAt(instanceId: number, matrix: Matrix4): void;
      count?: number | undefined;
    };

    if (meshLike.isMesh || meshLike.isLine || meshLike.isPoints) {
      if ((meshLike as { isInstancedMesh?: boolean }).isInstancedMesh) {
        const instanced = object as InstancedMesh;

        this.instances[instanced.uuid] = [];

        for (let instanceId = 0; instanceId < instanced.count; instanceId++) {
          instanced.getMatrixAt(instanceId, _matrix);
          _matrix.decompose(_center, _quaternion, _scale);
          _center.applyMatrix4(instanced.matrixWorld);

          if (frustum.containsPoint(_center)) {
            this.instances[instanced.uuid].push(instanceId);
          }
        }
      } else if ((meshLike as { isBatchedMesh?: boolean }).isBatchedMesh) {
        const batched = object as BatchedMesh;

        this.batches[batched.uuid] = [];

        for (let instanceId = 0, count = 0; count < batched.instanceCount; instanceId++) {
          // skip invalid instances in the batchedMesh

          if ((batched.validateInstanceId(instanceId) as unknown as boolean) === false) continue;

          count++;

          batched.getMatrixAt(instanceId, _matrix);
          _matrix.decompose(_center, _quaternion, _scale);
          _center.applyMatrix4(batched.matrixWorld);

          if (frustum.containsPoint(_center)) {
            this.batches[batched.uuid].push(instanceId);
          }
        }
      } else {
        const geometry = meshLike.geometry!;
        if (geometry.boundingSphere === null) geometry.computeBoundingSphere();

        _center.copy(geometry.boundingSphere!.center);

        _center.applyMatrix4(object.matrixWorld);

        if (frustum.containsPoint(_center)) {
          this.collection.push(object);
        }
      }
    }

    if (object.children.length > 0) {
      for (let x = 0; x < object.children.length; x++) {
        this._searchChildInFrustum(frustum, object.children[x]);
      }
    }
  }
}
