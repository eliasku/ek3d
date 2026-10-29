import { Material } from "./Material";
import { Color } from "../math/Color";

export type ShadowMaterialParameters = Omit<
  Partial<
    Pick<
      ShadowMaterial,
      | "isShadowMaterial"
      | "type"
      | "color"
      | "transparent"
      | "fog"
      | "isMaterial"
      | "uuid"
      | "name"
      | "blending"
      | "side"
      | "vertexColors"
      | "opacity"
      | "alphaHash"
      | "blendSrc"
      | "blendDst"
      | "blendEquation"
      | "blendSrcAlpha"
      | "blendDstAlpha"
      | "blendEquationAlpha"
      | "blendColor"
      | "blendAlpha"
      | "depthFunc"
      | "depthTest"
      | "depthWrite"
      | "stencilWriteMask"
      | "stencilFunc"
      | "stencilRef"
      | "stencilFuncMask"
      | "stencilFail"
      | "stencilZFail"
      | "stencilZPass"
      | "stencilWrite"
      | "clippingPlanes"
      | "clipIntersection"
      | "clipShadows"
      | "shadowSide"
      | "colorWrite"
      | "precision"
      | "polygonOffset"
      | "polygonOffsetFactor"
      | "polygonOffsetUnits"
      | "dithering"
      | "alphaToCoverage"
      | "premultipliedAlpha"
      | "forceSinglePass"
      | "allowOverride"
      | "visible"
      | "toneMapped"
      | "userData"
      | "version"
      | "alphaTest"
      | "needsUpdate"
    >
  >,
  "color"
> & { color?: Color | number | string };
/**
 * This material can receive shadows, but otherwise is completely transparent.
 *
 * ```ts
 * import { PlaneGeometry } from 'ek3d/geometries/PlaneGeometry';
 * import { ShadowMaterial } from 'ek3d/materials/ShadowMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 * const geometry = new PlaneGeometry( 2000, 2000 );
 * geometry.rotateX( - Math.PI / 2 );
 *
 * const material = new ShadowMaterial();
 * material.opacity = 0.2;
 *
 * const plane = new Mesh( geometry, material );
 * plane.position.y = -200;
 * plane.receiveShadow = true;
 * scene.add( plane );
 * ```
 *
 */
export class ShadowMaterial extends Material {
  isShadowMaterial: boolean;

  color: Color;

  fog: boolean;

  /**
   * Constructs a new shadow material.
   *
   * @param [parameters] - An object with one or more properties
   * defining the material's appearance. Any property of the material
   * (including any property from inherited materials) can be passed
   * in here. Color values can be passed any type of value accepted
   * by {@link Color#set}.
   */
  constructor(parameters?: ShadowMaterialParameters) {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isShadowMaterial = true;
    this.type = "ShadowMaterial";
    /**
     * Color of the material.
     *
     * @default (0,0,0)
     */
    this.color = new Color(0x000000);
    /**
     * Overwritten since shadow materials are transparent
     * by default.
     *
     * @default true
     */
    this.transparent = true;
    /**
     * Whether the material is affected by fog or not.
     *
     * @default true
     */
    this.fog = true;
    this.setValues(parameters);
  }
  copy(source: ShadowMaterial): this {
    super.copy(source);
    this.color.copy(source.color);
    this.fog = source.fog;
    return this;
  }
}
