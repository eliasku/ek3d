import { BackSide } from "../../constants";
import { Color } from "../../math/Color";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { fog, displacementmap } from "../../renderers/shaders/UniformsLib";
import { mergeUniforms } from "../../renderers/shaders/UniformsUtils";
import type { Material } from "../../materials/Material";
import type { Texture } from "../../textures/Texture";
import type { Object3D } from "../../core/Object3D";
import type { BufferGeometry } from "../../core/BufferGeometry";
import type { Mesh } from "../../objects/Mesh";
import type { Camera } from "../../cameras/Camera";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLShadowMapSystem } from "../../renderers/webgl/WebGLShadowMap";
import chunk_common from "../../renderers/shaders/ShaderChunk/common.glsl";
import chunk_uv_pars_vertex from "../../renderers/shaders/ShaderChunk/uv_pars_vertex.glsl";
import chunk_displacementmap_pars_vertex from "../../renderers/shaders/ShaderChunk/displacementmap_pars_vertex.glsl";
import chunk_fog_pars_vertex from "../../renderers/shaders/ShaderChunk/fog_pars_vertex.glsl";
import chunk_morphtarget_pars_vertex from "../../renderers/shaders/ShaderChunk/morphtarget_pars_vertex.glsl";
import chunk_skinning_pars_vertex from "../../renderers/shaders/ShaderChunk/skinning_pars_vertex.glsl";
import chunk_logdepthbuf_pars_vertex from "../../renderers/shaders/ShaderChunk/logdepthbuf_pars_vertex.glsl";
import chunk_clipping_planes_pars_vertex from "../../renderers/shaders/ShaderChunk/clipping_planes_pars_vertex.glsl";
import chunk_uv_vertex from "../../renderers/shaders/ShaderChunk/uv_vertex.glsl";
import chunk_beginnormal_vertex from "../../renderers/shaders/ShaderChunk/beginnormal_vertex.glsl";
import chunk_morphnormal_vertex from "../../renderers/shaders/ShaderChunk/morphnormal_vertex.glsl";
import chunk_skinbase_vertex from "../../renderers/shaders/ShaderChunk/skinbase_vertex.glsl";
import chunk_skinnormal_vertex from "../../renderers/shaders/ShaderChunk/skinnormal_vertex.glsl";
import chunk_begin_vertex from "../../renderers/shaders/ShaderChunk/begin_vertex.glsl";
import chunk_morphtarget_vertex from "../../renderers/shaders/ShaderChunk/morphtarget_vertex.glsl";
import chunk_skinning_vertex from "../../renderers/shaders/ShaderChunk/skinning_vertex.glsl";
import chunk_displacementmap_vertex from "../../renderers/shaders/ShaderChunk/displacementmap_vertex.glsl";
import chunk_project_vertex from "../../renderers/shaders/ShaderChunk/project_vertex.glsl";
import chunk_logdepthbuf_vertex from "../../renderers/shaders/ShaderChunk/logdepthbuf_vertex.glsl";
import chunk_clipping_planes_vertex from "../../renderers/shaders/ShaderChunk/clipping_planes_vertex.glsl";
import chunk_fog_vertex from "../../renderers/shaders/ShaderChunk/fog_vertex.glsl";
import chunk_fog_pars_fragment from "../../renderers/shaders/ShaderChunk/fog_pars_fragment.glsl";
import chunk_logdepthbuf_pars_fragment from "../../renderers/shaders/ShaderChunk/logdepthbuf_pars_fragment.glsl";
import chunk_clipping_planes_pars_fragment from "../../renderers/shaders/ShaderChunk/clipping_planes_pars_fragment.glsl";
import chunk_clipping_planes_fragment from "../../renderers/shaders/ShaderChunk/clipping_planes_fragment.glsl";
import chunk_logdepthbuf_fragment from "../../renderers/shaders/ShaderChunk/logdepthbuf_fragment.glsl";
import chunk_tonemapping_fragment from "../../renderers/shaders/ShaderChunk/tonemapping_fragment.glsl";
import chunk_colorspace_fragment from "../../renderers/shaders/ShaderChunk/colorspace_fragment.glsl";
import chunk_fog_fragment from "../../renderers/shaders/ShaderChunk/fog_fragment.glsl";
import chunk_premultiplied_alpha_fragment from "../../renderers/shaders/ShaderChunk/premultiplied_alpha_fragment.glsl";

