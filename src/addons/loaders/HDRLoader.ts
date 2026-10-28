import { TextureType, TextureFilter, ColorSpace } from "../../constants";
import { DataTextureLoader } from "../../loaders/DataTextureLoader";
import type { DataTextureData } from "../../loaders/DataTextureLoader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { toHalfFloat } from "../../extras/DataUtils";

const rgbeReadError = 1;
const rgbeWriteError = 2;
const rgbeFormatError = 3;
const rgbeMemoryError = 4;

function rgbeError(rgbeErrorCode: number, msg?: string): never {
  switch (rgbeErrorCode) {
    case rgbeReadError:
      throw new Error("THREE.HDRLoader: Read Error: " + (msg || ""));
    case rgbeWriteError:
      throw new Error("THREE.HDRLoader: Write Error: " + (msg || ""));
    case rgbeFormatError:
      throw new Error("THREE.HDRLoader: Bad File Format: " + (msg || ""));
    default:
    case rgbeMemoryError:
      throw new Error("THREE.HDRLoader: Memory Error: " + (msg || ""));
  }
}

/* flags indicating which fields in an rgbe_header_info are valid */
const RGBE_VALID_PROGRAMTYPE = 1;
const RGBE_VALID_FORMAT = 2;
const RGBE_VALID_DIMENSIONS = 4;

const NEWLINE = "\n";

/** View over the raw bytes with a moving read cursor, as upstream's buffer.pos attachment. */
interface RgbeBuffer extends Uint8Array {
  pos: number;
}

/** A parsed RGBE header. */
interface RGBEHeaderInfo {
  valid: number;
  string: string;
  comments: string;
  programtype: string;
  format: string;
  gamma: number;
  exposure: number;
  width: number;
  height: number;
}

function fgets(buffer: RgbeBuffer, lineLimit?: number, consume?: boolean): string | false {
  const chunkSize = 128;

  lineLimit = !lineLimit ? 1024 : lineLimit;
  let p = buffer.pos;
  let i = -1;
  let len = 0;
  let s = "";
  let chunk = String.fromCharCode.apply(
    null,
    new Uint16Array(buffer.subarray(p, p + chunkSize)) as unknown as number[],
  );

  while ((i = chunk.indexOf(NEWLINE)) < 0 && len < lineLimit && p < buffer.byteLength) {
    s += chunk;
    len += chunk.length;
    p += chunkSize;
    chunk = String.fromCharCode.apply(null, new Uint16Array(buffer.subarray(p, p + chunkSize)) as unknown as number[]);
  }

  if (i > -1) {
    if (consume !== false) buffer.pos += len + i + 1;
    return s + chunk.slice(0, i);
  }

  return false;
}

/* minimal header reading. modify if you want to parse more information */
function RGBE_ReadHeader(buffer: RgbeBuffer): RGBEHeaderInfo {
  // regexes to parse header info fields
  const magic_token_re = /^#\?(\S+)/;
  const gamma_re = /^\s*GAMMA\s*=\s*(\d+(\.\d+)?)\s*$/;
  const exposure_re = /^\s*EXPOSURE\s*=\s*(\d+(\.\d+)?)\s*$/;
  const format_re = /^\s*FORMAT=(\S+)\s*$/;
  const dimensions_re = /^\s*-Y\s+(\d+)\s+\+X\s+(\d+)\s*$/;

  // RGBE format header struct
  const header: RGBEHeaderInfo = {
    valid: 0 /* indicate which fields are valid */,
    string: "" /* the actual header string */,
    comments: "" /* comments found in header */,
    programtype: "RGBE" /* listed at beginning of file to identify it after "#?" defaults to "RGBE" */,
    format: "" /* RGBE format, default 32-bit_rle_rgbe */,
    gamma: 1.0 /* image has already been gamma corrected with given gamma defaults is 1.0 (no correction) */,
    exposure: 1.0 /* a value of 1.0 in an image corresponds to <exposure> watts/steradian/m^2 defaults is 1.0 */,
    width: 0,
    height: 0 /* image dimensions, width/height */,
  };

  let line: string | false;
  let match: RegExpExecArray | RegExpMatchArray | null;

  if (buffer.pos >= buffer.byteLength || !(line = fgets(buffer))) {
    rgbeError(rgbeReadError, "no header found");
  }

  /* if you want to require the magic token then uncomment the next line */
  if (!(match = (line as string).match(magic_token_re))) {
    rgbeError(rgbeFormatError, "bad initial token");
  }

  header.valid |= RGBE_VALID_PROGRAMTYPE;
  header.programtype = match![1]!;
  header.string += line + "\n";

  for (;;) {
    line = fgets(buffer);
    if (line === false) break;
    header.string += line + "\n";

    if ("#" === line.charAt(0)) {
      header.comments += line + "\n";
      continue; // comment line
    }

    if ((match = line.match(gamma_re))) {
      header.gamma = parseFloat(match[1]!);
    }

    if ((match = line.match(exposure_re))) {
      header.exposure = parseFloat(match[1]!);
    }

    if ((match = line.match(format_re))) {
      header.valid |= RGBE_VALID_FORMAT;
      header.format = match[1]!; //'32-bit_rle_rgbe';
    }

    if ((match = line.match(dimensions_re))) {
      header.valid |= RGBE_VALID_DIMENSIONS;
      header.height = parseInt(match[1]!, 10);
      header.width = parseInt(match[2]!, 10);
    }

    if ((header.valid & RGBE_VALID_FORMAT) !== 0 && (header.valid & RGBE_VALID_DIMENSIONS) !== 0) break;
  }

  if (!(header.valid & RGBE_VALID_FORMAT)) {
    rgbeError(rgbeFormatError, "missing format specifier");
  }

  if (!(header.valid & RGBE_VALID_DIMENSIONS)) {
    rgbeError(rgbeFormatError, "missing image size specifier");
  }

  return header;
}

