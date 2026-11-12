import { TextureType } from "../../constants";
import { DataArrayTexture } from "../../textures/DataArrayTexture";
import { Vector4 } from "../../math/Vector4";
import { Vector2 } from "../../math/Vector2";
import type { WebGLUniforms } from "./WebGLUniforms";
import type { BufferGeometry } from "../../core/BufferGeometry";
import type { DataTexture } from "../../textures/DataTexture";
import type { WebGLCapabilitiesState } from "./WebGLCapabilities";
import type { WebGLProgramInfo } from "./WebGLProgram";
import type { WebGLTextures } from "./WebGLTextures";

interface MorphTextureEntry {
  count: number;
  texture: DataArrayTexture;
  size: Vector2;
}

interface MorphTargetObject {
  morphTargetInfluences?: number[];
  isInstancedMesh?: boolean;
  morphTexture?: DataTexture | null;
}

export class WebGLMorphtargets {
  private morphTextures: WeakMap<BufferGeometry, MorphTextureEntry>;
  private morph: Vector4;

  constructor(
    private gl: WebGL2RenderingContext,
    private capabilities: WebGLCapabilitiesState,
    private textures: WebGLTextures,
  ) {
    this.morphTextures = new WeakMap();
    this.morph = new Vector4();
    this.update = this.update.bind(this);
  }

  update(object: MorphTargetObject, geometry: BufferGeometry, program: WebGLProgramInfo): void {
    const objectInfluences = object.morphTargetInfluences!;
    // the following encodes morph targets into an array of data textures. Each layer represents a single morph target.
    const morphAttribute =
      geometry.morphAttributes.position || geometry.morphAttributes.normal || geometry.morphAttributes.color;
    const morphTargetsCount = morphAttribute !== undefined ? morphAttribute.length : 0;
    let entry = this.morphTextures.get(geometry);
    if (entry === undefined || entry.count !== morphTargetsCount) {
      if (entry !== undefined) entry.texture.dispose();
      const hasMorphPosition = geometry.morphAttributes.position !== undefined;
      const hasMorphNormals = geometry.morphAttributes.normal !== undefined;
      const hasMorphColors = geometry.morphAttributes.color !== undefined;
      const morphTargets = geometry.morphAttributes.position || [];
      const morphNormals = geometry.morphAttributes.normal || [];
      const morphColors = geometry.morphAttributes.color || [];
      let vertexDataCount = 0;
      if (hasMorphPosition === true) vertexDataCount = 1;
      if (hasMorphNormals === true) vertexDataCount = 2;
      if (hasMorphColors === true) vertexDataCount = 3;
      let width = geometry.attributes.position.count * vertexDataCount;
      let height = 1;
      if (width > this.capabilities.maxTextureSize) {
        height = Math.ceil(width / this.capabilities.maxTextureSize);
        width = this.capabilities.maxTextureSize;
      }
      const buffer = new Float32Array(width * height * 4 * morphTargetsCount);
      const texture = new DataArrayTexture(buffer, width, height, morphTargetsCount);
      texture.type = TextureType.Float;
      texture.needsUpdate = true;
      // fill buffer
      const vertexDataStride = vertexDataCount * 4;
      for (let i = 0; i < morphTargetsCount; i++) {
        const morphTarget = morphTargets[i];
        const morphNormal = morphNormals[i];
        const morphColor = morphColors[i];
        const offset = width * height * 4 * i;
        for (let j = 0; j < geometry.attributes.position.count; j++) {
          const stride = j * vertexDataStride;
          if (hasMorphPosition === true) {
            this.morph.fromBufferAttribute(morphTarget, j);
            buffer[offset + stride + 0] = this.morph.x;
            buffer[offset + stride + 1] = this.morph.y;
            buffer[offset + stride + 2] = this.morph.z;
            buffer[offset + stride + 3] = 0;
          }
          if (hasMorphNormals === true) {
            this.morph.fromBufferAttribute(morphNormal, j);
            buffer[offset + stride + 4] = this.morph.x;
            buffer[offset + stride + 5] = this.morph.y;
            buffer[offset + stride + 6] = this.morph.z;
            buffer[offset + stride + 7] = 0;
          }
          if (hasMorphColors === true) {
            this.morph.fromBufferAttribute(morphColor, j);
            buffer[offset + stride + 8] = this.morph.x;
            buffer[offset + stride + 9] = this.morph.y;
            buffer[offset + stride + 10] = this.morph.z;
            buffer[offset + stride + 11] = morphColor.itemSize === 4 ? this.morph.w : 1;
          }
        }
      }
      entry = {
        count: morphTargetsCount,
        texture: texture,
        size: new Vector2(width, height),
      };
      this.morphTextures.set(geometry, entry);
      const morphTextures = this.morphTextures;
      function disposeTexture() {
        texture.dispose();
        morphTextures.delete(geometry);
        geometry.removeEventListener("dispose", disposeTexture);
      }
      geometry.addEventListener("dispose", disposeTexture);
    }
    //
    const uniforms: WebGLUniforms = program.getUniforms();
    if (object.isInstancedMesh === true && object.morphTexture !== null) {
      uniforms.setValue(this.gl, "morphTexture", object.morphTexture, this.textures);
    } else {
      let morphInfluencesSum = 0;
      for (let i = 0; i < objectInfluences.length; i++) {
        morphInfluencesSum += objectInfluences[i];
      }
      const morphBaseInfluence = geometry.morphTargetsRelative ? 1 : 1 - morphInfluencesSum;
      uniforms.setValue(this.gl, "morphTargetBaseInfluence", morphBaseInfluence);
      uniforms.setValue(this.gl, "morphTargetInfluences", objectInfluences);
    }
    uniforms.setValue(this.gl, "morphTargetsTexture", entry.texture, this.textures);
    uniforms.setValue(this.gl, "morphTargetsTextureSize", entry.size);
  }
}