type OutlineMaterial = ShaderMaterial & { displacementMap?: Texture | null };
type SourceMaterial = Material & {
  fog?: boolean;
  displacementMap?: Texture | null;
  displacementScale?: number;
  displacementBias?: number;
  wireframe?: boolean;
};
type OutlineScene = Object3D & { background?: Color | Texture | null };

export class OutlineEffect {
  enabled: boolean;
  autoClear: boolean;
  render: (scene: OutlineScene, camera: Camera) => void;
  renderOutline: (scene: OutlineScene, camera: Camera) => void;
  setSize: (width: number, height: number) => void;

  constructor(
    renderer: WebGLRenderer,
    parameters: {
      defaultThickness?: number;
      defaultColor?: number[];
      defaultAlpha?: number;
      defaultKeepAlive?: boolean;
    } = {},
  ) {
    this.enabled = true;
    this.autoClear = renderer.autoClear;

    const defaultThickness = parameters.defaultThickness !== undefined ? parameters.defaultThickness : 0.003;
    const defaultColor = new Color().fromArray(
      parameters.defaultColor !== undefined ? parameters.defaultColor : [0, 0, 0],
    );
    const defaultAlpha = parameters.defaultAlpha !== undefined ? parameters.defaultAlpha : 1.0;
    const defaultKeepAlive = parameters.defaultKeepAlive !== undefined ? parameters.defaultKeepAlive : false;

    // object.material.uuid -> outlineMaterial or
    // object.material[ n ].uuid -> outlineMaterial
    // save at the outline material creation and release
    // if it's unused removeThresholdCount frames
    // unless keepAlive is true.
    const cache: Record<string, { material: OutlineMaterial; used: boolean; keepAlive: boolean; count: number }> = {};

    const removeThresholdCount = 60;

    // outlineMaterial.uuid -> object.material or
    // outlineMaterial.uuid -> object.material[ n ]
    // save before render and release after render.
    const originalMaterials: Record<string, SourceMaterial> = {};

    // object.uuid -> originalOnBeforeRender
    // save before render and release after render.
    const originalOnBeforeRenders: Record<string, Object3D["onBeforeRender"]> = {};

    const uniformsOutline = {
      outlineThickness: { value: defaultThickness },
      outlineColor: { value: defaultColor },
      outlineAlpha: { value: defaultAlpha },
    };

    const vertexShader = [
      chunk_common,
      chunk_uv_pars_vertex,
      chunk_displacementmap_pars_vertex,
      chunk_fog_pars_vertex,
      chunk_morphtarget_pars_vertex,
      chunk_skinning_pars_vertex,
      chunk_logdepthbuf_pars_vertex,
      chunk_clipping_planes_pars_vertex,

      "uniform float outlineThickness;",

      "vec4 calculateOutline( vec4 pos, vec3 normal, vec4 skinned ) {",
      "	float thickness = outlineThickness;",
      "	const float ratio = 1.0;",
      "	vec4 pos2 = projectionMatrix * modelViewMatrix * vec4( skinned.xyz + normal, 1.0 );",
      // NOTE: subtract pos2 from pos because BackSide objectNormal is negative
      "	vec4 norm = normalize( pos - pos2 );",
      "	return pos + norm * thickness * pos.w * ratio;",
      "}",

      "void main() {",

      chunk_uv_vertex,

      chunk_beginnormal_vertex,
      chunk_morphnormal_vertex,
      chunk_skinbase_vertex,
      chunk_skinnormal_vertex,

      chunk_begin_vertex,
      chunk_morphtarget_vertex,
      chunk_skinning_vertex,
      chunk_displacementmap_vertex,
      chunk_project_vertex,

      "	vec3 outlineNormal = - objectNormal;", // the outline material is always rendered with BackSide

      "	gl_Position = calculateOutline( gl_Position, outlineNormal, vec4( transformed, 1.0 ) );",

      chunk_logdepthbuf_vertex,
      chunk_clipping_planes_vertex,
      chunk_fog_vertex,

      "}",
    ].join("\n");

    const fragmentShader = [
      chunk_common,
      chunk_fog_pars_fragment,
      chunk_logdepthbuf_pars_fragment,
      chunk_clipping_planes_pars_fragment,

      "uniform vec3 outlineColor;",
      "uniform float outlineAlpha;",

      "void main() {",

      chunk_clipping_planes_fragment,
      chunk_logdepthbuf_fragment,

      "	gl_FragColor = vec4( outlineColor, outlineAlpha );",

      chunk_tonemapping_fragment,
      chunk_colorspace_fragment,
      chunk_fog_fragment,
      chunk_premultiplied_alpha_fragment,

      "}",
    ].join("\n");

    function createMaterial() {
      return new ShaderMaterial({
        type: "OutlineEffect",
        uniforms: mergeUniforms([fog, displacementmap, uniformsOutline]),
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: BackSide,
      });
    }

    function getOutlineMaterialFromCache(originalMaterial: SourceMaterial) {
      let data = cache[originalMaterial.uuid];

      if (data === undefined) {
        data = {
          material: createMaterial(),
          used: true,
          keepAlive: defaultKeepAlive,
          count: 0,
        };

        cache[originalMaterial.uuid] = data;
      }

      data.used = true;

      return data.material;
    }

    function getOutlineMaterial(originalMaterial: SourceMaterial) {
      const outlineMaterial = getOutlineMaterialFromCache(originalMaterial);

      originalMaterials[outlineMaterial.uuid] = originalMaterial;

      updateOutlineMaterial(outlineMaterial, originalMaterial);

      return outlineMaterial;
    }

    function isCompatible(object: Object3D): object is Mesh {
      const mesh = object as Mesh;
      const geometry = mesh.geometry;
      const hasNormals = geometry !== undefined && geometry.attributes.normal !== undefined;

      return mesh.isMesh === true && mesh.material !== undefined && hasNormals === true;
    }

    function setOutlineMaterial(object: Object3D) {
      if (isCompatible(object) === false) return;

      if (Array.isArray(object.material)) {
        for (let i = 0, il = object.material.length; i < il; i++) {
          object.material[i] = getOutlineMaterial(object.material[i]);
        }
      } else {
        object.material = getOutlineMaterial(object.material);
      }

      /* oxlint-disable-next-line typescript/unbound-method -- Restore the original callback with its original receiver. */
      originalOnBeforeRenders[object.uuid] = object.onBeforeRender;
      object.onBeforeRender = onBeforeRender;
    }

    function restoreOriginalMaterial(object: Object3D) {
      if (isCompatible(object) === false) return;

      if (Array.isArray(object.material)) {
        for (let i = 0, il = object.material.length; i < il; i++) {
          object.material[i] = originalMaterials[object.material[i].uuid];
        }
      } else {
        object.material = originalMaterials[object.material.uuid];
      }

      object.onBeforeRender = originalOnBeforeRenders[object.uuid];
    }

    function onBeforeRender(
      renderer: WebGLRenderer,
      scene: Object3D,
      camera: Camera,
      geometry: BufferGeometry,
      material: OutlineMaterial,
    ) {
      const originalMaterial = originalMaterials[material.uuid];

      // just in case
      if (originalMaterial === undefined) return;

      updateUniforms(material, originalMaterial);
    }

    function updateUniforms(material: OutlineMaterial, originalMaterial: SourceMaterial) {
      const outlineParameters = originalMaterial.userData.outlineParameters as
        | { thickness?: number; color?: number[]; alpha?: number }
        | undefined;

      material.uniforms.outlineAlpha.value = originalMaterial.opacity;

      if (outlineParameters !== undefined) {
        if (outlineParameters.thickness !== undefined)
          material.uniforms.outlineThickness.value = outlineParameters.thickness;
        if (outlineParameters.color !== undefined)
          material.uniforms.outlineColor.value.fromArray(outlineParameters.color);
        if (outlineParameters.alpha !== undefined) material.uniforms.outlineAlpha.value = outlineParameters.alpha;
      }

      if (originalMaterial.displacementMap) {
        material.uniforms.displacementMap.value = originalMaterial.displacementMap;
        material.uniforms.displacementScale.value = originalMaterial.displacementScale;
        material.uniforms.displacementBias.value = originalMaterial.displacementBias;
      }
    }

    function updateOutlineMaterial(material: OutlineMaterial, originalMaterial: SourceMaterial) {
      if (material.name === "invisible") return;

      const outlineParameters = originalMaterial.userData.outlineParameters as
        | { visible?: boolean; alpha?: number; keepAlive?: boolean }
        | undefined;

      material.fog = originalMaterial.fog ?? false;
      material.toneMapped = originalMaterial.toneMapped;
      material.premultipliedAlpha = originalMaterial.premultipliedAlpha;
      material.displacementMap = originalMaterial.displacementMap;

      if (outlineParameters !== undefined) {
        if (originalMaterial.visible === false) {
          material.visible = false;
        } else {
          material.visible = outlineParameters.visible !== undefined ? outlineParameters.visible : true;
        }

        material.transparent =
          outlineParameters.alpha !== undefined && outlineParameters.alpha < 1.0 ? true : originalMaterial.transparent;

        if (outlineParameters.keepAlive !== undefined)
          cache[originalMaterial.uuid].keepAlive = outlineParameters.keepAlive;
      } else {
        material.transparent = originalMaterial.transparent;
        material.visible = originalMaterial.visible;
      }

      if (originalMaterial.wireframe === true || originalMaterial.depthTest === false) material.visible = false;

      if (originalMaterial.clippingPlanes) {
        material.clipping = true;

        material.clippingPlanes = originalMaterial.clippingPlanes;
        material.clipIntersection = originalMaterial.clipIntersection;
        material.clipShadows = originalMaterial.clipShadows;
      }

      material.version = originalMaterial.version; // update outline material if necessary
    }

    function cleanupCache() {
      let keys;

      // clear originalMaterials
      keys = Object.keys(originalMaterials);

      for (let i = 0, il = keys.length; i < il; i++) {
        delete originalMaterials[keys[i]];
      }

      // clear originalOnBeforeRenders
      keys = Object.keys(originalOnBeforeRenders);

      for (let i = 0, il = keys.length; i < il; i++) {
        delete originalOnBeforeRenders[keys[i]];
      }

      // remove unused outlineMaterial from cache
      keys = Object.keys(cache);

      for (let i = 0, il = keys.length; i < il; i++) {
        const key = keys[i];

        if (cache[key].used === false) {
          cache[key].count++;

          if (cache[key].keepAlive === false && cache[key].count > removeThresholdCount) {
            delete cache[key];
          }
        } else {
          cache[key].used = false;
          cache[key].count = 0;
        }
      }
    }

    this.render = function (this: OutlineEffect, scene: OutlineScene, camera: Camera) {
      if (this.enabled === false) {
        renderer.render(scene, camera);
        return;
      }

      const currentAutoClear = renderer.autoClear;
      renderer.autoClear = this.autoClear;

      renderer.render(scene, camera);

      renderer.autoClear = currentAutoClear;

      this.renderOutline(scene, camera);
    };

    this.renderOutline = function (scene: OutlineScene, camera: Camera) {
      const currentAutoClear = renderer.autoClear;
      const currentSceneAutoUpdate = scene.matrixWorldAutoUpdate;
      const currentSceneBackground = scene.background;
      const shadowMap = renderer.shadowMap as WebGLShadowMapSystem | null;
      const currentShadowMapEnabled = shadowMap?.enabled;

      scene.matrixWorldAutoUpdate = false;
      scene.background = null;
      renderer.autoClear = false;
      if (shadowMap !== null) shadowMap.enabled = false;

      scene.traverse(setOutlineMaterial);

      renderer.render(scene, camera);

      scene.traverse(restoreOriginalMaterial);

      cleanupCache();

      scene.matrixWorldAutoUpdate = currentSceneAutoUpdate;
      scene.background = currentSceneBackground;
      renderer.autoClear = currentAutoClear;
      if (shadowMap !== null && currentShadowMapEnabled !== undefined) shadowMap.enabled = currentShadowMapEnabled;
    };

    this.setSize = function (width: number, height: number) {
      renderer.setSize(width, height);
    };
  }
}
