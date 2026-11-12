import { TextureType, TextureFilter, ColorSpace, PixelFormat } from "../../constants";
import { DataTextureLoader } from "../../loaders/DataTextureLoader";
import type { DataTextureData } from "../../loaders/DataTextureLoader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { fromHalfFloat, toHalfFloat } from "../../extras/DataUtils";

// Referred to the original Industrial Light & Magic OpenEXR implementation and the TinyEXR / Syoyo Fujita
// implementation, so I have preserved their copyright notices.

// /*
// Copyright (c) 2014 - 2017, Syoyo Fujita
// All rights reserved.

// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//     * Neither the name of the Syoyo Fujita nor the
//       names of its contributors may be used to endorse or promote products
//       derived from this software without specific prior written permission.

// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
// DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
// */

// // TinyEXR contains some OpenEXR code, which is licensed under ------------

// ///////////////////////////////////////////////////////////////////////////
// //
// // Copyright (c) 2002, Industrial Light & Magic, a division of Lucas
// // Digital Ltd. LLC
// //
// // All rights reserved.
// //
// // Redistribution and use in source and binary forms, with or without
// // modification, are permitted provided that the following conditions are
// // met:
// // *       Redistributions of source code must retain the above copyright
// // notice, this list of conditions and the following disclaimer.
// // *       Redistributions in binary form must reproduce the above
// // copyright notice, this list of conditions and the following disclaimer
// // in the documentation and/or other materials provided with the
// // distribution.
// // *       Neither the name of Industrial Light & Magic nor the names of
// // its contributors may be used to endorse or promote products derived
// // from this software without specific prior written permission.
// //
// // THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// // "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// // LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// // A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// // OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// // SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// // LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// // DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// // THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// // (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// // OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
// //
// ///////////////////////////////////////////////////////////////////////////

// // End of OpenEXR license -------------------------------------------------

/** An injected zlib runtime; the package never bundles a decompressor. */
export interface EXRZlibDecoder {
  unzlibSync(data: Uint8Array): Uint8Array;
}

/** A channel entry from the file's `channels` (chlist) attribute. */
export interface EXRChannel {
  name: string;
  pixelType: number;
  pLinear: number;
  xSampling: number;
  ySampling: number;
}

/** A `box2i` attribute such as the data window. */
export interface EXRBox2i {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

/** A `chromaticities` attribute. */
export interface EXRChromaticities {
  redX: number;
  redY: number;
  greenX: number;
  greenY: number;
  blueX: number;
  blueY: number;
  whiteX: number;
  whiteY: number;
}

/** A `tiledesc` attribute. */
export interface EXRTiledesc {
  xSize: number;
  ySize: number;
  levelMode: string;
  roundingMode: string;
}

/** The version-flags byte of the file header. */
export interface EXRSpec {
  singleTile: boolean;
  longName: boolean;
  deepFormat: boolean;
  multiPart: boolean;
}

/**
 * One parsed part header. Unknown attributes are retained by their file names;
 * the parsed header is exposed as `header` on the returned texture data.
 */
export interface EXRPartHeader {
  [attributeName: string]: unknown;
  channels: EXRChannel[];
  compression: string;
  dataWindow: EXRBox2i;
  lineOrder?: string;
  tiles?: EXRTiledesc;
  version: number;
  spec: EXRSpec;
  /** Chunk count supplied by multi-part headers; upstream never derives it. */
  chunkCount?: number;
  /** Offset table of the selected part for multi-part and deep files. */
  _chunkOffsets?: number[];
}

/** Parsed EXR texture pixels plus the part header that produced them. */
export type EXRTextureData = Omit<DataTextureData, "header"> & { header: EXRPartHeader };

/** A value parsed from a header attribute. */
type EXRAttributeValue =
  | string
  | number
  | [number, number]
  | [number, number, number]
  | EXRChannel[]
  | EXRChromaticities
  | EXRBox2i
  | EXRTiledesc;

/** A moving read cursor over the raw buffer, as upstream's `{ value }` offsets. */
interface EXROffset {
  value: number;
}

/** One entry of the Huffman decoding table. */
interface HufDecodeEntry {
  len: number;
  lit: number;
  p: number[] | null;
}

/** Per-channel bookkeeping while decoding a PIZ block. */
interface PIZChannelData {
  start: number;
  end: number;
  nx: number;
  ny: number;
  size: number;
}

/** Per-channel bookkeeping while decoding a DWA block. */
interface DWAChannelData {
  name: string;
  compression: number;
  decoded: boolean;
  type: number;
  pLinear: number;
  width: number;
  height: number;
  offset?: number;
}

/** Decoder state shared by the block decompressors and the scanline readers. */
interface EXRDecoderState {
  size: number;
  viewer: DataView;
  array: Uint8Array;
  offset: EXROffset;
  width: number;
  height: number;
  inputChannels: EXRChannel[];
  channelByteOffsets: Record<string, number>;
  shouldExpand: boolean;
  yCbCr: boolean;
  totalBytes: number;
  columns: number;
  lines: number;
  type: number;
  uncompress: (info: EXRDecoderState) => DataView;
  getter: (viewer: DataView, offset: EXROffset) => number;
  format: number;
  colorSpace: string;
  outputChannels: number;
  decodeChannels: Record<string, number>;
  byteArray: Float32Array | Uint16Array;
  blockHeight: number;
  blockWidth: number;
  outLineWidth: number;
  tileCount: number;
  deepChannels: EXRDeepChannel[];
  chunkOffsets: number[];
  multiPart: boolean;
}

/** One channel of a deep image, with its per-sample byte width. */
interface EXRDeepChannel {
  name: string;
  bytesPerSample: number;
}

/** Decoder state plus the selected chunk reader. */
type EXRDecoder = EXRDecoderState & { decode: () => void };

/**
 * A loader for the OpenEXR texture format.
 *
 * `EXRLoader` currently supports uncompressed, ZIP(S), RLE, PIZ, PXR24, B44/A and DWA/B compression.
 * Supports reading as UnsignedByte, HalfFloat and Float type data texture.
 *
 * ZIP(S), PXR24, DWA and deep data need a zlib runtime; pass one with {@link EXRLoader#setZlibDecoder}
 * before parsing compressed files. Uncompressed, RLE, PIZ and B44 streams work without it.
 *
 * ```typescript
 * import { EXRLoader, type EXRZlibDecoder } from "ek3d/addons/loaders/EXRLoader";
 *
 * async function loadEXR( url: string, runtime: EXRZlibDecoder ) {
 *   return new EXRLoader().setZlibDecoder( runtime ).loadAsync( url );
 * }
 * ```
 */
export class EXRLoader extends DataTextureLoader {
  /**
   * The texture type.
   *
   * @default TextureType.HalfFloat
   */
  type: TextureType;

  /**
   * Texture output format.
   *
   * @default PixelFormat.RGBA
   */
  outputFormat: PixelFormat;

  /**
   * For multi-part EXR files, the index of the part to load.
   *
   * @default 0
   */
  part: number;

  /**
   * The zlib runtime used by ZIP(S), PXR24 and DWA blocks, or `null` when unset.
   */
  zlibDecoder: EXRZlibDecoder | null;

