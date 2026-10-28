import type { Texture } from "../textures/Texture";
import { Material } from "./Material";
import { Color } from "../math/Color";

export type PointsMaterialParameters = Omit<Partial<PointsMaterial>, "color"> & { color?: Color | number | string };
/**
 * A material for rendering point primitives.
 *
 * Materials define the appearance of renderable 3D objects.
 *
 * ```typescript
 * import { BufferGeometry } from 'ek3d/core/BufferGeometry';
 * import { Float32BufferAttribute } from 'ek3d/core/BufferAttribute';
 * import { PointsMaterial } from 'ek3d/materials/PointsMaterial';
 * import { randFloatSpread } from 'ek3d/math/MathUtils';
 * import { Points } from 'ek3d/objects/Points';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 * const vertices: number[] = [];
 *
 * for ( let i = 0; i < 10000; i ++ ) {
 * 	const x = randFloatSpread( 2000 );
 * 	const y = randFloatSpread( 2000 );
 * 	const z = randFloatSpread( 2000 );
 *
 * 	vertices.push( x, y, z );
 * }
 *
 * const geometry = new BufferGeometry();
 * geometry.setAttribute( 'position', new Float32BufferAttribute( vertices, 3 ) );
 * const material = new PointsMaterial( { color: 0x888888 } );
 * const points = new Points( geometry, material );
 * scene.add( points );
 * ```
 *
 */
export class PointsMaterial extends Material {
  isPointsMaterial: boolean;

  color: Color;
  map: Texture | null;
  alphaMap: Texture | null;
  size: number;
  sizeAttenuation: boolean;
  fog: boolean;

  /**
   * Constructs a new points material.
   *
   * @param [parameters] - An object with one or more properties
   * defining the material's appearance. Any property of the material
   * (including any property from inherited materials) can be passed
   * in here. Color values can be passed any type of value accepted
   * by {@link Color#set}.
   */
  constructor(parameters?: PointsMaterialParameters) {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isPointsMaterial = true;
    this.type = "PointsMaterial";
    /**
     * Color of the material.
     *
     * @default (1,1,1)
     */
    this.color = new Color(0xffffff);
    /**
     * The color map. May optionally include an alpha channel, typically combined
     * with {@link Material#transparent} or {@link Material#alphaTest}. The texture map
     * color is modulated by the diffuse `color`.
     *
     * `map` represents color data, and the texture must be assigned a
     * {@link Texture#colorSpace}. Most `map` textures set
     * `texture.colorSpace = ColorSpace.SRGB`.
     *
     * @default null
     */
    this.map = null;
    /**
     * The alpha map is a grayscale texture that controls the opacity across the
     * surface (black: fully transparent; white: fully opaque).
     *
     * Only the color of the texture is used, ignoring the alpha channel if one
     * exists. For RGB and RGBA textures, the renderer will use the green channel
     * when sampling this texture due to the extra bit of precision provided for
     * green in DXT-compressed and uncompressed RGB 565 formats. Luminance-only and
     * luminance/alpha textures will also still work as expected.
     *
     * `alphaMap` represents non-color data. Any texture assigned must have
     * `texture.colorSpace = ColorSpace.No` (default).
     *
     * @default null
     */
    this.alphaMap = null;
    /**
     * Defines the size of the points in pixels.
     *
     * Might be capped if the value exceeds hardware dependent parameters like [GL.ALIASED_POINT_SIZE_RANGE](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getParamete).
     *
     * @default 1
     */
    this.size = 1;
    /**
     * Specifies whether size of individual points is attenuated by the camera depth (perspective camera only).
     *
     * @default true
     */
    this.sizeAttenuation = true;
    /**
     * Whether the material is affected by fog or not.
     *
     * @default true
     */
    this.fog = true;
    this.setValues(parameters);
  }
  copy(source: PointsMaterial): this {
    super.copy(source);
    this.color.copy(source.color);
    this.map = source.map;
    this.alphaMap = source.alphaMap;
    this.size = source.size;
    this.sizeAttenuation = source.sizeAttenuation;
    this.fog = source.fog;
    return this;
  }
}
