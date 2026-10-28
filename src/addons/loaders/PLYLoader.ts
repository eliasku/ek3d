import { SRGBColorSpace } from "../../constants";
import {
  BufferAttribute,
  Float32BufferAttribute,
  Int8BufferAttribute,
  Int16BufferAttribute,
  Int32BufferAttribute,
  Uint8BufferAttribute,
  Uint16BufferAttribute,
  Uint32BufferAttribute,
} from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { Color } from "../../math/Color";

const _color = new Color();

type PlyScalarType =
  | "int8"
  | "char"
  | "uint8"
  | "uchar"
  | "int16"
  | "short"
  | "uint16"
  | "ushort"
  | "int32"
  | "int"
  | "uint32"
  | "uint"
  | "float32"
  | "float"
  | "float64"
  | "double";

type PlyProperty =
  | { type: "list"; name: string; countType: PlyScalarType; itemType: PlyScalarType }
  | { type: PlyScalarType; name: string };

interface PlyElement {
  name: string;
  count: number;
  properties: PlyProperty[];
}

interface PlyHeader {
  format?: string;
  version?: string;
  comments: string[];
  elements: PlyElement[];
  headerLength: number;
  objInfo: string;
}

interface PlyAttributeDescriptor {
  names: string[];
  type: PlyScalarType;
  usage: boolean;
}

interface PlyElementDescriptor {
  position: PlyAttributeDescriptor;
  normal: PlyAttributeDescriptor;
  uv: PlyAttributeDescriptor;
  texcoord: { type: PlyScalarType; usage: boolean };
  color: PlyAttributeDescriptor;
  custom: Record<string, { type: PlyScalarType; usage: boolean }>;
}

interface PlyBuffer {
  indices: number[];
  vertices: number[];
  normals: number[];
  uvs: number[];
  faceVertexUvs: number[];
  colors: number[];
  faceVertexColors: number[];
  /** Element descriptors exist only for element names present in the header. */
  descriptors: Record<string, PlyElementDescriptor | undefined>;
  custom: Record<string, number[]>;
}

type PlyElementValues = Record<string, number | number[]>;

interface BinaryReader {
  read(at: number): number;
  size: number;
}

interface BinaryPropertyReaders {
  count?: BinaryReader;
  value: BinaryReader;
}

type BufferAttributeConstructor = new (array: number[], itemSize: number, normalized?: boolean) => BufferAttribute;

/**
 * A loader for the PLY format (known as the Polygon
 * File Format or the Stanford Triangle Format).
 *
 * Limitations:
 * - ASCII decoding assumes file is UTF-8.
 *
 * ```typescript
 * import { PLYLoader } from "ek3d/addons/loaders/PLYLoader";
 * import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
 * import { Mesh } from "ek3d/objects/Mesh";
 * import { Scene } from "ek3d/scenes/Scene";
 *
 * const scene = new Scene();
 * const loader = new PLYLoader();
 * const geometry = await loader.loadAsync( "./models/ply/ascii/dolphins.ply" );
 * scene.add( new Mesh( geometry, new MeshStandardMaterial() ) );
 * ```
 */
export class PLYLoader extends Loader<BufferGeometry, string> {
  /**
   * Maps default property names to custom ones, applied while parsing the header.
   */
  propertyNameMapping: Record<string, string>;
  /**
   * Maps attribute names to the element properties that make up the attribute.
   */
  customPropertyMapping: Record<string, string[]>;