  /**
   * Constructs a new EXR loader.
   *
   * @param manager - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);

    this.type = TextureType.HalfFloat;
    this.outputFormat = PixelFormat.RGBA;
    this.part = 0;
    this.zlibDecoder = null;
  }

  /**
   * Parses the given EXR texture data.
   *
   * @param buffer - The raw texture data.
   * @return An object representing the parsed texture data.
   */
  override parse(buffer: ArrayBuffer): EXRTextureData {
    const USHORT_RANGE = 1 << 16;
    const BITMAP_SIZE = USHORT_RANGE >> 3;

    const HUF_ENCBITS = 16; // literal (value) bit length
    const HUF_DECBITS = 14; // decoding bit size (>= 8)

    const HUF_ENCSIZE = (1 << HUF_ENCBITS) + 1; // encoding table size
    const HUF_DECSIZE = 1 << HUF_DECBITS; // decoding table size
    const HUF_DECMASK = HUF_DECSIZE - 1;

    const NBITS = 16;
    const A_OFFSET = 1 << (NBITS - 1);
    const MOD_MASK = (1 << NBITS) - 1;

    const SHORT_ZEROCODE_RUN = 59;
    const LONG_ZEROCODE_RUN = 63;
    const SHORTEST_LONG_RUN = 2 + LONG_ZEROCODE_RUN - SHORT_ZEROCODE_RUN;

    const ULONG_SIZE = 8;
    const FLOAT32_SIZE = 4;
    const INT32_SIZE = 4;
    const INT16_SIZE = 2;
    const INT8_SIZE = 1;

    const STATIC_HUFFMAN = 0;
    const DEFLATE = 1;

    const UNKNOWN = 0;
    const LOSSY_DCT = 1;
    const RLE = 2;

    const logBase = Math.pow(2.7182818, 2.2);

    let b44LogTable: Uint16Array | null = null; // lazily initialized for pLinear B44 channels
    let dwaToLinearTable: Uint16Array | null = null; // lazily initialized for DWA lossy DCT channels

    // Only reached when a block actually needs zlib, so uncompressed files load without a runtime.
    const decodeZlib = (data: Uint8Array): Uint8Array => {
      const decoder = this.zlibDecoder;
      if (decoder === null) {
        throw new Error(
          "THREE.EXRLoader: this file is zlib-compressed (ZIP/ZIPS/PXR24/DWA); call setZlibDecoder() with a runtime exporting unzlibSync() before loading it.",
        );
      }
      return decoder.unzlibSync(data);
    };

    const required = <T>(value: T | undefined, what: string): T => {
      if (value === undefined) throw new Error("THREE.EXRLoader: missing " + what + " data.");
      return value;
    };

    function reverseLutFromBitmap(bitmap: Uint8Array, lut: Uint16Array): number {
      let k = 0;

      for (let i = 0; i < USHORT_RANGE; ++i) {
        if (i == 0 || bitmap[i >> 3] & (1 << (i & 7))) {
          lut[k++] = i;
        }
      }

      const n = k - 1;

      while (k < USHORT_RANGE) lut[k++] = 0;

      return n;
    }

    function hufClearDecTable(hdec: HufDecodeEntry[]): void {
      for (let i = 0; i < HUF_DECSIZE; i++) {
        hdec[i] = { len: 0, lit: 0, p: null };
      }
    }

    const getBitsReturn = { l: 0, c: 0, lc: 0 };

    function getBits(nBits: number, c: number, lc: number, uInt8Array: Uint8Array, inOffset: EXROffset): void {
      while (lc < nBits) {
        c = (c << 8) | parseUint8Array(uInt8Array, inOffset);
        lc += 8;
      }

      lc -= nBits;

      getBitsReturn.l = (c >> lc) & ((1 << nBits) - 1);
      getBitsReturn.c = c;
      getBitsReturn.lc = lc;
    }

    const hufTableBuffer = Array<number>(59).fill(0);

    function hufCanonicalCodeTable(hcode: number[]): void {
      for (let i = 0; i <= 58; ++i) hufTableBuffer[i] = 0;
      for (let i = 0; i < HUF_ENCSIZE; ++i) hufTableBuffer[hcode[i]] += 1;

      let c = 0;

      for (let i = 58; i > 0; --i) {
        const nc = (c + hufTableBuffer[i]) >> 1;
        hufTableBuffer[i] = c;
        c = nc;
      }

      for (let i = 0; i < HUF_ENCSIZE; ++i) {
        const l = hcode[i];
        if (l > 0) hcode[i] = l | (hufTableBuffer[l]++ << 6);
      }
    }

    function hufUnpackEncTable(
      uInt8Array: Uint8Array,
      inOffset: EXROffset,
      ni: number,
      im: number,
      iM: number,
      hcode: number[],
    ): void {
      const p = inOffset;
      let c = 0;
      let lc = 0;

      for (; im <= iM; im++) {
        if (p.value - inOffset.value > ni) return;

        getBits(6, c, lc, uInt8Array, p);

        const l = getBitsReturn.l;
        c = getBitsReturn.c;
        lc = getBitsReturn.lc;

        hcode[im] = l;

        if (l == LONG_ZEROCODE_RUN) {
          if (p.value - inOffset.value > ni) {
            throw new Error("THREE.EXRLoader: Something wrong with hufUnpackEncTable");
          }

          getBits(8, c, lc, uInt8Array, p);

          let zerun = getBitsReturn.l + SHORTEST_LONG_RUN;
          c = getBitsReturn.c;
          lc = getBitsReturn.lc;

          if (im + zerun > iM + 1) {
            throw new Error("THREE.EXRLoader: Something wrong with hufUnpackEncTable");
          }

          while (zerun--) hcode[im++] = 0;

          im--;
        } else if (l >= SHORT_ZEROCODE_RUN) {
          let zerun = l - SHORT_ZEROCODE_RUN + 2;

          if (im + zerun > iM + 1) {
            throw new Error("THREE.EXRLoader: Something wrong with hufUnpackEncTable");
          }

          while (zerun--) hcode[im++] = 0;

          im--;
        }
      }

      hufCanonicalCodeTable(hcode);
    }

    function hufLength(code: number): number {
      return code & 63;
    }

    function hufCode(code: number): number {
      return code >> 6;
    }

    function hufBuildDecTable(hcode: number[], im: number, iM: number, hdecod: HufDecodeEntry[]): boolean {
      for (; im <= iM; im++) {
        const c = hufCode(hcode[im]);
        const l = hufLength(hcode[im]);

        if (c >> l) {
          throw new Error("THREE.EXRLoader: Invalid table entry");
        }

        if (l > HUF_DECBITS) {
          const pl = hdecod[c >> (l - HUF_DECBITS)];

          if (pl.len) {
            throw new Error("THREE.EXRLoader: Invalid table entry");
          }

          pl.lit++;

          if (pl.p !== null) {
            const p = pl.p;
            const table = Array<number>(pl.lit);

            for (let i = 0; i < pl.lit - 1; ++i) {
              table[i] = p[i];
            }

            pl.p = table;
          } else {
            pl.p = Array<number>(1);
          }

          const table = pl.p;

          if (table === null) {
            throw new Error("THREE.EXRLoader: Invalid table entry");
          }

          table[pl.lit - 1] = im;
        } else if (l) {
          let plOffset = 0;

          for (let i = 1 << (HUF_DECBITS - l); i > 0; i--) {
            const pl = hdecod[(c << (HUF_DECBITS - l)) + plOffset];

            if (pl.len || pl.p !== null) {
              throw new Error("THREE.EXRLoader: Invalid table entry");
            }

            pl.len = l;
            pl.lit = im;

            plOffset++;
          }
        }
      }

      return true;
    }

    const getCharReturn = { c: 0, lc: 0 };

    function getChar(c: number, lc: number, uInt8Array: Uint8Array, inOffset: EXROffset): void {
      c = (c << 8) | parseUint8Array(uInt8Array, inOffset);
      lc += 8;

      getCharReturn.c = c;
      getCharReturn.lc = lc;
    }

    const getCodeReturn = { c: 0, lc: 0 };

    function getCode(
      po: number,
      rlc: number,
      c: number,
      lc: number,
      uInt8Array: Uint8Array,
      inOffset: EXROffset,
      outBuffer: Uint16Array,
      outBufferOffset: EXROffset,
      outBufferEndOffset: number,
    ): void {
      if (po == rlc) {
        if (lc < 8) {
          getChar(c, lc, uInt8Array, inOffset);
          c = getCharReturn.c;
          lc = getCharReturn.lc;
        }

        lc -= 8;

        let cs = c >> lc;
        cs = new Uint8Array([cs])[0];

        if (outBufferOffset.value + cs > outBufferEndOffset) {
          return;
        }

        const s = outBuffer[outBufferOffset.value - 1];

        while (cs-- > 0) {
          outBuffer[outBufferOffset.value++] = s;
        }
      } else if (outBufferOffset.value < outBufferEndOffset) {
        outBuffer[outBufferOffset.value++] = po;
      } else {
        return;
      }

      getCodeReturn.c = c;
      getCodeReturn.lc = lc;
    }

    function UInt16(value: number): number {
      return value & 0xffff;
    }

    function Int16(value: number): number {
      const ref = UInt16(value);
      return ref > 0x7fff ? ref - 0x10000 : ref;
    }

    const wdec14Return = { a: 0, b: 0 };

    function wdec14(l: number, h: number): void {
      const ls = Int16(l);
      const hs = Int16(h);

      const hi = hs;
      const ai = ls + (hi & 1) + (hi >> 1);

      const as = ai;
      const bs = ai - hi;

      wdec14Return.a = as;
      wdec14Return.b = bs;
    }

    function wdec16(l: number, h: number): void {
      const m = UInt16(l);
      const d = UInt16(h);

      const bb = (m - (d >> 1)) & MOD_MASK;
      const aa = (d + bb - A_OFFSET) & MOD_MASK;

      wdec14Return.a = aa;
      wdec14Return.b = bb;
    }

    function wav2Decode(
      buffer: Uint16Array,
      j: number,
      nx: number,
      ox: number,
      ny: number,
      oy: number,
      mx: number,
    ): number {
      const w14 = mx < 1 << 14;
      const n = nx > ny ? ny : nx;
      let p = 1;
      let p2: number;
      let py = 0;

      while (p <= n) p <<= 1;

      p >>= 1;
      p2 = p;
      p >>= 1;

      while (p >= 1) {
        py = 0;
        const ey = py + oy * (ny - p2);
        const oy1 = oy * p;
        const oy2 = oy * p2;
        const ox1 = ox * p;
        const ox2 = ox * p2;
        let i00: number, i01: number, i10: number, i11: number;

        for (; py <= ey; py += oy2) {
          let px = py;
          const ex = py + ox * (nx - p2);

          for (; px <= ex; px += ox2) {
            const p01 = px + ox1;
            const p10 = px + oy1;
            const p11 = p10 + ox1;

            if (w14) {
              wdec14(buffer[px + j], buffer[p10 + j]);

              i00 = wdec14Return.a;
              i10 = wdec14Return.b;

              wdec14(buffer[p01 + j], buffer[p11 + j]);

              i01 = wdec14Return.a;
              i11 = wdec14Return.b;

              wdec14(i00, i01);

              buffer[px + j] = wdec14Return.a;
              buffer[p01 + j] = wdec14Return.b;

              wdec14(i10, i11);

              buffer[p10 + j] = wdec14Return.a;
              buffer[p11 + j] = wdec14Return.b;
            } else {
              wdec16(buffer[px + j], buffer[p10 + j]);

              i00 = wdec14Return.a;
              i10 = wdec14Return.b;

              wdec16(buffer[p01 + j], buffer[p11 + j]);

              i01 = wdec14Return.a;
              i11 = wdec14Return.b;

              wdec16(i00, i01);

              buffer[px + j] = wdec14Return.a;
              buffer[p01 + j] = wdec14Return.b;

              wdec16(i10, i11);

              buffer[p10 + j] = wdec14Return.a;
              buffer[p11 + j] = wdec14Return.b;
            }
          }

          if (nx & p) {
            const p10 = px + oy1;

            if (w14) wdec14(buffer[px + j], buffer[p10 + j]);
            else wdec16(buffer[px + j], buffer[p10 + j]);

            i00 = wdec14Return.a;
            buffer[p10 + j] = wdec14Return.b;

            buffer[px + j] = i00;
          }
        }

        if (ny & p) {
          let px = py;
          const ex = py + ox * (nx - p2);

          for (; px <= ex; px += ox2) {
            const p01 = px + ox1;

            if (w14) wdec14(buffer[px + j], buffer[p01 + j]);
            else wdec16(buffer[px + j], buffer[p01 + j]);

            i00 = wdec14Return.a;
            buffer[p01 + j] = wdec14Return.b;

            buffer[px + j] = i00;
          }
        }

        p2 = p;
        p >>= 1;
      }

      return py;
    }

    function hufDecode(
      encodingTable: number[],
      decodingTable: HufDecodeEntry[],
      uInt8Array: Uint8Array,
      inOffset: EXROffset,
      ni: number,
      rlc: number,
      no: number,
      outBuffer: Uint16Array,
      outOffset: EXROffset,
    ): boolean {
      let c = 0;
      let lc = 0;
      const outBufferEndOffset = no;
      const inOffsetEnd = Math.trunc(inOffset.value + (ni + 7) / 8);

      while (inOffset.value < inOffsetEnd) {
        getChar(c, lc, uInt8Array, inOffset);

        c = getCharReturn.c;
        lc = getCharReturn.lc;

        while (lc >= HUF_DECBITS) {
          const index = (c >> (lc - HUF_DECBITS)) & HUF_DECMASK;
          const pl = decodingTable[index];

          if (pl.len) {
            lc -= pl.len;

            getCode(pl.lit, rlc, c, lc, uInt8Array, inOffset, outBuffer, outOffset, outBufferEndOffset);

            c = getCodeReturn.c;
            lc = getCodeReturn.lc;
          } else {
            const candidates = pl.p;

            if (candidates === null) {
              throw new Error("THREE.EXRLoader: hufDecode issues");
            }

            let j: number;

            for (j = 0; j < pl.lit; j++) {
              const l = hufLength(encodingTable[candidates[j]]);

              while (lc < l && inOffset.value < inOffsetEnd) {
                getChar(c, lc, uInt8Array, inOffset);

                c = getCharReturn.c;
                lc = getCharReturn.lc;
              }

              if (lc >= l) {
                if (hufCode(encodingTable[candidates[j]]) == ((c >> (lc - l)) & ((1 << l) - 1))) {
                  lc -= l;

                  getCode(candidates[j], rlc, c, lc, uInt8Array, inOffset, outBuffer, outOffset, outBufferEndOffset);

                  c = getCodeReturn.c;
                  lc = getCodeReturn.lc;

                  break;
                }
              }
            }

            if (j == pl.lit) {
              throw new Error("THREE.EXRLoader: hufDecode issues");
            }
          }
        }
      }

      const i = (8 - ni) & 7;

      c >>= i;
      lc -= i;

      while (lc > 0) {
        const pl = decodingTable[(c << (HUF_DECBITS - lc)) & HUF_DECMASK];

        if (pl.len) {
          lc -= pl.len;

          getCode(pl.lit, rlc, c, lc, uInt8Array, inOffset, outBuffer, outOffset, outBufferEndOffset);

          c = getCodeReturn.c;
          lc = getCodeReturn.lc;
        } else {
          throw new Error("THREE.EXRLoader: hufDecode issues");
        }
      }

      return true;
    }

    function hufUncompress(
      uInt8Array: Uint8Array,
      inDataView: DataView,
      inOffset: EXROffset,
      nCompressed: number,
      outBuffer: Uint16Array,
      nRaw: number,
    ): void {
      const outOffset = { value: 0 };
      const initialInOffset = inOffset.value;

      const im = parseUint32(inDataView, inOffset);
      const iM = parseUint32(inDataView, inOffset);

      inOffset.value += 4;

      const nBits = parseUint32(inDataView, inOffset);

      inOffset.value += 4;

      if (im < 0 || im >= HUF_ENCSIZE || iM < 0 || iM >= HUF_ENCSIZE) {
        throw new Error("THREE.EXRLoader: Something wrong with HUF_ENCSIZE");
      }

      const freq = Array<number>(HUF_ENCSIZE).fill(0);
      const hdec = Array<HufDecodeEntry>(HUF_DECSIZE);

      hufClearDecTable(hdec);

      const ni = nCompressed - (inOffset.value - initialInOffset);

      hufUnpackEncTable(uInt8Array, inOffset, ni, im, iM, freq);

      if (nBits > 8 * (nCompressed - (inOffset.value - initialInOffset))) {
        throw new Error("THREE.EXRLoader: Something wrong with hufUncompress");
      }

      hufBuildDecTable(freq, im, iM, hdec);

      hufDecode(freq, hdec, uInt8Array, inOffset, nBits, iM, nRaw, outBuffer, outOffset);
    }

    function applyLut(lut: Uint16Array, data: Uint16Array, nData: number): void {
      for (let i = 0; i < nData; ++i) {
        data[i] = lut[data[i]];
      }
    }

    function predictor(source: Uint8Array): void {
      for (let t = 1; t < source.length; t++) {
        const d = source[t - 1] + source[t] - 128;
        source[t] = d;
      }
    }

    function interleaveScalar(source: Uint8Array, out: Uint8Array): void {
      let t1 = 0;
      let t2 = Math.floor((source.length + 1) / 2);
      let s = 0;
      const stop = source.length - 1;

      while (true) {
        if (s > stop) break;
        out[s++] = source[t1++];

        if (s > stop) break;
        out[s++] = source[t2++];
      }
    }

    function decodeRunLength(source: ArrayBufferLike): number[] {
      let size = source.byteLength;
      const out: number[] = [];
      let p = 0;

      const reader = new DataView(source);

      while (size > 0) {
        const l = reader.getInt8(p++);

        if (l < 0) {
          const count = -l;
          size -= count + 1;

          for (let i = 0; i < count; i++) {
            out.push(reader.getUint8(p++));
          }
        } else {
          const count = l;
          size -= 2;

          const value = reader.getUint8(p++);

          for (let i = 0; i < count + 1; i++) {
            out.push(value);
          }
        }
      }

      return out;
    }

    function lossyDctDecode(
      cscSet: { idx: number[] },
      rowPtrs: number[][],
      channelData: DWAChannelData[],
      acBuffer: Uint16Array,
      dcBuffer: Uint16Array,
      outBuffer: Uint8Array,
    ): void {
      let dataView = new DataView(outBuffer.buffer);

      const width = channelData[cscSet.idx[0]].width;
      const height = channelData[cscSet.idx[0]].height;

      const numComp = 3;

      const numFullBlocksX = Math.floor(width / 8.0);
      const numBlocksX = Math.ceil(width / 8.0);
      const numBlocksY = Math.ceil(height / 8.0);
      const leftoverX = width - (numBlocksX - 1) * 8;
      const leftoverY = height - (numBlocksY - 1) * 8;

      const currAcComp = { value: 0 };
      const currDcComp = Array<number>(numComp);
      const dctData = Array<Float32Array>(numComp);
      const halfZigBlock = Array<Uint16Array>(numComp);
      const rowBlock = Array<Uint16Array>(numComp);
      const rowOffsets = Array<number[]>(numComp);

      for (let comp = 0; comp < numComp; ++comp) {
        rowOffsets[comp] = rowPtrs[cscSet.idx[comp]];
        currDcComp[comp] = comp < 1 ? 0 : currDcComp[comp - 1] + numBlocksX * numBlocksY;
        dctData[comp] = new Float32Array(64);
        halfZigBlock[comp] = new Uint16Array(64);
        rowBlock[comp] = new Uint16Array(numBlocksX * 64);
      }

      for (let blocky = 0; blocky < numBlocksY; ++blocky) {
        let maxY = 8;

        if (blocky == numBlocksY - 1) maxY = leftoverY;

        let maxX = 8;

        for (let blockx = 0; blockx < numBlocksX; ++blockx) {
          if (blockx == numBlocksX - 1) maxX = leftoverX;

          for (let comp = 0; comp < numComp; ++comp) {
            halfZigBlock[comp].fill(0);

            // set block DC component
            halfZigBlock[comp][0] = dcBuffer[currDcComp[comp]++];
            // set block AC components
            unRleAC(currAcComp, acBuffer, halfZigBlock[comp]);

            // UnZigZag block to float
            unZigZag(halfZigBlock[comp], dctData[comp]);
            // decode float dct
            dctInverse(dctData[comp]);
          }

          if (numComp == 3) {
            csc709Inverse(dctData);
          }

          for (let comp = 0; comp < numComp; ++comp) {
            convertToHalf(dctData[comp], rowBlock[comp], blockx * 64);
          }
        } // blockx

        for (let comp = 0; comp < numComp; ++comp) {
          const type = channelData[cscSet.idx[comp]].type;

          for (let y = 8 * blocky; y < 8 * blocky + maxY; ++y) {
            let offset = rowOffsets[comp][y];

            for (let blockx = 0; blockx < numFullBlocksX; ++blockx) {
              const src = blockx * 64 + (y & 0x7) * 8;

              dataView.setUint16(offset, rowBlock[comp][src], true);
              dataView.setUint16(offset + 1 * INT16_SIZE * type, rowBlock[comp][src + 1], true);
              dataView.setUint16(offset + 2 * INT16_SIZE * type, rowBlock[comp][src + 2], true);
              dataView.setUint16(offset + 3 * INT16_SIZE * type, rowBlock[comp][src + 3], true);

              dataView.setUint16(offset + 4 * INT16_SIZE * type, rowBlock[comp][src + 4], true);
              dataView.setUint16(offset + 5 * INT16_SIZE * type, rowBlock[comp][src + 5], true);
              dataView.setUint16(offset + 6 * INT16_SIZE * type, rowBlock[comp][src + 6], true);
              dataView.setUint16(offset + 7 * INT16_SIZE * type, rowBlock[comp][src + 7], true);

              offset += 8 * INT16_SIZE * type;
            }
          }

          // handle partial X blocks
          if (numFullBlocksX != numBlocksX) {
            for (let y = 8 * blocky; y < 8 * blocky + maxY; ++y) {
              const offset = rowOffsets[comp][y] + 8 * numFullBlocksX * INT16_SIZE * type;
              const src = numFullBlocksX * 64 + (y & 0x7) * 8;

              for (let x = 0; x < maxX; ++x) {
                dataView.setUint16(offset + x * INT16_SIZE * type, rowBlock[comp][src + x], true);
              }
            }
          }
        } // comp
      } // blocky

      const halfRow = new Uint16Array(width);
      dataView = new DataView(outBuffer.buffer);

      // convert channels back to float, if needed
      for (let comp = 0; comp < numComp; ++comp) {
        channelData[cscSet.idx[comp]].decoded = true;
        const type = channelData[cscSet.idx[comp]].type;

        if (channelData[comp].type != 2) continue;

        for (let y = 0; y < height; ++y) {
          const offset = rowOffsets[comp][y];

          for (let x = 0; x < width; ++x) {
            halfRow[x] = dataView.getUint16(offset + x * INT16_SIZE * type, true);
          }

          for (let x = 0; x < width; ++x) {
            dataView.setFloat32(offset + x * INT16_SIZE * type, fromHalfFloat(halfRow[x]), true);
          }
        }
      }
    }

    function lossyDctChannelDecode(
      channelIndex: number,
      rowPtrs: number[][],
      channelData: DWAChannelData[],
      acBuffer: Uint16Array,
      dcBuffer: Uint16Array,
      outBuffer: Uint8Array,
    ): void {
      const dataView = new DataView(outBuffer.buffer);
      const cd = channelData[channelIndex];
      const width = cd.width;
      const height = cd.height;

      const numBlocksX = Math.ceil(width / 8.0);
      const numBlocksY = Math.ceil(height / 8.0);
      const numFullBlocksX = Math.floor(width / 8.0);
      const leftoverX = width - (numBlocksX - 1) * 8;
      const leftoverY = height - (numBlocksY - 1) * 8;

      const currAcComp = { value: 0 };
      let currDcComp = 0;
      const dctData = new Float32Array(64);
      const halfZigBlock = new Uint16Array(64);
      const rowBlock = new Uint16Array(numBlocksX * 64);

      for (let blocky = 0; blocky < numBlocksY; ++blocky) {
        let maxY = 8;

        if (blocky == numBlocksY - 1) maxY = leftoverY;

        for (let blockx = 0; blockx < numBlocksX; ++blockx) {
          halfZigBlock.fill(0);
          halfZigBlock[0] = dcBuffer[currDcComp++];
          unRleAC(currAcComp, acBuffer, halfZigBlock);
          unZigZag(halfZigBlock, dctData);
          dctInverse(dctData);
          convertToHalf(dctData, rowBlock, blockx * 64);
        }

        // Write decoded data to output buffer
        for (let y = 8 * blocky; y < 8 * blocky + maxY; ++y) {
          let offset = rowPtrs[channelIndex][y];

          for (let blockx = 0; blockx < numFullBlocksX; ++blockx) {
            const src = blockx * 64 + (y & 0x7) * 8;

            for (let x = 0; x < 8; ++x) {
              dataView.setUint16(offset + x * INT16_SIZE * cd.type, rowBlock[src + x], true);
            }

            offset += 8 * INT16_SIZE * cd.type;
          }

          if (numBlocksX != numFullBlocksX) {
            const src = numFullBlocksX * 64 + (y & 0x7) * 8;

            for (let x = 0; x < leftoverX; ++x) {
              dataView.setUint16(offset + x * INT16_SIZE * cd.type, rowBlock[src + x], true);
            }
          }
        }
      }

      cd.decoded = true;
    }

    function unRleAC(currAcComp: EXROffset, acBuffer: Uint16Array, halfZigBlock: Uint16Array): void {
      let acValue: number;
      let dctComp = 1;

      while (dctComp < 64) {
        acValue = acBuffer[currAcComp.value];

        if (acValue == 0xff00) {
          dctComp = 64;
        } else if (acValue >> 8 == 0xff) {
          dctComp += acValue & 0xff;
        } else {
          halfZigBlock[dctComp] = acValue;
          dctComp++;
        }

        currAcComp.value++;
      }
    }

    function unZigZag(src: Uint16Array, dst: Float32Array): void {
      dst[0] = fromHalfFloat(src[0]);
      dst[1] = fromHalfFloat(src[1]);
      dst[2] = fromHalfFloat(src[5]);
      dst[3] = fromHalfFloat(src[6]);
      dst[4] = fromHalfFloat(src[14]);
      dst[5] = fromHalfFloat(src[15]);
      dst[6] = fromHalfFloat(src[27]);
      dst[7] = fromHalfFloat(src[28]);
      dst[8] = fromHalfFloat(src[2]);
      dst[9] = fromHalfFloat(src[4]);

      dst[10] = fromHalfFloat(src[7]);
      dst[11] = fromHalfFloat(src[13]);
      dst[12] = fromHalfFloat(src[16]);
      dst[13] = fromHalfFloat(src[26]);
      dst[14] = fromHalfFloat(src[29]);
      dst[15] = fromHalfFloat(src[42]);
      dst[16] = fromHalfFloat(src[3]);
      dst[17] = fromHalfFloat(src[8]);
      dst[18] = fromHalfFloat(src[12]);
      dst[19] = fromHalfFloat(src[17]);

      dst[20] = fromHalfFloat(src[25]);
      dst[21] = fromHalfFloat(src[30]);
      dst[22] = fromHalfFloat(src[41]);
      dst[23] = fromHalfFloat(src[43]);
      dst[24] = fromHalfFloat(src[9]);
      dst[25] = fromHalfFloat(src[11]);
      dst[26] = fromHalfFloat(src[18]);
      dst[27] = fromHalfFloat(src[24]);
      dst[28] = fromHalfFloat(src[31]);
      dst[29] = fromHalfFloat(src[40]);

      dst[30] = fromHalfFloat(src[44]);
      dst[31] = fromHalfFloat(src[53]);
      dst[32] = fromHalfFloat(src[10]);
      dst[33] = fromHalfFloat(src[19]);
      dst[34] = fromHalfFloat(src[23]);
      dst[35] = fromHalfFloat(src[32]);
      dst[36] = fromHalfFloat(src[39]);
      dst[37] = fromHalfFloat(src[45]);
      dst[38] = fromHalfFloat(src[52]);
      dst[39] = fromHalfFloat(src[54]);

      dst[40] = fromHalfFloat(src[20]);
      dst[41] = fromHalfFloat(src[22]);
      dst[42] = fromHalfFloat(src[33]);
      dst[43] = fromHalfFloat(src[38]);
      dst[44] = fromHalfFloat(src[46]);
      dst[45] = fromHalfFloat(src[51]);
      dst[46] = fromHalfFloat(src[55]);
      dst[47] = fromHalfFloat(src[60]);
      dst[48] = fromHalfFloat(src[21]);
      dst[49] = fromHalfFloat(src[34]);

      dst[50] = fromHalfFloat(src[37]);
      dst[51] = fromHalfFloat(src[47]);
      dst[52] = fromHalfFloat(src[50]);
      dst[53] = fromHalfFloat(src[56]);
      dst[54] = fromHalfFloat(src[59]);
      dst[55] = fromHalfFloat(src[61]);
      dst[56] = fromHalfFloat(src[35]);
      dst[57] = fromHalfFloat(src[36]);
      dst[58] = fromHalfFloat(src[48]);
      dst[59] = fromHalfFloat(src[49]);

      dst[60] = fromHalfFloat(src[57]);
      dst[61] = fromHalfFloat(src[58]);
      dst[62] = fromHalfFloat(src[62]);
      dst[63] = fromHalfFloat(src[63]);
    }

    function dctInverse(data: Float32Array): void {
      const a = 0.5 * Math.cos(3.14159 / 4.0);
      const b = 0.5 * Math.cos(3.14159 / 16.0);
      const c = 0.5 * Math.cos(3.14159 / 8.0);
      const d = 0.5 * Math.cos((3.0 * 3.14159) / 16.0);
      const e = 0.5 * Math.cos((5.0 * 3.14159) / 16.0);
      const f = 0.5 * Math.cos((3.0 * 3.14159) / 8.0);
      const g = 0.5 * Math.cos((7.0 * 3.14159) / 16.0);

      const alpha = Array<number>(4);
      const beta = Array<number>(4);
      const theta = Array<number>(4);
      const gamma = Array<number>(4);

      for (let row = 0; row < 8; ++row) {
        const rowPtr = row * 8;

        alpha[0] = c * data[rowPtr + 2];
        alpha[1] = f * data[rowPtr + 2];
        alpha[2] = c * data[rowPtr + 6];
        alpha[3] = f * data[rowPtr + 6];

        beta[0] = b * data[rowPtr + 1] + d * data[rowPtr + 3] + e * data[rowPtr + 5] + g * data[rowPtr + 7];
        beta[1] = d * data[rowPtr + 1] - g * data[rowPtr + 3] - b * data[rowPtr + 5] - e * data[rowPtr + 7];
        beta[2] = e * data[rowPtr + 1] - b * data[rowPtr + 3] + g * data[rowPtr + 5] + d * data[rowPtr + 7];
        beta[3] = g * data[rowPtr + 1] - e * data[rowPtr + 3] + d * data[rowPtr + 5] - b * data[rowPtr + 7];

        theta[0] = a * (data[rowPtr + 0] + data[rowPtr + 4]);
        theta[3] = a * (data[rowPtr + 0] - data[rowPtr + 4]);
        theta[1] = alpha[0] + alpha[3];
        theta[2] = alpha[1] - alpha[2];

        gamma[0] = theta[0] + theta[1];
        gamma[1] = theta[3] + theta[2];
        gamma[2] = theta[3] - theta[2];
        gamma[3] = theta[0] - theta[1];

        data[rowPtr + 0] = gamma[0] + beta[0];
        data[rowPtr + 1] = gamma[1] + beta[1];
        data[rowPtr + 2] = gamma[2] + beta[2];
        data[rowPtr + 3] = gamma[3] + beta[3];

        data[rowPtr + 4] = gamma[3] - beta[3];
        data[rowPtr + 5] = gamma[2] - beta[2];
        data[rowPtr + 6] = gamma[1] - beta[1];
        data[rowPtr + 7] = gamma[0] - beta[0];
      }

      for (let column = 0; column < 8; ++column) {
        alpha[0] = c * data[16 + column];
        alpha[1] = f * data[16 + column];
        alpha[2] = c * data[48 + column];
        alpha[3] = f * data[48 + column];

        beta[0] = b * data[8 + column] + d * data[24 + column] + e * data[40 + column] + g * data[56 + column];
        beta[1] = d * data[8 + column] - g * data[24 + column] - b * data[40 + column] - e * data[56 + column];
        beta[2] = e * data[8 + column] - b * data[24 + column] + g * data[40 + column] + d * data[56 + column];
        beta[3] = g * data[8 + column] - e * data[24 + column] + d * data[40 + column] - b * data[56 + column];

        theta[0] = a * (data[column] + data[32 + column]);
        theta[3] = a * (data[column] - data[32 + column]);

        theta[1] = alpha[0] + alpha[3];
        theta[2] = alpha[1] - alpha[2];

        gamma[0] = theta[0] + theta[1];
        gamma[1] = theta[3] + theta[2];
        gamma[2] = theta[3] - theta[2];
        gamma[3] = theta[0] - theta[1];

        data[0 + column] = gamma[0] + beta[0];
        data[8 + column] = gamma[1] + beta[1];
        data[16 + column] = gamma[2] + beta[2];
        data[24 + column] = gamma[3] + beta[3];

        data[32 + column] = gamma[3] - beta[3];
        data[40 + column] = gamma[2] - beta[2];
        data[48 + column] = gamma[1] - beta[1];
        data[56 + column] = gamma[0] - beta[0];
      }
    }

    function csc709Inverse(data: Float32Array[]): void {
      for (let i = 0; i < 64; ++i) {
        const y = data[0][i];
        const cb = data[1][i];
        const cr = data[2][i];

        data[0][i] = y + 1.5747 * cr;
        data[1][i] = y - 0.1873 * cb - 0.4682 * cr;
        data[2][i] = y + 1.8556 * cb;
      }
    }

    const _f32 = new Float32Array(1);
    const _u32 = new Uint32Array(_f32.buffer);

    // float -> half bits with round-to-nearest-even, like Imath's float_to_half
    // (toHalfFloat truncates, which is what put DWA output 1-5 ulp off OpenEXR).
    function floatToHalfBits(f: number): number {
      _f32[0] = f;
      const x = _u32[0];
      const sign = (x >>> 16) & 0x8000;
      const a = x & 0x7fffffff;

      if (a >= 0x47800000) return sign | (a > 0x7f800000 ? 0x7e00 : 0x7c00); // overflow, Inf, NaN

      if (a < 0x38800000) {
        // subnormal or zero in half
        _f32[0] = Math.abs(f) + 0.5; // 0.5 = 2^-1: forces rounding to a 2^-24 grid
        return sign | (_u32[0] - 0x3f000000);
      }

      const r = a + 0xfff + ((a >>> 13) & 1);
      return sign | ((r - 0x38000000) >>> 13);
    }

    function convertToHalf(src: Float32Array, dst: Uint16Array, idx: number): void {
      if (dwaToLinearTable === null) {
        // Mirrors OpenEXR dwaLookups.cpp: gamma 2.2 below 1, log curve above,
        // applied to the half bits after rounding so results match bit for bit.

        dwaToLinearTable = new Uint16Array(65536);

        for (let i = 1; i < 65536; ++i) {
          if ((i & 0x7c00) === 0x7c00) continue; // NaN / Inf -> 0

          const h = fromHalfFloat(i);
          const v = Math.abs(h);
          const linear = v <= 1 ? Math.pow(v, 2.2) : Math.pow(logBase, v - 1);

          dwaToLinearTable[i] = floatToHalfBits(h < 0 ? -linear : linear);
        }
      }

      for (let i = 0; i < 64; ++i) {
        dst[idx + i] = dwaToLinearTable[floatToHalfBits(src[i])];
      }
    }

    function uncompressRAW(info: EXRDecoderState): DataView {
      return new DataView(info.array.buffer, info.offset.value, info.size);
    }

    function uncompressRLE(info: EXRDecoderState): DataView {
      const compressed = info.viewer.buffer.slice(info.offset.value, info.offset.value + info.size);

      const rawBuffer = new Uint8Array(decodeRunLength(compressed));
      const tmpBuffer = new Uint8Array(rawBuffer.length);

      predictor(rawBuffer); // revert predictor

      interleaveScalar(rawBuffer, tmpBuffer); // interleave pixels

      return new DataView(tmpBuffer.buffer);
    }

    function uncompressZIP(info: EXRDecoderState): DataView {
      const compressed = info.array.slice(info.offset.value, info.offset.value + info.size);

      const rawBuffer = decodeZlib(compressed);
      const tmpBuffer = new Uint8Array(rawBuffer.length);

      predictor(rawBuffer); // revert predictor

      interleaveScalar(rawBuffer, tmpBuffer); // interleave pixels

      return new DataView(tmpBuffer.buffer);
    }

    function uncompressPIZ(info: EXRDecoderState): DataView {
      const inDataView = info.viewer;
      const inOffset = { value: info.offset.value };

      const outBuffer = new Uint16Array(info.columns * info.lines * (info.inputChannels.length * info.type));
      const bitmap = new Uint8Array(BITMAP_SIZE);

      // Setup channel info
      let outBufferEnd = 0;
      const pizChannelData = Array<PIZChannelData>(info.inputChannels.length);
      for (let i = 0, il = info.inputChannels.length; i < il; i++) {
        pizChannelData[i] = {
          start: outBufferEnd,
          end: outBufferEnd,
          nx: info.columns,
          ny: info.lines,
          size: info.type,
        };

        outBufferEnd += pizChannelData[i].nx * pizChannelData[i].ny * pizChannelData[i].size;
      }

      // Read range compression data

      const minNonZero = parseUint16(inDataView, inOffset);
      const maxNonZero = parseUint16(inDataView, inOffset);

      if (maxNonZero >= BITMAP_SIZE) {
        throw new Error("THREE.EXRLoader: Something is wrong with PIZ_COMPRESSION BITMAP_SIZE");
      }

      if (minNonZero <= maxNonZero) {
        for (let i = 0; i < maxNonZero - minNonZero + 1; i++) {
          bitmap[i + minNonZero] = parseUint8(inDataView, inOffset);
        }
      }

      // Reverse LUT
      const lut = new Uint16Array(USHORT_RANGE);
      const maxValue = reverseLutFromBitmap(bitmap, lut);

      const length = parseUint32(inDataView, inOffset);

      // Huffman decoding
      hufUncompress(info.array, inDataView, inOffset, length, outBuffer, outBufferEnd);

      // Wavelet decoding
      for (let i = 0; i < info.inputChannels.length; ++i) {
        const cd = pizChannelData[i];

        for (let j = 0; j < pizChannelData[i].size; ++j) {
          wav2Decode(outBuffer, cd.start + j, cd.nx, cd.size, cd.ny, cd.nx * cd.size, maxValue);
        }
      }

      // Expand the pixel data to their original range
      applyLut(lut, outBuffer, outBufferEnd);

      // Rearrange the pixel data into the format expected by the caller.
      let tmpOffset = 0;
      const tmpBuffer = new Uint8Array(outBuffer.buffer.byteLength);
      for (let y = 0; y < info.lines; y++) {
        for (let c = 0; c < info.inputChannels.length; c++) {
          const cd = pizChannelData[c];

          const n = cd.nx * cd.size;
          const cp = new Uint8Array(outBuffer.buffer, cd.end * INT16_SIZE, n * INT16_SIZE);

          tmpBuffer.set(cp, tmpOffset);
          tmpOffset += n * INT16_SIZE;
          cd.end += n;
        }
      }

      return new DataView(tmpBuffer.buffer);
    }

    function uncompressPXR(info: EXRDecoderState): DataView {
      const compressed = info.array.slice(info.offset.value, info.offset.value + info.size);

      const rawBuffer = decodeZlib(compressed);

      const byteSize = info.inputChannels.length * info.lines * info.columns * info.totalBytes;
      const tmpBuffer = new ArrayBuffer(byteSize);
      const viewer = new DataView(tmpBuffer);

      let tmpBufferEnd = 0;
      let writePtr = 0;
      const ptr = Array<number>(4);

      for (let y = 0; y < info.lines; y++) {
        for (let c = 0; c < info.inputChannels.length; c++) {
          let pixel = 0;

          const type = info.inputChannels[c].pixelType;
          switch (type) {
            case 1:
              ptr[0] = tmpBufferEnd;
              ptr[1] = ptr[0] + info.columns;
              tmpBufferEnd = ptr[1] + info.columns;

              for (let j = 0; j < info.columns; ++j) {
                const diff = (rawBuffer[ptr[0]++] << 8) | rawBuffer[ptr[1]++];

                pixel += diff;

                viewer.setUint16(writePtr, pixel, true);
                writePtr += 2;
              }

              break;

            case 2:
              ptr[0] = tmpBufferEnd;
              ptr[1] = ptr[0] + info.columns;
              ptr[2] = ptr[1] + info.columns;
              tmpBufferEnd = ptr[2] + info.columns;

              for (let j = 0; j < info.columns; ++j) {
                const diff = (rawBuffer[ptr[0]++] << 24) | (rawBuffer[ptr[1]++] << 16) | (rawBuffer[ptr[2]++] << 8);

                pixel += diff;

                viewer.setUint32(writePtr, pixel, true);
                writePtr += 4;
              }

              break;
          }
        }
      }

      return viewer;
    }

    function uncompressB44(info: EXRDecoderState): DataView {
      const src = info.array;
      let srcOffset = info.offset.value;

      const width = info.columns;
      const height = info.lines;
      const channels = info.inputChannels;
      const totalBytes = info.totalBytes;

      // B44A allows 3-byte flat blocks; B44 always uses 14-byte blocks
      const isB44A = EXRHeader.compression === "B44A_COMPRESSION";

      // Output buffer organised as:
      // for each scanline y: [ ch0 pixels (w×2 bytes) | ch1 pixels | … ]
      const outBuffer = new Uint8Array(height * width * totalBytes);

      // Reusable 4×4 block buffer
      const block = new Uint16Array(16);

      // chByteOffset mirrors channelByteOffsets accumulation in setupDecoder
      let chByteOffset = 0;

      for (let c = 0; c < channels.length; c++) {
        const channel = channels[c];
        const pixelSize = channel.pixelType * 2; // HALF=2, FLOAT=4

        // Effective dimensions for this channel (subsampled channels are smaller)
        const chanWidth = Math.ceil(width / channel.xSampling);
        const chanHeight = Math.ceil(height / channel.ySampling);
        const isFullRes = channel.xSampling === 1 && channel.ySampling === 1;

        if (channel.pixelType !== 1) {
          // Non-HALF channels are stored raw, scanline by scanline
          for (let y = 0; y < chanHeight; y++) {
            if (isFullRes) {
              const lineBase = y * width * totalBytes + chByteOffset * width;
              for (let x = 0; x < chanWidth * pixelSize; x++) {
                outBuffer[lineBase + x] = src[srcOffset++];
              }
            } else {
              srcOffset += chanWidth * pixelSize;
            }
          }

          chByteOffset += pixelSize;
          continue;
        }

        // HALF channel — process 4×4 blocks at effective channel dimensions
        const numBlocksX = Math.ceil(chanWidth / 4);
        const numBlocksY = Math.ceil(chanHeight / 4);

        for (let by = 0; by < numBlocksY; by++) {
          for (let bx = 0; bx < numBlocksX; bx++) {
            // B44A only: flat-block when shift ≥ 13 (byte[2] ≥ 52)
            if (isB44A && src[srcOffset + 2] >= 52) {
              // 3-byte flat block — all 16 pixels share one value
              const t = (src[srcOffset] << 8) | src[srcOffset + 1];
              const h = t & 0x8000 ? t & 0x7fff : ~t & 0xffff;
              block.fill(h);
              srcOffset += 3;
            } else {
              // 14-byte B44 block
              const s0 = (src[srcOffset] << 8) | src[srcOffset + 1];
              const shift = src[srcOffset + 2] >> 2;
              const bias = 0x20 << shift;

              // Reconstruct 16 ordered-magnitude values from 6-bit running deltas.
              // Prediction structure (row = 4 pixels wide):
              //   column 0 top-to-bottom: s0 → s4 → s8  → s12
              //   then row-wise:          s0 → s1 → s2  → s3
              //                           s4 → s5 → s6  → s7  etc.

              const s4 =
                (s0 + (((src[srcOffset + 2] << 4) | (src[srcOffset + 3] >> 4)) & 0x3f) * (1 << shift) - bias) & 0xffff;
              const s8 =
                (s4 + (((src[srcOffset + 3] << 2) | (src[srcOffset + 4] >> 6)) & 0x3f) * (1 << shift) - bias) & 0xffff;
              const s12 = (s8 + (src[srcOffset + 4] & 0x3f) * (1 << shift) - bias) & 0xffff;

              const s1 = (s0 + ((src[srcOffset + 5] >> 2) & 0x3f) * (1 << shift) - bias) & 0xffff;
              const s5 =
                (s4 + (((src[srcOffset + 5] << 4) | (src[srcOffset + 6] >> 4)) & 0x3f) * (1 << shift) - bias) & 0xffff;
              const s9 =
                (s8 + (((src[srcOffset + 6] << 2) | (src[srcOffset + 7] >> 6)) & 0x3f) * (1 << shift) - bias) & 0xffff;
              const s13 = (s12 + (src[srcOffset + 7] & 0x3f) * (1 << shift) - bias) & 0xffff;

              const s2 = (s1 + ((src[srcOffset + 8] >> 2) & 0x3f) * (1 << shift) - bias) & 0xffff;
              const s6 =
                (s5 + (((src[srcOffset + 8] << 4) | (src[srcOffset + 9] >> 4)) & 0x3f) * (1 << shift) - bias) & 0xffff;
              const s10 =
                (s9 + (((src[srcOffset + 9] << 2) | (src[srcOffset + 10] >> 6)) & 0x3f) * (1 << shift) - bias) & 0xffff;
              const s14 = (s13 + (src[srcOffset + 10] & 0x3f) * (1 << shift) - bias) & 0xffff;

              const s3 = (s2 + ((src[srcOffset + 11] >> 2) & 0x3f) * (1 << shift) - bias) & 0xffff;
              const s7 =
                (s6 + (((src[srcOffset + 11] << 4) | (src[srcOffset + 12] >> 4)) & 0x3f) * (1 << shift) - bias) &
                0xffff;
              const s11 =
                (s10 + (((src[srcOffset + 12] << 2) | (src[srcOffset + 13] >> 6)) & 0x3f) * (1 << shift) - bias) &
                0xffff;
              const s15 = (s14 + (src[srcOffset + 13] & 0x3f) * (1 << shift) - bias) & 0xffff;

              // Convert ordered-magnitude → half-float:
              // positive (bit15=1): clear sign bit; negative (bit15=0): invert all bits
              const t = [s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15];
              for (let i = 0; i < 16; i++) {
                block[i] = t[i] & 0x8000 ? t[i] & 0x7fff : ~t[i] & 0xffff;
              }

              srcOffset += 14;
            }

            // pLinear channels: data was stored as exp(x/8), convert back with 8·log(x)
            if (channel.pLinear) {
              if (b44LogTable === null) {
                b44LogTable = new Uint16Array(65536);
                for (let i = 0; i < 65536; i++) {
                  if ((i & 0x7c00) === 0x7c00 || i > 0x8000) {
                    b44LogTable[i] = 0;
                  } else {
                    const f = fromHalfFloat(i);
                    b44LogTable[i] = f <= 0 ? 0 : toHalfFloat(8 * Math.log(f));
                  }
                }
              }

              for (let i = 0; i < 16; i++) block[i] = b44LogTable[block[i]];
            }

            // Scatter the 16 pixels into the scanline-interleaved output buffer.
            // For subsampled channels (e.g. RY/BY with xSampling=ySampling=2) each decoded
            // pixel is replicated across its xSampling×ySampling footprint so the output
            // buffer has uniform full-resolution scanlines that parseScanline can read directly.
            for (let py = 0; py < 4; py++) {
              const chanY = by * 4 + py;
              if (chanY >= chanHeight) continue;

              for (let px = 0; px < 4; px++) {
                const chanX = bx * 4 + px;
                if (chanX >= chanWidth) continue;

                const val = block[py * 4 + px];

                for (let dy = 0; dy < channel.ySampling; dy++) {
                  const fullY = chanY * channel.ySampling + dy;
                  if (fullY >= height) continue;

                  for (let dx = 0; dx < channel.xSampling; dx++) {
                    const fullX = chanX * channel.xSampling + dx;
                    if (fullX >= width) continue;

                    const outIdx = fullY * width * totalBytes + chByteOffset * width + fullX * 2;
                    outBuffer[outIdx] = val & 0xff;
                    outBuffer[outIdx + 1] = (val >> 8) & 0xff;
                  }
                }
              }
            }
          }
        }

        chByteOffset += 2; // HALF = 2 bytes per pixel
      }

      return new DataView(outBuffer.buffer);
    }

    function uncompressDWA(info: EXRDecoderState): DataView {
      const inDataView = info.viewer;
      const inOffset = { value: info.offset.value };
      const outBuffer = new Uint8Array(
        info.columns * info.lines * (info.inputChannels.length * info.type * INT16_SIZE),
      );

      // Read compression header information
      const dwaHeader = {
        version: parseInt64(inDataView, inOffset),
        unknownUncompressedSize: parseInt64(inDataView, inOffset),
        unknownCompressedSize: parseInt64(inDataView, inOffset),
        acCompressedSize: parseInt64(inDataView, inOffset),
        dcCompressedSize: parseInt64(inDataView, inOffset),
        rleCompressedSize: parseInt64(inDataView, inOffset),
        rleUncompressedSize: parseInt64(inDataView, inOffset),
        rleRawSize: parseInt64(inDataView, inOffset),
        totalAcUncompressedCount: parseInt64(inDataView, inOffset),
        totalDcUncompressedCount: parseInt64(inDataView, inOffset),
        acCompression: parseInt64(inDataView, inOffset),
      };

      if (dwaHeader.version < 2) {
        throw new Error(
          "THREE.EXRLoader: " + EXRHeader.compression + " version " + dwaHeader.version + " is unsupported",
        );
      }

      // Read channel ruleset information
      const channelRules: Array<{ name: string; index: number; type: number; compression: number }> = [];
      let ruleSize = parseUint16(inDataView, inOffset) - INT16_SIZE;

      while (ruleSize > 0) {
        const name = parseNullTerminatedString(inDataView.buffer, inOffset);
        const value = parseUint8(inDataView, inOffset);
        const compression = (value >> 2) & 3;
        const csc = (value >> 4) - 1;
        const index = new Int8Array([csc])[0];
        const type = parseUint8(inDataView, inOffset);

        channelRules.push({ name, index, type, compression });

        ruleSize -= name.length + 3;
      }

      // Classify channels
      const channels = EXRHeader.channels;
      const channelData = Array<DWAChannelData>(info.inputChannels.length);

      for (let i = 0; i < info.inputChannels.length; ++i) {
        const channel = channels[i];

        channelData[i] = {
          name: channel.name,
          compression: UNKNOWN,
          decoded: false,
          type: channel.pixelType,
          pLinear: channel.pLinear,
          width: info.columns,
          height: info.lines,
        };
      }

      const cscSet: { idx: (number | undefined)[] } = { idx: Array<number | undefined>(3) };

      for (let offset = 0; offset < info.inputChannels.length; ++offset) {
        const cd = channelData[offset];

        const dotIndex = cd.name.lastIndexOf(".");
        const suffix = dotIndex >= 0 ? cd.name.substring(dotIndex + 1) : cd.name;

        for (let i = 0; i < channelRules.length; ++i) {
          const rule = channelRules[i];

          if (suffix === rule.name && cd.type === rule.type) {
            cd.compression = rule.compression;

            if (rule.index >= 0) {
              cscSet.idx[rule.index] = offset;
            }

            cd.offset = offset;
          }
        }
      }

      let acBuffer: Uint16Array | undefined;
      let dcBuffer: Uint16Array | undefined;
      let rleBuffer: number[] | undefined;

      // Read DCT - AC component data
      if (dwaHeader.acCompressedSize > 0) {
        switch (dwaHeader.acCompression) {
          case STATIC_HUFFMAN:
            acBuffer = new Uint16Array(dwaHeader.totalAcUncompressedCount);
            hufUncompress(
              info.array,
              inDataView,
              inOffset,
              dwaHeader.acCompressedSize,
              acBuffer,
              dwaHeader.totalAcUncompressedCount,
            );
            break;

          case DEFLATE: {
            const compressed = info.array.slice(inOffset.value, inOffset.value + dwaHeader.totalAcUncompressedCount);
            const data = decodeZlib(compressed);
            acBuffer = new Uint16Array(data.buffer);
            inOffset.value += dwaHeader.totalAcUncompressedCount;
            break;
          }
        }
      }

      // Read DCT - DC component data
      if (dwaHeader.dcCompressedSize > 0) {
        const zlibInfo: EXRDecoderState = {
          ...info,
          offset: inOffset,
          size: dwaHeader.dcCompressedSize,
        };
        dcBuffer = new Uint16Array(uncompressZIP(zlibInfo).buffer);
        inOffset.value += dwaHeader.dcCompressedSize;
      }

      // Read RLE compressed data
      if (dwaHeader.rleRawSize > 0) {
        const compressed = info.array.slice(inOffset.value, inOffset.value + dwaHeader.rleCompressedSize);
        const data = decodeZlib(compressed);
        rleBuffer = decodeRunLength(data.buffer);

        inOffset.value += dwaHeader.rleCompressedSize;
      }

      // Prepare outbuffer data offset
      let outBufferEnd = 0;
      const rowOffsets = Array<number[]>(channelData.length);
      for (let i = 0; i < rowOffsets.length; ++i) {
        rowOffsets[i] = [];
      }

      for (let y = 0; y < info.lines; ++y) {
        for (let chan = 0; chan < channelData.length; ++chan) {
          rowOffsets[chan].push(outBufferEnd);
          outBufferEnd += channelData[chan].width * info.type * INT16_SIZE;
        }
      }

      // Decode lossy DCT data if we have a valid color space conversion set with the first RGB channel present
      const firstIndex = cscSet.idx[0];
      if (firstIndex !== undefined && channelData[firstIndex]) {
        const idx = Array<number>(3);
        for (let comp = 0; comp < 3; comp++) {
          const index = cscSet.idx[comp];
          if (index === undefined) {
            throw new Error("THREE.EXRLoader: DWA color space conversion is missing a channel.");
          }
          idx[comp] = index;
        }

        lossyDctDecode(
          { idx },
          rowOffsets,
          channelData,
          required(acBuffer, "DWA AC"),
          required(dcBuffer, "DWA DC"),
          outBuffer,
        );
      }

      // Decode other channels
      for (let i = 0; i < channelData.length; ++i) {
        const cd = channelData[i];

        if (cd.decoded) continue;

        switch (cd.compression) {
          case RLE: {
            const rle = required(rleBuffer, "DWA RLE");
            let row = 0;
            let rleOffset = 0;

            for (let y = 0; y < info.lines; ++y) {
              let rowOffsetBytes = rowOffsets[i][row];

              for (let x = 0; x < cd.width; ++x) {
                for (let byte = 0; byte < INT16_SIZE * cd.type; ++byte) {
                  outBuffer[rowOffsetBytes++] = rle[rleOffset + byte * cd.width * cd.height];
                }

                rleOffset++;
              }

              row++;
            }

            break;
          }

          case LOSSY_DCT:
            lossyDctChannelDecode(
              i,
              rowOffsets,
              channelData,
              required(acBuffer, "DWA AC"),
              required(dcBuffer, "DWA DC"),
              outBuffer,
            );

            break;

          default:
            throw new Error("THREE.EXRLoader: unsupported channel compression");
        }
      }

      return new DataView(outBuffer.buffer);
    }

    function parseNullTerminatedString(buffer: ArrayBufferLike, offset: EXROffset): string {
      const uintBuffer = new Uint8Array(buffer);
      let endOffset = 0;

      while (uintBuffer[offset.value + endOffset] != 0) {
        endOffset += 1;
      }

      const stringValue = new TextDecoder().decode(uintBuffer.slice(offset.value, offset.value + endOffset));

      offset.value = offset.value + endOffset + 1;

      return stringValue;
    }

    function parseFixedLengthString(buffer: ArrayBufferLike, offset: EXROffset, size: number): string {
      const stringValue = new TextDecoder().decode(new Uint8Array(buffer).slice(offset.value, offset.value + size));

      offset.value = offset.value + size;

      return stringValue;
    }

    function parseRational(dataView: DataView, offset: EXROffset): [number, number] {
      const x = parseInt32(dataView, offset);
      const y = parseUint32(dataView, offset);

      return [x, y];
    }

    function parseTimecode(dataView: DataView, offset: EXROffset): [number, number] {
      const x = parseUint32(dataView, offset);
      const y = parseUint32(dataView, offset);

      return [x, y];
    }

    function parseInt32(dataView: DataView, offset: EXROffset): number {
      const Int32 = dataView.getInt32(offset.value, true);

      offset.value = offset.value + INT32_SIZE;

      return Int32;
    }

    function parseUint32(dataView: DataView, offset: EXROffset): number {
      const Uint32 = dataView.getUint32(offset.value, true);

      offset.value = offset.value + INT32_SIZE;

      return Uint32;
    }

    function parseUint8Array(uInt8Array: Uint8Array, offset: EXROffset): number {
      const Uint8 = uInt8Array[offset.value];

      offset.value = offset.value + INT8_SIZE;

      return Uint8;
    }

    function parseUint8(dataView: DataView, offset: EXROffset): number {
      const Uint8 = dataView.getUint8(offset.value);

      offset.value = offset.value + INT8_SIZE;

      return Uint8;
    }

    function parseInt64(dataView: DataView, offset: EXROffset): number {
      const int = Number(dataView.getBigInt64(offset.value, true));

      offset.value += ULONG_SIZE;

      return int;
    }

    function parseFloat32(dataView: DataView, offset: EXROffset): number {
      const float = dataView.getFloat32(offset.value, true);

      offset.value += FLOAT32_SIZE;

      return float;
    }

    function decodeFloat32(dataView: DataView, offset: EXROffset): number {
      return toHalfFloat(parseFloat32(dataView, offset));
    }

    function parseUint16(dataView: DataView, offset: EXROffset): number {
      const Uint16 = dataView.getUint16(offset.value, true);

      offset.value += INT16_SIZE;

      return Uint16;
    }

    function parseFloat16(buffer: DataView, offset: EXROffset): number {
      return fromHalfFloat(parseUint16(buffer, offset));
    }

    function parseChlist(dataView: DataView, buffer: ArrayBufferLike, offset: EXROffset, size: number): EXRChannel[] {
      const startOffset = offset.value;
      const channels: EXRChannel[] = [];

      while (offset.value < startOffset + size - 1) {
        const name = parseNullTerminatedString(buffer, offset);
        const pixelType = parseInt32(dataView, offset);
        const pLinear = parseUint8(dataView, offset);
        offset.value += 3; // reserved, three chars
        const xSampling = parseInt32(dataView, offset);
        const ySampling = parseInt32(dataView, offset);

        channels.push({ name, pixelType, pLinear, xSampling, ySampling });
      }

      offset.value += 1;

      return channels;
    }

    function parseChromaticities(dataView: DataView, offset: EXROffset): EXRChromaticities {
      const redX = parseFloat32(dataView, offset);
      const redY = parseFloat32(dataView, offset);
      const greenX = parseFloat32(dataView, offset);
      const greenY = parseFloat32(dataView, offset);
      const blueX = parseFloat32(dataView, offset);
      const blueY = parseFloat32(dataView, offset);
      const whiteX = parseFloat32(dataView, offset);
      const whiteY = parseFloat32(dataView, offset);

      return { redX, redY, greenX, greenY, blueX, blueY, whiteX, whiteY };
    }

    function parseCompression(dataView: DataView, offset: EXROffset): string {
      const compressionCodes = [
        "NO_COMPRESSION",
        "RLE_COMPRESSION",
        "ZIPS_COMPRESSION",
        "ZIP_COMPRESSION",
        "PIZ_COMPRESSION",
        "PXR24_COMPRESSION",
        "B44_COMPRESSION",
        "B44A_COMPRESSION",
        "DWAA_COMPRESSION",
        "DWAB_COMPRESSION",
      ];

      const compression = parseUint8(dataView, offset);

      const name: string | undefined = compressionCodes[compression];

      if (name === undefined) {
        throw new Error("THREE.EXRLoader: unknown compression code " + compression + ".");
      }

      return name;
    }

    function parseBox2i(dataView: DataView, offset: EXROffset): EXRBox2i {
      const xMin = parseInt32(dataView, offset);
      const yMin = parseInt32(dataView, offset);
      const xMax = parseInt32(dataView, offset);
      const yMax = parseInt32(dataView, offset);

      return { xMin, yMin, xMax, yMax };
    }

    function parseLineOrder(dataView: DataView, offset: EXROffset): string {
      const lineOrders = ["INCREASING_Y", "DECREASING_Y", "RANDOM_Y"];

      const lineOrder = parseUint8(dataView, offset);

      const name: string | undefined = lineOrders[lineOrder];

      if (name === undefined) {
        throw new Error("THREE.EXRLoader: unknown line order " + lineOrder + ".");
      }

      return name;
    }

    function parseEnvmap(dataView: DataView, offset: EXROffset): string {
      const envmaps = ["ENVMAP_LATLONG", "ENVMAP_CUBE"];

      const envmap = parseUint8(dataView, offset);

      const name: string | undefined = envmaps[envmap];

      if (name === undefined) {
        throw new Error("THREE.EXRLoader: unknown envmap mode " + envmap + ".");
      }

      return name;
    }

    function parseTiledesc(dataView: DataView, offset: EXROffset): EXRTiledesc {
      const levelModes = ["ONE_LEVEL", "MIPMAP_LEVELS", "RIPMAP_LEVELS"];

      const roundingModes = ["ROUND_DOWN", "ROUND_UP"];

      const xSize = parseUint32(dataView, offset);
      const ySize = parseUint32(dataView, offset);
      const modes = parseUint8(dataView, offset);

      const levelMode: string | undefined = levelModes[modes & 0xf];
      const roundingMode: string | undefined = roundingModes[modes >> 4];

      if (levelMode === undefined || roundingMode === undefined) {
        throw new Error("THREE.EXRLoader: invalid tiledesc modes byte " + modes + ".");
      }

      return { xSize, ySize, levelMode, roundingMode };
    }

    function parseV2f(dataView: DataView, offset: EXROffset): [number, number] {
      const x = parseFloat32(dataView, offset);
      const y = parseFloat32(dataView, offset);

      return [x, y];
    }

    function parseV3f(dataView: DataView, offset: EXROffset): [number, number, number] {
      const x = parseFloat32(dataView, offset);
      const y = parseFloat32(dataView, offset);
      const z = parseFloat32(dataView, offset);

      return [x, y, z];
    }

    function parseValue(
      dataView: DataView,
      buffer: ArrayBufferLike,
      offset: EXROffset,
      type: string,
      size: number,
    ): EXRAttributeValue | undefined {
      if (type === "string" || type === "stringvector" || type === "iccProfile") {
        return parseFixedLengthString(buffer, offset, size);
      } else if (type === "chlist") {
        return parseChlist(dataView, buffer, offset, size);
      } else if (type === "chromaticities") {
        return parseChromaticities(dataView, offset);
      } else if (type === "compression") {
        return parseCompression(dataView, offset);
      } else if (type === "box2i") {
        return parseBox2i(dataView, offset);
      } else if (type === "envmap") {
        return parseEnvmap(dataView, offset);
      } else if (type === "tiledesc") {
        return parseTiledesc(dataView, offset);
      } else if (type === "lineOrder") {
        return parseLineOrder(dataView, offset);
      } else if (type === "float") {
        return parseFloat32(dataView, offset);
      } else if (type === "v2f") {
        return parseV2f(dataView, offset);
      } else if (type === "v3f") {
        return parseV3f(dataView, offset);
      } else if (type === "int") {
        return parseInt32(dataView, offset);
      } else if (type === "rational") {
        return parseRational(dataView, offset);
      } else if (type === "timecode") {
        return parseTimecode(dataView, offset);
      } else if (type === "preview" || type === "deepImageState" || type === "idmanifest") {
        // Known metadata-only types: silently skip, they carry no pixel data.
        offset.value += size;
        return "skipped";
      } else {
        offset.value += size;
        return undefined;
      }
    }

    function roundLog2(x: number, mode: string): number {
      const log2 = Math.log2(x);
      return mode == "ROUND_DOWN" ? Math.floor(log2) : Math.ceil(log2);
    }

    function calculateTileLevels(tiledesc: EXRTiledesc, w: number, h: number): number {
      let num = 0;

      switch (tiledesc.levelMode) {
        case "ONE_LEVEL":
          num = 1;
          break;

        case "MIPMAP_LEVELS":
          num = roundLog2(Math.max(w, h), tiledesc.roundingMode) + 1;
          break;

        case "RIPMAP_LEVELS":
          throw new Error("THREE.EXRLoader: RIPMAP_LEVELS tiles currently unsupported.");
      }

      return num;
    }

    function calculateTiles(count: number, dataSize: number, size: number, roundingMode: string): number[] {
      const tiles = Array<number>(count);

      for (let i = 0; i < count; i++) {
        const b = 1 << i;
        let s = (dataSize / b) | 0;

        if (roundingMode == "ROUND_UP" && s * b < dataSize) s += 1;

        const l = Math.max(s, 1);

        tiles[i] = ((l + size - 1) / size) | 0;
      }

      return tiles;
    }

    function parseTiles(EXRDecoder: EXRDecoderState): void {
      const offset = EXRDecoder.offset;
      const tmpOffset = { value: 0 };

      for (let tile = 0; tile < EXRDecoder.tileCount; tile++) {
        const tileX = parseInt32(EXRDecoder.viewer, offset);
        const tileY = parseInt32(EXRDecoder.viewer, offset);
        offset.value += 8; // skip levels - only parsing top-level
        EXRDecoder.size = parseUint32(EXRDecoder.viewer, offset);

        const startX = tileX * EXRDecoder.blockWidth;
        const startY = tileY * EXRDecoder.blockHeight;
        EXRDecoder.columns =
          startX + EXRDecoder.blockWidth > EXRDecoder.width ? EXRDecoder.width - startX : EXRDecoder.blockWidth;
        EXRDecoder.lines =
          startY + EXRDecoder.blockHeight > EXRDecoder.height ? EXRDecoder.height - startY : EXRDecoder.blockHeight;

        const bytesBlockLine = EXRDecoder.columns * EXRDecoder.totalBytes;
        const isCompressed = EXRDecoder.size < EXRDecoder.lines * bytesBlockLine;
        const viewer = isCompressed ? EXRDecoder.uncompress(EXRDecoder) : uncompressRAW(EXRDecoder);

        offset.value += EXRDecoder.size;

        for (let line = 0; line < EXRDecoder.lines; line++) {
          const lineOffset = line * EXRDecoder.columns * EXRDecoder.totalBytes;

          for (let channelID = 0; channelID < EXRDecoder.inputChannels.length; channelID++) {
            const name = EXRHeader.channels[channelID].name;
            const lOff = EXRDecoder.channelByteOffsets[name] * EXRDecoder.columns;
            const cOff = EXRDecoder.decodeChannels[name];

            if (cOff === undefined) continue;

            tmpOffset.value = lineOffset + lOff;
            const outLineOffset = (EXRDecoder.height - (1 + startY + line)) * EXRDecoder.outLineWidth;

            for (let x = 0; x < EXRDecoder.columns; x++) {
              const outIndex = outLineOffset + (x + startX) * EXRDecoder.outputChannels + cOff;
              EXRDecoder.byteArray[outIndex] = EXRDecoder.getter(viewer, tmpOffset);
            }
          }
        }
      }
    }

    function parseScanline(EXRDecoder: EXRDecoderState): void {
      const offset = EXRDecoder.offset;
      const tmpOffset = { value: 0 };

      for (
        let scanlineBlockIdx = 0;
        scanlineBlockIdx < EXRDecoder.height / EXRDecoder.blockHeight;
        scanlineBlockIdx++
      ) {
        const line = parseInt32(EXRDecoder.viewer, offset) - EXRHeader.dataWindow.yMin; // line_no
        EXRDecoder.size = parseUint32(EXRDecoder.viewer, offset); // data_len
        EXRDecoder.lines =
          line + EXRDecoder.blockHeight > EXRDecoder.height ? EXRDecoder.height - line : EXRDecoder.blockHeight;

        const bytesPerLine = EXRDecoder.columns * EXRDecoder.totalBytes;
        const isCompressed = EXRDecoder.size < EXRDecoder.lines * bytesPerLine;
        const viewer = isCompressed ? EXRDecoder.uncompress(EXRDecoder) : uncompressRAW(EXRDecoder);

        offset.value += EXRDecoder.size;

        for (let line_y = 0; line_y < EXRDecoder.lines; line_y++) {
          const true_y = line + line_y;

          const lineOffset = line_y * bytesPerLine;
          const outLineOffset = (EXRDecoder.height - 1 - true_y) * EXRDecoder.outLineWidth;

          for (let channelID = 0; channelID < EXRDecoder.inputChannels.length; channelID++) {
            const name = EXRHeader.channels[channelID].name;
            const lOff = EXRDecoder.channelByteOffsets[name] * EXRDecoder.columns;
            const cOff = EXRDecoder.decodeChannels[name];

            if (cOff === undefined) continue;

            tmpOffset.value = lineOffset + lOff;

            for (let x = 0; x < EXRDecoder.columns; x++) {
              const outIndex = outLineOffset + x * EXRDecoder.outputChannels + cOff;
              EXRDecoder.byteArray[outIndex] = EXRDecoder.getter(viewer, tmpOffset);
            }
          }
        }
      }
    }

    function parseMultiPartScanline(EXRDecoder: EXRDecoderState): void {
      const chunkOffsets = EXRDecoder.chunkOffsets;
      const tmpOffset = { value: 0 };

      for (let chunkIdx = 0; chunkIdx < chunkOffsets.length; chunkIdx++) {
        const offset = { value: chunkOffsets[chunkIdx] };

        offset.value += INT32_SIZE; // skip part number

        const line = parseInt32(EXRDecoder.viewer, offset) - EXRHeader.dataWindow.yMin;
        EXRDecoder.size = parseUint32(EXRDecoder.viewer, offset);
        EXRDecoder.lines =
          line + EXRDecoder.blockHeight > EXRDecoder.height ? EXRDecoder.height - line : EXRDecoder.blockHeight;

        const bytesPerLine = EXRDecoder.columns * EXRDecoder.totalBytes;
        const isCompressed = EXRDecoder.size < EXRDecoder.lines * bytesPerLine;

        const savedOffset = EXRDecoder.offset;
        EXRDecoder.offset = offset;
        const viewer = isCompressed ? EXRDecoder.uncompress(EXRDecoder) : uncompressRAW(EXRDecoder);
        EXRDecoder.offset = savedOffset;

        for (let line_y = 0; line_y < EXRDecoder.lines; line_y++) {
          const true_y = line + line_y;

          const lineOffset = line_y * bytesPerLine;
          const outLineOffset = (EXRDecoder.height - 1 - true_y) * EXRDecoder.outLineWidth;

          for (let channelID = 0; channelID < EXRDecoder.inputChannels.length; channelID++) {
            const name = EXRHeader.channels[channelID].name;
            const lOff = EXRDecoder.channelByteOffsets[name] * EXRDecoder.columns;
            const cOff = EXRDecoder.decodeChannels[name];

            if (cOff === undefined) continue;

            tmpOffset.value = lineOffset + lOff;

            for (let x = 0; x < EXRDecoder.columns; x++) {
              const outIndex = outLineOffset + x * EXRDecoder.outputChannels + cOff;
              EXRDecoder.byteArray[outIndex] = EXRDecoder.getter(viewer, tmpOffset);
            }
          }
        }
      }
    }

    function decompressDeepData(
      array: Uint8Array,
      compressedOffset: number,
      compressedSize: number,
      compression: string,
    ): DataView | null {
      if (compressedSize === 0) return null;

      const compressed = array.slice(compressedOffset, compressedOffset + compressedSize);

      switch (compression) {
        case "NO_COMPRESSION":
          return new DataView(compressed.buffer, compressed.byteOffset, compressed.byteLength);

        case "RLE_COMPRESSION": {
          const rawBuffer = new Uint8Array(
            decodeRunLength(
              compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength),
            ),
          );
          const tmpBuffer = new Uint8Array(rawBuffer.length);
          predictor(rawBuffer);
          interleaveScalar(rawBuffer, tmpBuffer);
          return new DataView(tmpBuffer.buffer);
        }

        case "ZIPS_COMPRESSION": {
          const rawBuffer = decodeZlib(compressed);
          const tmpBuffer = new Uint8Array(rawBuffer.length);
          predictor(rawBuffer);
          interleaveScalar(rawBuffer, tmpBuffer);
          return new DataView(tmpBuffer.buffer);
        }

        default:
          throw new Error("THREE.EXRLoader: " + compression + " is unsupported for deep data");
      }
    }

