import type { Color } from "../math/Color";
import { Float32BufferAttribute } from "../core/BufferAttribute";
import { BufferGeometry } from "../core/BufferGeometry";
import { Object3D } from "../core/Object3D";
import { ConeGeometry } from "../geometries/ConeGeometry";
import { MeshBasicMaterial } from "../materials/MeshBasicMaterial";
import { LineBasicMaterial } from "../materials/LineBasicMaterial";
import { Mesh } from "../objects/Mesh";
import { Line } from "../objects/Line";
import { Vector3 } from "../math/Vector3";
const _axis = /*@__PURE__*/ new Vector3();
let _lineGeometry: any, _coneGeometry: any;
/**
 * An 3D arrow object for visualizing directions.
 *
 * ```typescript
 * import { ArrowHelper } from 'ek3d/helpers/ArrowHelper';
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { Vector3 } from 'ek3d/math/Vector3';
 *
 * const scene = new Scene();
 *
 * const dir = new Vector3( 1, 2, 0 );
 *
 * //normalize the direction vector (convert to vector of length 1)
 * dir.normalize();
 *
 * const origin = new Vector3( 0, 0, 0 );
 * const length = 1;
 * const hex = 0xffff00;
 *
 * const arrowHelper = new ArrowHelper( dir, origin, length, hex );
 * scene.add( arrowHelper );
 * ```
 *
 */
export class ArrowHelper extends Object3D {
  line: Line & { material: LineBasicMaterial };
  cone: Mesh & { material: MeshBasicMaterial };

  /**
   * Constructs a new arrow helper.
   *
   * @param [dir=(0, 0, 1)] - The (normalized) direction vector.
   * @param [origin=(0, 0, 0)] - Point at which the arrow starts.
   * @param [length=1] - Length of the arrow in world units.
   * @param [color=0xffff00] - Color of the arrow.
   * @param [headLength=length*0.2] - The length of the head of the arrow.
   * @param [headWidth=headLength*0.2] - The width of the head of the arrow.
   */
  constructor(
    dir: Vector3 = new Vector3(0, 0, 1),
    origin: Vector3 = new Vector3(0, 0, 0),
    length: number = 1,
    color: Color | string | number = 0xffff00,
    headLength: number = length * 0.2,
    headWidth: number = headLength * 0.2,
  ) {
    super();
    this.type = "ArrowHelper";
    if (_lineGeometry === undefined) {
      _lineGeometry = new BufferGeometry();
      _lineGeometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3));
      _coneGeometry = new ConeGeometry(0.5, 1, 5, 1);
      _coneGeometry.translate(0, -0.5, 0);
    }
    (this as any).position.copy(origin);
    /**
     * The line part of the arrow helper.
     *
     */
    this.line = new Line(_lineGeometry, new LineBasicMaterial({ color: color, toneMapped: false })) as Line & {
      material: LineBasicMaterial;
    };
    this.line.matrixAutoUpdate = false;
    this.add(this.line);
    /**
     * The cone part of the arrow helper.
     *
     */
    this.cone = new Mesh(_coneGeometry, new MeshBasicMaterial({ color: color, toneMapped: false })) as Mesh & {
      material: MeshBasicMaterial;
    };
    this.cone.matrixAutoUpdate = false;
    this.add(this.cone);
    this.setDirection(dir);
    this.setLength(length, headLength, headWidth);
  }
  /**
   * Sets the direction of the helper.
   *
   * @param dir - The normalized direction vector.
   */
  setDirection(dir: Vector3) {
    // dir is assumed to be normalized
    if (dir.y > 0.99999) {
      (this as any).quaternion.set(0, 0, 0, 1);
    } else if (dir.y < -0.99999) {
      (this as any).quaternion.set(1, 0, 0, 0);
    } else {
      _axis.set(dir.z, 0, -dir.x).normalize();
      const radians = Math.acos(dir.y);
      (this as any).quaternion.setFromAxisAngle(_axis, radians);
    }
  }
  /**
   * Sets the length of the helper.
   *
   * @param length - Length of the arrow in world units.
   * @param [headLength=length*0.2] - The length of the head of the arrow.
   * @param [headWidth=headLength*0.2] - The width of the head of the arrow.
   */
  setLength(length: number, headLength: number = length * 0.2, headWidth: number = headLength * 0.2) {
    (this.line as any).scale.set(1, Math.max(0.0001, length - headLength), 1); // see #17458
    this.line.updateMatrix();
    (this.cone as any).scale.set(headWidth, headLength, headWidth);
    (this.cone as any).position.y = length;
    this.cone.updateMatrix();
  }
  /**
   * Sets the color of the helper.
   *
   * @param color - The color to set.
   */
  setColor(color: Color | string | number): void;
  setColor(color?: Color | string | number) {
    this.line.material.color.set(color);
    this.cone.material.color.set(color);
  }
  copy(source: Object3D): this {
    super.copy(source, false);
    this.line.copy((source as ArrowHelper).line);
    this.cone.copy((source as ArrowHelper).cone);
    return this;
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   */
  dispose() {
    super.dispose();
    this.line.geometry.dispose();
    this.line.material.dispose();
    this.cone.geometry.dispose();
    this.cone.material.dispose();
  }
}
