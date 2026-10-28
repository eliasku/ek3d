import { SphereGeometry } from "../../geometries/SphereGeometry";
import type { LightProbe } from "../../lights/LightProbe";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { Mesh } from "../../objects/Mesh";

/** Visualizes a light probe's irradiance in a WebGL scene. */
export class LightProbeHelper extends Mesh<ShaderMaterial> {
  lightProbe: LightProbe;
  size: number;

  constructor(lightProbe: LightProbe, size = 1) {
    const material = new ShaderMaterial({
      type: "LightProbeHelperMaterial",
      uniforms: { sh: { value: lightProbe.sh.coefficients }, intensity: { value: lightProbe.intensity } },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize( normalMatrix * normal );
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
      `,
      fragmentShader: `
        #define RECIPROCAL_PI 0.318309886
        vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
          return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
        }
        vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
          float x = normal.x, y = normal.y, z = normal.z;
          vec3 result = shCoefficients[ 0 ] * 0.886227;
          result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
          result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
          result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
          result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
          result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
          result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
          result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
          result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
          return result;
        }
        uniform vec3 sh[ 9 ];
        uniform float intensity;
        varying vec3 vNormal;
        void main() {
          vec3 normal = normalize( vNormal );
          vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
          vec3 irradiance = shGetIrradianceAt( worldNormal, sh );
          vec3 outgoingLight = RECIPROCAL_PI * irradiance * intensity;
          gl_FragColor = linearToOutputTexel( vec4( outgoingLight, 1.0 ) );
        }
      `,
    });
    super(new SphereGeometry(1, 32, 16), material);
    this.lightProbe = lightProbe;
    this.size = size;
    this.type = "LightProbeHelper";
    this.onBeforeRender();
  }

  override onBeforeRender(): void {
    this.position.copy(this.lightProbe.position);
    this.scale.set(1, 1, 1).multiplyScalar(this.size);
    this.material.uniforms.intensity.value = this.lightProbe.intensity;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
