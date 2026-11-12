import type { SunLightShadow } from "../../addons/lights/SunLightShadow";
import type { Light } from "../../lights/Light";
import type { SpotLightShadow } from "../../lights/SpotLightShadow";
import type { Vector4 } from "../../math/Vector4";
import type { Texture } from "../../textures/Texture";
import type { LTCTextures } from "../shaders/LTCTextures";
import type { WebGLExtensions } from "./WebGLExtensions";
import type { Camera } from "../../cameras/Camera";
import type { AmbientLight } from "../../lights/AmbientLight";
import type { DirectionalLight } from "../../lights/DirectionalLight";
import type { HemisphereLight } from "../../lights/HemisphereLight";
import type { LightProbe } from "../../lights/LightProbe";
import type { LightShadow } from "../../lights/LightShadow";
import type { PointLight } from "../../lights/PointLight";
import type { RectAreaLight } from "../../lights/RectAreaLight";
import type { SpotLight } from "../../lights/SpotLight";
import type { SunLight } from "../../addons/lights/SunLight";
import { Color } from "../../math/Color";
import { Matrix4 } from "../../math/Matrix4";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import { PixelFormat } from "../../constants";

interface DirectionalUniforms {
  direction: Vector3;
  color: Color;
}

interface PointUniforms {
  position: Vector3;
  color: Color;
  distance: number;
  decay: number;
}

interface SpotUniforms extends PointUniforms {
  direction: Vector3;
  coneCos: number;
  penumbraCos: number;
}

interface HemisphereUniforms {
  direction: Vector3;
  skyColor: Color;
  groundColor: Color;
}

interface RectAreaUniforms {
  color: Color;
  position: Vector3;
  halfWidth: Vector3;
  halfHeight: Vector3;
}

type LightUniforms = DirectionalUniforms | PointUniforms | SpotUniforms | HemisphereUniforms | RectAreaUniforms;

interface ShadowUniforms {
  shadowIntensity: number;
  shadowBias: number;
  shadowNormalBias: number;
  shadowRadius: number;
  shadowMapSize: Vector2;
  shadowCameraNear?: number;
  shadowCameraFar?: number;
}

interface WebGLLightsState {
  version: number;
  hash: {
    sunLength: number;
    directionalLength: number;
    pointLength: number;
    spotLength: number;
    rectAreaLength: number;
    hemiLength: number;
    numSunShadows: number;
    numDirectionalShadows: number;
    numPointShadows: number;
    numSpotShadows: number;
    numSpotMaps: number;
    numLightProbes: number;
  };
  ambient: number[];
  probe: Vector3[];
  sun: DirectionalUniforms[];
  sunShadow: ShadowUniforms[];
  sunShadowMap: (Texture | null)[];
  sunShadowMatrix: Matrix4[];
  sunShadowCascade: Vector4[];
  directional: DirectionalUniforms[];
  directionalShadow: ShadowUniforms[];
  directionalShadowMap: (Texture | null)[];
  directionalShadowMatrix: Matrix4[];
  spot: SpotUniforms[];
  spotLightMap: Texture[];
  spotShadow: ShadowUniforms[];
  spotShadowMap: (Texture | null)[];
  spotLightMatrix: Matrix4[];
  rectArea: RectAreaUniforms[];
  rectAreaLTC1: Texture | null;
  rectAreaLTC2: Texture | null;
  point: PointUniforms[];
  pointShadow: ShadowUniforms[];
  pointShadowMap: (Texture | null)[];
  pointShadowMatrix: Matrix4[];
  hemi: HemisphereUniforms[];
  numSpotLightShadowsWithMaps: number;
  numLightProbes: number;
}

class UniformsCache {
  private readonly lights: Record<number, LightUniforms | undefined> = {};

  constructor() {
    this.get = this.get.bind(this);
  }

