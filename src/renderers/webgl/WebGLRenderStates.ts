import type { Texture } from "../../textures/Texture";
import type { Vector3 } from "../../math/Vector3";
import type { LTCTextures } from "../shaders/LTCTextures";
import type { WebGLExtensions } from "./WebGLExtensions";
import type { Camera } from "../../cameras/Camera";
import type { Object3D } from "../../core/Object3D";
import type { Light } from "../../lights/Light";
import type { LightProbeGridWebGL } from "../../addons/lighting/LightProbeGridWebGL";
import type { WebGLRenderTarget } from "../WebGLRenderTarget";
import { WebGLLights } from "./WebGLLights";

export interface WebGLRenderStateData {
  lightsArray: Light[];
  shadowsArray: Light[];
  lightProbeGridArray: LightProbeGridWebGL[];
  lightProbeGridUniforms: {
    textures: Texture[];
    min: Vector3[];
    max: Vector3[];
    resolution: Vector3[];
  };
  camera: Camera | null;
  lights: WebGLLights;
  transmissionRenderTarget: Record<number, WebGLRenderTarget | undefined>;
  textureUnits: number;
}

class WebGLRenderState {
  private readonly lights: WebGLLights;
  private readonly lightsArray: Light[];
  private readonly shadowsArray: Light[];
  private readonly lightProbeGridArray: LightProbeGridWebGL[];
  private readonly lightProbeGridUniforms: WebGLRenderStateData["lightProbeGridUniforms"];
  private readonly capturedState: WebGLRenderStateData;
  state: WebGLRenderStateData;

  constructor(extensions: WebGLExtensions, ltcTextures: LTCTextures | null = null) {
    this.lights = new WebGLLights(extensions, ltcTextures);
    this.lightsArray = [];
    this.shadowsArray = [];
    this.lightProbeGridArray = [];
    this.lightProbeGridUniforms = {
      textures: [],
      min: [],
      max: [],
      resolution: [],
    };
    this.capturedState = {
      lightsArray: this.lightsArray,
      shadowsArray: this.shadowsArray,
      lightProbeGridArray: this.lightProbeGridArray,
      lightProbeGridUniforms: this.lightProbeGridUniforms,
      camera: null,
      lights: this.lights,
      transmissionRenderTarget: {},
      textureUnits: 0,
    };
    this.state = this.capturedState;
    this.init = this.init.bind(this);
    this.setupLights = this.setupLights.bind(this);
    this.setupLightsView = this.setupLightsView.bind(this);
    this.pushLight = this.pushLight.bind(this);
    this.pushShadow = this.pushShadow.bind(this);
  }

  init(camera: Camera) {
    this.capturedState.camera = camera;
    this.lightsArray.length = 0;
    this.shadowsArray.length = 0;
    this.lightProbeGridArray.length = 0;
  }

  pushLight(light: Light) {
    if ((light as LightProbeGridWebGL).isLightProbeGrid) {
      this.lightProbeGridArray.push(light as LightProbeGridWebGL);
    } else {
      this.lightsArray.push(light);
    }
  }

  pushShadow(shadowLight: Light) {
    this.shadowsArray.push(shadowLight);
  }

  setupLights() {
    this.lights.setup(this.lightsArray);
    this.lightProbeGridArray.sort((a, b) => a.priority - b.priority || a.id - b.id);
  }

  setupLightsView(camera: Camera) {
    this.lights.setupView(this.lightsArray, camera);
  }
}
export class WebGLRenderStates {
  private readonly extensions: WebGLExtensions;
  private readonly ltcTextures: LTCTextures | null;
  private renderStates: WeakMap<object, WebGLRenderState[]> = new WeakMap();

  constructor(extensions: WebGLExtensions, ltcTextures: LTCTextures | null = null) {
    this.extensions = extensions;
    this.ltcTextures = ltcTextures;
    this.get = this.get.bind(this);
    this.dispose = this.dispose.bind(this);
  }

  get(scene: Object3D, renderCallDepth: number = 0) {
    const renderStateArray = this.renderStates.get(scene);
    let renderState: WebGLRenderState;
    if (renderStateArray === undefined) {
      renderState = new WebGLRenderState(this.extensions, this.ltcTextures);
      this.renderStates.set(scene, [renderState]);
    } else {
      if (renderCallDepth >= renderStateArray.length) {
        renderState = new WebGLRenderState(this.extensions, this.ltcTextures);
        renderStateArray.push(renderState);
      } else {
        renderState = renderStateArray[renderCallDepth];
      }
    }
    return renderState;
  }

  dispose() {
    this.renderStates = new WeakMap();
  }
}
