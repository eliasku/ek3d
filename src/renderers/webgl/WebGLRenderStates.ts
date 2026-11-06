import type { Texture } from "../../textures/Texture";
import type { Vector3 } from "../../math/Vector3";
import type { LTCTextures } from "../shaders/LTCTextures";
import { WebGLLights } from "./WebGLLights";
function WebGLRenderState(extensions?: any, ltcTextures: LTCTextures | null = null) {
  const lights = new (WebGLLights as any)(extensions, ltcTextures);
  const lightsArray: any[] = [];
  const shadowsArray: any[] = [];
  const lightProbeGridArray: any[] = [];
  const lightProbeGridUniforms = {
    textures: [] as Texture[],
    min: [] as Vector3[],
    max: [] as Vector3[],
    resolution: [] as Vector3[],
  };
  function init(camera?: any) {
    state.camera = camera;
    lightsArray.length = 0;
    shadowsArray.length = 0;
    lightProbeGridArray.length = 0;
  }
  function pushLight(light?: any) {
    if (light.isLightProbeGrid) {
      lightProbeGridArray.push(light);
    } else {
      lightsArray.push(light);
    }
  }
  function pushShadow(shadowLight?: any) {
    shadowsArray.push(shadowLight);
  }
  function setupLights() {
    lights.setup(lightsArray);
    lightProbeGridArray.sort((a, b) => a.priority - b.priority || a.id - b.id);
  }
  function setupLightsView(camera?: any) {
    lights.setupView(lightsArray, camera);
  }
  const state: any = {
    lightsArray: lightsArray,
    shadowsArray: shadowsArray,
    lightProbeGridArray: lightProbeGridArray,
    lightProbeGridUniforms: lightProbeGridUniforms,
    camera: null,
    lights: lights,
    transmissionRenderTarget: {},
    textureUnits: 0,
  };
  return {
    init: init,
    state: state,
    setupLights: setupLights,
    setupLightsView: setupLightsView,
    pushLight: pushLight,
    pushShadow: pushShadow,
  };
}
export function WebGLRenderStates(extensions?: any, ltcTextures: LTCTextures | null = null) {
  let renderStates = new WeakMap<any, any>();
  function get(scene?: any, renderCallDepth: number = 0) {
    const renderStateArray = renderStates.get(scene);
    let renderState: any;
    if (renderStateArray === undefined) {
      renderState = new (WebGLRenderState as any)(extensions, ltcTextures);
      renderStates.set(scene, [renderState]);
    } else {
      if (renderCallDepth >= renderStateArray.length) {
        renderState = new (WebGLRenderState as any)(extensions, ltcTextures);
        renderStateArray.push(renderState);
      } else {
        renderState = renderStateArray[renderCallDepth];
      }
    }
    return renderState;
  }
  function dispose() {
    renderStates = new WeakMap();
  }
  return {
    get: get,
    dispose: dispose,
  };
}
