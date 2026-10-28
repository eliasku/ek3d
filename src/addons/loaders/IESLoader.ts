import { FloatType, HalfFloatType, LinearFilter, RedFormat, RepeatWrapping, UnsignedByteType } from "../../constants";
import { toHalfFloat } from "../../extras/DataUtils";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import { lerp } from "../../math/MathUtils";
import { DataTexture } from "../../textures/DataTexture";

interface IESProfile {
  vertical: number[];
  horizontal: number[];
  candela: number[][];
}

/** Loads normalized IES photometric profiles as red-channel textures. */
export class IESLoader extends Loader<DataTexture> {
  type: number = HalfFloatType;

  override load(
    url: string,
    onLoad?: (texture: DataTexture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setResponseType("text");
    loader.setCrossOrigin(this.crossOrigin);
    loader.setWithCredentials(this.withCredentials);
    loader.setPath(this.path);
    loader.setRequestHeader(this.requestHeader);
    loader.load(
      url,
      (text) => {
        try {
          if (typeof text !== "string") throw new TypeError("IESLoader requires text data");
          const texture = this.parse(text);
          onLoad?.(texture);
        } catch (error) {
          if (onError) onError(error);
          else console.error(error);
          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }

  parse(text: string): DataTexture {
    const profile = parseProfile(text);
    const width = profile.horizontal.length === 1 ? 1 : 360;
    const height = 180;
    let data: Uint8Array | Uint16Array | Float32Array;
    switch (this.type) {
      case UnsignedByteType:
        data = new Uint8Array(width * height);
        break;
      case HalfFloatType:
        data = new Uint16Array(width * height);
        break;
      case FloatType:
        data = new Float32Array(width * height);
        break;
      default:
        throw new Error(`IESLoader: Unsupported type: ${this.type}`);
    }
    const endTheta = profile.horizontal[profile.horizontal.length - 1];
    for (let theta = 0; theta < width; theta++) {
      let sampleTheta = theta;
      if (endTheta !== 0 && sampleTheta > endTheta) {
        sampleTheta %= endTheta * 2;
        if (sampleTheta > endTheta) sampleTheta = endTheta * 2 - sampleTheta;
      }
      for (let phi = 0; phi < height; phi++) {
        const value = interpolate(profile, (phi * 180) / (height - 1), sampleTheta);
        data[phi + theta * height] =
          this.type === HalfFloatType
            ? toHalfFloat(value)
            : this.type === UnsignedByteType
              ? Math.min(value * 255, 255)
              : value;
      }
    }
    const texture = new DataTexture(data, height, width, RedFormat, this.type);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.wrapT = RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }
}

function interpolate(profile: IESProfile, phi: number, theta: number): number {
  let thetaIndex = 0,
    phiIndex = 0;
  let startTheta = 0,
    endTheta = 0,
    startPhi = 0,
    endPhi = 0;
  for (let i = 0; i < profile.horizontal.length - 1; i++) {
    if (theta < profile.horizontal[i + 1] || i === profile.horizontal.length - 2) {
      thetaIndex = i;
      startTheta = profile.horizontal[i];
      endTheta = profile.horizontal[i + 1];
      break;
    }
  }
  for (let i = 0; i < profile.vertical.length - 1; i++) {
    if (phi < profile.vertical[i + 1] || i === profile.vertical.length - 2) {
      phiIndex = i;
      startPhi = profile.vertical[i];
      endPhi = profile.vertical[i + 1];
      break;
    }
  }
  const deltaTheta = endTheta - startTheta,
    deltaPhi = endPhi - startPhi;
  if (deltaPhi === 0) return 0;
  const t1 = deltaTheta === 0 ? 0 : (theta - startTheta) / deltaTheta;
  const t2 = (phi - startPhi) / deltaPhi;
  const nextTheta = deltaTheta === 0 ? thetaIndex : thetaIndex + 1;
  return lerp(
    lerp(profile.candela[thetaIndex][phiIndex], profile.candela[nextTheta][phiIndex], t1),
    lerp(profile.candela[thetaIndex][phiIndex + 1], profile.candela[nextTheta][phiIndex + 1], t1),
    t2,
  );
}

function parseProfile(text: string): IESProfile {
  const lines = text.split("\n");
  const tilt = lines.findIndex((line) => line.includes("TILT"));
  if (tilt === -1) throw new Error("IESLoader: Missing TILT record");
  const mode = lines[tilt];
  if (!mode.includes("NONE") && !mode.includes("INCLUDE")) {
    throw new Error("IESLoader: External tilt files are not supported");
  }
  const tokens = lines
    .slice(tilt + 1)
    .join(" ")
    .trim()
    .split(/[\s,]+/);
  let offset = 0;
  function read(count: number): number[] {
    if (!Number.isInteger(count) || count < 0 || count > tokens.length - offset) {
      throw new Error("IESLoader: Invalid or truncated numeric record");
    }
    const values: number[] = [];
    values.length = count;
    for (let i = 0; i < count; i++) {
      const value = Number(tokens[offset++]);
      if (!Number.isFinite(value)) throw new Error("IESLoader: Invalid numeric value");
      values[i] = value;
    }
    return values;
  }
  if (!mode.includes("NONE")) {
    read(1);
    const count = read(1)[0];
    read(count);
    read(count);
  }
  const values = read(10);
  const factors = read(3);
  const vertical = read(values[3]);
  const horizontal = read(values[4]);
  if (vertical.length === 0 || horizontal.length === 0) throw new Error("IESLoader: Missing angles");
  const candela: number[][] = [];
  let maximum = -1;
  const multiplier = values[2] * factors[0] * factors[1];
  const base = horizontal[0];
  for (let i = 0; i < horizontal.length; i++) {
    horizontal[i] -= base;
    const row = read(vertical.length);
    for (let j = 0; j < row.length; j++) {
      row[j] *= multiplier;
      maximum = Math.max(maximum, row[j]);
    }
    candela.push(row);
  }
  const endAngle = horizontal[horizontal.length - 1];
  if (endAngle > 180 && endAngle < 360) {
    horizontal.push(360);
    candela.push(candela[0].slice());
  }
  if (maximum > 0) {
    for (const row of candela) {
      for (let j = 0; j < row.length; j++) row[j] /= maximum;
    }
  }
  return { vertical, horizontal, candela };
}