  get(light: Light) {
    if (this.lights[light.id] !== undefined) {
      return this.lights[light.id];
    }
    let uniforms: LightUniforms | undefined;
    switch (light.type) {
      case "SunLight":
      case "DirectionalLight":
        uniforms = {
          direction: new Vector3(),
          color: new Color(),
        };
        break;
      case "SpotLight":
        uniforms = {
          position: new Vector3(),
          direction: new Vector3(),
          color: new Color(),
          distance: 0,
          coneCos: 0,
          penumbraCos: 0,
          decay: 0,
        };
        break;
      case "PointLight":
        uniforms = {
          position: new Vector3(),
          color: new Color(),
          distance: 0,
          decay: 0,
        };
        break;
      case "HemisphereLight":
        uniforms = {
          direction: new Vector3(),
          skyColor: new Color(),
          groundColor: new Color(),
        };
        break;
      case "RectAreaLight":
        uniforms = {
          color: new Color(),
          position: new Vector3(),
          halfWidth: new Vector3(),
          halfHeight: new Vector3(),
        };
        break;
    }
    this.lights[light.id] = uniforms;
    return uniforms;
  }
}
class ShadowUniformsCache {
  private readonly lights: Record<number, ShadowUniforms | undefined> = {};

  constructor() {
    this.get = this.get.bind(this);
  }

  get(light: Light) {
    if (this.lights[light.id] !== undefined) {
      return this.lights[light.id];
    }
    let uniforms: ShadowUniforms | undefined;
    switch (light.type) {
      case "SunLight":
      case "DirectionalLight":
        uniforms = {
          shadowIntensity: 1,
          shadowBias: 0,
          shadowNormalBias: 0,
          shadowRadius: 1,
          shadowMapSize: new Vector2(),
        };
        break;
      case "SpotLight":
        uniforms = {
          shadowIntensity: 1,
          shadowBias: 0,
          shadowNormalBias: 0,
          shadowRadius: 1,
          shadowMapSize: new Vector2(),
        };
        break;
      case "PointLight":
        uniforms = {
          shadowIntensity: 1,
          shadowBias: 0,
          shadowNormalBias: 0,
          shadowRadius: 1,
          shadowMapSize: new Vector2(),
          shadowCameraNear: 1,
          shadowCameraFar: 1000,
        };
        break;
      // TODO (abelnation): set RectAreaLight shadow uniforms
    }
    this.lights[light.id] = uniforms;
    return uniforms;
  }
}
let nextVersion = 0;
function shadowCastingAndTexturingLightsFirst(
  lightA: Light & { map?: Texture | null },
  lightB: Light & { map?: Texture | null },
) {
  return (lightB.castShadow ? 2 : 0) - (lightA.castShadow ? 2 : 0) + (lightB.map ? 1 : 0) - (lightA.map ? 1 : 0);
}
export class WebGLLights {
  private readonly extensions: WebGLExtensions;
  private readonly ltcTextures: LTCTextures | null;
  private readonly cache: UniformsCache;
  private readonly shadowCache: ShadowUniformsCache;
  private readonly lightState: WebGLLightsState;
  private readonly vector3: Vector3;
  private readonly matrix4: Matrix4;
  private readonly matrix42: Matrix4;
  state: WebGLLightsState;

