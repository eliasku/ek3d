import type { CurveFactory } from "../../extras/core/Curve";
import type { Shape } from "../../extras/core/Shape";
import type { Vector3 } from "../../math/Vector3";
import { ExtrudeGeometry } from "../../geometries/ExtrudeGeometry";
import type { ExtrudeGeometryJSON, ExtrudeGeometryOptions } from "../../geometries/ExtrudeGeometry";
import { Font } from "../loaders/FontLoader";
import type { FontData, FontDirection } from "../loaders/FontLoader";

/**
 * Represents the `options` type of the text geometry's constructor.
 */
export interface TextGeometryOptions extends ExtrudeGeometryOptions {
  /** The font. Without a font, a default extrude geometry is generated. */
  font?: Font;
  /** The text size. */
  size?: number;
  /** Char direction: ltr(left to right), rtl(right to left) & tb(top bottom). */
  direction?: FontDirection;
}

/**
 * Serialized text geometry. The geometry does not retain its source text, so `options.text` is
 * present only when the consumer adds it to the serialized object before deserializing.
 */
export interface TextGeometryJSON extends ExtrudeGeometryJSON {
  options: ExtrudeGeometryJSON["options"] & {
    text?: string;
    font?: { data: FontData };
    size?: number;
    direction?: FontDirection;
  };
}

/**
 * A class for generating text as a single geometry. It is constructed by providing a string of text, and a set of
 * parameters consisting of a loaded font and extrude settings.
 *
 * `TextGeometry` uses [typeface.json](https://gero3.github.io/facetype.js/) generated fonts.
 *
 * ```typescript
 * import { FontLoader } from 'ek3d/addons/loaders/FontLoader';
 * import { TextGeometry } from 'ek3d/addons/geometries/TextGeometry';
 *
 * const font = await new FontLoader().loadAsync( './helvetiker_regular.typeface.json' );
 * const geometry = new TextGeometry( 'Hello three.js!', {
 * 	font: font,
 * 	size: 80,
 * 	depth: 5,
 * 	curveSegments: 12
 * } );
 * ```
 */
export class TextGeometry extends ExtrudeGeometry {
  /**
   * Constructs a new text geometry.
   *
   * @param text - The text that should be transformed into a geometry.
   * @param parameters - The text settings.
   */
  constructor(text: string, parameters: TextGeometryOptions = {}) {
    const font = parameters.font;
    if (font === undefined) {
      super(); // generate default extrude geometry
    } else {
      const shapes = font.generateShapes(text, parameters.size, parameters.direction);
      // Upstream mutates the caller's options bag with the text defaults.
      if (parameters.depth === undefined) parameters.depth = 50;
      if (parameters.bevelThickness === undefined) parameters.bevelThickness = 10;
      if (parameters.bevelSize === undefined) parameters.bevelSize = 8;
      if (parameters.bevelEnabled === undefined) parameters.bevelEnabled = false;
      super(shapes, parameters);
    }
    this.type = "TextGeometry";
  }
  /**
   * Serializes the geometry into JSON. The source text is not retained, so `options` contains
   * only the settings supplied to the constructor.
   *
   * @return A JSON object representing the serialized geometry.
   */
  toJSON(): TextGeometryJSON {
    return super.toJSON();
  }
  /**
   * Factory method for creating an instance of this class from the given JSON object.
   *
   * The serialized `options` must include `text` and `font`; a serialized `extrudePath` needs the
   * `createCurve` factory, since no curve registry is owned by the geometry.
   *
   * @param data - A JSON object representing the serialized text geometry.
   * @param shapes - Unused serialized shape registry; accepted for compatibility with the base
   * extrusion factory, which rebuilds the shapes from `text`.
   * @param createCurve - Decodes a serialized extrusion path.
   * @return A new instance.
   */
  static fromJSON(
    data: TextGeometryJSON,
    _shapes?: Record<string, Shape>,
    createCurve?: CurveFactory<Vector3>,
  ): TextGeometry {
    const { text, font: serializedFont, extrudePath, ...extrudeOptions } = data.options;
    if (text === undefined) {
      throw new Error("TextGeometry.fromJSON: serialized options must include text.");
    }
    if (serializedFont === undefined) {
      throw new Error("TextGeometry.fromJSON: serialized options must include a font.");
    }
    const options: TextGeometryOptions = { ...extrudeOptions, font: new Font(serializedFont.data) };
    if (extrudePath !== undefined) {
      if (createCurve === undefined) {
        throw new Error("TextGeometry.fromJSON: serialized extrudePath requires a createCurve factory.");
      }
      options.extrudePath = createCurve(extrudePath);
    }
    return new TextGeometry(text, options);
  }
}
