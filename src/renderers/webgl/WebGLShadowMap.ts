import type { Camera } from "../../cameras/Camera";
import type { Light } from "../../lights/Light";
import type { Object3D } from "../../core/Object3D";
import type { WebGLRenderer } from "../WebGLRenderer";
import { Side, TextureFilter, ShadowMap, Blending, Compare, PixelFormat, TextureType } from "../../constants";
import { WebGLRenderTarget } from "../WebGLRenderTarget";
import { WebGLCubeRenderTarget } from "../WebGLCubeRenderTarget";
import { MeshDepthMaterial } from "../../materials/MeshDepthMaterial";
import { MeshDistanceMaterial } from "../../materials/MeshDistanceMaterial";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Mesh } from "../../objects/Mesh";
import { Vector4 } from "../../math/Vector4";
import { Vector2 } from "../../math/Vector2";
import { Matrix4 } from "../../math/Matrix4";
import { Frustum } from "../../math/Frustum";
import { DepthTexture } from "../../textures/DepthTexture";
import { CubeDepthTexture } from "../../textures/CubeDepthTexture";
import * as vsm from "../shaders/ShaderLib/vsm.glsl";
import { warn } from "../../utils";
import { Vector3 } from "../../math/Vector3";

export interface WebGLShadowMapObjects {
  update(object: Object3D): BufferGeometry;
}
export interface WebGLShadowMapCapabilities {
  maxTextureSize: number;
}
export interface WebGLShadowMapSystem {
  /** Enables shadow maps. Defaults to false. */
  enabled: boolean;
  /** Updates shadows automatically. Disable for static lighting. Defaults to true. */
  autoUpdate: boolean;
  /** Requests a shadow update on the next render. Defaults to false. */
  needsUpdate: boolean;
  /** Shadow filtering algorithm. Defaults to ShadowMap.PCF. */
  type: ShadowMap;
  render(lights: Light[], scene: Object3D, camera: Camera): void;
  dispose(): void;
}
const _cubeDirections = [
  /*@__PURE__*/ new Vector3(1, 0, 0),
  /*@__PURE__*/ new Vector3(-1, 0, 0),
  /*@__PURE__*/ new Vector3(0, 1, 0),
  /*@__PURE__*/ new Vector3(0, -1, 0),
  /*@__PURE__*/ new Vector3(0, 0, 1),
  /*@__PURE__*/ new Vector3(0, 0, -1),
];
const _cubeUps = [
  /*@__PURE__*/ new Vector3(0, -1, 0),
  /*@__PURE__*/ new Vector3(0, -1, 0),
  /*@__PURE__*/ new Vector3(0, 0, 1),
  /*@__PURE__*/ new Vector3(0, 0, -1),
  /*@__PURE__*/ new Vector3(0, -1, 0),
  /*@__PURE__*/ new Vector3(0, -1, 0),
];
const _projScreenMatrix = /*@__PURE__*/ new Matrix4();
const _lightPositionWorld = /*@__PURE__*/ new Vector3();
const _lookTarget = /*@__PURE__*/ new Vector3();
export function WebGLShadowMap(
  renderer: WebGLRenderer,
  objects: WebGLShadowMapObjects,
  capabilities: WebGLShadowMapCapabilities,
): WebGLShadowMapSystem {
  let _frustum = new Frustum();
  const _shadowMapSize = new Vector2(),
    _viewportSize = new Vector2(),
    _viewport = new Vector4(),
    _depthMaterial = new MeshDepthMaterial(),
    _distanceMaterial = new MeshDistanceMaterial(),
    _materialCache: any = {},
    _maxTextureSize = capabilities.maxTextureSize;
  const shadowSide: any = { [Side.Front]: Side.Back, [Side.Back]: Side.Front, [Side.Double]: Side.Double };
  const shadowMaterialVertical = new ShaderMaterial({
    defines: {
      VSM_SAMPLES: 8,
    },
    uniforms: {
      shadow_pass: { value: null },
      resolution: { value: new Vector2() },
      radius: { value: 4.0 },
    },
    vertexShader: vsm.vertex,
    fragmentShader: vsm.fragment,
  });
  const shadowMaterialHorizontal = shadowMaterialVertical.clone();
  (shadowMaterialHorizontal as any).defines.HORIZONTAL_PASS = 1;
  const fullScreenTri = new BufferGeometry();
  fullScreenTri.setAttribute(
    "position",
    new BufferAttribute(new Float32Array([-1, -1, 0.5, 3, -1, 0.5, -1, 3, 0.5]), 3),
  );
  const fullScreenMesh = new Mesh(fullScreenTri, shadowMaterialVertical);
  const scope: WebGLShadowMapSystem = {
    enabled: false,
    autoUpdate: true,
    needsUpdate: false,
    type: ShadowMap.PCF,
    render,
    dispose,
  };
  const materialSources = new Map<any, any>();
  const shadows = new Set<any>();
  const shadowRefs = new WeakMap<any, any>();
  const shadowMapTypes = new WeakMap<any, any>();
  const shadowRegistry = new FinalizationRegistry((ref?: any) => shadows.delete(ref));
  let _previousType = scope.type;
  function render(lights: Light[], scene: Object3D, camera: Camera): void {
    if (scope.enabled === false) return;
    if (scope.autoUpdate === false && scope.needsUpdate === false) return;
    if (lights.length === 0) return;
    if (scope.type === ShadowMap.PCFSoft) {
      warn("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.");
      scope.type = ShadowMap.PCF;
    }
    const currentRenderTarget = renderer.getRenderTarget();
    const activeCubeFace = renderer.getActiveCubeFace();
    const activeMipmapLevel = renderer.getActiveMipmapLevel();
    try {
      const _state = (renderer as any).state;
      // Set GL state for depth map.
      _state.setBlending(Blending.No);
      if (_state.buffers.depth.getReversed() === true) {
        _state.buffers.color.setClear(0, 0, 0, 0);
      } else {
        _state.buffers.color.setClear(1, 1, 1, 1);
      }
      _state.buffers.depth.setTest(true);
      _state.setScissorTest(false);
      // check for shadow map type changes
      const typeChanged = _previousType !== scope.type;
      // When shadow map type changes, materials need recompilation because sampler types change
      // (sampler2DShadow for PCF vs sampler2D for Basic)
      if (typeChanged) {
        scene.traverse(function (object?: any) {
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((mat?: any) => (mat.needsUpdate = true));
            } else {
              object.material.needsUpdate = true;
            }
          }
        });
      }
      // render depth map
      for (let i = 0, il = lights.length; i < il; i++) {
        const light: any = lights[i];
        const shadow = light.shadow;
        if (shadow === undefined) {
          warn("WebGLShadowMap:", light, "has no shadow.");
          continue;
        }
        if (!shadowRefs.has(shadow)) {
          const ref = new WeakRef<any>(shadow);
          shadowRefs.set(shadow, ref);
          shadows.add(ref);
          shadowRegistry.register(shadow, ref, ref);
        }
        if (shadow.autoUpdate === false && shadow.needsUpdate === false) continue;
        _shadowMapSize.copy(shadow.mapSize);
        const shadowFrameExtents = shadow.getFrameExtents();
        _shadowMapSize.multiply(shadowFrameExtents);
        _viewportSize.copy(shadow.mapSize);
        if (_shadowMapSize.x > _maxTextureSize || _shadowMapSize.y > _maxTextureSize) {
          if (_shadowMapSize.x > _maxTextureSize) {
            _viewportSize.x = Math.floor(_maxTextureSize / shadowFrameExtents.x);
            _shadowMapSize.x = _viewportSize.x * shadowFrameExtents.x;
            shadow.mapSize.x = _viewportSize.x;
          }
          if (_shadowMapSize.y > _maxTextureSize) {
            _viewportSize.y = Math.floor(_maxTextureSize / shadowFrameExtents.y);
            _shadowMapSize.y = _viewportSize.y * shadowFrameExtents.y;
            shadow.mapSize.y = _viewportSize.y;
          }
        }
        const reversedDepthBuffer = (renderer as any).state.buffers.depth.getReversed();
        shadow.camera._reversedDepth = reversedDepthBuffer;
        if (shadow.map === null || typeChanged === true || shadowMapTypes.get(shadow) !== scope.type) {
          if (shadow.map !== null) {
            if (shadow.map.depthTexture !== null) {
              shadow.map.depthTexture.dispose();
              shadow.map.depthTexture = null;
            }
            shadow.map.dispose();
          }
          if (scope.type === ShadowMap.VSM) {
            if (light.isPointLight) {
              warn(
                "WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.",
              );
              continue;
            }
            shadow.map = new WebGLRenderTarget(_shadowMapSize.x, _shadowMapSize.y, {
              format: PixelFormat.RG,
              type: TextureType.HalfFloat,
              minFilter: TextureFilter.Linear,
              magFilter: TextureFilter.Linear,
              generateMipmaps: false,
            });
            shadow.map.texture.name = light.name + ".shadowMap";
            // Native depth texture for VSM - depth is captured here, then blurred into the color texture
            shadow.map.depthTexture = new DepthTexture(_shadowMapSize.x, _shadowMapSize.y, TextureType.Float);
            shadow.map.depthTexture.name = light.name + ".shadowMapDepth";
            shadow.map.depthTexture.format = PixelFormat.Depth;
            shadow.map.depthTexture.compareFunction = null; // For regular sampling (not shadow comparison)
            shadow.map.depthTexture.minFilter = TextureFilter.Nearest;
            shadow.map.depthTexture.magFilter = TextureFilter.Nearest;
          } else {
            if (light.isPointLight) {
              shadow.map = new WebGLCubeRenderTarget(_shadowMapSize.x);
              shadow.map.depthTexture = new CubeDepthTexture(_shadowMapSize.x, TextureType.UnsignedInt);
            } else {
              shadow.map = new WebGLRenderTarget(_shadowMapSize.x, _shadowMapSize.y);
              shadow.map.depthTexture = new DepthTexture(_shadowMapSize.x, _shadowMapSize.y, TextureType.UnsignedInt);
            }
            shadow.map.depthTexture.name = light.name + ".shadowMap";
            shadow.map.depthTexture.format = PixelFormat.Depth;
            if (scope.type === ShadowMap.PCF) {
              shadow.map.depthTexture.compareFunction = reversedDepthBuffer ? Compare.GreaterEqual : Compare.LessEqual;
              shadow.map.depthTexture.minFilter = TextureFilter.Linear;
              shadow.map.depthTexture.magFilter = TextureFilter.Linear;
            } else {
              shadow.map.depthTexture.compareFunction = null;
              shadow.map.depthTexture.minFilter = TextureFilter.Nearest;
              shadow.map.depthTexture.magFilter = TextureFilter.Nearest;
            }
          }
          shadow.camera.updateProjectionMatrix();
          shadowMapTypes.set(shadow, scope.type);
        }
        if (
          shadow.map.isWebGLCubeRenderTarget !== true &&
          (shadow.map.width !== _shadowMapSize.x || shadow.map.height !== _shadowMapSize.y)
        ) {
          shadow.map.setSize(_shadowMapSize.x, _shadowMapSize.y);
        }
        // For cube render targets (PointLights), render all 6 faces. Sun lights
        // render one atlas viewport per cascade.
        const faceCount = shadow.map.isWebGLCubeRenderTarget ? 6 : shadow.getViewportCount();
        if (light.isPointLight !== true) shadow.updateMatrices(light, camera);
        const layers = (shadow.camera.layers.mask & 0xfffffffe) !== 0 ? shadow.camera.layers : camera.layers;
        for (let face = 0; face < faceCount; face++) {
          const shadowCamera = shadow.getCamera(face);
          if (light.isPointLight) {
            const camera = shadow.camera;
            const shadowMatrix = shadow.matrix;
            const far = light.distance || camera.far;
            if (far !== camera.far) {
              camera.far = far;
              camera.updateProjectionMatrix();
            }
            _lightPositionWorld.setFromMatrixPosition(light.matrixWorld);
            camera.position.copy(_lightPositionWorld);
            _lookTarget.copy(camera.position);
            _lookTarget.add(_cubeDirections[face]);
            camera.up.copy(_cubeUps[face]);
            camera.lookAt(_lookTarget);
            camera.updateMatrixWorld();
            shadowMatrix.makeTranslation(-_lightPositionWorld.x, -_lightPositionWorld.y, -_lightPositionWorld.z);
            _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
            shadow._frustum.setFromProjectionMatrix(_projScreenMatrix, camera.coordinateSystem, camera.reversedDepth);
          }
          // For cube render targets, render to each face separately
          if (shadow.map.isWebGLCubeRenderTarget) {
            renderer.setRenderTarget(shadow.map, face);
            renderer.clear();
          } else {
            // For 2D render targets, use viewports
            if (face === 0) {
              renderer.setRenderTarget(shadow.map);
              renderer.clear();
            }
            const viewport = shadow.getViewport(face);
            _viewport.set(
              _viewportSize.x * viewport.x,
              _viewportSize.y * viewport.y,
              _viewportSize.x * viewport.z,
              _viewportSize.y * viewport.w,
            );
            _state.viewport(_viewport);
          }
          _frustum = shadow.getFrustum(face);
          renderObject(scene, camera, shadowCamera, light, layers, scope.type);
        }
        // do blur pass for VSM
        if (shadow.isPointLightShadow !== true && scope.type === ShadowMap.VSM) {
          VSMPass(shadow, camera);
        }
        shadow.needsUpdate = false;
      }
      _previousType = scope.type;
      scope.needsUpdate = false;
    } finally {
      renderer.setRenderTarget(currentRenderTarget, activeCubeFace, activeMipmapLevel);
    }
  }
  function VSMPass(shadow?: any, camera?: any) {
    const geometry = objects.update(fullScreenMesh);
    if (shadowMaterialVertical.defines.VSM_SAMPLES !== shadow.blurSamples) {
      shadowMaterialVertical.defines.VSM_SAMPLES = shadow.blurSamples;
      (shadowMaterialHorizontal as any).defines.VSM_SAMPLES = shadow.blurSamples;
      shadowMaterialVertical.needsUpdate = true;
      shadowMaterialHorizontal.needsUpdate = true;
    }
    if (shadow.mapPass === null) {
      shadow.mapPass = new WebGLRenderTarget(_shadowMapSize.x, _shadowMapSize.y, {
        format: PixelFormat.RG,
        type: TextureType.HalfFloat,
      });
    } else if (shadow.mapPass.width !== shadow.map.width || shadow.mapPass.height !== shadow.map.height) {
      shadow.mapPass.setSize(shadow.map.width, shadow.map.height);
    }
    // vertical pass - read from native depth texture
    shadowMaterialVertical.uniforms.shadow_pass.value = shadow.map.depthTexture;
    shadowMaterialVertical.uniforms.resolution.value.set(shadow.map.width, shadow.map.height);
    shadowMaterialVertical.uniforms.radius.value = shadow.radius;
    renderer.setRenderTarget(shadow.mapPass);
    renderer.clear();
    renderer.renderBufferDirect(camera, null, geometry, shadowMaterialVertical, fullScreenMesh, null);
    // horizontal pass
    (shadowMaterialHorizontal as any).uniforms.shadow_pass.value = shadow.mapPass.texture;
    (shadowMaterialHorizontal as any).uniforms.resolution.value.set(shadow.map.width, shadow.map.height);
    (shadowMaterialHorizontal as any).uniforms.radius.value = shadow.radius;
    renderer.setRenderTarget(shadow.map);
    renderer.clear();
    renderer.renderBufferDirect(camera, null, geometry, shadowMaterialHorizontal, fullScreenMesh, null);
  }
  function getDepthMaterial(object?: any, material?: any, light?: any, type?: any) {
    let result: any = null;
    const customMaterial = light.isPointLight === true ? object.customDistanceMaterial : object.customDepthMaterial;
    if (customMaterial !== undefined) {
      result = customMaterial;
    } else {
      result = light.isPointLight === true ? _distanceMaterial : _depthMaterial;
      if (
        (renderer.localClippingEnabled &&
          material.clipShadows === true &&
          Array.isArray(material.clippingPlanes) &&
          material.clippingPlanes.length !== 0) ||
        (material.displacementMap && material.displacementScale !== 0) ||
        (material.alphaMap && material.alphaTest > 0) ||
        (material.map && material.alphaTest > 0) ||
        material.alphaToCoverage === true
      ) {
        // in this case we need a unique material instance reflecting the
        // appropriate state
        const keyA = result.uuid,
          keyB = material.uuid;
        let materialsForVariant = (_materialCache as any)[keyA];
        if (materialsForVariant === undefined) {
          materialsForVariant = {};
          (_materialCache as any)[keyA] = materialsForVariant;
        }
        let cachedMaterial = materialsForVariant[keyB];
        if (cachedMaterial === undefined) {
          cachedMaterial = result.clone();
          materialsForVariant[keyB] = cachedMaterial;
          material.addEventListener("dispose", onMaterialDispose);
          materialSources.set(material.uuid, new WeakRef(material));
        }
        result = cachedMaterial;
      }
    }
    result.visible = material.visible;
    result.wireframe = material.wireframe;
    if (type === ShadowMap.VSM) {
      result.side = material.shadowSide !== null ? material.shadowSide : material.side;
    } else {
      result.side = material.shadowSide !== null ? material.shadowSide : (shadowSide as any)[material.side];
    }
    result.alphaMap = material.alphaMap;
    result.alphaTest = material.alphaToCoverage === true ? 0.5 : material.alphaTest; // approximate alphaToCoverage by using a fixed alphaTest value
    result.map = material.map;
    result.clipShadows = material.clipShadows;
    result.clippingPlanes = material.clippingPlanes;
    result.clipIntersection = material.clipIntersection;
    result.displacementMap = material.displacementMap;
    result.displacementScale = material.displacementScale;
    result.displacementBias = material.displacementBias;
    result.wireframeLinewidth = material.wireframeLinewidth;
    result.linewidth = material.linewidth;
    if (light.isPointLight === true && result.isMeshDistanceMaterial === true) {
      const materialProperties = (renderer as any).properties.get(result);
      materialProperties.light = light;
    }
    return result;
  }
  function renderObject(object?: any, camera?: any, shadowCamera?: any, light?: any, layers?: any, type?: any) {
    if (object.visible === false) return;
    const visible = object.layers.test(layers);
    if (visible && (object.isMesh || object.isLine || object.isPoints)) {
      if (
        (object.castShadow || (object.receiveShadow && type === ShadowMap.VSM)) &&
        (!object.frustumCulled || object.intersectsFrustum(_frustum))
      ) {
        object.modelViewMatrix.multiplyMatrices(shadowCamera.matrixWorldInverse, object.matrixWorld);
        const geometry = objects.update(object);
        const material = object.material;
        if (Array.isArray(material)) {
          const groups = geometry.groups;
          for (let k = 0, kl = groups.length; k < kl; k++) {
            const group = groups[k];
            const groupMaterial = material[group.materialIndex];
            if (groupMaterial && groupMaterial.visible) {
              const depthMaterial = getDepthMaterial(object, groupMaterial, light, type);
              object.onBeforeShadow(renderer, object, camera, shadowCamera, geometry, depthMaterial, group);
              renderer.renderBufferDirect(shadowCamera, null, geometry, depthMaterial, object, group);
              object.onAfterShadow(renderer, object, camera, shadowCamera, geometry, depthMaterial, group);
            }
          }
        } else if (material.visible) {
          const depthMaterial = getDepthMaterial(object, material, light, type);
          object.onBeforeShadow(renderer, object, camera, shadowCamera, geometry, depthMaterial, null);
          renderer.renderBufferDirect(shadowCamera, null, geometry, depthMaterial, object, null);
          object.onAfterShadow(renderer, object, camera, shadowCamera, geometry, depthMaterial, null);
        }
      }
    }
    const children = object.children;
    for (let i = 0, l = children.length; i < l; i++) {
      renderObject(children[i], camera, shadowCamera, light, layers, type);
    }
  }
  function onMaterialDispose(event?: any) {
    const material = event.target;
    material.removeEventListener("dispose", onMaterialDispose);
    materialSources.delete(material.uuid);
    // make sure to remove the unique distance/depth materials used for shadow map rendering
    for (const id in _materialCache) {
      const cache = (_materialCache as any)[id];
      const uuid = event.target.uuid;
      if (uuid in cache) {
        const shadowMaterial = cache[uuid];
        shadowMaterial.dispose();
        delete cache[uuid];
      }
    }
  }
  function dispose(): void {
    for (const ref of materialSources.values()) ref.deref()?.removeEventListener("dispose", onMaterialDispose);
    materialSources.clear();
    for (const variant in _materialCache) {
      for (const uuid in (_materialCache as any)[variant]) (_materialCache as any)[variant][uuid].dispose();
      delete (_materialCache as any)[variant];
    }
    _depthMaterial.dispose();
    _distanceMaterial.dispose();
    shadowMaterialVertical.dispose();
    shadowMaterialHorizontal.dispose();
    fullScreenTri.dispose();
    // Light-owned targets survive; context restoration must refill even frozen maps.
    for (const ref of shadows) {
      const shadow = ref.deref();
      if (shadow !== undefined) {
        shadow.needsUpdate = true;
        shadowRefs.delete(shadow);
      }
      shadowRegistry.unregister(ref);
    }
    shadows.clear();
    scope.needsUpdate = true;
  }
  return scope;
}
