import type { Texture } from "../textures/Texture";
import { Material } from "./Material";
import { Color } from "../math/Color";

export type SpriteMaterialParameters = Omit<Partial<SpriteMaterial>, "color"> & { color?: Color | number | string };
/**
 * A material for rendering instances of {@link Sprite}.
 *
 * ```ts
 * import { TextureLoader } from 'ek3d/loaders/TextureLoader';
 * import { SpriteMaterial } from 'ek3d/materials/SpriteMaterial';
 * import { Sprite } from 'ek3d/objects/Sprite';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 * const map = new TextureLoader().load( 'textures/sprite.png' );
 * const material = new SpriteMaterial( { map: map, color: 0xffffff } );
 *
 * const sprite = new Sprite( material );
 * sprite.scale.set( 200, 200, 1 );
 * scene.add( sprite );
 * ```
 *
 */
export class SpriteMaterial extends Material {
  isSpriteMaterial: boolean;

  color: Color;
  map: Texture | null;
  alphaMap: Texture | null;
  rotation: number;
  sizeAttenuation: boolean;

  fog: boolean;

  /**
   * Constructs a new sprite material.
   *
   * @param [parameters] - An object with one or more properties
   * defining the material's appearance. Any property of the material
   * (including any property from inherited materials) can be passed
   * in here. Color values can be passed any type of value accepted
   * by {@link Color#set}.
   */
  constructor(parameters?: SpriteMaterialParameters) {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isSpriteMaterial = true;
    this.type = "SpriteMaterial";
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
     * The rotation of the sprite in radians.
     *
     * @default 0
     */
    this.rotation = 0;
    /**
     * Specifies whether size of the sprite is attenuated by the camera depth (perspective camera only).
     *
     * @default true
     */
    this.sizeAttenuation = true;
    /**
     * Overwritten since sprite materials are transparent
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
  copy(source: SpriteMaterial): this {
    super.copy(source);
    this.color.copy(source.color);
    this.map = source.map;
    this.alphaMap = source.alphaMap;
    this.rotation = source.rotation;
    this.sizeAttenuation = source.sizeAttenuation;
    this.fog = source.fog;
    return this;
  }
}
