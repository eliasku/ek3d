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

type MaterialUniforms = Record<string, { value: unknown }> & {
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
  ]?: { value: Color };
} & {
  [name in "normalScale" | "clearcoatNormalScale" | "transmissionSamplerSize" | "anisotropyVector"]?: {
    value: Vector2;
  };
} & {
  envMapRotation?: { value: Matrix3 };
  referencePosition?: { value: Vector3 };
  bumpScale?: { value: number };
};

interface MaterialProperties {
  envMap?: (Texture & { isCubeTexture?: boolean }) | null;
  envMapRotation?: Euler;
  light?: PointLight;
}

const _m1 = /*@__PURE__*/ new Matrix4();
const _m = /*@__PURE__*/ new Matrix3();
_m.set(-1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);
export function WebGLMaterials(renderer: WebGLRenderer, properties: { get(material: object): MaterialProperties }) {
  function refreshTransformUniform(map: Texture, uniform: { value: unknown }) {
    if (map.matrixAutoUpdate === true) {
      map.updateMatrix();
    }
    (uniform.value as Matrix3).copy(map.matrix);
  }
  function refreshFogUniforms(uniforms: MaterialUniforms, fog: Fog | FogExp2) {
    fog.color.getRGB(uniforms.fogColor!.value, getUnlitUniformColorSpace(renderer));
    if ((fog as Fog).isFog) {
      uniforms.fogNear.value = (fog as Fog).near;
      uniforms.fogFar.value = (fog as Fog).far;
    } else if ((fog as FogExp2).isFogExp2) {
      uniforms.fogDensity.value = (fog as FogExp2).density;
    }
  }
  function refreshMaterialUniforms(
    uniforms: MaterialUniforms,
    material?: any,
    pixelRatio?: any,
    height?: any,
    transmissionRenderTarget?: any,
  ) {
    if (material.isMeshBasicMaterial) {
      refreshUniformsCommon(uniforms, material);
    } else if (material.isMeshLambertMaterial) {
      refreshUniformsCommon(uniforms, material);
      if (material.envMap) {
        uniforms.envMapIntensity.value = material.envMapIntensity;
      }
    } else if (material.isMeshToonMaterial) {
      refreshUniformsCommon(uniforms, material);
      refreshUniformsToon(uniforms, material);
    } else if (material.isMeshPhongMaterial) {
      refreshUniformsCommon(uniforms, material);
      refreshUniformsPhong(uniforms, material);
      if (material.envMap) {
        uniforms.envMapIntensity.value = material.envMapIntensity;
      }
    } else if (material.isMeshStandardMaterial) {
      refreshUniformsCommon(uniforms, material);
      refreshUniformsStandard(uniforms, material);
      if (material.isMeshPhysicalMaterial) {
        refreshUniformsPhysical(uniforms, material, transmissionRenderTarget);
      }
    } else if (material.isMeshMatcapMaterial) {
      refreshUniformsCommon(uniforms, material);
      refreshUniformsMatcap(uniforms, material);
    } else if (material.isMeshDepthMaterial) {
      refreshUniformsCommon(uniforms, material);
    } else if (material.isMeshDistanceMaterial) {
      refreshUniformsCommon(uniforms, material);
      refreshUniformsDistance(uniforms, material);
    } else if (material.isMeshNormalMaterial) {
      refreshUniformsCommon(uniforms, material);
    } else if (material.isLineBasicMaterial) {
      refreshUniformsLine(uniforms, material);
      if (material.isLineDashedMaterial) {
        refreshUniformsDash(uniforms, material);
      }
    } else if (material.isPointsMaterial) {
      refreshUniformsPoints(uniforms, material, pixelRatio, height);
    } else if (material.isSpriteMaterial) {
      refreshUniformsSprites(uniforms, material);
    } else if (material.isShadowMaterial) {
      uniforms.color!.value.copy(material.color);
      uniforms.opacity.value = material.opacity;
    } else if (material.isShaderMaterial) {
      material.uniformsNeedUpdate = false; // #15581
    }
  }
  function refreshUniformsCommon(uniforms: MaterialUniforms, material?: any) {
    uniforms.opacity.value = material.opacity;
    if (material.color) {
      uniforms.diffuse!.value.copy(material.color);
    }
    if (material.emissive) {
      uniforms.emissive!.value.copy(material.emissive).multiplyScalar(material.emissiveIntensity);
    }
    if (material.map) {
      uniforms.map.value = material.map;
      refreshTransformUniform(material.map, uniforms.mapTransform);
    }
    if (material.alphaMap) {
      uniforms.alphaMap.value = material.alphaMap;
      refreshTransformUniform(material.alphaMap, uniforms.alphaMapTransform);
    }
    if (material.bumpMap) {
      uniforms.bumpMap.value = material.bumpMap;
      refreshTransformUniform(material.bumpMap, uniforms.bumpMapTransform);
      uniforms.bumpScale!.value = material.bumpScale;
      if (material.side === Side.Back) {
        uniforms.bumpScale!.value *= -1;
      }
    }
    if (material.normalMap) {
      uniforms.normalMap.value = material.normalMap;
      refreshTransformUniform(material.normalMap, uniforms.normalMapTransform);
      uniforms.normalScale!.value.copy(material.normalScale);
      if (material.side === Side.Back) {
        uniforms.normalScale!.value.negate();
      }
    }
    if (material.displacementMap) {
      uniforms.displacementMap.value = material.displacementMap;
      refreshTransformUniform(material.displacementMap, uniforms.displacementMapTransform);
      uniforms.displacementScale.value = material.displacementScale;
      uniforms.displacementBias.value = material.displacementBias;
    }
    if (material.emissiveMap) {
      uniforms.emissiveMap.value = material.emissiveMap;
      refreshTransformUniform(material.emissiveMap, uniforms.emissiveMapTransform);
    }
    if (material.specularMap) {
      uniforms.specularMap.value = material.specularMap;
      refreshTransformUniform(material.specularMap, uniforms.specularMapTransform);
    }
    if (material.alphaTest > 0) {
      uniforms.alphaTest.value = material.alphaTest;
    }
    const materialProperties = properties.get(material);
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
      refreshTransformUniform(material.lightMap, uniforms.lightMapTransform);
    }
    if (material.aoMap) {
      uniforms.aoMap.value = material.aoMap;
      uniforms.aoMapIntensity.value = material.aoMapIntensity;
      refreshTransformUniform(material.aoMap, uniforms.aoMapTransform);
    }
  }
  function refreshUniformsLine(uniforms: MaterialUniforms, material?: any) {
    uniforms.diffuse!.value.copy(material.color);
    uniforms.opacity.value = material.opacity;
    if (material.map) {
      uniforms.map.value = material.map;
      refreshTransformUniform(material.map, uniforms.mapTransform);
    }
  }
  function refreshUniformsDash(uniforms: MaterialUniforms, material?: any) {
    uniforms.dashSize.value = material.dashSize;
    uniforms.totalSize.value = material.dashSize + material.gapSize;
    uniforms.scale.value = material.scale;
  }
  function refreshUniformsPoints(uniforms: MaterialUniforms, material?: any, pixelRatio?: any, height?: any) {
    uniforms.diffuse!.value.copy(material.color);
    uniforms.opacity.value = material.opacity;
    uniforms.size.value = material.size * pixelRatio;
    uniforms.scale.value = height * 0.5;
    if (material.map) {
      uniforms.map.value = material.map;
      refreshTransformUniform(material.map, uniforms.uvTransform);
    }
    if (material.alphaMap) {
      uniforms.alphaMap.value = material.alphaMap;
      refreshTransformUniform(material.alphaMap, uniforms.alphaMapTransform);
    }
    if (material.alphaTest > 0) {
      uniforms.alphaTest.value = material.alphaTest;
    }
  }
  function refreshUniformsSprites(uniforms: MaterialUniforms, material?: any) {
    uniforms.diffuse!.value.copy(material.color);
    uniforms.opacity.value = material.opacity;
    uniforms.rotation.value = material.rotation;
    if (material.map) {
      uniforms.map.value = material.map;
      refreshTransformUniform(material.map, uniforms.mapTransform);
    }
    if (material.alphaMap) {
      uniforms.alphaMap.value = material.alphaMap;
      refreshTransformUniform(material.alphaMap, uniforms.alphaMapTransform);
    }
    if (material.alphaTest > 0) {
      uniforms.alphaTest.value = material.alphaTest;
    }
  }
  function refreshUniformsPhong(uniforms: MaterialUniforms, material?: any) {
    uniforms.specular!.value.copy(material.specular);
    uniforms.shininess.value = Math.max(material.shininess, 1e-4); // to prevent pow( 0.0, 0.0 )
  }
  function refreshUniformsToon(uniforms: MaterialUniforms, material?: any) {
    if (material.gradientMap) {
      uniforms.gradientMap.value = material.gradientMap;
    }
  }
  function refreshUniformsStandard(uniforms: MaterialUniforms, material?: any) {
    uniforms.metalness.value = material.metalness;
    if (material.metalnessMap) {
      uniforms.metalnessMap.value = material.metalnessMap;
      refreshTransformUniform(material.metalnessMap, uniforms.metalnessMapTransform);
    }
    uniforms.roughness.value = material.roughness;
    if (material.roughnessMap) {
      uniforms.roughnessMap.value = material.roughnessMap;
      refreshTransformUniform(material.roughnessMap, uniforms.roughnessMapTransform);
    }
    if (material.envMap) {
      //uniforms.envMap.value = material.envMap; // part of uniforms common
      uniforms.envMapIntensity.value = material.envMapIntensity;
    }
  }
  function refreshUniformsPhysical(uniforms: MaterialUniforms, material?: any, transmissionRenderTarget?: any) {
    uniforms.ior.value = material.ior; // also part of uniforms common
    if (material.diffuseRoughness > 0) {
      uniforms.diffuseRoughness.value = material.diffuseRoughness;
      if (material.diffuseRoughnessMap) {
        uniforms.diffuseRoughnessMap.value = material.diffuseRoughnessMap;
        refreshTransformUniform(material.diffuseRoughnessMap, uniforms.diffuseRoughnessMapTransform);
      }
    }
    if (material.sheen > 0) {
      uniforms.sheenColor!.value.copy(material.sheenColor).multiplyScalar(material.sheen);
      uniforms.sheenRoughness.value = material.sheenRoughness;
      if (material.sheenColorMap) {
        uniforms.sheenColorMap.value = material.sheenColorMap;
        refreshTransformUniform(material.sheenColorMap, uniforms.sheenColorMapTransform);
      }
      if (material.sheenRoughnessMap) {
        uniforms.sheenRoughnessMap.value = material.sheenRoughnessMap;
        refreshTransformUniform(material.sheenRoughnessMap, uniforms.sheenRoughnessMapTransform);
      }
    }
    if (material.clearcoat > 0) {
      uniforms.clearcoat.value = material.clearcoat;
      uniforms.clearcoatRoughness.value = material.clearcoatRoughness;
      if (material.clearcoatMap) {
        uniforms.clearcoatMap.value = material.clearcoatMap;
        refreshTransformUniform(material.clearcoatMap, uniforms.clearcoatMapTransform);
      }
      if (material.clearcoatRoughnessMap) {
        uniforms.clearcoatRoughnessMap.value = material.clearcoatRoughnessMap;
        refreshTransformUniform(material.clearcoatRoughnessMap, uniforms.clearcoatRoughnessMapTransform);
      }
      if (material.clearcoatNormalMap) {
        uniforms.clearcoatNormalMap.value = material.clearcoatNormalMap;
        refreshTransformUniform(material.clearcoatNormalMap, uniforms.clearcoatNormalMapTransform);
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
        refreshTransformUniform(material.iridescenceMap, uniforms.iridescenceMapTransform);
      }
      if (material.iridescenceThicknessMap) {
        uniforms.iridescenceThicknessMap.value = material.iridescenceThicknessMap;
        refreshTransformUniform(material.iridescenceThicknessMap, uniforms.iridescenceThicknessMapTransform);
      }
    }
    if (material.transmission > 0) {
      uniforms.transmission.value = material.transmission;
      uniforms.transmissionSamplerMap.value = transmissionRenderTarget.texture;
      uniforms.transmissionSamplerSize!.value.set(transmissionRenderTarget.width, transmissionRenderTarget.height);
      if (material.transmissionMap) {
        uniforms.transmissionMap.value = material.transmissionMap;
        refreshTransformUniform(material.transmissionMap, uniforms.transmissionMapTransform);
      }
      uniforms.thickness.value = material.thickness;
      if (material.thicknessMap) {
        uniforms.thicknessMap.value = material.thicknessMap;
        refreshTransformUniform(material.thicknessMap, uniforms.thicknessMapTransform);
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
        refreshTransformUniform(material.anisotropyMap, uniforms.anisotropyMapTransform);
      }
    }
    uniforms.specularIntensity.value = material.specularIntensity;
    uniforms.specularColor!.value.copy(material.specularColor);
    if (material.specularColorMap) {
      uniforms.specularColorMap.value = material.specularColorMap;
      refreshTransformUniform(material.specularColorMap, uniforms.specularColorMapTransform);
    }
    if (material.specularIntensityMap) {
      uniforms.specularIntensityMap.value = material.specularIntensityMap;
      refreshTransformUniform(material.specularIntensityMap, uniforms.specularIntensityMapTransform);
    }
  }
  function refreshUniformsMatcap(uniforms: MaterialUniforms, material?: any) {
    if (material.matcap) {
      uniforms.matcap.value = material.matcap;
    }
  }
  function refreshUniformsDistance(uniforms: MaterialUniforms, material?: any) {
    const light = properties.get(material).light!;
    uniforms.referencePosition!.value.setFromMatrixPosition(light.matrixWorld);
    uniforms.nearDistance.value = light.shadow.camera.near;
    uniforms.farDistance.value = light.shadow.camera.far;
  }
  return {
    refreshFogUniforms: refreshFogUniforms,
    refreshMaterialUniforms: refreshMaterialUniforms,
  };
}
