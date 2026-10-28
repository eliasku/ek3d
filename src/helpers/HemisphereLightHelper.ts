import type { HemisphereLight } from "../lights/HemisphereLight";
import { Vector3 } from "../math/Vector3";
import { Color } from "../math/Color";
import { Object3D } from "../core/Object3D";
import { Mesh } from "../objects/Mesh";
import { MeshBasicMaterial } from "../materials/MeshBasicMaterial";
import { OctahedronGeometry } from "../geometries/OctahedronGeometry";
import { BufferAttribute } from "../core/BufferAttribute";
const _vector = /*@__PURE__*/ new Vector3();
const _color1 = /*@__PURE__*/ new Color();
const _color2 = /*@__PURE__*/ new Color();
/**
 * Creates a visual aid consisting of a spherical mesh for a
 * given {@link HemisphereLight}.
 *
 * When the hemisphere light is transformed or its light properties are changed,
 * it's necessary to call the `update()` method of the respective helper.
 *
 * ```typescript
 * import { HemisphereLight } from 'ek3d/lights/HemisphereLight';
 * import { HemisphereLightHelper } from 'ek3d/helpers/HemisphereLightHelper';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 *
 * const light = new HemisphereLight( 0xffffbb, 0x080820, 1 );
 * const helper = new HemisphereLightHelper( light, 5 );
 * scene.add( helper );
 * ```
 *
 */
export class HemisphereLightHelper extends Object3D {
  light: HemisphereLight;
  material: MeshBasicMaterial;

  color: Color | string | number | undefined;

  /**
   * Constructs a new hemisphere light helper.
   *
   * @param light - The light to be visualized.
   * @param [size=1] - The size of the mesh used to visualize the light.
   * @param [color] - The helper's color. If not set, the helper will take
   * the color of the light.
   */
  constructor(light: HemisphereLight, size?: number, color?: Color | string | number) {
    super();
    /**
     * The light being visualized.
     *
     */
    this.light = light;
    this.matrix = light.matrixWorld;
    this.matrixAutoUpdate = false;
    /**
     * The color parameter passed in the constructor.
     * If not set, the helper will take the color of the light.
     *
     */
    this.color = color;
    this.type = "HemisphereLightHelper";
    const geometry = new OctahedronGeometry(size);
    geometry.rotateY(Math.PI * 0.5);
    this.material = new MeshBasicMaterial({ wireframe: true, fog: false, toneMapped: false });
    if (this.color === undefined) this.material.vertexColors = true;
    const position = geometry.getAttribute("position") as BufferAttribute;
    const colors = new Float32Array(position.count * 3);
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    this.add(new Mesh(geometry, this.material) as Mesh & { material: MeshBasicMaterial });
    this.update();
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   */
  dispose() {
    super.dispose();
    (this.children[0] as Mesh & { material: MeshBasicMaterial } as any).geometry.dispose();
    (this.children[0] as Mesh & { material: MeshBasicMaterial } as any).material.dispose();
  }
  /**
   * Updates the helper to match the position and direction of the
   * light being visualized.
   */
  update() {
    const mesh = this.children[0] as Mesh & { material: MeshBasicMaterial };
    if (this.color !== undefined) {
      this.material.color.set(this.color);
    } else {
      const colors = (mesh as any).geometry.getAttribute("color") as BufferAttribute;
      _color1.copy(this.light.color);
      _color2.copy(this.light.groundColor);
      for (let i = 0, l = colors.count; i < l; i++) {
        const color = i < l / 2 ? _color1 : _color2;
        colors.setXYZ(i, color.r, color.g, color.b);
      }
      colors.needsUpdate = true;
    }
    this.matrixWorldNeedsUpdate = true;
    this.light.updateWorldMatrix(true, false);
    mesh.lookAt(_vector.setFromMatrixPosition(this.light.matrixWorld).negate());
  }
}
