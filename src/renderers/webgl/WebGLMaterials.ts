import type { IUniform, Uniforms } from "../../core/Uniform";
import type { Material, MaterialProperties } from "../../materials/Material";
import type { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import type { MeshLambertMaterial } from "../../materials/MeshLambertMaterial";
import type { MeshToonMaterial } from "../../materials/MeshToonMaterial";
import type { MeshPhongMaterial } from "../../materials/MeshPhongMaterial";
import type { MeshStandardMaterial } from "../../materials/MeshStandardMaterial";
import type { MeshPhysicalMaterial } from "../../materials/MeshPhysicalMaterial";
import type { MeshMatcapMaterial } from "../../materials/MeshMatcapMaterial";
import type { MeshDepthMaterial } from "../../materials/MeshDepthMaterial";
import type { MeshDistanceMaterial } from "../../materials/MeshDistanceMaterial";
import type { MeshNormalMaterial } from "../../materials/MeshNormalMaterial";
import type { LineBasicMaterial } from "../../materials/LineBasicMaterial";
import type { LineDashedMaterial } from "../../materials/LineDashedMaterial";
import type { PointsMaterial } from "../../materials/PointsMaterial";
import type { SpriteMaterial } from "../../materials/SpriteMaterial";
import type { ShadowMaterial } from "../../materials/ShadowMaterial";
import type { ShaderMaterial } from "../../materials/ShaderMaterial";
import type { RenderTarget } from "../../core/RenderTarget";
import type { PointLight } from "../../lights/PointLight";
import type { Euler } from "../../math/Euler";
import type { Color } from "../../math/Color";
import type { Vector2 } from "../../math/Vector2";
import type { Vector3 } from "../../math/Vector3";
import type { Fog } from "../../scenes/Fog";
import type { FogExp2 } from "../../scenes/FogExp2";
import type { Texture } from "../../textures/Texture";
import type { WebGLRenderer } from "../WebGLRenderer";
import { Side } from "../../constants";
import { getUnlitUniformColorSpace } from "../shaders/UniformsUtils";
import { Matrix3 } from "../../math/Matrix3";
import { Matrix4 } from "../../math/Matrix4";

export type MaterialUniforms = Uniforms<unknown> & {
  [
    name in
      | "color"
      | "diffuse"
      | "emissive"
      | "fogColor"
      | "specular"
      | "sheenColor"
      | "attenuationColor"
      | "specularColor"
  ]?: IUniform<Color>;
} & {
  [name in "normalScale" | "clearcoatNormalScale" | "transmissionSamplerSize" | "anisotropyVector"]?: IUniform<Vector2>;
} & {
  envMapRotation?: IUniform<Matrix3>;
  referencePosition?: IUniform<Vector3>;
  bumpScale?: IUniform<number>;
};

export interface MaterialUniformsProperties {
  envMap?: (Texture & { isCubeTexture?: boolean }) | null;
  envMapRotation?: Euler;
  light?: PointLight;
}

const _m1 = /*@__PURE__*/ new Matrix4();
const _m = /*@__PURE__*/ new Matrix3();
_m.set(-1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);
export class WebGLMaterials {
  constructor(
    private renderer: WebGLRenderer,
    private properties: { get(material: object): MaterialUniformsProperties },
  ) {
    this.refreshFogUniforms = this.refreshFogUniforms.bind(this);
    this.refreshMaterialUniforms = this.refreshMaterialUniforms.bind(this);
  }

  private refreshTransformUniform(map: Texture, uniform: IUniform<unknown>) {
    if (map.matrixAutoUpdate === true) {
      map.updateMatrix();
    }
    (uniform.value as Matrix3).copy(map.matrix);
  }

  refreshFogUniforms(uniforms: MaterialUniforms, fog: Fog | FogExp2) {
    fog.color.getRGB(uniforms.fogColor!.value, getUnlitUniformColorSpace(this.renderer));
    if ((fog as Fog).isFog) {
      uniforms.fogNear.value = (fog as Fog).near;
      uniforms.fogFar.value = (fog as Fog).far;
    } else if ((fog as FogExp2).isFogExp2) {
      uniforms.fogDensity.value = (fog as FogExp2).density;
    }
  }

  refreshMaterialUniforms(
    uniforms: MaterialUniforms,
    material: Material,
    pixelRatio: number,
    height: number,
    transmissionRenderTarget?: RenderTarget | null,
  ) {
    if ((material as MeshBasicMaterial).isMeshBasicMaterial) {
      this.refreshUniformsCommon(uniforms, material);
    } else if ((material as MeshLambertMaterial).isMeshLambertMaterial) {
      this.refreshUniformsCommon(uniforms, material);
      if ((material as MeshLambertMaterial).envMap) {
        uniforms.envMapIntensity.value = (material as MeshLambertMaterial).envMapIntensity;
      }
    } else if ((material as MeshToonMaterial).isMeshToonMaterial) {
      this.refreshUniformsCommon(uniforms, material);
      this.refreshUniformsToon(uniforms, material as MeshToonMaterial);
    } else if ((material as MeshPhongMaterial).isMeshPhongMaterial) {
      this.refreshUniformsCommon(uniforms, material);
      this.refreshUniformsPhong(uniforms, material as MeshPhongMaterial);
      if ((material as MeshPhongMaterial).envMap) {
        uniforms.envMapIntensity.value = (material as MeshPhongMaterial).envMapIntensity;
      }
    } else if ((material as MeshStandardMaterial).isMeshStandardMaterial) {
      this.refreshUniformsCommon(uniforms, material);
      this.refreshUniformsStandard(uniforms, material as MeshStandardMaterial);
      if ((material as MeshPhysicalMaterial).isMeshPhysicalMaterial) {
        this.refreshUniformsPhysical(uniforms, material as MeshPhysicalMaterial, transmissionRenderTarget!);
      }
    } else if ((material as MeshMatcapMaterial).isMeshMatcapMaterial) {
      this.refreshUniformsCommon(uniforms, material);
      this.refreshUniformsMatcap(uniforms, material as MeshMatcapMaterial);
    } else if ((material as MeshDepthMaterial).isMeshDepthMaterial) {
      this.refreshUniformsCommon(uniforms, material);
    } else if ((material as MeshDistanceMaterial).isMeshDistanceMaterial) {
      this.refreshUniformsCommon(uniforms, material);
      this.refreshUniformsDistance(uniforms, material as MeshDistanceMaterial);
    } else if ((material as MeshNormalMaterial).isMeshNormalMaterial) {
      this.refreshUniformsCommon(uniforms, material);
    } else if ((material as LineBasicMaterial).isLineBasicMaterial) {
      this.refreshUniformsLine(uniforms, material as LineBasicMaterial);
      if ((material as LineDashedMaterial).isLineDashedMaterial) {
        this.refreshUniformsDash(uniforms, material as LineDashedMaterial);
      }
    } else if ((material as PointsMaterial).isPointsMaterial) {
      this.refreshUniformsPoints(uniforms, material as PointsMaterial, pixelRatio, height);
    } else if ((material as SpriteMaterial).isSpriteMaterial) {
      this.refreshUniformsSprites(uniforms, material as SpriteMaterial);
    } else if ((material as ShadowMaterial).isShadowMaterial) {
      uniforms.color!.value.copy((material as ShadowMaterial).color);
      uniforms.opacity.value = material.opacity;
    } else if ((material as ShaderMaterial).isShaderMaterial) {
      (material as ShaderMaterial).uniformsNeedUpdate = false; // #15581
    }
  }

  private refreshUniformsCommon(
    uniforms: MaterialUniforms,
    material: Material & MaterialProperties & { color?: Color; emissive?: Color; ior?: number },
  ) {
    uniforms.opacity.value = material.opacity;
    if (material.color) {
      uniforms.diffuse!.value.copy(material.color);
    }
    if (material.emissive) {
      uniforms.emissive!.value.copy(material.emissive).multiplyScalar(material.emissiveIntensity!);
    }
    if (material.map) {
      uniforms.map.value = material.map;
      this.refreshTransformUniform(material.map, uniforms.mapTransform);
    }
    if (material.alphaMap) {
      uniforms.alphaMap.value = material.alphaMap;
      this.refreshTransformUniform(material.alphaMap, uniforms.alphaMapTransform);
    }
    if (material.bumpMap) {
      uniforms.bumpMap.value = material.bumpMap;
      this.refreshTransformUniform(material.bumpMap, uniforms.bumpMapTransform);
      uniforms.bumpScale!.value = material.bumpScale!;
      if (material.side === Side.Back) {
        uniforms.bumpScale!.value *= -1;
      }
    }
    if (material.normalMap) {
      uniforms.normalMap.value = material.normalMap;
      this.refreshTransformUniform(material.normalMap, uniforms.normalMapTransform);
      uniforms.normalScale!.value.copy(material.normalScale!);
      if (material.side === Side.Back) {
        uniforms.normalScale!.value.negate();
      }
    }
    if (material.displacementMap) {
      uniforms.displacementMap.value = material.displacementMap;
      this.refreshTransformUniform(material.displacementMap, uniforms.displacementMapTransform);
      uniforms.displacementScale.value = material.displacementScale;
      uniforms.displacementBias.value = material.displacementBias;
    }
    if (material.emissiveMap) {
      uniforms.emissiveMap.value = material.emissiveMap;
      this.refreshTransformUniform(material.emissiveMap, uniforms.emissiveMapTransform);
    }
    if (material.specularMap) {
      uniforms.specularMap.value = material.specularMap;
      this.refreshTransformUniform(material.specularMap, uniforms.specularMapTransform);
    }
    if (material.alphaTest > 0) {
      uniforms.alphaTest.value = material.alphaTest;
    }
    const materialProperties = this.properties.get(material);
    const envMap = materialProperties.envMap;
    const envMapRotation = materialProperties.envMapRotation;
    if (envMap) {
      uniforms.envMap.value = envMap;
      // note: since the matrix is orthonormal, we can use the more-efficient transpose() in lieu of invert()
      uniforms.envMapRotation!.value.setFromMatrix4(_m1.makeRotationFromEuler(envMapRotation!)).transpose();
      if (envMap.isCubeTexture && envMap.isRenderTargetTexture === false) {
        uniforms.envMapRotation!.value.premultiply(_m);
      }
      uniforms.reflectivity.value = material.reflectivity;
      uniforms.ior.value = material.ior;
      uniforms.refractionRatio.value = material.refractionRatio;
    }
    if (material.lightMap) {
      uniforms.lightMap.value = material.lightMap;
      uniforms.lightMapIntensity.value = material.lightMapIntensity;
      this.refreshTransformUniform(material.lightMap, uniforms.lightMapTransform);
    }
    if (material.aoMap) {
      uniforms.aoMap.value = material.aoMap;
      uniforms.aoMapIntensity.value = material.aoMapIntensity;
      this.refreshTransformUniform(material.aoMap, uniforms.aoMapTransform);
    }
  }

  private refreshUniformsLine(uniforms: MaterialUniforms, material: LineBasicMaterial) {
    uniforms.diffuse!.value.copy(material.color);
    uniforms.opacity.value = material.opacity;
    if (material.map) {
      uniforms.map.value = material.map;
      this.refreshTransformUniform(material.map, uniforms.mapTransform);
    }
  }

  private refreshUniformsDash(uniforms: MaterialUniforms, material: LineDashedMaterial) {
    uniforms.dashSize.value = material.dashSize;
    uniforms.totalSize.value = material.dashSize + material.gapSize;
    uniforms.scale.value = material.scale;
  }

  private refreshUniformsPoints(
    uniforms: MaterialUniforms,
    material: PointsMaterial,
    pixelRatio: number,
    height: number,
  ) {
    uniforms.diffuse!.value.copy(material.color);
    uniforms.opacity.value = material.opacity;
    uniforms.size.value = material.size * pixelRatio;
    uniforms.scale.value = height * 0.5;
    if (material.map) {
      uniforms.map.value = material.map;
      this.refreshTransformUniform(material.map, uniforms.uvTransform);
    }
    if (material.alphaMap) {
      uniforms.alphaMap.value = material.alphaMap;
      this.refreshTransformUniform(material.alphaMap, uniforms.alphaMapTransform);
    }
    if (material.alphaTest > 0) {
      uniforms.alphaTest.value = material.alphaTest;
    }
  }

  private refreshUniformsSprites(uniforms: MaterialUniforms, material: SpriteMaterial) {
    uniforms.diffuse!.value.copy(material.color);
    uniforms.opacity.value = material.opacity;
    uniforms.rotation.value = material.rotation;
    if (material.map) {
      uniforms.map.value = material.map;
      this.refreshTransformUniform(material.map, uniforms.mapTransform);
    }
    if (material.alphaMap) {
      uniforms.alphaMap.value = material.alphaMap;
      this.refreshTransformUniform(material.alphaMap, uniforms.alphaMapTransform);
    }
    if (material.alphaTest > 0) {
      uniforms.alphaTest.value = material.alphaTest;
    }
  }

  private refreshUniformsPhong(uniforms: MaterialUniforms, material: MeshPhongMaterial) {
    uniforms.specular!.value.copy(material.specular);
    uniforms.shininess.value = Math.max(material.shininess, 1e-4); // to prevent pow( 0.0, 0.0 )
  }

  private refreshUniformsToon(uniforms: MaterialUniforms, material: MeshToonMaterial) {
    if (material.gradientMap) {
      uniforms.gradientMap.value = material.gradientMap;
    }
  }

  private refreshUniformsStandard(uniforms: MaterialUniforms, material: MeshStandardMaterial) {
    uniforms.metalness.value = material.metalness;
    if (material.metalnessMap) {
      uniforms.metalnessMap.value = material.metalnessMap;
      this.refreshTransformUniform(material.metalnessMap, uniforms.metalnessMapTransform);
    }
    uniforms.roughness.value = material.roughness;
    if (material.roughnessMap) {
      uniforms.roughnessMap.value = material.roughnessMap;
      this.refreshTransformUniform(material.roughnessMap, uniforms.roughnessMapTransform);
    }
    if (material.envMap) {
      //uniforms.envMap.value = material.envMap; // part of uniforms common
      uniforms.envMapIntensity.value = material.envMapIntensity;
    }
  }

  private refreshUniformsPhysical(
    uniforms: MaterialUniforms,
    material: MeshPhysicalMaterial,
    transmissionRenderTarget: RenderTarget,
  ) {
    uniforms.ior.value = material.ior; // also part of uniforms common
    if (material.diffuseRoughness > 0) {
      uniforms.diffuseRoughness.value = material.diffuseRoughness;
      if (material.diffuseRoughnessMap) {
        uniforms.diffuseRoughnessMap.value = material.diffuseRoughnessMap;
        this.refreshTransformUniform(material.diffuseRoughnessMap, uniforms.diffuseRoughnessMapTransform);
      }
    }
    if (material.sheen > 0) {
      uniforms.sheenColor!.value.copy(material.sheenColor).multiplyScalar(material.sheen);
      uniforms.sheenRoughness.value = material.sheenRoughness;
      if (material.sheenColorMap) {
        uniforms.sheenColorMap.value = material.sheenColorMap;
        this.refreshTransformUniform(material.sheenColorMap, uniforms.sheenColorMapTransform);
      }
      if (material.sheenRoughnessMap) {
        uniforms.sheenRoughnessMap.value = material.sheenRoughnessMap;
        this.refreshTransformUniform(material.sheenRoughnessMap, uniforms.sheenRoughnessMapTransform);
      }
    }
    if (material.clearcoat > 0) {
      uniforms.clearcoat.value = material.clearcoat;
      uniforms.clearcoatRoughness.value = material.clearcoatRoughness;
      if (material.clearcoatMap) {
        uniforms.clearcoatMap.value = material.clearcoatMap;
        this.refreshTransformUniform(material.clearcoatMap, uniforms.clearcoatMapTransform);
      }
      if (material.clearcoatRoughnessMap) {
        uniforms.clearcoatRoughnessMap.value = material.clearcoatRoughnessMap;
        this.refreshTransformUniform(material.clearcoatRoughnessMap, uniforms.clearcoatRoughnessMapTransform);
      }
      if (material.clearcoatNormalMap) {
        uniforms.clearcoatNormalMap.value = material.clearcoatNormalMap;
        this.refreshTransformUniform(material.clearcoatNormalMap, uniforms.clearcoatNormalMapTransform);
        uniforms.clearcoatNormalScale!.value.copy(material.clearcoatNormalScale);
        if (material.side === Side.Back) {
          uniforms.clearcoatNormalScale!.value.negate();
        }
      }
    }
    if (material.dispersion > 0) {
      uniforms.dispersion.value = material.dispersion;
    }
    if (material.retroreflectivity > 0) {
      uniforms.retroreflectivity.value = material.retroreflectivity;
    }
    if (material.iridescence > 0) {
      uniforms.iridescence.value = material.iridescence;
      uniforms.iridescenceIOR.value = material.iridescenceIOR;
      uniforms.iridescenceThicknessMinimum.value = material.iridescenceThicknessMinimum;
      uniforms.iridescenceThicknessMaximum.value = material.iridescenceThicknessMaximum;
      if (material.iridescenceMap) {
        uniforms.iridescenceMap.value = material.iridescenceMap;
        this.refreshTransformUniform(material.iridescenceMap, uniforms.iridescenceMapTransform);
      }
      if (material.iridescenceThicknessMap) {
        uniforms.iridescenceThicknessMap.value = material.iridescenceThicknessMap;
        this.refreshTransformUniform(material.iridescenceThicknessMap, uniforms.iridescenceThicknessMapTransform);
      }
    }
    if (material.transmission > 0) {
      uniforms.transmission.value = material.transmission;
      uniforms.transmissionSamplerMap.value = transmissionRenderTarget.texture;
      uniforms.transmissionSamplerSize!.value.set(transmissionRenderTarget.width, transmissionRenderTarget.height);
      if (material.transmissionMap) {
        uniforms.transmissionMap.value = material.transmissionMap;
        this.refreshTransformUniform(material.transmissionMap, uniforms.transmissionMapTransform);
      }
      uniforms.thickness.value = material.thickness;
      if (material.thicknessMap) {
        uniforms.thicknessMap.value = material.thicknessMap;
        this.refreshTransformUniform(material.thicknessMap, uniforms.thicknessMapTransform);
      }
      uniforms.attenuationDistance.value = material.attenuationDistance;
      uniforms.attenuationColor!.value.copy(material.attenuationColor);
    }
    if (material.anisotropy > 0) {
      uniforms.anisotropyVector!.value.set(
        material.anisotropy * Math.cos(material.anisotropyRotation),
        material.anisotropy * Math.sin(material.anisotropyRotation),
      );
      if (material.anisotropyMap) {
        uniforms.anisotropyMap.value = material.anisotropyMap;
        this.refreshTransformUniform(material.anisotropyMap, uniforms.anisotropyMapTransform);
      }
    }
    uniforms.specularIntensity.value = material.specularIntensity;
    uniforms.specularColor!.value.copy(material.specularColor);
    if (material.specularColorMap) {
      uniforms.specularColorMap.value = material.specularColorMap;
      this.refreshTransformUniform(material.specularColorMap, uniforms.specularColorMapTransform);
    }
    if (material.specularIntensityMap) {
      uniforms.specularIntensityMap.value = material.specularIntensityMap;
      this.refreshTransformUniform(material.specularIntensityMap, uniforms.specularIntensityMapTransform);
    }
  }

  private refreshUniformsMatcap(uniforms: MaterialUniforms, material: MeshMatcapMaterial) {
    if (material.matcap) {
      uniforms.matcap.value = material.matcap;
    }
  }

  private refreshUniformsDistance(uniforms: MaterialUniforms, material: MeshDistanceMaterial) {
    const light = this.properties.get(material).light!;
    uniforms.referencePosition!.value.setFromMatrixPosition(light.matrixWorld);
    uniforms.nearDistance.value = light.shadow.camera.near;
    uniforms.farDistance.value = light.shadow.camera.far;
  }
}