  constructor(extensions: WebGLExtensions, ltcTextures: LTCTextures | null = null) {
    this.extensions = extensions;
    this.ltcTextures = ltcTextures;
    this.cache = new UniformsCache();
    this.shadowCache = new ShadowUniformsCache();
    this.lightState = {
      version: 0,
      hash: {
        sunLength: -1,
        directionalLength: -1,
        pointLength: -1,
        spotLength: -1,
        rectAreaLength: -1,
        hemiLength: -1,
        numSunShadows: -1,
        numDirectionalShadows: -1,
        numPointShadows: -1,
        numSpotShadows: -1,
        numSpotMaps: -1,
        numLightProbes: -1,
      },
      ambient: [0, 0, 0],
      probe: [] as Vector3[],
      sun: [] as DirectionalUniforms[],
      sunShadow: [] as ShadowUniforms[],
      sunShadowMap: [] as (Texture | null)[],
      sunShadowMatrix: [] as Matrix4[],
      sunShadowCascade: [] as Vector4[],
      directional: [] as DirectionalUniforms[],
      directionalShadow: [] as ShadowUniforms[],
      directionalShadowMap: [] as (Texture | null)[],
      directionalShadowMatrix: [] as Matrix4[],
      spot: [] as SpotUniforms[],
      spotLightMap: [] as Texture[],
      spotShadow: [] as ShadowUniforms[],
      spotShadowMap: [] as (Texture | null)[],
      spotLightMatrix: [] as Matrix4[],
      rectArea: [] as RectAreaUniforms[],
      rectAreaLTC1: null as Texture | null,
      rectAreaLTC2: null as Texture | null,
      point: [] as PointUniforms[],
      pointShadow: [] as ShadowUniforms[],
      pointShadowMap: [] as (Texture | null)[],
      pointShadowMatrix: [] as Matrix4[],
      hemi: [] as HemisphereUniforms[],
      numSpotLightShadowsWithMaps: 0,
      numLightProbes: 0,
    };
    for (let i = 0; i < 9; i++) this.lightState.probe.push(new Vector3());
    this.vector3 = new Vector3();
    this.matrix4 = new Matrix4();
    this.matrix42 = new Matrix4();
    this.setup = this.setup.bind(this);
    this.setupView = this.setupView.bind(this);
    this.state = this.lightState;
  }
  setup(lights: (Light & { distance?: number; shadow?: LightShadow })[]) {
    let r = 0,
      g = 0,
      b = 0;
    for (let i = 0; i < 9; i++) this.lightState.probe[i].set(0, 0, 0);
    let sunLength = 0;
    let numSunShadows = 0;
    let numSunShadowCascades = 0;
    let directionalLength = 0;
    let pointLength = 0;
    let spotLength = 0;
    let rectAreaLength = 0;
    let hemiLength = 0;
    let numDirectionalShadows = 0;
    let numPointShadows = 0;
    let numSpotShadows = 0;
    let numSpotMaps = 0;
    let numSpotShadowsWithMaps = 0;
    let numLightProbes = 0;
    // ordering : [shadow casting + map texturing, map texturing, shadow casting, none ]
    lights.sort(shadowCastingAndTexturingLightsFirst);
    for (let i = 0, l = lights.length; i < l; i++) {
      const light = lights[i];
      const color = light.color;
      const intensity = light.intensity;
      const distance = light.distance;
      let shadowMap: Texture | null = null;
      if (light.shadow && light.shadow.map) {
        if (light.shadow.map.texture.format === PixelFormat.RG) {
          // VSM uses color texture with blurred mean/std_dev
          shadowMap = light.shadow.map.texture;
        } else {
          // Other types use depth texture
          shadowMap = light.shadow.map.depthTexture || light.shadow.map.texture;
        }
      }
      if ((light as AmbientLight).isAmbientLight) {
        r += color.r * intensity;
        g += color.g * intensity;
        b += color.b * intensity;
      } else if ((light as LightProbe).isLightProbe) {
        for (let j = 0; j < 9; j++) {
          this.lightState.probe[j].addScaledVector((light as LightProbe).sh.coefficients[j], intensity);
        }
        numLightProbes++;
      } else if ((light as SunLight).isSunLight) {
        const uniforms = this.cache.get(light) as DirectionalUniforms;
        uniforms.color.copy(light.color).multiplyScalar(light.intensity);
        if (light.castShadow) {
          const shadow = light.shadow as SunLightShadow;
          const shadowUniforms = this.shadowCache.get(light)!;
          shadowUniforms.shadowIntensity = shadow.intensity;
          shadowUniforms.shadowBias = shadow.bias;
          shadowUniforms.shadowNormalBias = shadow.normalBias;
          shadowUniforms.shadowRadius = shadow.radius;
          shadowUniforms.shadowMapSize.copy(shadow.mapSize).multiply(shadow.getFrameExtents());
          this.lightState.sunShadow[numSunShadows] = shadowUniforms;
          this.lightState.sunShadowMap[numSunShadows] = shadowMap;
          const cascadeCount = shadow.getViewportCount();
          for (let j = 0; j < cascadeCount; j++) {
            this.lightState.sunShadowMatrix[numSunShadowCascades + j] = shadow.getMatrix(j);
            this.lightState.sunShadowCascade[numSunShadowCascades + j] = shadow._cascadeData[j];
          }
          numSunShadowCascades += cascadeCount;
          numSunShadows++;
        }
        this.lightState.sun[sunLength] = uniforms;
        sunLength++;
      } else if ((light as DirectionalLight).isDirectionalLight) {
        const uniforms = this.cache.get(light) as DirectionalUniforms;
        uniforms.color.copy(light.color).multiplyScalar(light.intensity);
        if (light.castShadow) {
          const shadow = light.shadow!;
          const shadowUniforms = this.shadowCache.get(light)!;
          shadowUniforms.shadowIntensity = shadow.intensity;
          shadowUniforms.shadowBias = shadow.bias;
          shadowUniforms.shadowNormalBias = shadow.normalBias;
          shadowUniforms.shadowRadius = shadow.radius;
          shadowUniforms.shadowMapSize = shadow.mapSize;
          this.lightState.directionalShadow[directionalLength] = shadowUniforms;
          this.lightState.directionalShadowMap[directionalLength] = shadowMap;
          this.lightState.directionalShadowMatrix[directionalLength] = light.shadow!.matrix;
          numDirectionalShadows++;
        }
        this.lightState.directional[directionalLength] = uniforms;
        directionalLength++;
      } else if ((light as SpotLight).isSpotLight) {
        const uniforms = this.cache.get(light) as SpotUniforms;
        uniforms.position.setFromMatrixPosition(light.matrixWorld);
        uniforms.color.copy(color).multiplyScalar(intensity);
        uniforms.distance = distance!;
        uniforms.coneCos = Math.cos((light as SpotLight).angle);
        uniforms.penumbraCos = Math.cos((light as SpotLight).angle * (1 - (light as SpotLight).penumbra));
        uniforms.decay = (light as SpotLight).decay;
        this.lightState.spot[spotLength] = uniforms;
        const shadow = light.shadow as SpotLightShadow;
        if ((light as SpotLight).map) {
          this.lightState.spotLightMap[numSpotMaps] = (light as SpotLight).map!;
          numSpotMaps++;
          // make sure the lightMatrix is up to date
          // TODO : do it if required only
          shadow.updateMatrices(light as SpotLight);
          if (light.castShadow) numSpotShadowsWithMaps++;
        }
        this.lightState.spotLightMatrix[spotLength] = shadow.matrix;
        if (light.castShadow) {
          const shadowUniforms = this.shadowCache.get(light)!;
          shadowUniforms.shadowIntensity = shadow.intensity;
          shadowUniforms.shadowBias = shadow.bias;
          shadowUniforms.shadowNormalBias = shadow.normalBias;
          shadowUniforms.shadowRadius = shadow.radius;
          shadowUniforms.shadowMapSize = shadow.mapSize;
          this.lightState.spotShadow[spotLength] = shadowUniforms;
          this.lightState.spotShadowMap[spotLength] = shadowMap;
          numSpotShadows++;
        }
        spotLength++;
      } else if ((light as RectAreaLight).isRectAreaLight) {
        const uniforms = this.cache.get(light) as RectAreaUniforms;
        uniforms.color.copy(color).multiplyScalar(intensity);
        uniforms.halfWidth.set((light as RectAreaLight).width * 0.5, 0.0, 0.0);
        uniforms.halfHeight.set(0.0, (light as RectAreaLight).height * 0.5, 0.0);
        this.lightState.rectArea[rectAreaLength] = uniforms;
        rectAreaLength++;
      } else if ((light as PointLight).isPointLight) {
        const uniforms = this.cache.get(light) as PointUniforms;
        uniforms.color.copy(light.color).multiplyScalar(light.intensity);
        uniforms.distance = (light as PointLight).distance;
        uniforms.decay = (light as PointLight).decay;
        if (light.castShadow) {
          const shadow = (light as PointLight).shadow;
          const shadowUniforms = this.shadowCache.get(light)!;
          shadowUniforms.shadowIntensity = shadow.intensity;
          shadowUniforms.shadowBias = shadow.bias;
          shadowUniforms.shadowNormalBias = shadow.normalBias;
          shadowUniforms.shadowRadius = shadow.radius;
          shadowUniforms.shadowMapSize = shadow.mapSize;
          shadowUniforms.shadowCameraNear = shadow.camera.near;
          shadowUniforms.shadowCameraFar = shadow.camera.far;
          this.lightState.pointShadow[pointLength] = shadowUniforms;
          this.lightState.pointShadowMap[pointLength] = shadowMap;
          this.lightState.pointShadowMatrix[pointLength] = light.shadow!.matrix;
          numPointShadows++;
        }
        this.lightState.point[pointLength] = uniforms;
        pointLength++;
      } else if ((light as HemisphereLight).isHemisphereLight) {
        const uniforms = this.cache.get(light) as HemisphereUniforms;
        uniforms.skyColor.copy(light.color).multiplyScalar(intensity);
        uniforms.groundColor.copy((light as HemisphereLight).groundColor).multiplyScalar(intensity);
        this.lightState.hemi[hemiLength] = uniforms;
        hemiLength++;
      }
    }
    if (rectAreaLength > 0) {
      if (this.ltcTextures === null) throw new Error("Rectangular area lighting requires explicit ltcTextures.");
      if (this.extensions.has("OES_texture_float_linear") === true) {
        this.lightState.rectAreaLTC1 = this.ltcTextures.LTC_FLOAT_1;
        this.lightState.rectAreaLTC2 = this.ltcTextures.LTC_FLOAT_2;
      } else {
        this.lightState.rectAreaLTC1 = this.ltcTextures.LTC_HALF_1;
        this.lightState.rectAreaLTC2 = this.ltcTextures.LTC_HALF_2;
      }
      if (!this.lightState.rectAreaLTC1 || !this.lightState.rectAreaLTC2)
        throw new Error("Missing LTC textures for the selected GPU format.");
    }
    this.lightState.ambient[0] = r;
    this.lightState.ambient[1] = g;
    this.lightState.ambient[2] = b;
    const hash = this.lightState.hash;
    if (
      hash.sunLength !== sunLength ||
      hash.directionalLength !== directionalLength ||
      hash.pointLength !== pointLength ||
      hash.spotLength !== spotLength ||
      hash.rectAreaLength !== rectAreaLength ||
      hash.hemiLength !== hemiLength ||
      hash.numSunShadows !== numSunShadows ||
      hash.numDirectionalShadows !== numDirectionalShadows ||
      hash.numPointShadows !== numPointShadows ||
      hash.numSpotShadows !== numSpotShadows ||
      hash.numSpotMaps !== numSpotMaps ||
      hash.numLightProbes !== numLightProbes
    ) {
      this.lightState.sun.length = sunLength;
      this.lightState.directional.length = directionalLength;
      this.lightState.spot.length = spotLength;
      this.lightState.rectArea.length = rectAreaLength;
      this.lightState.point.length = pointLength;
      this.lightState.hemi.length = hemiLength;
      this.lightState.sunShadow.length = numSunShadows;
      this.lightState.sunShadowMap.length = numSunShadows;
      this.lightState.sunShadowMatrix.length = numSunShadowCascades;
      this.lightState.sunShadowCascade.length = numSunShadowCascades;
      this.lightState.directionalShadow.length = numDirectionalShadows;
      this.lightState.directionalShadowMap.length = numDirectionalShadows;
      this.lightState.directionalShadowMatrix.length = numDirectionalShadows;
      this.lightState.pointShadow.length = numPointShadows;
      this.lightState.pointShadowMap.length = numPointShadows;
      this.lightState.pointShadowMatrix.length = numPointShadows;
      this.lightState.spotShadow.length = numSpotShadows;
      this.lightState.spotShadowMap.length = numSpotShadows;
      this.lightState.spotLightMatrix.length = numSpotShadows + numSpotMaps - numSpotShadowsWithMaps;
      this.lightState.spotLightMap.length = numSpotMaps;
      this.lightState.numSpotLightShadowsWithMaps = numSpotShadowsWithMaps;
      this.lightState.numLightProbes = numLightProbes;
      hash.sunLength = sunLength;
      hash.directionalLength = directionalLength;
      hash.pointLength = pointLength;
      hash.spotLength = spotLength;
      hash.rectAreaLength = rectAreaLength;
      hash.hemiLength = hemiLength;
      hash.numSunShadows = numSunShadows;
      hash.numDirectionalShadows = numDirectionalShadows;
      hash.numPointShadows = numPointShadows;
      hash.numSpotShadows = numSpotShadows;
      hash.numSpotMaps = numSpotMaps;
      hash.numLightProbes = numLightProbes;
      this.lightState.version = nextVersion++;
    }
  }
  setupView(lights: Light[], camera: Camera) {
    let sunLength = 0;
    let directionalLength = 0;
    let pointLength = 0;
    let spotLength = 0;
    let rectAreaLength = 0;
    let hemiLength = 0;
    const viewMatrix = camera.matrixWorldInverse;
    for (let i = 0, l = lights.length; i < l; i++) {
      const light = lights[i];
      if ((light as SunLight).isSunLight) {
        const uniforms = this.lightState.sun[sunLength];
        uniforms.direction.setFromMatrixPosition(light.matrixWorld);
        uniforms.direction.transformDirection(viewMatrix);
        sunLength++;
      } else if ((light as DirectionalLight).isDirectionalLight) {
        const uniforms = this.lightState.directional[directionalLength];
        uniforms.direction.setFromMatrixPosition(light.matrixWorld);
        this.vector3.setFromMatrixPosition((light as DirectionalLight).target.matrixWorld);
        uniforms.direction.sub(this.vector3);
        uniforms.direction.transformDirection(viewMatrix);
        directionalLength++;
      } else if ((light as SpotLight).isSpotLight) {
        const uniforms = this.lightState.spot[spotLength];
        uniforms.position.setFromMatrixPosition(light.matrixWorld);
        uniforms.position.applyMatrix4(viewMatrix);
        uniforms.direction.setFromMatrixPosition(light.matrixWorld);
        this.vector3.setFromMatrixPosition((light as SpotLight).target.matrixWorld);
        uniforms.direction.sub(this.vector3);
        uniforms.direction.transformDirection(viewMatrix);
        spotLength++;
      } else if ((light as RectAreaLight).isRectAreaLight) {
        const uniforms = this.lightState.rectArea[rectAreaLength];
        uniforms.position.setFromMatrixPosition(light.matrixWorld);
        uniforms.position.applyMatrix4(viewMatrix);
        // extract local rotation of light to derive width/height half vectors
        this.matrix42.identity();
        this.matrix4.copy(light.matrixWorld);
        this.matrix4.premultiply(viewMatrix);
        this.matrix42.extractRotation(this.matrix4);
        uniforms.halfWidth.set((light as RectAreaLight).width * 0.5, 0.0, 0.0);
        uniforms.halfHeight.set(0.0, (light as RectAreaLight).height * 0.5, 0.0);
        uniforms.halfWidth.applyMatrix4(this.matrix42);
        uniforms.halfHeight.applyMatrix4(this.matrix42);
        rectAreaLength++;
      } else if ((light as PointLight).isPointLight) {
        const uniforms = this.lightState.point[pointLength];
        uniforms.position.setFromMatrixPosition(light.matrixWorld);
        uniforms.position.applyMatrix4(viewMatrix);
        pointLength++;
      } else if ((light as HemisphereLight).isHemisphereLight) {
        const uniforms = this.lightState.hemi[hemiLength];
        uniforms.direction.setFromMatrixPosition(light.matrixWorld);
        uniforms.direction.transformDirection(viewMatrix);
        hemiLength++;
      }
    }
  }
}