  /**
   * Constructs a new PLY loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);

    // internals

    this.propertyNameMapping = {};
    this.customPropertyMapping = {};
  }

  /**
   * Starts loading from the given URL and passes the loaded PLY asset
   * to the `onLoad()` callback.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param [onLoad] - Executed when the loading process has been finished.
   * @param [onProgress] - Executed while the loading is in progress.
   * @param [onError] - Executed when errors occur.
   */
  override load(
    url: string,
    onLoad?: (value: BufferGeometry) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setPath(this.path);
    loader.setResponseType("arraybuffer");
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      (text: unknown) => {
        try {
          const geometry = this.parse(text as ArrayBuffer);

          if (onLoad !== undefined) onLoad(geometry);
        } catch (e) {
          if (onError !== undefined) {
            onError(e);
          } else {
            console.error(e);
          }

          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }

  /**
   * Sets a property name mapping that maps default property names
   * to custom ones. For example, the following maps the properties
   * "diffuse_(red|green|blue)" in the file to standard color names.
   *
   * ```typescript
   * loader.setPropertyNameMapping( {
   *   diffuse_red: "red",
   *   diffuse_green: "green",
   *   diffuse_blue: "blue"
   * } );
   * ```
   *
   * @param mapping - The mapping dictionary.
   */
  setPropertyNameMapping(mapping: Record<string, string>): void {
    this.propertyNameMapping = mapping;
  }

  /**
   * Custom properties outside of the defaults for position, uv, normal
   * and color attributes can be added using the setCustomPropertyNameMapping method.
   * For example, the following maps the element properties "custom_property_a"
   * and "custom_property_b" to an attribute "customAttribute" with an item size of 2.
   * Attribute item sizes are set from the number of element properties in the property array.
   *
   * ```typescript
   * loader.setCustomPropertyNameMapping( {
   *   customAttribute: ["custom_property_a", "custom_property_b"],
   * } );
   * ```
   *
   * @param mapping - The mapping dictionary.
   */
  setCustomPropertyNameMapping(mapping: Record<string, string[]>): void {
    this.customPropertyMapping = mapping;
  }

  /**
   * Parses the given PLY data and returns the resulting geometry.
   *
   * @param data - The raw PLY data as an array buffer or, for ASCII files, as text.
   * @return The parsed geometry.
   */
  parse(data: ArrayBuffer | string): BufferGeometry {
    const propertyNameMapping = this.propertyNameMapping;
    const customPropertyMapping = this.customPropertyMapping;

    function parseHeader(text: string, headerLength: number = 0): PlyHeader {
      const patternHeader = /^ply([\s\S]*)end_header(\r\n|\r|\n)/;
      let headerText = "";
      const result = patternHeader.exec(text);

      if (result !== null) {
        headerText = result[1];
      }

      const header: PlyHeader = {
        comments: [],
        elements: [],
        headerLength: headerLength,
        objInfo: "",
      };

      const lines = headerText.split(/\r\n|\r|\n/);
      let currentElement: PlyElement | undefined;

      function makeElementProperty(propertyValues: string[], propertyNameMapping: Record<string, string>): PlyProperty {
        const type = propertyValues[0] as PlyProperty["type"];

        if (type === "list") {
          const property: PlyProperty = {
            type,
            name: propertyValues[3],
            countType: propertyValues[1] as PlyScalarType,
            itemType: propertyValues[2] as PlyScalarType,
          };

          if (property.name in propertyNameMapping) {
            property.name = propertyNameMapping[property.name];
          }

          return property;
        }

        const property: PlyProperty = { type, name: propertyValues[1] };

        if (property.name in propertyNameMapping) {
          property.name = propertyNameMapping[property.name];
        }

        return property;
      }

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        line = line.trim();

        if (line === "") continue;

        const lineValues = line.split(/\s+/);
        const lineType = lineValues.shift() as string;
        line = lineValues.join(" ");

        switch (lineType) {
          case "format":
            header.format = lineValues[0];
            header.version = lineValues[1];

            break;

          case "comment":
            header.comments.push(line);

            break;

          case "element":
            if (currentElement !== undefined) {
              header.elements.push(currentElement);
            }

            currentElement = {
              name: lineValues[0],
              count: parseInt(lineValues[1]),
              properties: [],
            };

            break;

          case "property":
            currentElement!.properties.push(makeElementProperty(lineValues, propertyNameMapping));

            break;

          case "obj_info":
            header.objInfo = line;

            break;

          default:
            console.log("unhandled", lineType, lineValues);
        }
      }

      if (currentElement !== undefined) {
        header.elements.push(currentElement);
      }

      return header;
    }

    function parseASCIINumber(n: string, type: PlyScalarType): number {
      switch (type) {
        case "char":
        case "uchar":
        case "short":
        case "ushort":
        case "int":
        case "uint":
        case "int8":
        case "uint8":
        case "int16":
        case "uint16":
        case "int32":
        case "uint32":
          return parseInt(n);

        case "float":
        case "double":
        case "float32":
        case "float64":
          return parseFloat(n);

        // The header may name an unknown type; upstream leaves such values undefined, which
        // typed arrays and list loops treat exactly like NaN.
        default:
          return Number.NaN;
      }
    }

    function parseASCIIElement(properties: PlyProperty[], tokens: ArrayStream): PlyElementValues | null {
      const element: PlyElementValues = {};

      for (let i = 0; i < properties.length; i++) {
        if (tokens.empty()) return null;

        const property = properties[i];

        if (property.type === "list") {
          const list: number[] = [];
          const n = parseASCIINumber(tokens.next(), property.countType);

          for (let j = 0; j < n; j++) {
            if (tokens.empty()) return null;

            list.push(parseASCIINumber(tokens.next(), property.itemType));
          }

          element[property.name] = list;
        } else {
          element[property.name] = parseASCIINumber(tokens.next(), property.type);
        }
      }

      return element;
    }

    function createBuffer(): PlyBuffer {
      const buffer: PlyBuffer = {
        indices: [],
        vertices: [],
        normals: [],
        uvs: [],
        faceVertexUvs: [],
        colors: [],
        faceVertexColors: [],
        descriptors: {},
        custom: {},
      };

      for (const customProperty of Object.keys(customPropertyMapping)) {
        buffer.custom[customProperty] = [];
      }

      return buffer;
    }

    function getBufferAttributeClass(type: PlyScalarType): BufferAttributeConstructor {
      switch (type) {
        case "int8":
        case "char":
          return Int8BufferAttribute;
        case "uint8":
        case "uchar":
          return Uint8BufferAttribute;
        case "int16":
        case "short":
          return Int16BufferAttribute;
        case "uint16":
        case "ushort":
          return Uint16BufferAttribute;
        case "int32":
        case "int":
          return Int32BufferAttribute;
        case "uint32":
        case "uint":
          return Uint32BufferAttribute;
        case "float32":
        case "float":
          return Float32BufferAttribute;
        case "float64":
        case "double":
          return Float64BufferAttribute;
        default:
          throw new TypeError(`PLYLoader: Unsupported attribute type "${String(type)}".`);
      }
    }

    function getColorScale(type: PlyScalarType): number {
      switch (type) {
        case "uchar":
        case "uint8":
          return 1 / 255;
        case "ushort":
        case "uint16":
          return 1 / 65535;
        case "float":
        case "float32":
        case "double":
        case "float64":
          return 1;
        default:
          return 1 / 255;
      }
    }

    function isFloatType(type: PlyScalarType): boolean {
      return type === "float" || type === "float32" || type === "double" || type === "float64";
    }

    function getAttributeDescriptor(properties: PlyProperty[]): PlyElementDescriptor {
      function findProperty(names: string[]): PlyProperty | null {
        for (const name of names) {
          const property = properties.find((p) => p.name === name);
          if (property) return property;
        }

        return null;
      }

      // property lookup

      const x = findProperty(["x", "px", "posx"]);
      const y = findProperty(["y", "py", "posy"]);
      const z = findProperty(["z", "pz", "posz"]);
      const nx = findProperty(["nx", "normalx"]);
      const ny = findProperty(["ny", "normaly"]);
      const nz = findProperty(["nz", "normalz"]);
      const s = findProperty(["s", "u", "texture_u", "tx"]);
      const t = findProperty(["t", "v", "texture_v", "ty"]);
      const r = findProperty(["red", "diffuse_red", "r", "diffuse_r"]);
      const g = findProperty(["green", "diffuse_green", "g", "diffuse_g"]);
      const b = findProperty(["blue", "diffuse_blue", "b", "diffuse_b"]);
      const texcoord = findProperty(["texcoord"]);

      // custom property lookup

      const custom: Record<string, { type: PlyScalarType; usage: boolean }> = {};

      for (const customAttr of Object.keys(customPropertyMapping)) {
        const propNames = customPropertyMapping[customAttr];
        const matched = propNames.map((name) => properties.find((p) => p.name === name));
        const types = matched.filter((p) => p !== undefined).map((p) => p.type);
        const uniform = types.length > 0 && types.every((type) => type === types[0]);

        custom[customAttr] = {
          type: uniform ? (types[0] as PlyScalarType) : "float32",
          usage: matched.every((p) => p !== undefined),
        };
      }

      // build descriptor

      return {
        position: {
          names: [x ? x.name : "x", y ? y.name : "y", z ? z.name : "z"],
          type: x ? (x.type as PlyScalarType) : "float32",
          usage: !!(x && y && z),
        },
        normal: {
          names: [nx ? nx.name : "nx", ny ? ny.name : "ny", nz ? nz.name : "nz"],
          type: nx ? (nx.type as PlyScalarType) : "float32",
          usage: !!(nx && ny && nz),
        },
        uv: {
          names: [s ? s.name : "s", t ? t.name : "t"],
          type: s ? (s.type as PlyScalarType) : "float32",
          usage: !!(s && t),
        },
        texcoord: {
          // Upstream reads `itemType` even when a property named texcoord is not a list; keep that
          // runtime undefined so the later UV class lookup fails the same way.
          type: texcoord ? (texcoord as { itemType: PlyScalarType }).itemType : "float32",
          usage: !!texcoord,
        },
        color: {
          names: [r ? r.name : "red", g ? g.name : "green", b ? b.name : "blue"],
          type: r ? (r.type as PlyScalarType) : "uchar",
          usage: !!(r && g && b),
        },
        custom: custom,
      };
    }

    function parseASCII(text: string, header: PlyHeader): BufferGeometry {
      // PLY ascii format specification, as per http://en.wikipedia.org/wiki/PLY_(file_format)

      const buffer = createBuffer();

      const patternBody = /end_header\s+(\S[\s\S]*\S|\S)\s*$/;
      let body: string[];

      const matches = patternBody.exec(text);

      if (matches !== null) {
        body = matches[1].split(/\s+/);
      } else {
        body = [];
      }

      const tokens = new ArrayStream(body);

      loop: for (let i = 0; i < header.elements.length; i++) {
        const elementDesc = header.elements[i];
        const attributeDescriptor = getAttributeDescriptor(elementDesc.properties);
        buffer.descriptors[elementDesc.name] = attributeDescriptor;

        for (let j = 0; j < elementDesc.count; j++) {
          const element = parseASCIIElement(elementDesc.properties, tokens);

          if (!element) break loop;

          handleElement(buffer, elementDesc.name, element, attributeDescriptor);
        }
      }

      return postProcess(buffer);
    }

    function postProcess(buffer: PlyBuffer): BufferGeometry {
      let geometry = new BufferGeometry();

      const vertexDescriptor = buffer.descriptors.vertex;

      // mandatory buffer data

      if (buffer.indices.length > 0) {
        geometry.setIndex(buffer.indices);
      }

      const PositionClass = getBufferAttributeClass(vertexDescriptor ? vertexDescriptor.position.type : "float32");
      geometry.setAttribute("position", new PositionClass(buffer.vertices, 3));

      // optional buffer data

      if (buffer.normals.length > 0) {
        const NormalClass = getBufferAttributeClass(vertexDescriptor!.normal.type);
        geometry.setAttribute("normal", new NormalClass(buffer.normals, 3));
      }

      if (buffer.uvs.length > 0) {
        const UvClass = getBufferAttributeClass(vertexDescriptor!.uv.type);
        geometry.setAttribute("uv", new UvClass(buffer.uvs, 2));
      }

      if (buffer.colors.length > 0) {
        const colorType = vertexDescriptor!.color.type;
        const normalized = !isFloatType(colorType);

        const ColorClass = getBufferAttributeClass(colorType);
        geometry.setAttribute("color", new ColorClass(buffer.colors, 3, normalized));
      }

      // custom buffer data

      for (const customProperty of Object.keys(customPropertyMapping)) {
        if (buffer.custom[customProperty].length > 0) {
          const CustomClass = getBufferAttributeClass(vertexDescriptor!.custom[customProperty].type);
          geometry.setAttribute(
            customProperty,
            new CustomClass(buffer.custom[customProperty], customPropertyMapping[customProperty].length),
          );
        }
      }

      if (buffer.faceVertexUvs.length > 0 || buffer.faceVertexColors.length > 0) {
        const faceDescriptor = buffer.descriptors.face!;

        geometry = geometry.toNonIndexed();

        if (buffer.faceVertexUvs.length > 0) {
          const UvClass = getBufferAttributeClass(faceDescriptor.texcoord.type);
          geometry.setAttribute("uv", new UvClass(buffer.faceVertexUvs, 2));
        }

        if (buffer.faceVertexColors.length > 0) {
          const colorType = faceDescriptor.color.type;
          const normalized = !isFloatType(colorType);

          const ColorClass = getBufferAttributeClass(colorType);
          geometry.setAttribute("color", new ColorClass(buffer.faceVertexColors, 3, normalized));
        }
      }

      geometry.computeBoundingSphere();

      return geometry;
    }

    function handleElement(
      buffer: PlyBuffer,
      elementName: string,
      element: PlyElementValues,
      attributeDescriptor: PlyElementDescriptor,
    ): void {
      if (elementName === "vertex") {
        const { position, normal, uv, color } = attributeDescriptor;

        if (position.usage) {
          buffer.vertices.push(
            element[position.names[0]] as number,
            element[position.names[1]] as number,
            element[position.names[2]] as number,
          );
        }

        if (normal.usage) {
          buffer.normals.push(
            element[normal.names[0]] as number,
            element[normal.names[1]] as number,
            element[normal.names[2]] as number,
          );
        }

        if (uv.usage) {
          buffer.uvs.push(element[uv.names[0]] as number, element[uv.names[1]] as number);
        }

        if (color.usage) {
          const scale = getColorScale(color.type);
          const isFloat = isFloatType(color.type);

          // convert to float for color space conversion

          _color.setRGB(
            (element[color.names[0]] as number) * scale,
            (element[color.names[1]] as number) * scale,
            (element[color.names[2]] as number) * scale,
            SRGBColorSpace,
          );

          // convert back to original type

          const invScale = 1 / scale;

          buffer.colors.push(
            isFloat ? _color.r : Math.round(_color.r * invScale),
            isFloat ? _color.g : Math.round(_color.g * invScale),
            isFloat ? _color.b : Math.round(_color.b * invScale),
          );
        }

        for (const customProperty of Object.keys(customPropertyMapping)) {
          for (const elementProperty of customPropertyMapping[customProperty]) {
            buffer.custom[customProperty].push(element[elementProperty] as number);
          }
        }
      } else if (elementName === "face") {
        const vertexIndices = (element["vertex_indices"] || element["vertex_index"]) as number[]; // issue #9338
        const texcoord = element["texcoord"] as number[] | undefined;

        if (vertexIndices.length === 3) {
          buffer.indices.push(vertexIndices[0], vertexIndices[1], vertexIndices[2]);

          if (texcoord && texcoord.length === 6) {
            buffer.faceVertexUvs.push(texcoord[0], texcoord[1]);
            buffer.faceVertexUvs.push(texcoord[2], texcoord[3]);
            buffer.faceVertexUvs.push(texcoord[4], texcoord[5]);
          }
        } else if (vertexIndices.length === 4) {
          // according to the spec, quads need to be split along a specific rule
          // 4 0 1 2 3 results in 0,1,2 and 0,2,3

          buffer.indices.push(vertexIndices[0], vertexIndices[1], vertexIndices[2]);
          buffer.indices.push(vertexIndices[0], vertexIndices[2], vertexIndices[3]);

          if (texcoord && texcoord.length === 8) {
            buffer.faceVertexUvs.push(texcoord[0], texcoord[1]);
            buffer.faceVertexUvs.push(texcoord[2], texcoord[3]);
            buffer.faceVertexUvs.push(texcoord[4], texcoord[5]);
            buffer.faceVertexUvs.push(texcoord[0], texcoord[1]);
            buffer.faceVertexUvs.push(texcoord[4], texcoord[5]);
            buffer.faceVertexUvs.push(texcoord[6], texcoord[7]);
          }
        }

        // face colors

        const { color } = attributeDescriptor;

        if (color.usage) {
          // convert to float for color space conversion

          const scale = getColorScale(color.type);

          _color.setRGB(
            (element[color.names[0]] as number) * scale,
            (element[color.names[1]] as number) * scale,
            (element[color.names[2]] as number) * scale,
            SRGBColorSpace,
          );

          // convert back to original type

          const invScale = 1 / scale;

          const r = _color.r * invScale;
          const g = _color.g * invScale;
          const b = _color.b * invScale;

          buffer.faceVertexColors.push(r, g, b);
          buffer.faceVertexColors.push(r, g, b);
          buffer.faceVertexColors.push(r, g, b);

          if (vertexIndices.length === 4) {
            buffer.faceVertexColors.push(r, g, b);
            buffer.faceVertexColors.push(r, g, b);
            buffer.faceVertexColors.push(r, g, b);
          }
        }
      }
    }

    function binaryReadElement(
      at: number,
      properties: PlyProperty[],
      readers: BinaryPropertyReaders[],
    ): [PlyElementValues, number] {
      const element: PlyElementValues = {};
      let read = 0;

      for (let i = 0; i < properties.length; i++) {
        const property = properties[i];
        const propertyReaders = readers[i];
        const valueReader = propertyReaders.value;

        if (property.type === "list") {
          const list: number[] = [];

          const countReader = propertyReaders.count!;

          const n = countReader.read(at + read);
          read += countReader.size;

          for (let j = 0; j < n; j++) {
            list.push(valueReader.read(at + read));
            read += valueReader.size;
          }

          element[property.name] = list;
        } else {
          element[property.name] = valueReader.read(at + read);
          read += valueReader.size;
        }
      }

      return [element, read];
    }

    function setPropertyBinaryReaders(
      properties: PlyProperty[],
      body: DataView,
      littleEndian: boolean,
    ): BinaryPropertyReaders[] {
      function getBinaryReader(type: PlyScalarType): BinaryReader {
        switch (type) {
          // correspondences for non-specific length types here match rply:
          case "int8":
          case "char":
            return { read: (at: number) => body.getInt8(at), size: 1 };
          case "uint8":
          case "uchar":
            return { read: (at: number) => body.getUint8(at), size: 1 };
          case "int16":
          case "short":
            return { read: (at: number) => body.getInt16(at, littleEndian), size: 2 };
          case "uint16":
          case "ushort":
            return { read: (at: number) => body.getUint16(at, littleEndian), size: 2 };
          case "int32":
          case "int":
            return { read: (at: number) => body.getInt32(at, littleEndian), size: 4 };
          case "uint32":
          case "uint":
            return { read: (at: number) => body.getUint32(at, littleEndian), size: 4 };
          case "float32":
          case "float":
            return { read: (at: number) => body.getFloat32(at, littleEndian), size: 4 };
          case "float64":
          case "double":
            return { read: (at: number) => body.getFloat64(at, littleEndian), size: 8 };
          default:
            throw new TypeError(`PLYLoader: Unsupported binary type "${String(type)}".`);
        }
      }

      return properties.map((property) =>
        property.type === "list"
          ? { count: getBinaryReader(property.countType), value: getBinaryReader(property.itemType) }
          : { value: getBinaryReader(property.type) },
      );
    }

    function parseBinary(bytes: ArrayBuffer, header: PlyHeader): BufferGeometry {
      const buffer = createBuffer();

      const littleEndian = header.format === "binary_little_endian";
      const body = new DataView(bytes, header.headerLength);
      let loc = 0;

      for (let currentElement = 0; currentElement < header.elements.length; currentElement++) {
        const elementDesc = header.elements[currentElement];
        const properties = elementDesc.properties;
        const attributeDescriptor = getAttributeDescriptor(properties);
        buffer.descriptors[elementDesc.name] = attributeDescriptor;

        const readers = setPropertyBinaryReaders(properties, body, littleEndian);

        for (let currentElementCount = 0; currentElementCount < elementDesc.count; currentElementCount++) {
          const result = binaryReadElement(loc, properties, readers);
          loc += result[1];
          const element = result[0];

          handleElement(buffer, elementDesc.name, element, attributeDescriptor);
        }
      }

      return postProcess(buffer);
    }

    function extractHeaderText(bytes: Uint8Array): { headerText: string; headerLength: number } {
      let i = 0;
      let cont = true;

      let line = "";
      const lines: string[] = [];

      const startLine = new TextDecoder().decode(bytes.subarray(0, 5));
      const hasCRNL = startLine.startsWith("ply\r\n");

      do {
        const c = String.fromCharCode(bytes[i++]);

        if (c !== "\n" && c !== "\r") {
          line += c;
        } else {
          if (line === "end_header") cont = false;
          if (line !== "") {
            lines.push(line);
            line = "";
          }
        }
      } while (cont && i < bytes.length);

      // ascii section using \r\n as line endings
      if (hasCRNL === true) i++;

      return { headerText: lines.join("\r") + "\r", headerLength: i };
    }

    let geometry: BufferGeometry;

    if (data instanceof ArrayBuffer) {
      const bytes = new Uint8Array(data);
      const { headerText, headerLength } = extractHeaderText(bytes);
      const header = parseHeader(headerText, headerLength);

      if (header.format === "ascii") {
        const text = new TextDecoder().decode(bytes);

        geometry = parseASCII(text, header);
      } else {
        geometry = parseBinary(data, header);
      }
    } else {
      geometry = parseASCII(data, parseHeader(data));
    }

    return geometry;
  }
}

/** PLY `double`/`float64` data stays 64-bit, matching upstream. */
class Float64BufferAttribute extends BufferAttribute {
  constructor(array: number[], itemSize: number, normalized?: boolean) {
    super(new Float64Array(array), itemSize, normalized);
  }
}

class ArrayStream {
  arr: string[];
  i: number;

  constructor(arr: string[]) {
    this.arr = arr;
    this.i = 0;
  }

  empty(): boolean {
    return this.i >= this.arr.length;
  }

  next(): string {
    return this.arr[this.i++];
  }
}
