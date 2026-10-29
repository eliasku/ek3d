import type { BufferAttribute } from "../core/BufferAttribute";
import type { Bone } from "../objects/Bone";
import type { Object3D } from "../core/Object3D";
import { LineSegments } from "../objects/LineSegments";
import { Matrix4 } from "../math/Matrix4";
import { LineBasicMaterial } from "../materials/LineBasicMaterial";
import { Color } from "../math/Color";
import { Vector3 } from "../math/Vector3";
import { BufferGeometry } from "../core/BufferGeometry";
import { Float32BufferAttribute } from "../core/BufferAttribute";
const _vector = /*@__PURE__*/ new Vector3();
const _boneMatrix = /*@__PURE__*/ new Matrix4();
const _matrixWorldInv = /*@__PURE__*/ new Matrix4();
/**
 * A helper object to assist with visualizing a {@link Skeleton}.
 *
 * ```ts
 * import { Bone } from 'ek3d/objects/Bone';
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { SkeletonHelper } from 'ek3d/helpers/SkeletonHelper';
 *
 * const scene = new Scene();
 * const root = new Bone();
 * const child = new Bone();
 * child.position.y = 5;
 * root.add( child );
 *
 * const helper = new SkeletonHelper( root );
 * scene.add( helper );
 * ```
 *
 */
export class SkeletonHelper extends LineSegments<LineBasicMaterial> {
  isSkeletonHelper: boolean;

  root: Object3D;
  bones: Bone[];

  /**
   * Constructs a new skeleton helper.
   *
   * @param object -  Usually an instance of {@link SkinnedMesh}. However, any 3D object
   * can be used if it represents a hierarchy of bones (see {@link Bone}).
   */
  constructor(object: Object3D) {
    const bones = getBoneList(object);
    const geometry = new BufferGeometry();
    const vertices: any[] = [];
    const colors: any[] = [];
    for (let i = 0; i < bones.length; i++) {
      const bone = bones[i];
      if (bone.parent && (bone.parent as Bone).isBone) {
        vertices.push(0, 0, 0);
        vertices.push(0, 0, 0);
        colors.push(0, 0, 0);
        colors.push(0, 0, 0);
      }
    }
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    const material = new LineBasicMaterial({
      vertexColors: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      transparent: true,
    });
    super(geometry, material);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isSkeletonHelper = true;
    this.type = "SkeletonHelper";
    /**
     * The object being visualized.
     *
     */
    this.root = object;
    /**
     * The list of bones that the helper visualizes.
     *
     */
    this.bones = bones;
    this.matrix = object.matrixWorld;
    this.matrixAutoUpdate = false;
    // colors
    const color1 = new Color(0x0000ff);
    const color2 = new Color(0x00ff00);
    this.setColors(color1, color2);
  }
  updateMatrixWorld(force?: boolean) {
    const bones = this.bones;
    const geometry = this.geometry;
    const position = geometry.getAttribute("position") as BufferAttribute;
    _matrixWorldInv.copy(this.root.matrixWorld).invert();
    for (let i = 0, j = 0; i < bones.length; i++) {
      const bone = bones[i];
      if (bone.parent && (bone.parent as Bone).isBone) {
        _boneMatrix.multiplyMatrices(_matrixWorldInv, bone.matrixWorld);
        _vector.setFromMatrixPosition(_boneMatrix);
        position.setXYZ(j, _vector.x, _vector.y, _vector.z);
        _boneMatrix.multiplyMatrices(_matrixWorldInv, bone.parent.matrixWorld);
        _vector.setFromMatrixPosition(_boneMatrix);
        position.setXYZ(j + 1, _vector.x, _vector.y, _vector.z);
        j += 2;
      }
    }
    (geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
    super.updateMatrixWorld(force);
  }
  /**
   * Defines the colors of the helper.
   *
   * @param color1 - The first line color for each bone.
   * @param color2 - The second line color for each bone.
   * @return A reference to this helper.
   */
  setColors(color1: Color, color2: Color): this {
    const geometry = this.geometry;
    const colorAttribute = geometry.getAttribute("color") as BufferAttribute;
    for (let i = 0; i < colorAttribute.count; i += 2) {
      colorAttribute.setXYZ(i, color1.r, color1.g, color1.b);
      colorAttribute.setXYZ(i + 1, color2.r, color2.g, color2.b);
    }
    colorAttribute.needsUpdate = true;
    return this;
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   */
  dispose() {
    super.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
  clone(recursive: boolean = true): this {
    return new (this.constructor as any)().copy(this, recursive);
  }
}
function getBoneList(object: Object3D) {
  const boneList: Bone[] = [];
  if ((object as Bone).isBone === true) {
    boneList.push(object as Bone);
  }
  for (let i = 0; i < object.children.length; i++) {
    boneList.push(...getBoneList(object.children[i]));
  }
  return boneList;
}
