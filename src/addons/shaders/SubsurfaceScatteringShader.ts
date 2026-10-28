import { Color } from "../../math/Color";
import type { Texture } from "../../textures/Texture";
import { phongShader } from "../../renderers/shaders/PhongShader";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";

const direct =
  "RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );";
const scattering = /* glsl */ `
uniform sampler2D thicknessMap;
uniform float thicknessPower;
uniform float thicknessScale;
uniform float thicknessDistortion;
uniform float thicknessAmbient;
uniform float thicknessAttenuation;
uniform vec3 thicknessColor;

void RE_Direct_Scattering(const in IncidentLight directLight, const in vec2 uv, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, inout ReflectedLight reflectedLight) {
  vec3 thickness = thicknessColor * texture2D(thicknessMap, uv).r;
  vec3 scatteringHalf = normalize(directLight.direction + (geometryNormal * thicknessDistortion));
  float scatteringDot = pow(saturate(dot(geometryViewDir, -scatteringHalf)), thicknessPower) * thicknessScale;
  vec3 scatteringIllu = (scatteringDot + thicknessAmbient) * thickness;
  reflectedLight.directDiffuse += scatteringIllu * thicknessAttenuation * directLight.color;
}
`;

/** Fast translucency approximation from Colin Barre-Brisebois' GDC 2011 presentation.
 * Composes the maintained Phong descriptor rather than an implicit ShaderLib registry.
 * @three_import import { SubsurfaceScatteringShader } from 'ek3d/addons/shaders/SubsurfaceScatteringShader';
 */
export const SubsurfaceScatteringShader = {
  name: "SubsurfaceScatteringShader",
  uniforms: {
    ...(cloneUniforms(phongShader.uniforms) as Record<string, { value: unknown }>),
    thicknessMap: { value: null as Texture | null },
    thicknessColor: { value: new Color(0xffffff) },
    thicknessDistortion: { value: 0.1 },
    thicknessAmbient: { value: 0.0 },
    thicknessAttenuation: { value: 0.1 },
    thicknessPower: { value: 2.0 },
    thicknessScale: { value: 10.0 },
  },
  vertexShader: "#define USE_UV\n" + phongShader.vertexShader,
  fragmentShader:
    "#define USE_UV\n#define SUBSURFACE\n" +
    phongShader.fragmentShader
      .replace("void main() {", scattering + "\nvoid main() {")
      .replaceAll(
        direct,
        direct +
          "\n#if defined( SUBSURFACE ) && defined( USE_UV )\nRE_Direct_Scattering(directLight, vUv, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, reflectedLight);\n#endif",
      ),
};
