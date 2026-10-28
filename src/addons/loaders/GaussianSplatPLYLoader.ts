import type { BufferAttribute } from "../../core/BufferAttribute";
import type { BufferGeometry } from "../../core/BufferGeometry";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { PLYLoader } from "./PLYLoader";
import {
  SH_BAND_COMPONENTS,
  SH_BAND_WORDS,
  createGaussianSplatGeometry,
  createPackedSphericalHarmonicsBand,
  sigmoid,
  writeColorBytesFromSH0,
  writeCovariance,
} from "../utils/GaussianSplatUtils";

const SH_DEGREE_TO_COMPONENTS = [0, 9, 24, 45];
const PROPERTY_MAPPING: Record<string, string[]> = {
  scale: ["scale_0", "scale_1", "scale_2"],
  rotation: ["rot_0", "rot_1", "rot_2", "rot_3"],
  f_dc: ["f_dc_0", "f_dc_1", "f_dc_2"],
  opacity: ["opacity"],
};
const REQUIRED_PROPERTIES = ["x", "y", "z", ...Object.values(PROPERTY_MAPPING).flat()];
const HEADER_PATTERN = /^ply([\s\S]*?)end_header/;
const PROPERTY_PATTERN = /^property\s+\S+\s+(\S+)\s*$/;
const REST_PROPERTY_PATTERN = /^f_rest_\d+$/;

/**
 * Loads GraphDECO/INRIA Gaussian splat PLY files, detecting spherical harmonics
 * degree from the header and converting the properties to splat geometry.
 *
 * ```typescript
 * import { GaussianSplatPLYLoader } from "ek3d/addons/loaders/GaussianSplatPLYLoader";
 * const geometry = await new GaussianSplatPLYLoader().loadAsync("./point_cloud.ply");
 * console.log(geometry.getAttribute("position"));
 * ```
 */
