import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { WebGLOutput } from "ek3d/renderers/webgl/WebGLOutput";
import { TextureType, ColorSpace, ShadowMap, ToneMapping } from "ek3d/constants";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { distanceShader } from "ek3d/renderers/shaders/DistanceShader";
import { dashedShader } from "ek3d/renderers/shaders/DashedShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { spriteShader } from "ek3d/renderers/shaders/SpriteShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { matcapShader } from "ek3d/renderers/shaders/MatcapShader";
import { toonShader } from "ek3d/renderers/shaders/ToonShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { shadowShader } from "ek3d/renderers/shaders/ShadowShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";

export function createRenderer(canvas: HTMLCanvasElement, resources: Array<{ dispose(): void }>) {
  const dfgLUT = createDFGLUT();
  const ltcTextures = createLTCTextures();
  resources.push(dfgLUT, ...Object.values(ltcTextures));
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    preserveDrawingBuffer: true,
    outputBufferType: TextureType.HalfFloat,
    createBackground: WebGLBackground,
    createEnvironments: WebGLEnvironments,
    createShadowMap: WebGLShadowMap,
    createOutput: WebGLOutput,
    getDFGLUT: () => dfgLUT,
    ltcTextures,
    shaders: {
      MeshBasicMaterial: basicShader,
      MeshLambertMaterial: lambertShader,
      MeshPhongMaterial: phongShader,
      MeshNormalMaterial: normalShader,
      MeshMatcapMaterial: matcapShader,
      MeshToonMaterial: toonShader,
      MeshStandardMaterial: standardShader,
      MeshPhysicalMaterial: physicalShader,
      ShadowMaterial: shadowShader,
      MeshDepthMaterial: depthShader,
      MeshDistanceMaterial: distanceShader,
      LineBasicMaterial: basicShader,
      LineDashedMaterial: dashedShader,
      PointsMaterial: pointsShader,
      SpriteMaterial: spriteShader,
    },
  });
  resources.push(renderer);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x152238, 1);
  renderer.shadowMap!.enabled = true;
  renderer.shadowMap!.type = ShadowMap.PCF;
  renderer.toneMapping = ToneMapping.ACESFilmic;
  renderer.outputColorSpace = ColorSpace.SRGB;
  return renderer;
}
