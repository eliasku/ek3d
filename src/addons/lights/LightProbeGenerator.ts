import { TextureType, ColorSpace } from "../../constants";
import { LightProbe } from "../../lights/LightProbe";
import { Color } from "../../math/Color";
import { fromHalfFloat } from "../../extras/DataUtils";
import { SphericalHarmonics3 } from "../../math/SphericalHarmonics3";
import { Vector3 } from "../../math/Vector3";
import type { WebGLCubeRenderTarget } from "../../renderers/WebGLCubeRenderTarget";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { CubeTexture } from "../../textures/CubeTexture";

/** Creates light probes from cube textures and WebGL cube render targets. */
export class LightProbeGenerator {
  static fromCubeTexture(cubeTexture: CubeTexture): LightProbe {
    const faces: Uint8ClampedArray[] = [];
    let width = 0;
    for (const image of cubeTexture.image) {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to create 2D canvas context");
      context.drawImage(image, 0, 0, image.width, image.height);
      const pixels = context.getImageData(0, 0, image.width, image.height);
      width = pixels.width;
      faces.push(pixels.data);
    }
    return generate(faces, width, cubeTexture.colorSpace, false, false);
  }

  static async fromCubeRenderTarget(renderer: WebGLRenderer, target: WebGLCubeRenderTarget): Promise<LightProbe> {
    const width = target.width;
    const type = target.texture.type;
    const faces: (Float32Array | Uint16Array | Uint8Array)[] = [];
    for (let face = 0; face < 6; face++) {
      const data =
        type === TextureType.Float
          ? new Float32Array(width * width * 4)
          : type === TextureType.HalfFloat
            ? new Uint16Array(width * width * 4)
            : new Uint8Array(width * width * 4);
      await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, width, data, face);
      faces.push(data);
    }
    return generate(
      faces,
      width,
      target.texture.colorSpace,
      true,
      type === TextureType.HalfFloat,
      type === TextureType.Float,
    );
  }
}

function generate(
  faces: ArrayLike<number>[],
  width: number,
  colorSpace: string,
  renderTarget: boolean,
  half: boolean,
  floating = false,
): LightProbe {
  const sh = new SphericalHarmonics3();
  const basis = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const coord = new Vector3();
  const direction = new Vector3();
  const color = new Color();
  let totalWeight = 0;
  for (let face = 0; face < 6; face++) {
    const data = faces[face];
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (half) {
        r = fromHalfFloat(r);
        g = fromHalfFloat(g);
        b = fromHalfFloat(b);
      } else if (!floating) {
        r /= 255;
        g /= 255;
        b /= 255;
      }
      color.setRGB(r, g, b);
      if (colorSpace === ColorSpace.SRGB) color.convertSRGBToLinear();
      else if (colorSpace !== ColorSpace.LinearSRGB && colorSpace !== ColorSpace.No) {
        console.warn("WARNING: LightProbeGenerator convertColorToLinear() encountered an unsupported color space.");
      }
      const pixel = i / 4;
      const col = -1 + (((pixel % width) + 0.5) * 2) / width;
      const row = 1 - ((Math.floor(pixel / width) + 0.5) * 2) / width;
      if (renderTarget) {
        switch (face) {
          case 0:
            coord.set(1, row, -col);
            break;
          case 1:
            coord.set(-1, row, col);
            break;
          case 2:
            coord.set(col, 1, -row);
            break;
          case 3:
            coord.set(col, -1, row);
            break;
          case 4:
            coord.set(col, row, 1);
            break;
          case 5:
            coord.set(-col, row, -1);
            break;
        }
      } else {
        switch (face) {
          case 0:
            coord.set(-1, row, -col);
            break;
          case 1:
            coord.set(1, row, col);
            break;
          case 2:
            coord.set(-col, 1, -row);
            break;
          case 3:
            coord.set(-col, -1, row);
            break;
          case 4:
            coord.set(-col, row, 1);
            break;
          case 5:
            coord.set(col, row, -1);
            break;
        }
      }
      const lengthSq = coord.lengthSq();
      const weight = 4 / (Math.sqrt(lengthSq) * lengthSq);
      totalWeight += weight;
      direction.copy(coord).normalize();
      SphericalHarmonics3.getBasisAt(direction, basis);
      for (let j = 0; j < 9; j++) {
        sh.coefficients[j].x += basis[j] * color.r * weight;
        sh.coefficients[j].y += basis[j] * color.g * weight;
        sh.coefficients[j].z += basis[j] * color.b * weight;
      }
    }
  }
  const norm = (4 * Math.PI) / totalWeight;
  for (const coefficient of sh.coefficients) coefficient.multiplyScalar(norm);
  return new LightProbe(sh);
}
