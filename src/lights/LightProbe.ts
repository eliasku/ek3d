import { SphericalHarmonics3 } from "../math/SphericalHarmonics3";
import { Light } from "./Light";
/**
 * Light probes are an alternative way of adding light to a 3D scene. Unlike
 * classical light sources (e.g. directional, point or spot lights), light
 * probes do not emit light. Instead they store information about light
 * passing through 3D space. During rendering, the light that hits a 3D
 * object is approximated by using the data from the light probe.
 *
 * Light probes are usually created from (radiance) environment maps. The
 * class {@link LightProbeGenerator} can be used to create light probes from
 * cube textures or render targets, or supplied directly as spherical harmonic coefficients.
 *
 * The current probe implementation in three.js supports so-called diffuse
 * light probes. This type of light probe is functionally equivalent to an
 * irradiance environment map.
 *
 */
export class LightProbe extends Light {
  isLightProbe: boolean;

  sh: SphericalHarmonics3;

  /**
   * Constructs a new light probe.
   *
   * @param sh - The spherical harmonics which represents encoded lighting information.
   * @param [intensity=1] - The light's strength/intensity.
   */
  constructor(sh: SphericalHarmonics3 = new SphericalHarmonics3(), intensity: number = 1) {
    super(undefined, intensity);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isLightProbe = true;
    this.type = "LightProbe";
    /**
     * A light probe uses spherical harmonics to encode lighting information.
     *
     */
    this.sh = sh;
  }
  copy(source: LightProbe): this {
    super.copy(source);
    this.sh.copy(source.sh);
    return this;
  }
  toJSON(meta?: any) {
    const data = super.toJSON(meta);
    data.object.sh = this.sh.toArray();
    return data;
  }
}
