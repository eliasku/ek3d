import { BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Matrix3 } from "../../math/Matrix3";
import { Matrix4 } from "../../math/Matrix4";
import { Quaternion } from "../../math/Quaternion";
import { Vector3 } from "../../math/Vector3";

export const SH_C0 = 0.2820947917738781;
export const SH_BAND_COMPONENTS = [0, 9, 15, 21];
export const SH_BAND_WORDS = [0, 3, 4, 6];

const covarianceMatrix = new Matrix3();
const covarianceMatrixTranspose = new Matrix3();
const rotationScaleMatrix = new Matrix4();
const quaternion = new Quaternion();
const scale = new Vector3();
const zero = new Vector3();

export function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

export function writeColorBytes(
  target: Uint8ClampedArray,
  offset: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  target[offset] = r;
  target[offset + 1] = g;
  target[offset + 2] = b;
  target[offset + 3] = a;
}

export function sh0ToLinear(coefficient: number): number {
  return coefficient * SH_C0 + 0.5;
}

export function linearToSH0(color: number): number {
  return (color - 0.5) / SH_C0;
}

export function writeColorBytesFromSH0(
  target: Uint8ClampedArray,
  offset: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  writeColorBytes(target, offset, sh0ToLinear(r) * 255, sh0ToLinear(g) * 255, sh0ToLinear(b) * 255, a * 255);
}

export function writeCovariance(
  target: Float32Array,
  offset: number,
  sx: number,
  sy: number,
  sz: number,
  qx: number,
  qy: number,
  qz: number,
  qw: number,
): void {
  quaternion.set(qx, qy, qz, qw).normalize();
  scale.set(sx, sy, sz);
  rotationScaleMatrix.compose(zero, quaternion, scale);
  covarianceMatrix.setFromMatrix4(rotationScaleMatrix);
  covarianceMatrixTranspose.copy(covarianceMatrix).transpose();
  covarianceMatrix.multiply(covarianceMatrixTranspose);
  const elements = covarianceMatrix.elements;
  target[offset] = elements[0];
  target[offset + 1] = elements[3];
  target[offset + 2] = elements[6];
  target[offset + 3] = elements[4];
  target[offset + 4] = elements[7];
  target[offset + 5] = elements[8];
}

export function createPackedSphericalHarmonicsBand(
  count: number,
  degree: number,
): { packed: Uint32Array; bytes: Uint8ClampedArray } {
  const packed = new Uint32Array(count * SH_BAND_WORDS[degree]);
  packed.fill(0x80808080);
  return { packed, bytes: new Uint8ClampedArray(packed.buffer) };
}

function createSphericalHarmonicsAttribute(values: Uint32Array, count: number, degree: number): BufferAttribute {
  const words = SH_BAND_WORDS[degree];
  if (!(values instanceof Uint32Array))
    throw new Error(`THREE.createGaussianSplatGeometry: sphericalHarmonics${degree} must use packed uint32 words.`);
  if (values.length !== count * words)
    throw new Error(`THREE.createGaussianSplatGeometry: Invalid sphericalHarmonics${degree} packed length.`);
  return new BufferAttribute(values, words);
}

export function getSphericalHarmonicsDegree(geometry: BufferGeometry | undefined): number {
  if (geometry === undefined || geometry.isBufferGeometry !== true) return 0;
  let degree = 0;
  for (let i = 1; i <= 3; i++) {
    const attribute = geometry.getAttribute(`sphericalHarmonics${i}`);
    if (attribute === undefined) break;
    if (attribute.itemSize !== SH_BAND_WORDS[i])
      throw new Error(`THREE.getSphericalHarmonicsDegree: Invalid sphericalHarmonics${i} itemSize.`);
    if (!("array" in attribute) || !(attribute.array instanceof Uint32Array))
      throw new Error(`THREE.getSphericalHarmonicsDegree: sphericalHarmonics${i} must use packed uint32 words.`);
    degree = i;
  }
  for (let i = degree + 1; i <= 3; i++) {
    if (geometry.getAttribute(`sphericalHarmonics${i}`) !== undefined)
      throw new Error("THREE.getSphericalHarmonicsDegree: Spherical harmonics attributes must be contiguous.");
  }
  const position = geometry.getAttribute("position");
  if (position !== undefined) {
    for (let i = 1; i <= degree; i++) {
      if (geometry.getAttribute(`sphericalHarmonics${i}`)?.count !== position.count)
        throw new Error("THREE.getSphericalHarmonicsDegree: Spherical harmonics attribute counts must match position.");
    }
  }
  return degree;
}

/** Creates splat geometry from centers, covariances, RGBA bytes and optional packed SH bands. */
export function createGaussianSplatGeometry(
  centers: Float32Array,
  covariances: Float32Array,
  colors: Uint8Array | Uint8ClampedArray,
  sphericalHarmonics: Record<string, Uint32Array> = {},
): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(centers, 3));
  geometry.setAttribute("covariance", new BufferAttribute(covariances, 6));
  geometry.setAttribute("color", new BufferAttribute(colors, 4, true));
  const count = centers.length / 3;
  for (let i = 1; i <= 3; i++) {
    const values = sphericalHarmonics[`sh${i}`] || sphericalHarmonics[`sphericalHarmonics${i}`];
    if (values !== undefined)
      geometry.setAttribute(`sphericalHarmonics${i}`, createSphericalHarmonicsAttribute(values, count, i));
  }
  getSphericalHarmonicsDegree(geometry);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