function RGBE_ReadPixels_RLE(buffer: RgbeBuffer, w: number, h: number): Uint8Array {
  const scanline_width = w;

  if (
    // run length encoding is not allowed so read flat
    scanline_width < 8 ||
    scanline_width > 0x7fff ||
    // this file is not run length encoded
    buffer[0] !== 2 ||
    buffer[1] !== 2 ||
    (buffer[2]! & 0x80) !== 0
  ) {
    // return the flat buffer
    return new Uint8Array(buffer);
  }

  if (scanline_width !== ((buffer[2]! << 8) | buffer[3]!)) {
    rgbeError(rgbeFormatError, "wrong scanline width");
  }

  const data_rgba = new Uint8Array(4 * w * h);

  if (!data_rgba.length) {
    rgbeError(rgbeMemoryError, "unable to allocate buffer space");
  }

  let offset = 0;
  let pos = 0;

  const ptr_end = 4 * scanline_width;
  const rgbeStart = new Uint8Array(4);
  const scanline_buffer = new Uint8Array(ptr_end);
  let num_scanlines = h;

  // read in each successive scanline
  while (num_scanlines > 0 && pos < buffer.byteLength) {
    if (pos + 4 > buffer.byteLength) {
      rgbeError(rgbeReadError);
    }

    rgbeStart[0] = buffer[pos++]!;
    rgbeStart[1] = buffer[pos++]!;
    rgbeStart[2] = buffer[pos++]!;
    rgbeStart[3] = buffer[pos++]!;

    if (rgbeStart[0] !== 2 || rgbeStart[1] !== 2 || ((rgbeStart[2]! << 8) | rgbeStart[3]!) !== scanline_width) {
      rgbeError(rgbeFormatError, "bad rgbe scanline format");
    }

    // read each of the four channels for the scanline into the buffer
    // first red, then green, then blue, then exponent
    let ptr = 0;
    let count: number;

    while (ptr < ptr_end && pos < buffer.byteLength) {
      count = buffer[pos++]!;
      const isEncodedRun = count > 128;
      if (isEncodedRun) count -= 128;

      if (count === 0 || ptr + count > ptr_end) {
        rgbeError(rgbeFormatError, "bad scanline data");
      }

      if (isEncodedRun) {
        // a (encoded) run of the same value
        const byteValue = buffer[pos++]!;
        for (let i = 0; i < count; i++) {
          scanline_buffer[ptr++] = byteValue;
        }
        //ptr += count;
      } else {
        // a literal-run
        scanline_buffer.set(buffer.subarray(pos, pos + count), ptr);
        ptr += count;
        pos += count;
      }
    }

    // now convert data from buffer into rgba
    // first red, then green, then blue, then exponent (alpha)
    const l = scanline_width; //scanline_buffer.byteLength;
    for (let i = 0; i < l; i++) {
      let off = 0;
      data_rgba[offset] = scanline_buffer[i + off]!;
      off += scanline_width; //1;
      data_rgba[offset + 1] = scanline_buffer[i + off]!;
      off += scanline_width; //1;
      data_rgba[offset + 2] = scanline_buffer[i + off]!;
      off += scanline_width; //1;
      data_rgba[offset + 3] = scanline_buffer[i + off]!;
      offset += 4;
    }

    num_scanlines--;
  }

  return data_rgba;
}