    function parseDeepScanline(EXRDecoder: EXRDecoderState): void {
      const chunkOffsets = EXRDecoder.chunkOffsets;
      const width = EXRDecoder.width;
      const height = EXRDecoder.height;
      const deepChannels = EXRDecoder.deepChannels;
      const compression = EXRHeader.compression;
      const isMultiPart = EXRDecoder.multiPart;

      // Build a map from channel name to decode output slot
      const decodeChannels = EXRDecoder.decodeChannels;
      const outputChannels = EXRDecoder.outputChannels;
      const isHalfOutput = EXRDecoder.byteArray instanceof Uint16Array;

      // Find the alpha channel index in deepChannels (for compositing)
      let alphaChannelIdx = -1;

      for (let i = 0; i < deepChannels.length; i++) {
        if (deepChannels[i].name === "A") {
          alphaChannelIdx = i;
          break;
        }
      }

      for (let chunkIdx = 0; chunkIdx < chunkOffsets.length; chunkIdx++) {
        const chunkOffset = { value: chunkOffsets[chunkIdx] };

        // Multi-part files have a part number prefix per chunk
        if (isMultiPart) chunkOffset.value += INT32_SIZE;

        const line = parseInt32(EXRDecoder.viewer, chunkOffset) - EXRHeader.dataWindow.yMin;

        // Read deep scanline sizes
        const sctCompressedSize = parseInt64(EXRDecoder.viewer, chunkOffset);
        const dataCompressedSize = parseInt64(EXRDecoder.viewer, chunkOffset);
        parseInt64(EXRDecoder.viewer, chunkOffset); // uncompressed data size (unused)

        // Decompress sample count table
        const sctView = decompressDeepData(EXRDecoder.array, chunkOffset.value, sctCompressedSize, compression);
        chunkOffset.value += sctCompressedSize;

        if (sctView === null) continue;

        // Parse cumulative sample counts
        const cumulativeCounts = new Uint32Array(width);

        for (let x = 0; x < width; x++) {
          cumulativeCounts[x] = sctView.getUint32(x * 4, true);
        }

        const totalSamples = cumulativeCounts[width - 1];

        if (totalSamples === 0) {
          chunkOffset.value += dataCompressedSize;
          continue;
        }

        // Decompress pixel data
        const pixelView = decompressDeepData(EXRDecoder.array, chunkOffset.value, dataCompressedSize, compression);

        if (pixelView === null) {
          throw new Error("THREE.EXRLoader: deep scanline pixel data is missing.");
        }

        // Compute channel byte offsets within the decompressed pixel data.
        // Deep data layout: channels are contiguous, each has totalSamples values.
        const channelOffsets: number[] = [];
        let bytePos = 0;

        for (let i = 0; i < deepChannels.length; i++) {
          channelOffsets.push(bytePos);
          bytePos += totalSamples * deepChannels[i].bytesPerSample;
        }

        // Flatten deep samples: front-to-back composite with premultiplied alpha
        const outLineOffset = (height - 1 - line) * EXRDecoder.outLineWidth;

        for (let x = 0; x < width; x++) {
          const startSample = x === 0 ? 0 : cumulativeCounts[x - 1];
          const endSample = cumulativeCounts[x];
          const numSamples = endSample - startSample;

          if (numSamples === 0) continue;

          // Composite samples front-to-back (premultiplied alpha)
          const composited = new Float32Array(outputChannels);
          let compositedAlpha = 0;

          for (let s = 0; s < numSamples; s++) {
            const sampleIdx = startSample + s;
            const factor = 1 - compositedAlpha;

            if (factor <= 0) break;

            // Read alpha for this sample
            let sampleAlpha = 1;

            if (alphaChannelIdx >= 0) {
              const aBps = deepChannels[alphaChannelIdx].bytesPerSample;
              const aOff = channelOffsets[alphaChannelIdx] + sampleIdx * aBps;

              sampleAlpha =
                aBps === 2 ? fromHalfFloat(pixelView.getUint16(aOff, true)) : pixelView.getFloat32(aOff, true);
            }

            // Read and composite each output channel
            for (let ci = 0; ci < deepChannels.length; ci++) {
              const ch = deepChannels[ci];
              const cOff = decodeChannels[ch.name];

              if (cOff === undefined) continue;

              const bps = ch.bytesPerSample;
              const dataOff = channelOffsets[ci] + sampleIdx * bps;

              const value =
                bps === 2 ? fromHalfFloat(pixelView.getUint16(dataOff, true)) : pixelView.getFloat32(dataOff, true);

              composited[cOff] += value * factor;
            }

            compositedAlpha += sampleAlpha * factor;
          }

          // If alpha channel is being output, set it
          if (decodeChannels["A"] !== undefined) {
            composited[decodeChannels["A"]] = compositedAlpha;
          }

          // Write to output buffer
          const outIndex = outLineOffset + x * outputChannels;

          for (let c = 0; c < outputChannels; c++) {
            EXRDecoder.byteArray[outIndex + c] = isHalfOutput ? toHalfFloat(composited[c]) : composited[c];
          }
        }
      }
    }