export class GaussianSplatPLYLoader extends Loader<BufferGeometry, string> {
  constructor(manager?: LoadingManager) {
    super(manager);
  }

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
      (data: unknown) => {
        try {
          const geometry = this.parse(data as ArrayBuffer);
          if (onLoad !== undefined) onLoad(geometry);
        } catch (error) {
          if (onError !== undefined) onError(error);
          else console.error(error);
          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }

  /** Parses ASCII text or binary PLY data into Gaussian splat geometry. */
  parse(data: ArrayBuffer | string): BufferGeometry {
    const degree = detectSphericalHarmonicsDegree(data);
    const mapping = { ...PROPERTY_MAPPING };
    const count = SH_DEGREE_TO_COMPONENTS[degree];
    if (count > 0) mapping.f_rest = Array.from({ length: count }, (_, i) => `f_rest_${i}`);
    const loader = new PLYLoader(this.manager);
    loader.setCustomPropertyNameMapping(mapping);
    return convertPLYGeometry(loader.parse(data));
  }
}

function detectSphericalHarmonicsDegree(data: ArrayBuffer | string): number {
  const text = typeof data === "string" ? data : decodeHeaderText(new Uint8Array(data));
  const header = HEADER_PATTERN.exec(text);
  if (header === null) throw new Error("THREE.GaussianSplatPLYLoader: Missing PLY header.");
  const names = new Set<string>();
  let count = 0;
  for (const line of header[1].split(/\r\n|\r|\n/)) {
    const property = PROPERTY_PATTERN.exec(line.trim());
    if (property === null) continue;
    names.add(property[1]);
    if (REST_PROPERTY_PATTERN.test(property[1])) count++;
  }
  if (REQUIRED_PROPERTIES.some((name) => !names.has(name))) {
    throw new Error(
      "THREE.GaussianSplatPLYLoader: PLY file requires position, scale, rotation, f_dc and opacity properties.",
    );
  }
  const degree = SH_DEGREE_TO_COMPONENTS.indexOf(count);
  if (degree === -1) {
    throw new Error(
      `THREE.GaussianSplatPLYLoader: Unsupported number of f_rest spherical harmonics coefficients (${count}).`,
    );
  }
  return degree;
}

function decodeHeaderText(bytes: Uint8Array): string {
  const marker = "end_header";
  const scanLength = Math.min(bytes.length, 1024 * 1024);
  let headerEnd = -1;
  for (let i = 0; i <= scanLength - marker.length; i++) {
    let matches = true;
    for (let j = 0; j < marker.length; j++) {
      if (bytes[i + j] !== marker.charCodeAt(j)) {
        matches = false;
        break;
      }
    }
    if (matches) {
      headerEnd = i + marker.length;
      break;
    }
  }
  return new TextDecoder().decode(bytes.subarray(0, headerEnd === -1 ? bytes.length : headerEnd));
}

function convertPLYGeometry(geometry: BufferGeometry): BufferGeometry {
  // PLYLoader constructs ordinary BufferAttributes, never GPU or interleaved attributes.
  const position = geometry.getAttribute("position") as BufferAttribute | undefined;
  const scale = geometry.getAttribute("scale") as BufferAttribute | undefined;
  const rotation = geometry.getAttribute("rotation") as BufferAttribute | undefined;
  const sh0 = geometry.getAttribute("f_dc") as BufferAttribute | undefined;
  const shRest = geometry.getAttribute("f_rest") as BufferAttribute | undefined;
  const opacity = geometry.getAttribute("opacity") as BufferAttribute | undefined;
  if (
    position === undefined ||
    scale === undefined ||
    rotation === undefined ||
    sh0 === undefined ||
    opacity === undefined
  ) {
    throw new Error(
      "THREE.GaussianSplatPLYLoader: PLY file requires position, scale, rotation, f_dc and opacity properties.",
    );
  }
  const count = position.count;
  if (
    position.itemSize !== 3 ||
    scale.itemSize !== 3 ||
    rotation.itemSize !== 4 ||
    sh0.itemSize !== 3 ||
    opacity.itemSize !== 1
  ) {
    throw new Error("THREE.GaussianSplatPLYLoader: Invalid Gaussian splat PLY property itemSize.");
  }
  if (scale.count !== count || rotation.count !== count || sh0.count !== count || opacity.count !== count) {
    throw new Error("THREE.GaussianSplatPLYLoader: Gaussian splat PLY property counts must match position.");
  }
  const centers = new Float32Array(count * 3);
  const covariances = new Float32Array(count * 6);
  const colors = new Uint8ClampedArray(count * 4);
  const degree = shRest === undefined ? 0 : SH_DEGREE_TO_COMPONENTS.indexOf(shRest.itemSize);
  if (degree === -1)
    throw new Error("THREE.GaussianSplatPLYLoader: Unsupported number of f_rest spherical harmonics coefficients.");
  const sphericalHarmonics: Record<string, Uint32Array> = {};
  const bytes: Record<string, Uint8ClampedArray> = {};
  for (let bandDegree = 1; bandDegree <= degree; bandDegree++) {
    const band = createPackedSphericalHarmonicsBand(count, bandDegree);
    sphericalHarmonics[`sh${bandDegree}`] = band.packed;
    bytes[`sh${bandDegree}`] = band.bytes;
  }
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    centers[i3] = position.getX(i);
    centers[i3 + 1] = position.getY(i);
    centers[i3 + 2] = position.getZ(i);
    writeCovariance(
      covariances,
      i * 6,
      Math.exp(scale.getX(i)),
      Math.exp(scale.getY(i)),
      Math.exp(scale.getZ(i)),
      rotation.getY(i),
      rotation.getZ(i),
      rotation.getW(i),
      rotation.getX(i),
    );
    writeColorBytesFromSH0(colors, i * 4, sh0.getX(i), sh0.getY(i), sh0.getZ(i), sigmoid(opacity.getX(i)));
    if (shRest !== undefined && degree > 0) writeSphericalHarmonicsFromRest(bytes, i, shRest);
  }
  return createGaussianSplatGeometry(centers, covariances, colors, sphericalHarmonics);
}

function writeSphericalHarmonicsFromRest(
  bytes: Record<string, Uint8ClampedArray>,
  index: number,
  shRest: BufferAttribute,
): void {
  const stride = shRest.itemSize / 3;
  const source = shRest.array;
  const sourceOffset = index * shRest.itemSize;
  for (let degree = 1; degree <= 3; degree++) {
    const target = bytes[`sh${degree}`];
    if (target === undefined) break;
    const bandOffset = degree === 1 ? 0 : degree === 2 ? 3 : 8;
    const targetOffset = index * SH_BAND_WORDS[degree] * 4;
    for (let j = 0; j < SH_BAND_COMPONENTS[degree]; j++) {
      const coefficient = Math.floor(j / 3);
      const channel = j % 3;
      target[targetOffset + j] = source[sourceOffset + bandOffset + coefficient + channel * stride] * 128 + 128;
    }
  }
}