function RGBEByteToRGBFloat(
  sourceArray: Uint8Array,
  sourceOffset: number,
  destArray: Float32Array,
  destOffset: number,
): void {
  const e = sourceArray[sourceOffset + 3]!;
  const scale = Math.pow(2.0, e - 128.0) / 255.0;

  destArray[destOffset] = sourceArray[sourceOffset]! * scale;
  destArray[destOffset + 1] = sourceArray[sourceOffset + 1]! * scale;
  destArray[destOffset + 2] = sourceArray[sourceOffset + 2]! * scale;
  destArray[destOffset + 3] = 1;
}

function RGBEByteToRGBHalf(
  sourceArray: Uint8Array,
  sourceOffset: number,
  destArray: Uint16Array,
  destOffset: number,
): void {
  const e = sourceArray[sourceOffset + 3]!;
  const scale = Math.pow(2.0, e - 128.0) / 255.0;

  // clamping to 65504, the maximum representable value in float16
  destArray[destOffset] = toHalfFloat(Math.min(sourceArray[sourceOffset]! * scale, 65504));
  destArray[destOffset + 1] = toHalfFloat(Math.min(sourceArray[sourceOffset + 1]! * scale, 65504));
  destArray[destOffset + 2] = toHalfFloat(Math.min(sourceArray[sourceOffset + 2]! * scale, 65504));
  destArray[destOffset + 3] = toHalfFloat(1);
}

/**
 * A loader for the RGBE HDR texture format.
 *
 * ```typescript
 * import { HDRLoader } from 'ek3d/addons/loaders/HDRLoader';
 * import { Mapping } from 'ek3d/constants';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const loader = new HDRLoader();
 * const envMap = await loader.loadAsync( 'textures/equirectangular/blouberg_sunrise_2_1k.hdr' );
 * envMap.mapping = Mapping.EquirectangularReflection;
 *
 * const scene = new Scene();
 * scene.environment = envMap;
 * ```
 *
 * @augments DataTextureLoader
 */
export class HDRLoader extends DataTextureLoader {
  /**
   * The texture type.
   *
   * @default TextureType.HalfFloat
   */
  type: TextureType;

  /**
   * Constructs a new RGBE/HDR loader.
   *
   * @param manager - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);

    this.type = TextureType.HalfFloat;
  }

  /**
   * Parses the given RGBE texture data.
   *
   * @param buffer - The raw texture data.
   * @return An object representing the parsed texture data.
   */
  override parse(buffer: ArrayBuffer): DataTextureData & { header: string } {
    // adapted from http://www.graphics.cornell.edu/~bjw/rgbe.html

    const byteArray = new Uint8Array(buffer) as RgbeBuffer;
    byteArray.pos = 0;
    const rgbe_header_info = RGBE_ReadHeader(byteArray);

    const w = rgbe_header_info.width;
    const h = rgbe_header_info.height;
    const pixelBuffer = new Uint8Array(byteArray.subarray(byteArray.pos)) as RgbeBuffer;
    pixelBuffer.pos = 0;
    const image_rgba_data = RGBE_ReadPixels_RLE(pixelBuffer, w, h);

    let data: Float32Array | Uint16Array;
    let type: number;
    let numElements: number;

    switch (this.type) {
      case TextureType.Float: {
        numElements = image_rgba_data.length / 4;
        const floatArray = new Float32Array(numElements * 4);

        for (let j = 0; j < numElements; j++) {
          RGBEByteToRGBFloat(image_rgba_data, j * 4, floatArray, j * 4);
        }

        data = floatArray;
        type = TextureType.Float;
        break;
      }
      case TextureType.HalfFloat: {
        numElements = image_rgba_data.length / 4;
        const halfArray = new Uint16Array(numElements * 4);

        for (let j = 0; j < numElements; j++) {
          RGBEByteToRGBHalf(image_rgba_data, j * 4, halfArray, j * 4);
        }

        data = halfArray;
        type = TextureType.HalfFloat;
        break;
      }
      default:
        throw new Error("THREE.HDRLoader: Unsupported type: " + this.type);
    }

    return {
      width: w,
      height: h,
      data: data,
      header: rgbe_header_info.string,
      gamma: rgbe_header_info.gamma,
      exposure: rgbe_header_info.exposure,
      type: type,
      colorSpace: ColorSpace.LinearSRGB,
      minFilter: TextureFilter.Linear,
      magFilter: TextureFilter.Linear,
      generateMipmaps: false,
      flipY: true,
    };
  }

  /**
   * Sets the texture type.
   *
   * @param value - The texture type to set.
   * @return A reference to this loader.
   */
  setDataType(value: number): this {
    this.type = value;
    return this;
  }
}