    function parsePartHeader(
      dataView: DataView,
      buffer: ArrayBufferLike,
      offset: EXROffset,
    ): Record<string, unknown> | null {
      const header: Record<string, unknown> = {};
      let hasAttributes = false;

      while (true) {
        const attributeName = parseNullTerminatedString(buffer, offset);

        if (attributeName === "") break;

        hasAttributes = true;

        const attributeType = parseNullTerminatedString(buffer, offset);
        const attributeSize = parseUint32(dataView, offset);
        const attributeValue = parseValue(dataView, buffer, offset, attributeType, attributeSize);

        if (attributeValue === undefined) {
          console.warn(`THREE.EXRLoader: Skipped unknown header attribute type '${attributeType}'.`);
        } else {
          header[attributeName] = attributeValue;
        }
      }

      return hasAttributes ? header : null;
    }

    function isBox2i(value: unknown): value is EXRBox2i {
      if (typeof value !== "object" || value === null) return false;

      const box = value as Partial<Record<keyof EXRBox2i, unknown>>;

      return (
        typeof box.xMin === "number" &&
        typeof box.yMin === "number" &&
        typeof box.xMax === "number" &&
        typeof box.yMax === "number"
      );
    }

    function asPartHeader(attributes: Record<string, unknown>, version: number, spec: EXRSpec): EXRPartHeader {
      const channels = attributes.channels;
      const compression = attributes.compression;
      const dataWindow = attributes.dataWindow;

      if (!Array.isArray(channels)) {
        throw new Error("THREE.EXRLoader: header is missing a channel list.");
      }

      if (typeof compression !== "string") {
        throw new Error("THREE.EXRLoader: header is missing the compression attribute.");
      }

      if (!isBox2i(dataWindow)) {
        throw new Error("THREE.EXRLoader: header is missing a valid dataWindow attribute.");
      }

      const header = { ...attributes } as EXRPartHeader;

      header.channels = channels as EXRChannel[];
      header.compression = compression;
      header.dataWindow = dataWindow;
      header.version = version;
      header.spec = spec;

      if (typeof attributes.chunkCount === "number") header.chunkCount = attributes.chunkCount;

      return header;
    }

    function parseHeader(dataView: DataView, buffer: ArrayBufferLike, offset: EXROffset): EXRPartHeader[] {
      if (dataView.getUint32(0, true) != 20000630) {
        // magic
        throw new Error("THREE.EXRLoader: Provided file doesn't appear to be in OpenEXR format.");
      }

      const version = dataView.getUint8(4);

      const spec = dataView.getUint8(5); // fullMask

      const flags: EXRSpec = {
        singleTile: !!(spec & 2),
        longName: !!(spec & 4),
        deepFormat: !!(spec & 8),
        multiPart: !!(spec & 16),
      };

      // start of header

      offset.value = 8; // start at 8 - after pre-amble

      const headers: EXRPartHeader[] = [];

      if (flags.multiPart) {
        // Multi-part files: parse all part headers.
        // Each part header ends with an empty attribute name (null byte).
        // The header section ends when a null byte is read with no preceding attributes.

        while (true) {
          const attributes = parsePartHeader(dataView, buffer, offset);
          if (attributes === null) break;

          headers.push(asPartHeader(attributes, version, flags));
        }

        if (headers.length === 0) {
          throw new Error("THREE.EXRLoader: No valid part headers found.");
        }
      } else {
        // Single-part (standard or deep): one header

        const attributes = parsePartHeader(dataView, buffer, offset);

        if (attributes === null) {
          throw new Error("THREE.EXRLoader: header contains no attributes.");
        }

        headers.push(asPartHeader(attributes, version, flags));
      }

      return headers;
    }

    function setupDecoder(
      EXRHeader: EXRPartHeader,
      dataView: DataView,
      uInt8Array: Uint8Array,
      offset: EXROffset,
      outputType: number,
      outputFormat: number,
    ): EXRDecoder {
      const EXRDecoder: EXRDecoderState = {
        size: 0,
        viewer: dataView,
        array: uInt8Array,
        offset: offset,
        width: EXRHeader.dataWindow.xMax - EXRHeader.dataWindow.xMin + 1,
        height: EXRHeader.dataWindow.yMax - EXRHeader.dataWindow.yMin + 1,
        inputChannels: EXRHeader.channels,
        channelByteOffsets: {},
        shouldExpand: false,
        yCbCr: false,
        totalBytes: 0,
        columns: 0,
        lines: 0,
        type: 0,
        uncompress: uncompressRAW,
        getter: parseUint16,
        format: PixelFormat.RGBA,
        colorSpace: ColorSpace.LinearSRGB,
        outputChannels: 4,
        decodeChannels: {},
        byteArray: new Float32Array(0),
        blockHeight: 1,
        blockWidth: 0,
        outLineWidth: 0,
        tileCount: 0,
        deepChannels: [],
        chunkOffsets: [],
        multiPart: false,
      };

      switch (EXRHeader.compression) {
        case "NO_COMPRESSION":
          EXRDecoder.blockHeight = 1;
          EXRDecoder.uncompress = uncompressRAW;
          break;

        case "RLE_COMPRESSION":
          EXRDecoder.blockHeight = 1;
          EXRDecoder.uncompress = uncompressRLE;
          break;

        case "ZIPS_COMPRESSION":
          EXRDecoder.blockHeight = 1;
          EXRDecoder.uncompress = uncompressZIP;
          break;

        case "ZIP_COMPRESSION":
          EXRDecoder.blockHeight = 16;
          EXRDecoder.uncompress = uncompressZIP;
          break;

        case "PIZ_COMPRESSION":
          EXRDecoder.blockHeight = 32;
          EXRDecoder.uncompress = uncompressPIZ;
          break;

        case "PXR24_COMPRESSION":
          EXRDecoder.blockHeight = 16;
          EXRDecoder.uncompress = uncompressPXR;
          break;

        case "B44_COMPRESSION":
        case "B44A_COMPRESSION":
          EXRDecoder.blockHeight = 32;
          EXRDecoder.uncompress = uncompressB44;
          break;

        case "DWAA_COMPRESSION":
          EXRDecoder.blockHeight = 32;
          EXRDecoder.uncompress = uncompressDWA;
          break;

        case "DWAB_COMPRESSION":
          EXRDecoder.blockHeight = 256;
          EXRDecoder.uncompress = uncompressDWA;
          break;

        default:
          throw new Error("THREE.EXRLoader: " + EXRHeader.compression + " is unsupported");
      }

      const channels: Record<string, boolean> = {};
      for (const channel of EXRHeader.channels) {
        switch (channel.name) {
          case "BY":
          case "RY":
          case "Y":
          case "R":
          case "G":
          case "B":
          case "A":
            channels[channel.name] = true;
            EXRDecoder.type = channel.pixelType;
        }
      }

      // RGB images will be converted to RGBA format, preventing software emulation in select devices.
      let fillAlpha = false;
      let invalidOutput = false;

      // Validate if input texture contain supported channels
      if (channels.Y && channels.RY && channels.BY) {
        EXRDecoder.outputChannels = 4;
        EXRDecoder.yCbCr = true;
      } else if (channels.R && channels.G && channels.B) {
        EXRDecoder.outputChannels = 4;
      } else if (channels.Y) {
        EXRDecoder.outputChannels = 1;
      } else {
        throw new Error("THREE.EXRLoader: file contains unsupported data channels.");
      }

      // Setup output texture configuration
      switch (EXRDecoder.outputChannels) {
        case 4:
          if (outputFormat == PixelFormat.RGBA) {
            fillAlpha = !channels.A;
            EXRDecoder.format = PixelFormat.RGBA;
            EXRDecoder.colorSpace = ColorSpace.LinearSRGB;
            EXRDecoder.outputChannels = 4;
            EXRDecoder.decodeChannels = { R: 0, G: 1, B: 2, A: 3 };
          } else if (outputFormat == PixelFormat.RG) {
            EXRDecoder.format = PixelFormat.RG;
            EXRDecoder.colorSpace = ColorSpace.LinearSRGB;
            EXRDecoder.outputChannels = 2;
            EXRDecoder.decodeChannels = { R: 0, G: 1 };
          } else if (outputFormat == PixelFormat.Red) {
            EXRDecoder.format = PixelFormat.Red;
            EXRDecoder.colorSpace = ColorSpace.LinearSRGB;
            EXRDecoder.outputChannels = 1;
            EXRDecoder.decodeChannels = { R: 0 };
          } else {
            invalidOutput = true;
          }

          break;

        case 1:
          if (outputFormat == PixelFormat.RGBA) {
            fillAlpha = true;
            EXRDecoder.format = PixelFormat.RGBA;
            EXRDecoder.colorSpace = ColorSpace.LinearSRGB;
            EXRDecoder.outputChannels = 4;
            EXRDecoder.shouldExpand = true;
            EXRDecoder.decodeChannels = { Y: 0 };
          } else if (outputFormat == PixelFormat.RG) {
            EXRDecoder.format = PixelFormat.RG;
            EXRDecoder.colorSpace = ColorSpace.LinearSRGB;
            EXRDecoder.outputChannels = 2;
            EXRDecoder.shouldExpand = true;
            EXRDecoder.decodeChannels = { Y: 0 };
          } else if (outputFormat == PixelFormat.Red) {
            EXRDecoder.format = PixelFormat.Red;
            EXRDecoder.colorSpace = ColorSpace.LinearSRGB;
            EXRDecoder.outputChannels = 1;
            EXRDecoder.decodeChannels = { Y: 0 };
          } else {
            invalidOutput = true;
          }

          break;

        default:
          invalidOutput = true;
      }

      if (invalidOutput) {
        throw new Error("THREE.EXRLoader: invalid output format for specified file.");
      }

      // Luminance/chroma images always decode to RGBA; override whatever the output-format switch selected.
      if (EXRDecoder.yCbCr) {
        EXRDecoder.format = PixelFormat.RGBA;
        EXRDecoder.outputChannels = 4;
        EXRDecoder.decodeChannels = { Y: 0, RY: 1, BY: 2 };
        fillAlpha = true;
      }

      if (EXRDecoder.type == 1) {
        // half
        switch (outputType) {
          case TextureType.Float:
            EXRDecoder.getter = parseFloat16;
            break;

          case TextureType.HalfFloat:
            EXRDecoder.getter = parseUint16;
            break;
        }
      } else if (EXRDecoder.type == 2) {
        // float
        switch (outputType) {
          case TextureType.Float:
            EXRDecoder.getter = parseFloat32;
            break;

          case TextureType.HalfFloat:
            EXRDecoder.getter = decodeFloat32;
        }
      } else {
        throw new Error(
          "THREE.EXRLoader: unsupported pixelType " + EXRDecoder.type + " for " + EXRHeader.compression + ".",
        );
      }

      EXRDecoder.columns = EXRDecoder.width;
      const size = EXRDecoder.width * EXRDecoder.height * EXRDecoder.outputChannels;

      switch (outputType) {
        case TextureType.Float: {
          const floatArray = new Float32Array(size);

          // Fill initially with 1s for the alpha value if the texture is not RGBA, RGB values will be overwritten
          if (fillAlpha) floatArray.fill(1, 0, size);

          EXRDecoder.byteArray = floatArray;
          break;
        }

        case TextureType.HalfFloat: {
          const halfArray = new Uint16Array(size);

          if (fillAlpha) halfArray.fill(0x3c00, 0, size); // Uint16Array holds half float data, 0x3C00 is 1

          EXRDecoder.byteArray = halfArray;
          break;
        }

        default:
          throw new Error("THREE.EXRLoader: unsupported type: " + outputType);
      }

      let byteOffset = 0;
      for (const channel of EXRHeader.channels) {
        if (EXRDecoder.decodeChannels[channel.name] !== undefined) {
          EXRDecoder.channelByteOffsets[channel.name] = byteOffset;
        }

        byteOffset += channel.pixelType * 2;
      }

      EXRDecoder.totalBytes = byteOffset;
      EXRDecoder.outLineWidth = EXRDecoder.width * EXRDecoder.outputChannels;

      let decode: (() => void) | null = null;

      if (EXRHeader.spec.deepFormat) {
        // Deep format: offset tables are already parsed in the main flow.
        // Compute per-channel byte sizes for the deep pixel data layout.

        EXRDecoder.deepChannels = [];

        for (const channel of EXRHeader.channels) {
          // UINT=0→4bytes, HALF=1→2bytes, FLOAT=2→4bytes
          const bytesPerSample = channel.pixelType === 0 ? 4 : channel.pixelType * 2;
          EXRDecoder.deepChannels.push({ name: channel.name, bytesPerSample });
        }
        EXRDecoder.chunkOffsets = EXRHeader._chunkOffsets ?? [];
        EXRDecoder.multiPart = EXRHeader.spec.multiPart;
        decode = () => parseDeepScanline(EXRDecoder);
      } else if (EXRHeader.spec.singleTile) {
        const tiles = EXRHeader.tiles;

        if (tiles === undefined) {
          throw new Error("THREE.EXRLoader: tiled file has no tiledesc attribute.");
        }

        EXRDecoder.blockHeight = tiles.ySize;
        EXRDecoder.blockWidth = tiles.xSize;

        const numXLevels = calculateTileLevels(tiles, EXRDecoder.width, EXRDecoder.height);
        // const numYLevels = calculateTileLevels( tiles, EXRDecoder.width, EXRDecoder.height );

        const numXTiles = calculateTiles(numXLevels, EXRDecoder.width, tiles.xSize, tiles.roundingMode);
        const numYTiles = calculateTiles(numXLevels, EXRDecoder.height, tiles.ySize, tiles.roundingMode);

        EXRDecoder.tileCount = numXTiles[0] * numYTiles[0];

        for (let l = 0; l < numXLevels; l++)
          for (let y = 0; y < numYTiles[l]; y++) for (let x = 0; x < numXTiles[l]; x++) parseInt64(dataView, offset); // tileOffset

        decode = () => parseTiles(EXRDecoder);
      } else if (EXRHeader.spec.multiPart) {
        // Multi-part scanline: offsets already parsed in main flow.
        EXRDecoder.blockWidth = EXRDecoder.width;
        EXRDecoder.chunkOffsets = EXRHeader._chunkOffsets ?? [];
        decode = () => parseMultiPartScanline(EXRDecoder);
      } else {
        EXRDecoder.blockWidth = EXRDecoder.width;
        const blockCount = Math.ceil(EXRDecoder.height / EXRDecoder.blockHeight);

        for (let i = 0; i < blockCount; i++) parseInt64(dataView, offset); // scanlineOffset

        decode = () => parseScanline(EXRDecoder);
      }

      if (decode === null) {
        throw new Error("THREE.EXRLoader: failed to select a chunk reader.");
      }

      return Object.assign(EXRDecoder, { decode });
    }

    // start parsing file [START]
    const offset = { value: 0 };
    const bufferDataView = new DataView(buffer);
    const uInt8Array = new Uint8Array(buffer);

    // get header information and validate format.
    const EXRHeaders = parseHeader(bufferDataView, buffer, offset);

    // select part to decode
    const partIndex = Math.max(0, Math.min(this.part, EXRHeaders.length - 1));
    const EXRHeader = EXRHeaders[partIndex];

    // for multi-part deep files, skip offset tables for other parts
    if (EXRHeader.spec.multiPart || EXRHeader.spec.deepFormat) {
      // shortcut: upstream never derives chunkCount from the part header, so offset tables are only
      // read when a file supplies it as an attribute; upgrade when multi-part/deep assets are ported.
      for (let p = 0; p < EXRHeaders.length; p++) {
        const chunkCount = EXRHeaders[p].chunkCount ?? 0;

        if (p === partIndex) {
          // store offset table for the selected part
          EXRHeader._chunkOffsets = [];

          for (let i = 0; i < chunkCount; i++) {
            EXRHeader._chunkOffsets.push(parseInt64(bufferDataView, offset));
          }
        } else {
          // skip other parts' offset tables
          for (let i = 0; i < chunkCount; i++) parseInt64(bufferDataView, offset);
        }
      }
    }

    // get input compression information and prepare decoding.
    const EXRDecoder = setupDecoder(EXRHeader, bufferDataView, uInt8Array, offset, this.type, this.outputFormat);

    // parse input data
    EXRDecoder.decode();

    // output texture post-processing
    if (EXRDecoder.shouldExpand) {
      const byteArray = EXRDecoder.byteArray;

      if (this.outputFormat == PixelFormat.RGBA) {
        for (let i = 0; i < byteArray.length; i += 4) byteArray[i + 2] = byteArray[i + 1] = byteArray[i];
      } else if (this.outputFormat == PixelFormat.RG) {
        for (let i = 0; i < byteArray.length; i += 2) byteArray[i + 1] = byteArray[i];
      }
    }

    // Luminance/chroma → RGB conversion (second pass).
    // Y/RY/BY were decoded into output slots 0/1/2; convert in-place using Rec.709 coefficients:
    //   R = ( 1 + RY ) * Y,  B = ( 1 + BY ) * Y,  G = ( Y − R·0.2126 − B·0.0722 ) / 0.7152
    if (EXRDecoder.yCbCr) {
      const byteArray = EXRDecoder.byteArray;
      const nPixels = EXRDecoder.width * EXRDecoder.height;

      if (this.type === TextureType.HalfFloat) {
        for (let i = 0; i < nPixels; i++) {
          const base = i * 4;
          const Y = fromHalfFloat(byteArray[base]);
          const RY = fromHalfFloat(byteArray[base + 1]);
          const BY = fromHalfFloat(byteArray[base + 2]);
          const R = (1 + RY) * Y;
          const B = (1 + BY) * Y;
          const G = (Y - R * 0.2126 - B * 0.0722) / 0.7152;
          byteArray[base] = toHalfFloat(Math.max(0, R));
          byteArray[base + 1] = toHalfFloat(Math.max(0, G));
          byteArray[base + 2] = toHalfFloat(Math.max(0, B));
        }
      } else {
        for (let i = 0; i < nPixels; i++) {
          const base = i * 4;
          const Y = byteArray[base];
          const RY = byteArray[base + 1];
          const BY = byteArray[base + 2];
          const R = (1 + RY) * Y;
          const B = (1 + BY) * Y;
          byteArray[base] = Math.max(0, R);
          byteArray[base + 1] = Math.max(0, (Y - R * 0.2126 - B * 0.0722) / 0.7152);
          byteArray[base + 2] = Math.max(0, B);
        }
      }
    }

    return {
      header: EXRHeader,
      width: EXRDecoder.width,
      height: EXRDecoder.height,
      data: EXRDecoder.byteArray,
      format: EXRDecoder.format,
      colorSpace: EXRDecoder.colorSpace,
      type: this.type,
      minFilter: TextureFilter.Linear,
      magFilter: TextureFilter.Linear,
      generateMipmaps: false,
      flipY: false,
    };
  }

  /**
   * Sets the texture type.
   *
   * @param value - The texture type to set.
   * @return A reference to this loader.
   */
  setDataType(value: TextureType): this {
    this.type = value;
    return this;
  }

  /**
   * Sets texture output format. Defaults to `PixelFormat.RGBA`.
   *
   * @param value - Texture output format.
   * @return A reference to this loader.
   */
  setOutputFormat(value: PixelFormat): this {
    this.outputFormat = value;
    return this;
  }

  /**
   * For multi-part EXR files, sets which part to load.
   *
   * @param value - The part index to load.
   * @return A reference to this loader.
   */
  setPart(value: number): this {
    this.part = value;
    return this;
  }

  /**
   * Sets the zlib runtime used by ZIP(S), PXR24 and DWA blocks. The package never bundles one;
   * consumers supply a module exporting `unzlibSync`.
   *
   * @param runtime - The zlib runtime.
   * @return A reference to this loader.
   */
  setZlibDecoder(runtime: EXRZlibDecoder): this {
    this.zlibDecoder = runtime;
    return this;
  }
}
