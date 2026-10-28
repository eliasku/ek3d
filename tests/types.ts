import { BatchedMesh } from "ek3d/objects/BatchedMesh";
import type { BatchedMeshGeometryRange, BatchedMeshDrawRange, BatchedMeshSortFunction } from "ek3d/objects/BatchedMesh";
import { LOD } from "ek3d/objects/LOD";
import type { LODLevel } from "ek3d/objects/LOD";
import { Vector3 } from "ek3d/math/Vector3";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Triangle } from "ek3d/math/Triangle";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { Mesh } from "ek3d/objects/Mesh";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { Box3 } from "ek3d/math/Box3";
import { Sphere } from "ek3d/math/Sphere";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { DataTexture } from "ek3d/textures/DataTexture";
import { Vector2 } from "ek3d/math/Vector2";
import { PixelFormat, TextureType, ColorSpace, Wrapping } from "ek3d/constants";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { Color } from "ek3d/math/Color";
import { Euler } from "ek3d/math/Euler";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import type {
  WebGLBackgroundSystem,
  WebGLBackgroundState,
  WebGLBackgroundObjects,
  WebGLBackgroundRenderList,
} from "ek3d/renderers/webgl/WebGLBackground";
import type { WebGLEnvironmentProvider } from "ek3d/renderers/webgl/WebGLEnvironmentAccess";
import { backgroundShader } from "ek3d/renderers/shaders/BackgroundShader";
import { backgroundCubeShader } from "ek3d/renderers/shaders/BackgroundCubeShader";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import type { PMREMGeneratorOptions } from "ek3d/extras/PMREMGenerator";
import { WebGLCubeRenderTarget } from "ek3d/renderers/WebGLCubeRenderTarget";
import type { RenderTargetOptions } from "ek3d/core/RenderTarget";
import { CubeCamera } from "ek3d/cameras/CubeCamera";
import { CubeTexture } from "ek3d/textures/CubeTexture";
import { Texture } from "ek3d/textures/Texture";
import { Mapping, TextureFilter } from "ek3d/constants";
import { Object3D } from "ek3d/core/Object3D";
import { Camera } from "ek3d/cameras/Camera";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Material } from "ek3d/materials/Material";
import { MeshDepthMaterial } from "ek3d/materials/MeshDepthMaterial";
import type { MeshDepthMaterialParameters } from "ek3d/materials/MeshDepthMaterial";
import { MeshDistanceMaterial } from "ek3d/materials/MeshDistanceMaterial";
import type { MeshDistanceMaterialParameters } from "ek3d/materials/MeshDistanceMaterial";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { PointLight } from "ek3d/lights/PointLight";
import { DirectionalLightShadow } from "ek3d/lights/DirectionalLightShadow";
import { PointLightShadow } from "ek3d/lights/PointLightShadow";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { SpotLightShadow } from "ek3d/lights/SpotLightShadow";
import { DepthTexture } from "ek3d/textures/DepthTexture";
import { CubeDepthTexture } from "ek3d/textures/CubeDepthTexture";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import type {
  WebGLShadowMapSystem,
  WebGLShadowMapObjects,
  WebGLShadowMapCapabilities,
} from "ek3d/renderers/webgl/WebGLShadowMap";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { distanceShader } from "ek3d/renderers/shaders/DistanceShader";
import { ShadowMap, DepthPacking, Compare, BufferUsage } from "ek3d/constants";
import { WebGLOutput } from "ek3d/renderers/webgl/WebGLOutput";
import type { WebGLOutputSystem, WebGLOutputEffect } from "ek3d/renderers/webgl/WebGLOutput";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { Light } from "ek3d/lights/Light";
import { Group } from "ek3d/objects/Group";
// @ts-expect-error The WebXR manager and its native type contracts are not published.
import type {} from "ek3d/renderers/webxr/WebXRManager";
// @ts-expect-error The WebXR controller subpath is not published.
import type {} from "ek3d/renderers/webxr/WebXRController";
// @ts-expect-error The WebXR depth subpath is not published.
import type {} from "ek3d/renderers/webxr/WebXRDepthSensing";
// @ts-expect-error WebGPU renderers are not published.
import type {} from "ek3d/renderers/webgpu/WebGPURenderer";
// @ts-expect-error The WebGPU coordinate system is not exported.
import { WebGPUCoordinateSystem } from "ek3d/constants";
// @ts-expect-error GPU timestamp query contracts are not exported.
import { TimestampQuery } from "ek3d/constants";
import { ArrayCamera } from "ek3d/cameras/ArrayCamera";
import { ExternalTexture } from "ek3d/textures/ExternalTexture";
import { Vector4 } from "ek3d/math/Vector4";
import { InterleavedBuffer } from "ek3d/core/InterleavedBuffer";
import type { InterleavedBufferCloneData, InterleavedBufferSerializationData } from "ek3d/core/InterleavedBuffer";
import { InterleavedBufferAttribute } from "ek3d/core/InterleavedBufferAttribute";
import { InstancedBufferAttribute } from "ek3d/core/InstancedBufferAttribute";
import { InstancedInterleavedBuffer } from "ek3d/core/InstancedInterleavedBuffer";
import { InstancedBufferGeometry } from "ek3d/core/InstancedBufferGeometry";
import { GLBufferAttribute } from "ek3d/core/GLBufferAttribute";
import { Raycaster } from "ek3d/core/Raycaster";
import type { Intersection } from "ek3d/core/Raycaster";
import { Box2 } from "ek3d/math/Box2";
import { Line3 } from "ek3d/math/Line3";
import { Matrix2 } from "ek3d/math/Matrix2";
import { Spherical } from "ek3d/math/Spherical";
import { Cylindrical } from "ek3d/math/Cylindrical";
import { CapsuleGeometry } from "ek3d/geometries/CapsuleGeometry";
import { CircleGeometry } from "ek3d/geometries/CircleGeometry";
import { ConeGeometry } from "ek3d/geometries/ConeGeometry";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { DodecahedronGeometry } from "ek3d/geometries/DodecahedronGeometry";
import { EdgesGeometry } from "ek3d/geometries/EdgesGeometry";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { LatheGeometry } from "ek3d/geometries/LatheGeometry";
import { OctahedronGeometry } from "ek3d/geometries/OctahedronGeometry";
import { PolyhedronGeometry } from "ek3d/geometries/PolyhedronGeometry";
import { RingGeometry } from "ek3d/geometries/RingGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { TetrahedronGeometry } from "ek3d/geometries/TetrahedronGeometry";
import { TorusGeometry } from "ek3d/geometries/TorusGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { WireframeGeometry } from "ek3d/geometries/WireframeGeometry";
import { Line } from "ek3d/objects/Line";
import { LineLoop } from "ek3d/objects/LineLoop";
import { LineSegments } from "ek3d/objects/LineSegments";
import { Points } from "ek3d/objects/Points";
import { Sprite } from "ek3d/objects/Sprite";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { LineDashedMaterial } from "ek3d/materials/LineDashedMaterial";
import type { LineDashedMaterialParameters } from "ek3d/materials/LineDashedMaterial";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { SpriteMaterial } from "ek3d/materials/SpriteMaterial";
import { dashedShader } from "ek3d/renderers/shaders/DashedShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { spriteShader } from "ek3d/renderers/shaders/SpriteShader";
import { LightProbe } from "ek3d/lights/LightProbe";
import { RectAreaLight } from "ek3d/lights/RectAreaLight";
import { SphericalHarmonics3 } from "ek3d/math/SphericalHarmonics3";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { MeshNormalMaterial } from "ek3d/materials/MeshNormalMaterial";
import { MeshMatcapMaterial } from "ek3d/materials/MeshMatcapMaterial";
import { MeshToonMaterial } from "ek3d/materials/MeshToonMaterial";
import { ShadowMaterial } from "ek3d/materials/ShadowMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import type { MeshStandardMaterialParameters } from "ek3d/materials/MeshStandardMaterial";
import { MeshPhysicalMaterial } from "ek3d/materials/MeshPhysicalMaterial";
import type { MeshPhysicalMaterialParameters } from "ek3d/materials/MeshPhysicalMaterial";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { matcapShader } from "ek3d/renderers/shaders/MatcapShader";
import { toonShader } from "ek3d/renderers/shaders/ToonShader";
import { shadowShader } from "ek3d/renderers/shaders/ShadowShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
// @ts-expect-error Package roots are deliberately not exposed.
import * as forbiddenRoot from "ek3d";

import { Curve } from "ek3d/extras/core/Curve";
import type { CurveJSON, CurveFactory } from "ek3d/extras/core/Curve";
import { CurvePath } from "ek3d/extras/core/CurvePath";
import { Path } from "ek3d/extras/core/Path";
import { Shape } from "ek3d/extras/core/Shape";
import { ShapePath } from "ek3d/extras/core/ShapePath";
import { ArcCurve } from "ek3d/extras/curves/ArcCurve";
import { EllipseCurve } from "ek3d/extras/curves/EllipseCurve";
import { LineCurve } from "ek3d/extras/curves/LineCurve";
import { LineCurve3 } from "ek3d/extras/curves/LineCurve3";
import { QuadraticBezierCurve } from "ek3d/extras/curves/QuadraticBezierCurve";
import { QuadraticBezierCurve3 } from "ek3d/extras/curves/QuadraticBezierCurve3";
import { CubicBezierCurve } from "ek3d/extras/curves/CubicBezierCurve";
import { CubicBezierCurve3 } from "ek3d/extras/curves/CubicBezierCurve3";
import { SplineCurve } from "ek3d/extras/curves/SplineCurve";
import { CatmullRomCurve3 } from "ek3d/extras/curves/CatmullRomCurve3";
import { ShapeUtils } from "ek3d/extras/ShapeUtils";
import { Earcut } from "ek3d/extras/Earcut";
import { TubeGeometry } from "ek3d/geometries/TubeGeometry";
import { ExtrudeGeometry } from "ek3d/geometries/ExtrudeGeometry";
import type { ExtrudeGeometryOptions } from "ek3d/geometries/ExtrudeGeometry";
import { ShapeGeometry } from "ek3d/geometries/ShapeGeometry";
// @ts-expect-error Curve dispatch has no aggregate public module.
import type {} from "ek3d/extras/curves/Curves";

import { Fog } from "ek3d/scenes/Fog";
import { FogExp2 } from "ek3d/scenes/FogExp2";
// @ts-expect-error StereoCamera is deliberately excluded from the package.
import type {} from "ek3d/cameras/StereoCamera";
import { Timer } from "ek3d/core/Timer";
import { Clock } from "ek3d/core/Clock";
import { Uniform } from "ek3d/core/Uniform";
import { UniformsGroup } from "ek3d/core/UniformsGroup";

// Stage 4: animation buffers, discrete tracks, bindings and CPU skinning.
import { AnimationClip } from "ek3d/animation/AnimationClip";
import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { AnimationAction } from "ek3d/animation/AnimationAction";
import { AnimationObjectGroup } from "ek3d/animation/AnimationObjectGroup";
import { PropertyBinding } from "ek3d/animation/PropertyBinding";
import { PropertyMixer } from "ek3d/animation/PropertyMixer";
import { KeyframeTrack } from "ek3d/animation/KeyframeTrack";
import { NumberKeyframeTrack } from "ek3d/animation/tracks/NumberKeyframeTrack";
import { VectorKeyframeTrack } from "ek3d/animation/tracks/VectorKeyframeTrack";
import { QuaternionKeyframeTrack } from "ek3d/animation/tracks/QuaternionKeyframeTrack";
import { ColorKeyframeTrack } from "ek3d/animation/tracks/ColorKeyframeTrack";
import { BooleanKeyframeTrack } from "ek3d/animation/tracks/BooleanKeyframeTrack";
import { StringKeyframeTrack } from "ek3d/animation/tracks/StringKeyframeTrack";
import { LinearInterpolant } from "ek3d/math/interpolants/LinearInterpolant";
import { CubicInterpolant } from "ek3d/math/interpolants/CubicInterpolant";
import { DiscreteInterpolant } from "ek3d/math/interpolants/DiscreteInterpolant";
import { QuaternionLinearInterpolant } from "ek3d/math/interpolants/QuaternionLinearInterpolant";
import { convertArray, getKeyframeOrder, sortedArray, subclip, makeClipAdditive } from "ek3d/animation/AnimationUtils";
import type { NumericAnimationBuffer } from "ek3d/math/Interpolant";
import { Bone } from "ek3d/objects/Bone";
import { Skeleton } from "ek3d/objects/Skeleton";
import { SkinnedMesh } from "ek3d/objects/SkinnedMesh";
import { Interpolation, Loop } from "ek3d/constants";

void [WebGPUCoordinateSystem, TimestampQuery];

const v: Vector3 = new Vector3(1, 2, 3).applyMatrix4(new Matrix4());
const camera = new PerspectiveCamera(50, 1, 0.1, 100);
const scene = new Scene();
const geometry = new BoxGeometry(1, 1, 1);
const material = new MeshBasicMaterial({ color: 0xff8833, wireframe: false });
const mesh = new Mesh(geometry, material);
scene.add(mesh);
camera.position.copy(v);
const renderer = new WebGLRenderer({ shaders: { MeshBasicMaterial: basicShader }, antialias: false });
renderer.render(scene, camera);
renderer.setSize(640, 480);

renderer.setAnimationLoop((time) => {
  const timestamp: number = time;
  void timestamp;
});
renderer.setAnimationLoop(null);
const windowAnimation: FrameRequestCallback = (time) => {
  void time;
};
renderer.setAnimationLoop(windowAnimation);
declare const nativeTexture: WebGLTexture;
declare const nativeFramebuffer: WebGLFramebuffer;
const externalTarget = new WebGLRenderTarget(16, 16);
renderer.setRenderTargetTextures(externalTarget, nativeTexture, nativeTexture);
renderer.setRenderTargetFramebuffer(externalTarget, nativeFramebuffer);
const group = new Group();
group.add(mesh);
renderer.render(group, camera);
camera.viewport = new Vector4(0, 0, 100, 100);
const arrayCamera = new ArrayCamera([camera]);
const subCamera: PerspectiveCamera = arrayCamera.cameras[0];
const viewport: Vector4 = subCamera.viewport;
const externalTexture = new ExternalTexture(nativeTexture);
externalTexture.sourceTexture = null;
const externalCopy: ExternalTexture = externalTexture.copy(new ExternalTexture());
renderer.render(scene, arrayCamera);
void [viewport, externalCopy];

// @ts-expect-error The renderer has no XR manager.
void renderer.xr;
// @ts-expect-error XR injection is no longer an option.
new WebGLRenderer({ createXR: () => null });
// @ts-expect-error The renderer has no node-backend handler.
renderer.setNodesHandler(() => {});
// @ts-expect-error Node-backend shader diagnostics are not exposed.
void renderer.debug.diagnostics;
// @ts-expect-error Geometry indirect draws are a removed backend API.
void geometry.indirect;
// @ts-expect-error Geometry indirect offsets are a removed backend API.
void geometry.indirectOffset;
// @ts-expect-error Geometry indirect getter is a removed backend API.
geometry.getIndirect();
// @ts-expect-error Geometry indirect setter is a removed backend API.
geometry.setIndirect(null);
// @ts-expect-error Static object hints are a removed backend API.
void mesh.static;
// @ts-expect-error Mesh draw counts are a removed backend API.
void mesh.count;
// @ts-expect-error Per-attribute GPU disposal is not a WebGL API.
new BufferAttribute(new Float32Array(3), 3).dispose();
// @ts-expect-error Node-backed light registration is not supported.
Light.registerNode("test", () => {});
// @ts-expect-error Node-backed shadow bias is not supported.
void new DirectionalLightShadow().biasNode;
renderer.debug.checkShaderErrors = true;
renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
  gl.getProgramInfoLog(program);
  gl.getShaderInfoLog(vertexShader);
  gl.getShaderInfoLog(fragmentShader);
};
renderer.debug.onShaderError = null;
// @ts-expect-error Array cameras require perspective cameras.
new ArrayCamera([new Object3D()]);
// @ts-expect-error External texture sources cannot be scalars.
new ExternalTexture(1);
// @ts-expect-error Texture copies require external textures.
externalTexture.copy(new Texture());
// @ts-expect-error Animation timestamps are numeric.
renderer.setAnimationLoop((time: string) => {});
// @ts-expect-error Window RAF callbacks receive no XR frame argument.
renderer.setAnimationLoop((time: number, frame: object) => {});

const output: WebGLOutputSystem = WebGLOutput(TextureType.HalfFloat, 64, 48, false, true, false);
const effect: WebGLOutputEffect = {
  needsSwap: true,
  enabled: true,
  needsDepthTexture: true,
  setSize(width, height) {
    const size: number = width * height;
    void size;
  },
  setDepthTexture(depth) {
    const value: DepthTexture = depth;
    void value;
  },
  render(owner, write, read, delta) {
    const target: WebGLRenderTarget = read;
    const elapsed: number | undefined = delta;
    owner.setRenderTarget(write);
    void [target, elapsed];
  },
};
const outputRenderer = new WebGLRenderer({ createOutput: WebGLOutput, outputBufferType: TextureType.HalfFloat });
outputRenderer.setEffects([effect]);
outputRenderer.setEffects(null);
output.setEffects([effect]);
output.setSize(128, 96);
const outputBegun: boolean = output.begin(renderer, null);
const outputCompositing: boolean = output.isCompositing();
const outputRenderPass: boolean = output.hasRenderPass();
output.end(renderer, 1 / 60);
output.restore(renderer);
output.dispose();
const raw = new RawShaderMaterial({
  uniforms: { gain: { value: 2 } },
  vertexShader: "",
  fragmentShader: "",
  depthTest: false,
});
const rawClone: RawShaderMaterial = raw.clone();
void [outputBegun, outputCompositing, outputRenderPass, rawClone];

// @ts-expect-error Output factories return the complete lifecycle, not an inert object.
new WebGLRenderer({ createOutput: () => ({ dispose() {} }) });
// @ts-expect-error Output factory dimensions are numeric.
WebGLOutput(TextureType.HalfFloat, "64", 48, false, true, false);
// @ts-expect-error Output factory antialiasing is boolean.
WebGLOutput(TextureType.HalfFloat, 64, 48, 4, true, false);
// @ts-expect-error An effect needs a render operation.
outputRenderer.setEffects([{ enabled: true }]);
// @ts-expect-error Render targets are not arbitrary texture values.
output.begin(renderer, new Texture());
output.setEffects([
  {
    render() {},
    // @ts-expect-error Depth callbacks receive a DepthTexture.
    setDepthTexture(value: string) {
      void value;
    },
  },
]);
// @ts-expect-error Effect flags are boolean.
outputRenderer.setEffects([{ render() {}, needsSwap: "yes" }]);
// @ts-expect-error Raw shader programs are strings.
new RawShaderMaterial({ vertexShader: 1 });
// @ts-expect-error Raw shader uniform values need containers.
new RawShaderMaterial({ uniforms: { gain: 2 } });

const pixels = new Uint8Array(16);
const texture = new DataTexture(pixels, 2, 2, PixelFormat.RGBA, TextureType.UnsignedByte);
texture.colorSpace = ColorSpace.SRGB;
texture.wrapS = Wrapping.Repeat;
texture.offset.set(0.5, 0);
texture.repeat.set(2, 1);
texture.updateMatrix();
const uv: Vector2 = texture.transformUv(new Vector2(0.25, 0.75));
const imageWidth: number = texture.image.width;
const texel: number | undefined = texture.image.data?.[0];
const textureClone: DataTexture = texture.clone();
texture.image = { data: pixels, width: 2, height: 2 };
texture.needsUpdate = true;
material.map = texture;
new MeshBasicMaterial({ map: texture, color: "white" });
new MeshBasicMaterial({ map: null });
new DataTexture(null);
new DataTexture(new Float32Array(4), 1, 1);
void [uv, imageWidth, texel, textureClone];

const litMaterial = new MeshLambertMaterial({
  color: "coral",
  emissive: new Color(0x110000),
  emissiveIntensity: 0.5,
  normalScale: new Vector2(1, -1),
  normalMap: texture,
  flatShading: true,
});
const light = new HemisphereLight("white", 0x332211, 2);
light.position.set(0, 0, 1);
light.color.setHex(0x88bbff);
light.groundColor.setRGB(0.1, 0.2, 0.3);
light.intensity = 0.5;
const lightClone: HemisphereLight = light.clone();
const materialClone: MeshLambertMaterial = litMaterial.clone();
renderer.shaders = { MeshBasicMaterial: basicShader, MeshLambertMaterial: lambertShader };
renderer.render(scene.add(light, new Mesh(geometry, litMaterial)), camera);
void [lightClone, materialClone];

scene.background = texture;
scene.background = new Color("navy");
scene.background = null;
scene.backgroundBlurriness = 0.25;
scene.backgroundIntensity = 0.5;
scene.backgroundRotation = new Euler(0, 0.5, 0);
const sceneClone: Scene = scene.clone();
const plane = new PlaneGeometry(2, 2, 1, 1);
const planeClone: PlaneGeometry = plane.clone();
const planeWidth: number = plane.parameters.width;
const custom = new ShaderMaterial({
  uniforms: { time: { value: 1 }, map: { value: texture } },
  vertexShader: backgroundShader.vertexShader,
  fragmentShader: backgroundShader.fragmentShader,
  defines: { TEST: true, COUNT: 2, MODE: "TEST" },
  depthTest: false,
  depthWrite: false,
  fog: false,
  allowOverride: false,
});
custom.uniforms.time.value = 2;
custom.uniformsNeedUpdate = true;
const customClone: ShaderMaterial = custom.clone();
custom.copy(customClone);
new ShaderMaterial(backgroundCubeShader);
new WebGLRenderer({ createBackground: WebGLBackground, shaders: { MeshBasicMaterial: basicShader } });
new WebGLRenderer({
  createBackground(renderer, environments, state, objects, alpha, premultipliedAlpha) {
    const typedRenderer: WebGLRenderer = renderer;
    const typedEnvironments: WebGLEnvironmentProvider | null = environments;
    const typedState: WebGLBackgroundState = state;
    const typedObjects: WebGLBackgroundObjects = objects;
    const typedAlpha: boolean = alpha;
    const typedPremultipliedAlpha: boolean = premultipliedAlpha;
    const background: WebGLBackgroundSystem = WebGLBackground(
      typedRenderer,
      typedEnvironments,
      typedState,
      typedObjects,
      typedAlpha,
      typedPremultipliedAlpha,
    );
    const clear: Color = background.getClearColor();
    const opacity: number = background.getClearAlpha();
    background.setClearColor("navy", 0.5);
    background.setClearColor(new Color(), 1);
    background.setClearAlpha(1);
    background.render(scene);
    const list: WebGLBackgroundRenderList = {
      unshift(object, geometry, material, groupOrder, z, group) {
        const mesh: Mesh = object;
        const order: number = groupOrder;
        const depth: number = z;
        const noGroup: null = group;
        void [mesh, geometry, material, order, depth, noGroup];
      },
    };
    background.addToRenderList(list, scene);
    background.dispose();
    // @ts-expect-error Factory renderer is not an untyped argument.
    renderer.setSize("640", 480);
    // @ts-expect-error Environment conversion receives textures, not pixel buffers.
    environments?.get(pixels);
    // @ts-expect-error Factory state exposes actual clear-buffer arguments.
    state.buffers.color.setClear("red", 0, 0, 1, false);
    // @ts-expect-error Object upload requires a mesh.
    objects.update(texture);
    // @ts-expect-error Factory alpha is boolean.
    const invalidAlpha: string = alpha;
    // @ts-expect-error All six factory arguments are required.
    WebGLBackground(renderer, environments, state, objects, alpha);
    // @ts-expect-error Factory state cannot omit its clear buffers.
    WebGLBackground(renderer, environments, {}, objects, alpha, premultipliedAlpha);
    // @ts-expect-error The result accepts colors, not arrays.
    background.setClearColor([1, 0, 0]);
    // @ts-expect-error Clear opacity is numeric.
    background.setClearAlpha("opaque");
    // @ts-expect-error Background rendering accepts scene objects, not textures.
    background.render(texture);
    // @ts-expect-error Background queues require an unshift implementation.
    background.addToRenderList({}, scene);
    void [clear, opacity, invalidAlpha];
    return background;
  },
});
void [sceneClone, planeClone, planeWidth, customClone];

const rgb = new Color(0x123456).getRGB({ r: 0, g: 0, b: 0, label: "clear" });
const rgbLabel: string = rgb.label;
const rgbColor: Color = new Color().getRGB(new Color());
// @ts-expect-error RGB targets require three numeric channels.
new Color().getRGB({ r: 0, g: 0, b: "blue" });
void [rgbLabel, rgbColor];

texture.mapping = Mapping.EquirectangularReflection;
texture.needsPMREMUpdate = true;
const pmremVersion: number = texture.pmremVersion;
const isPMREM: boolean = texture.isPMREMTexture;
const environmentRenderer = new WebGLRenderer({
  shaders: { MeshBasicMaterial: basicShader },
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
});
new WebGLRenderer({
  createEnvironments(renderer) {
    const typedRenderer: WebGLRenderer = renderer;
    // @ts-expect-error Environment factories receive a concrete renderer.
    renderer.setSize("640", 480);
    return WebGLEnvironments(typedRenderer);
  },
});
const environments = WebGLEnvironments(environmentRenderer);
const environmentProvider: WebGLEnvironmentProvider = environments;
const convertedEnvironment: Texture | null = environments.get(texture);
const blurredEnvironment: Texture | null = environments.get(texture, true);
const absentEnvironment: Texture | null = environments.get(null);
environments.get(undefined, false);
environmentProvider.get(null);
environments.dispose();
const targetOptions: RenderTargetOptions = {
  type: TextureType.HalfFloat,
  generateMipmaps: true,
  mipmapsAutoUpdate: false,
  minFilter: TextureFilter.LinearMipmapLinear,
  depthBuffer: false,
  samples: 0,
  internalFormat: null,
  colorSpace: ColorSpace.SRGB,
};
const cubeTarget = new WebGLCubeRenderTarget(256, targetOptions);
const cubeTexture: CubeTexture = cubeTarget.texture;
cubeTarget.texture = new CubeTexture();
const cubeTargetClone: WebGLCubeRenderTarget = cubeTarget.clone();
const convertedTarget: WebGLCubeRenderTarget = cubeTarget.fromEquirectangularTexture(renderer, texture);
cubeTarget.clear(renderer);
cubeTarget.clear(renderer, true, false, false);
const cubeCamera = new CubeCamera(0.1, 100, cubeTarget);
cubeCamera.renderTarget = cubeTargetClone;
cubeCamera.update(renderer, scene);
cubeCamera.update(renderer, mesh);
cubeCamera.updateCoordinateSystem();
const generator = new PMREMGenerator(renderer);
const sceneOptions: PMREMGeneratorOptions = { size: 256, position: new Vector3(1, 2, 3) };
const scenePMREM: WebGLCubeRenderTarget = generator.fromScene(scene, 0.1, 0.1, 100, sceneOptions);
const defaultScenePMREM: WebGLCubeRenderTarget = generator.fromScene(scene);
const equirectPMREM: WebGLCubeRenderTarget = generator.fromEquirectangular(texture);
const cubePMREM: WebGLCubeRenderTarget = generator.fromCubemap(cubeTexture, cubeTarget);
generator.fromEquirectangular(texture, null);
generator.fromCubemap(cubeTexture, undefined);
generator.compileCubemapShader();
generator.compileEquirectangularShader();
const roughness: number = PMREMGenerator.lodToRoughness(1, 5);
generator.dispose();
new MeshBasicMaterial({
  envMap: texture,
  envMapRotation: new Euler(0, 0.5, 0),
  reflectivity: 0.5,
  refractionRatio: 0.98,
});
material.envMap = cubeTexture;
material.envMap = null;
void [
  pmremVersion,
  isPMREM,
  convertedEnvironment,
  blurredEnvironment,
  absentEnvironment,
  convertedTarget,
  scenePMREM,
  defaultScenePMREM,
  equirectPMREM,
  cubePMREM,
  roughness,
];

const directional = new DirectionalLight("white", 2);
const point = new PointLight(0xffaa55, 3, 20, 2);
const directionalShadow: DirectionalLightShadow = directional.shadow;
const pointShadow: PointLightShadow = point.shadow;
const directionalCamera: OrthographicCamera = directionalShadow.camera;
const pointCamera: PerspectiveCamera = pointShadow.camera;
directionalCamera.left = -10;
pointCamera.fov = 90;
directionalShadow.mapSize.set(256, 256);
directionalShadow.bias = -0.001;
directionalShadow.updateMatrices(directional);
const directionalClone: DirectionalLight = directional.clone();
const pointClone: PointLight = point.clone();
const directionalShadowClone: DirectionalLightShadow = directionalShadow.clone();
const pointShadowClone: PointLightShadow = pointShadow.clone();
const depthParameters: MeshDepthMaterialParameters = { depthPacking: DepthPacking.RGBA, map: texture, alphaTest: 0.5 };
const distanceParameters: MeshDistanceMaterialParameters = { displacementMap: texture, displacementScale: 2 };
const depthMaterial = new MeshDepthMaterial(depthParameters);
const distanceMaterial = new MeshDistanceMaterial(distanceParameters);
const depthClone: MeshDepthMaterial = depthMaterial.clone();
const distanceClone: MeshDistanceMaterial = distanceMaterial.clone();
mesh.customDepthMaterial = depthMaterial;
mesh.customDistanceMaterial = distanceMaterial;
mesh.customDepthMaterial = custom;
mesh.customDistanceMaterial = undefined;
mesh.onBeforeShadow = (renderer, object, camera, shadowCamera, geometry, material, group) => {
  const typedRenderer: WebGLRenderer = renderer;
  const typedObject: Object3D = object;
  const typedCamera: Camera = camera;
  const typedShadowCamera: Camera = shadowCamera;
  const typedGeometry: BufferGeometry = geometry;
  const typedMaterial: Material = material;
  const groupStart: number | undefined = group?.start;
  // @ts-expect-error Shadow callbacks retain concrete renderer arguments.
  renderer.setSize("640", 480);
  // @ts-expect-error Shadow callbacks receive materials, not numeric handles.
  const handle: number = material;
  void [typedRenderer, typedObject, typedCamera, typedShadowCamera, typedGeometry, typedMaterial, groupStart, handle];
};
mesh.onAfterShadow = mesh.onBeforeShadow;
const depthTexture = new DepthTexture(256, 256);
depthTexture.compareFunction = Compare.LessEqual;
depthTexture.compareFunction = null;
const depthTextureClone: DepthTexture = depthTexture.clone();
const cubeDepth = new CubeDepthTexture(128);
const cubeDepthClone: CubeDepthTexture = cubeDepth.clone();
const faceWidth: number = cubeDepth.images[0].width;
const shadowRenderer = new WebGLRenderer({
  shaders: { MeshLambertMaterial: lambertShader, MeshDepthMaterial: depthShader, MeshDistanceMaterial: distanceShader },
  createShadowMap(renderer, objects, capabilities) {
    const typedRenderer: WebGLRenderer = renderer;
    const typedObjects: WebGLShadowMapObjects = objects;
    const typedCapabilities: WebGLShadowMapCapabilities = capabilities;
    const geometry: BufferGeometry = objects.update(mesh);
    const maximum: number = capabilities.maxTextureSize;
    const shadows: WebGLShadowMapSystem = WebGLShadowMap(typedRenderer, typedObjects, typedCapabilities);
    shadows.enabled = true;
    shadows.autoUpdate = false;
    shadows.needsUpdate = true;
    shadows.type = ShadowMap.PCF;
    shadows.render([directional, point], scene, camera);
    shadows.dispose();
    // @ts-expect-error Uploads require scene objects.
    objects.update(texture);
    // @ts-expect-error Factory renderer arguments are not any.
    renderer.setSize("640", 480);
    // @ts-expect-error Texture size is numeric.
    const invalidMaximum: string = capabilities.maxTextureSize;
    // @ts-expect-error Factory requires all three arguments.
    WebGLShadowMap(renderer, objects);
    // @ts-expect-error Capabilities must expose maxTextureSize.
    WebGLShadowMap(renderer, objects, {});
    // @ts-expect-error Object upload must return geometry.
    WebGLShadowMap(renderer, { update: () => texture }, capabilities);
    void [geometry, maximum, invalidMaximum];
    return shadows;
  },
});
new WebGLRenderer({ createShadowMap: WebGLShadowMap });
const optionalShadows: WebGLShadowMapSystem | null = shadowRenderer.shadowMap;
optionalShadows?.render([directional, point], scene, camera);
// @ts-expect-error Shadow rendering is opt-in, hence nullable.
const requiredShadows: WebGLShadowMapSystem = shadowRenderer.shadowMap;
new WebGLRenderer({
  // @ts-expect-error Factory results must implement render and dispose.
  createShadowMap: () => ({ enabled: false, autoUpdate: true, needsUpdate: false, type: ShadowMap.PCF }),
});
// @ts-expect-error Factories cannot require a string renderer.
new WebGLRenderer({ createShadowMap: (renderer: string) => optionalShadows! });
// @ts-expect-error Shadow lists require lights.
optionalShadows?.render([mesh], scene, camera);
// @ts-expect-error Shadow rendering requires a camera.
optionalShadows?.render([directional], scene, texture);
// @ts-expect-error Shadow rendering requires a scene object.
optionalShadows?.render([point], texture, camera);
// @ts-expect-error Shadow toggles are boolean.
optionalShadows!.enabled = "yes";
// @ts-expect-error Shadow map selection is numeric.
optionalShadows!.type = "PCF";
// @ts-expect-error Disposal takes no arguments.
optionalShadows?.dispose(renderer);
// @ts-expect-error Directional lights require color representations.
new DirectionalLight(texture);
// @ts-expect-error Point light distance is numeric.
new PointLight("white", 1, "far");
// @ts-expect-error Directional shadow cameras are orthographic.
directionalShadow.camera = pointCamera;
// @ts-expect-error Point shadow cameras are perspective.
pointShadow.camera = directionalCamera;
// @ts-expect-error Concrete light shadow kinds cannot be exchanged.
directional.shadow = pointShadow;
// @ts-expect-error Custom shadow materials must be Material instances.
mesh.customDepthMaterial = texture;
// @ts-expect-error Distance overrides must be Material instances.
mesh.customDistanceMaterial = {};
// @ts-expect-error Callback geometry is not a number.
mesh.onAfterShadow = (renderer, object, camera, shadowCamera, geometry: number) => {};
// @ts-expect-error Depth packing is numeric.
new MeshDepthMaterial({ depthPacking: "RGBA" });
// @ts-expect-error Distance material maps are textures.
new MeshDistanceMaterial({ map: pixels });
// @ts-expect-error Depth material parameters reject unknown fields.
new MeshDepthMaterial({ nonexistent: true });
// @ts-expect-error Distance material displacement is numeric.
new MeshDistanceMaterial({ displacementScale: "large" });
// @ts-expect-error Depth texture dimensions are numeric.
new DepthTexture("256", 256);
// @ts-expect-error Depth comparisons use numeric constants.
depthTexture.compareFunction = "less";
// @ts-expect-error Cube depth faces retain numeric dimensions.
cubeDepth.images[0].width = "128";
void [
  directionalClone,
  pointClone,
  directionalShadowClone,
  pointShadowClone,
  depthClone,
  distanceClone,
  depthTextureClone,
  cubeDepthClone,
  faceWidth,
  requiredShadows,
];

// @ts-expect-error Environment factories require a concrete renderer.
WebGLEnvironments({});
// @ts-expect-error Environment factories require their renderer argument.
WebGLEnvironments();
// @ts-expect-error Environment factories must return disposal as well as conversion.
new WebGLRenderer({ createEnvironments: () => ({ get: () => null }) });
// @ts-expect-error Environment factories cannot return non-texture results.
new WebGLRenderer({ createEnvironments: () => ({ get: () => 1, dispose() {} }) });
// @ts-expect-error Environment factories cannot require a string renderer.
new WebGLRenderer({ createEnvironments: (renderer: string) => environments });
// @ts-expect-error Conversion accepts textures, not pixel buffers.
environments.get(pixels);
// @ts-expect-error PMREM selection is boolean.
environments.get(texture, "blurred");
// @ts-expect-error Returned environments retain Texture methods.
convertedEnvironment?.transformUv([0, 1]);
// @ts-expect-error Disposal takes no renderer or texture arguments.
environments.dispose(texture);
// @ts-expect-error Cube dimensions are numeric.
new WebGLCubeRenderTarget("256");
// @ts-expect-error Cube target options are checked, not arbitrary option bags.
new WebGLCubeRenderTarget(256, { generateMipmaps: "yes" });
// @ts-expect-error Cube target texture filters are numeric.
new WebGLCubeRenderTarget(256, { minFilter: "linear" });
// @ts-expect-error Cube target options reject unknown fields.
new WebGLCubeRenderTarget(256, { unknownOption: true });
// @ts-expect-error Cube textures cannot be replaced with 2D textures.
cubeTarget.texture = texture;
// @ts-expect-error Equirectangular conversion requires a renderer.
cubeTarget.fromEquirectangularTexture({}, texture);
// @ts-expect-error Equirectangular conversion requires a texture.
cubeTarget.fromEquirectangularTexture(renderer, pixels);
// @ts-expect-error Clear masks are boolean.
cubeTarget.clear(renderer, "yes");
// @ts-expect-error Cube cameras require cube render targets.
new CubeCamera(0.1, 100, texture);
// @ts-expect-error Only the internal PMREM camera can temporarily lack a target.
new CubeCamera(0.1, 100, null);
// @ts-expect-error Cube camera updates require renderable objects.
cubeCamera.update(renderer, texture);
// @ts-expect-error Cube camera updates require a renderer.
cubeCamera.update({}, scene);
// @ts-expect-error PMREM constructors require the renderer.
new PMREMGenerator();
// @ts-expect-error PMREM constructors reject untyped renderer substitutes.
new PMREMGenerator({});
// @ts-expect-error Scene captures require a scene, not a texture.
generator.fromScene(texture);
// @ts-expect-error Scene blur is numeric.
generator.fromScene(scene, "soft");
// @ts-expect-error PMREM capture size is numeric.
generator.fromScene(scene, 0, 0.1, 100, { size: "256" });
// @ts-expect-error PMREM capture position is a Vector3.
generator.fromScene(scene, 0, 0.1, 100, { position: [0, 0, 0] });
// @ts-expect-error PMREM conversion requires a texture.
generator.fromEquirectangular(pixels);
// @ts-expect-error Reused PMREM output must be a cube render target.
generator.fromCubemap(cubeTexture, texture);
// @ts-expect-error Roughness conversion takes numeric mip levels.
PMREMGenerator.lodToRoughness("1", 5);
// @ts-expect-error Texture PMREM updates use a boolean setter.
texture.needsPMREMUpdate = 1;
// @ts-expect-error Texture PMREM version remains numeric.
texture.pmremVersion = "1";
// @ts-expect-error PMREM marker remains boolean.
texture.isPMREMTexture = "yes";
// @ts-expect-error Basic environment maps are textures.
new MeshBasicMaterial({ envMap: pixels });
// @ts-expect-error Basic environment rotation is Euler state.
new MeshBasicMaterial({ envMapRotation: [0, 1, 0] });
// @ts-expect-error Basic reflectivity is numeric.
new MeshBasicMaterial({ reflectivity: "bright" });
// @ts-expect-error Basic refraction ratio is numeric.
new MeshBasicMaterial({ refractionRatio: false });

// @ts-expect-error A factory must return the complete background lifecycle.
new WebGLRenderer({ createBackground: () => ({ render() {} }) });
// @ts-expect-error A factory receives a renderer, not a string.
new WebGLRenderer({ createBackground: (renderer: string) => WebGLBackground });
// @ts-expect-error Scene backgrounds are colors or textures, not color strings.
scene.background = "navy";
// @ts-expect-error Background intensity is numeric.
scene.backgroundIntensity = "bright";
// @ts-expect-error Background blurriness is numeric.
scene.backgroundBlurriness = true;
// @ts-expect-error Background rotation requires Euler state.
scene.backgroundRotation = [0, 1, 0];
// @ts-expect-error Plane dimensions are numeric.
new PlaneGeometry("2", 2);
// @ts-expect-error Shader sources are strings.
new ShaderMaterial({ vertexShader: 1 });
// @ts-expect-error Shader uniforms retain value containers.
new ShaderMaterial({ uniforms: { time: 1 } });
// @ts-expect-error Shader uniform assignments retain value containers.
custom.uniforms.time = 1;
// @ts-expect-error Shader clone retains its material-specific fields.
customClone.uniformsNeedUpdate = "yes";
// @ts-expect-error Shader defines are scalar preprocessor values.
new ShaderMaterial({ defines: { TEST: {} } });

// @ts-expect-error Sky colors are Color instances, strings or numbers.
new HemisphereLight([1, 1, 1]);
// @ts-expect-error Ground colors have the same color contract.
new HemisphereLight("white", {});
// @ts-expect-error Light intensity is numeric.
new HemisphereLight("white", "black", "bright");
// @ts-expect-error Light position retains Object3D's vector contract.
light.position.set("1", 0, 0);
// @ts-expect-error Light color is not an untyped option bag.
light.color = "red";
// @ts-expect-error Emissive intensity is numeric.
new MeshLambertMaterial({ emissiveIntensity: "bright" });
// @ts-expect-error Emissive colors are not arrays.
new MeshLambertMaterial({ emissive: [1, 0, 0] });
// @ts-expect-error Normal scaling requires a Vector2.
new MeshLambertMaterial({ normalScale: [1, 1] });
// @ts-expect-error Normal maps are textures, not pixel buffers.
new MeshLambertMaterial({ normalMap: pixels });
// @ts-expect-error Flat shading is boolean.
new MeshLambertMaterial({ flatShading: "yes" });
// @ts-expect-error Both shader stages are required.
renderer.shaders = { MeshLambertMaterial: { uniforms: {}, vertexShader: "" } };
new WebGLRenderer({
  shaders: {
    MeshLambertMaterial: {
      vertexShader: "",
      fragmentShader: "",
      uniforms: {
        // @ts-expect-error Shader uniforms are value containers.
        diffuse: 1,
      },
    },
  },
});

// @ts-expect-error Pixel data must be a typed array, not an ordinary array.
new DataTexture([255, 0, 0, 255], 1, 1);
// @ts-expect-error Texture dimensions are numeric.
new DataTexture(pixels, "2", 2);
// @ts-expect-error Texture format is numeric.
new DataTexture(pixels, 2, 2, "RGBA");
new DataTexture(
  pixels,
  2,
  2,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  // @ts-expect-error Color space is a string.
  1,
);
// @ts-expect-error Image data retains its typed-array contract after construction.
texture.image.data = [255, 0, 0, 255];
// @ts-expect-error Image dimensions remain numeric.
texture.image.width = "2";
// @ts-expect-error UV transformation requires a Vector2.
texture.transformUv([0.5, 0.5]);
// @ts-expect-error Texture updates use a boolean flag.
texture.needsUpdate = "yes";
// @ts-expect-error A map is a texture, not its raw pixel buffer.
new MeshBasicMaterial({ map: pixels });

// @ts-expect-error Coordinates are numeric, not strings.
new Vector3("1", 2, 3);
// @ts-expect-error Camera field of view is numeric.
new PerspectiveCamera("50", 1, 0.1, 100);
// @ts-expect-error A material is explicitly required; the port has no default material dependency.
new Mesh(geometry);
// @ts-expect-error A scalar is not a material.
new Mesh(geometry, 7);
// @ts-expect-error Material wireframe is boolean.
new MeshBasicMaterial({ wireframe: "yes" });
// @ts-expect-error Canvas dimensions are numeric.
renderer.setSize("640", 480);
// @ts-expect-error A renderer requires a camera, not a vector.
renderer.render(scene, v);
void forbiddenRoot;

const interleaved = new InterleavedBuffer(new Int16Array(18), 6);
const interleavedPosition = new InterleavedBufferAttribute(interleaved, 3, 0, true);
const cloneData: InterleavedBufferCloneData = {};
const serializationData: InterleavedBufferSerializationData = {};
const interleavedClone: InterleavedBufferAttribute = interleavedPosition.clone(cloneData);
const deinterleaved: BufferAttribute = interleavedPosition.clone();
const normalized: boolean = interleavedPosition.normalized;
interleaved.toJSON(serializationData);
interleavedPosition.toJSON(serializationData);
interleaved.addUpdateRange(0, 3);
interleavedPosition.needsUpdate = true;
new Vector3().fromBufferAttribute(interleavedPosition, 0);
new Vector2().fromBufferAttribute(interleavedPosition, 0);
new Vector4().fromBufferAttribute(interleavedPosition, 0);
new Color().fromBufferAttribute(interleavedPosition, 0);
geometry.setAttribute("position", interleavedPosition);
const instancedAttribute: InstancedBufferAttribute = new InstancedBufferAttribute(new Float32Array(6), 3).clone();
const instancedBuffer: InstancedInterleavedBuffer = new InstancedInterleavedBuffer(new Float32Array(6), 3, 2).clone({});
const instancedGeometry: InstancedBufferGeometry = new InstancedBufferGeometry().clone();
declare const nativeBuffer: WebGLBuffer;
const nativeAttribute: GLBufferAttribute = new GLBufferAttribute(nativeBuffer, 5126, 3, 4, 2)
  .setBuffer(nativeBuffer)
  .setCount(3);
geometry.setAttribute("native", nativeAttribute);
const maybeAttribute: BufferAttribute | InterleavedBufferAttribute | GLBufferAttribute | undefined =
  geometry.getAttribute("native");
const raycaster = new Raycaster();
raycaster.setFromCamera(new Vector2(), camera);
raycaster.setFromCamera(new Vector2(), new OrthographicCamera());
raycaster.set(v, v);
raycaster.params.Line.threshold = 0.5;
const hits: Intersection[] = [];
const hit: Intersection | undefined = raycaster.intersectObject(mesh, true, hits)[0];
if (hit) {
  const distance: number = hit.distance;
  const point: Vector3 = hit.point;
  const hitObject: Object3D = hit.object;
  const uv: Vector2 | undefined = hit.uv;
  void [distance, point, hitObject, uv];
}
const customPickObject = new Object3D();
customPickObject.raycast = (_ray: Raycaster, target: Intersection[]) => {
  target.push({ distance: 1, object: customPickObject, point: new Vector3() });
  return false;
};
new Box2().expandByPoint(new Vector2());
new Line3(v, v).closestPointToPoint(v, true, new Vector3());
new Matrix2().set(1, 2, 3, 4);
new Vector3().setFromSpherical(new Spherical()).setFromCylindrical(new Cylindrical());
void [
  interleavedClone,
  deinterleaved,
  normalized,
  instancedAttribute,
  instancedBuffer,
  instancedGeometry,
  maybeAttribute,
];

// @ts-expect-error Interleaved storage must be a typed array.
new InterleavedBuffer([0, 1, 2], 3);
// @ts-expect-error Instanced attributes must not erase their typed-array contract.
new InstancedBufferAttribute([0, 1, 2], 3);
// @ts-expect-error Normalization is boolean.
new InterleavedBufferAttribute(interleaved, 3, 0, "yes");
// @ts-expect-error Update ranges are numeric.
interleaved.addUpdateRange("0", 3);
// @ts-expect-error Native VBOs are objects, not numeric handles.
new GLBufferAttribute(1, 5126, 3, 4, 2);
// @ts-expect-error Shared interleaved clones require a metadata owner.
interleaved.clone();
// @ts-expect-error Picking requires a scene object.
raycaster.intersectObject(v);
// @ts-expect-error Intersection distance is numeric.
hits.push({ distance: "1", point: v, object: mesh });
// @ts-expect-error Raycast thresholds remain numeric.
raycaster.params.Points.threshold = "1";
// @ts-expect-error The WebXR entry point is excluded.
raycaster.setFromXRController(mesh);
// @ts-expect-error Matrix elements are numeric.
new Matrix2(1, 2, "3", 4);

const capsule = new CapsuleGeometry(1, 2, 4, 8, 3);
const circle = new CircleGeometry(2, 16, 0.2, Math.PI);
const cone = new ConeGeometry(2, 3, 16, 2, true, 0.2, Math.PI);
const cylinder = new CylinderGeometry(1, 2, 3, 16, 2, false, 0.2, Math.PI);
const dodecahedron = new DodecahedronGeometry(2, 1);
const edges = new EdgesGeometry(new BufferGeometry(), 30);
const icosahedron = new IcosahedronGeometry(2, 1);
const lathe = new LatheGeometry([new Vector2(1, -1), new Vector3(2, 1, 0)], 16, 0.2, Math.PI);
const octahedron = new OctahedronGeometry(2, 1);
const polyhedron = new PolyhedronGeometry([1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 1, 2], 2, 1);
const ring = new RingGeometry(1, 2, 16, 2, 0.2, Math.PI);
const sphere = new SphereGeometry(2, 16, 8, 0.2, Math.PI, 0.3, Math.PI / 2);
const tetrahedron = new TetrahedronGeometry(2, 1);
const torus = new TorusGeometry(2, 0.5, 8, 16, Math.PI, 0.2, Math.PI / 2);
const torusKnot = new TorusKnotGeometry(2, 0.5, 16, 8, 2, 3);
const wireframe = new WireframeGeometry(new BufferGeometry());
new EdgesGeometry(null);
new WireframeGeometry(null);
new LatheGeometry([
  { x: 1, y: -1 },
  { x: 2, y: 1 },
]);

const capsuleCopy: CapsuleGeometry = capsule.clone().copy(CapsuleGeometry.fromJSON(capsule.parameters));
const circleCopy: CircleGeometry = circle.clone().copy(CircleGeometry.fromJSON(circle.parameters));
const coneCopy: ConeGeometry = cone.clone().copy(ConeGeometry.fromJSON(cone.parameters));
const cylinderCopy: CylinderGeometry = cylinder.clone().copy(CylinderGeometry.fromJSON(cylinder.parameters));
const dodecahedronCopy: DodecahedronGeometry = dodecahedron
  .clone()
  .copy(DodecahedronGeometry.fromJSON(dodecahedron.parameters));
const edgesCopy: EdgesGeometry = edges.clone().copy(edges);
const icosahedronCopy: IcosahedronGeometry = icosahedron
  .clone()
  .copy(IcosahedronGeometry.fromJSON(icosahedron.parameters));
const latheCopy: LatheGeometry = lathe.clone().copy(LatheGeometry.fromJSON(lathe.parameters));
const octahedronCopy: OctahedronGeometry = octahedron.clone().copy(OctahedronGeometry.fromJSON(octahedron.parameters));
const polyhedronCopy: PolyhedronGeometry = polyhedron.clone().copy(PolyhedronGeometry.fromJSON(polyhedron.parameters));
const ringCopy: RingGeometry = ring.clone().copy(RingGeometry.fromJSON(ring.parameters));
const sphereCopy: SphereGeometry = sphere.clone().copy(SphereGeometry.fromJSON(sphere.parameters));
const tetrahedronCopy: TetrahedronGeometry = tetrahedron
  .clone()
  .copy(TetrahedronGeometry.fromJSON(tetrahedron.parameters));
const torusCopy: TorusGeometry = torus.clone().copy(TorusGeometry.fromJSON(torus.parameters));
const torusKnotCopy: TorusKnotGeometry = torusKnot.clone().copy(TorusKnotGeometry.fromJSON(torusKnot.parameters));
const wireframeCopy: WireframeGeometry = wireframe.clone().copy(wireframe);
const jsonLathe: LatheGeometry = LatheGeometry.fromJSON({
  points: [
    { x: 1, y: -1 },
    { x: 2, y: 1 },
  ],
  segments: 16,
  phiStart: 0,
  phiLength: Math.PI,
});
const geometryScalars: number[] = [
  capsule.parameters.radius,
  capsule.parameters.height,
  capsule.parameters.capSegments,
  capsule.parameters.radialSegments,
  capsule.parameters.heightSegments,
  circle.parameters.radius,
  circle.parameters.segments,
  circle.parameters.thetaStart,
  circle.parameters.thetaLength,
  cone.parameters.radius,
  cone.parameters.height,
  cone.parameters.radialSegments,
  cone.parameters.heightSegments,
  cone.parameters.thetaStart,
  cone.parameters.thetaLength,
  cylinder.parameters.height,
  cylinder.parameters.radialSegments,
  cylinder.parameters.heightSegments,
  cylinder.parameters.thetaStart,
  cylinder.parameters.thetaLength,
  dodecahedron.parameters.radius,
  dodecahedron.parameters.detail,
  edges.parameters.thresholdAngle,
  icosahedron.parameters.radius,
  icosahedron.parameters.detail,
  lathe.parameters.points[0].x,
  lathe.parameters.points[0].y,
  lathe.parameters.segments,
  lathe.parameters.phiStart,
  lathe.parameters.phiLength,
  octahedron.parameters.radius,
  octahedron.parameters.detail,
  polyhedron.parameters.radius,
  polyhedron.parameters.detail,
  ring.parameters.innerRadius,
  ring.parameters.outerRadius,
  ring.parameters.thetaSegments,
  ring.parameters.phiSegments,
  ring.parameters.thetaStart,
  ring.parameters.thetaLength,
  sphere.parameters.radius,
  sphere.parameters.widthSegments,
  sphere.parameters.heightSegments,
  sphere.parameters.phiStart,
  sphere.parameters.phiLength,
  sphere.parameters.thetaStart,
  sphere.parameters.thetaLength,
  tetrahedron.parameters.radius,
  tetrahedron.parameters.detail,
  torus.parameters.radius,
  torus.parameters.tube,
  torus.parameters.radialSegments,
  torus.parameters.tubularSegments,
  torus.parameters.arc,
  torus.parameters.thetaStart,
  torus.parameters.thetaLength,
  torusKnot.parameters.radius,
  torusKnot.parameters.tube,
  torusKnot.parameters.tubularSegments,
  torusKnot.parameters.radialSegments,
  torusKnot.parameters.p,
  torusKnot.parameters.q,
];
const geometryFlags: boolean[] = [cone.parameters.openEnded, cylinder.parameters.openEnded];
const cylinderRadii: (number | undefined)[] = [cylinder.parameters.radiusTop, cylinder.parameters.radiusBottom];
const polyhedronVertices: number[] | undefined = polyhedron.parameters.vertices;
const polyhedronIndices: number[] | undefined = polyhedron.parameters.indices;
const edgeSource: BufferGeometry | null = edges.parameters.geometry;
const wireframeSource: BufferGeometry | null = wireframe.parameters.geometry;
void [
  capsuleCopy,
  circleCopy,
  coneCopy,
  cylinderCopy,
  dodecahedronCopy,
  edgesCopy,
  icosahedronCopy,
  latheCopy,
  octahedronCopy,
  polyhedronCopy,
  ringCopy,
  sphereCopy,
  tetrahedronCopy,
  torusCopy,
  torusKnotCopy,
  wireframeCopy,
  jsonLathe,
  geometryScalars,
  geometryFlags,
  cylinderRadii,
  polyhedronVertices,
  polyhedronIndices,
  edgeSource,
  wireframeSource,
];

// @ts-expect-error Capsule height segments are numeric.
new CapsuleGeometry(1, 2, 4, 8, "3");
// @ts-expect-error Circle angular lengths are numeric.
new CircleGeometry(1, 16, 0, "full");
// @ts-expect-error Cone end-cap selection is boolean.
new ConeGeometry(1, 2, 8, 1, 1);
// @ts-expect-error Cylinder end-cap selection is boolean.
new CylinderGeometry(1, 1, 2, 8, 1, "false");
// @ts-expect-error Dodecahedron detail is numeric.
new DodecahedronGeometry(1, "1");
// @ts-expect-error Edge sources must be buffer geometries.
new EdgesGeometry(mesh);
// @ts-expect-error Edge thresholds are numeric.
new EdgesGeometry(geometry, "30");
// @ts-expect-error Icosahedron radii are numeric.
new IcosahedronGeometry("1");
// @ts-expect-error Lathe points require numeric coordinates.
new LatheGeometry([{ x: "1", y: 0 }]);
// @ts-expect-error Lathe points are coordinate objects, not flat scalar arrays.
new LatheGeometry([1, 2]);
// @ts-expect-error Octahedron detail is numeric.
new OctahedronGeometry(1, false);
// @ts-expect-error Polyhedron vertex arrays contain numbers.
new PolyhedronGeometry(["1", 0, 0], [0]);
// @ts-expect-error Polyhedron index arrays contain numbers.
new PolyhedronGeometry([1, 0, 0], ["0"]);
// @ts-expect-error Ring segment counts are numeric.
new RingGeometry(1, 2, "16");
// @ts-expect-error Sphere angular ranges are numeric.
new SphereGeometry(1, 16, 8, 0, Math.PI, 0, false);
// @ts-expect-error Tetrahedron radii are numeric.
new TetrahedronGeometry("1");
// @ts-expect-error Torus cross-section starts are numeric.
new TorusGeometry(1, 0.4, 8, 16, Math.PI, "0");
// @ts-expect-error Torus cross-section lengths are numeric.
new TorusGeometry(1, 0.4, 8, 16, Math.PI, 0, "full");
// @ts-expect-error Torus knot winding counts are numeric.
new TorusKnotGeometry(1, 0.4, 16, 8, 2, "3");
// @ts-expect-error Wireframe sources must be buffer geometries.
new WireframeGeometry([0, 1, 2]);
// @ts-expect-error Geometry copies require the geometry's parameter contract.
circle.copy(new BufferGeometry());
// @ts-expect-error Cone parameters do not retain cylinder radii.
void cone.parameters.radiusTop;
// @ts-expect-error Platonic solid parameters do not retain polyhedron input arrays.
void dodecahedron.parameters.vertices;
// @ts-expect-error Capsule JSON height segments remain numeric.
CapsuleGeometry.fromJSON({ ...capsule.parameters, heightSegments: "3" });
// @ts-expect-error Cone JSON end-cap selection remains boolean.
ConeGeometry.fromJSON({ ...cone.parameters, openEnded: "true" });
// @ts-expect-error Lathe JSON points retain numeric coordinates.
LatheGeometry.fromJSON({ ...lathe.parameters, points: [{ x: 1, y: "0" }] });
// @ts-expect-error Polyhedron JSON indices retain numeric array elements.
PolyhedronGeometry.fromJSON({ ...polyhedron.parameters, indices: ["0"] });
// @ts-expect-error Torus JSON cross-section lengths remain numeric.
TorusGeometry.fromJSON({ ...torus.parameters, thetaLength: "full" });

const curves2D: Curve<Vector2>[] = [
  new ArcCurve(),
  new EllipseCurve(),
  new LineCurve(),
  new QuadraticBezierCurve(),
  new CubicBezierCurve(),
  new SplineCurve([new Vector2(), new Vector2(1, 1)]),
];
const curves3D: Curve<Vector3>[] = [
  new LineCurve3(),
  new QuadraticBezierCurve3(),
  new CubicBezierCurve3(),
  new CatmullRomCurve3([new Vector3(), new Vector3(1, 1, 1)], false, "centripetal", 0.5),
];
const point2D: Vector2 = curves2D[0].getPointAt(0.5, new Vector2());
const samples3D: Vector3[] = curves3D[0].getSpacedPoints(12);
const tangent3D: Vector3 = curves3D[0].getTangent(0.5);
const curveFrames: Vector3[] = curves3D[0].computeFrenetFrames(12).normals;
const curvePath = new CurvePath<Vector3>();
curvePath.add(new LineCurve3());
const maybePoint: Vector3 | null = curvePath.getPoint(0.5);
const shapePath = new ShapePath().moveTo(0, 0).lineTo(0, 1).lineTo(1, 0).lineTo(0, 0);
const shapesFromPaths: Shape[] = shapePath.toShapes();
const shape = new Shape([new Vector2(0, 0), new Vector2(0, 1), new Vector2(1, 0)]);
shape.holes.push(new Path());
const shapeCopy: Shape = shape.clone().copy(shape);
const contourPoints: Vector2[] = shape.extractPoints(12).shape;
const createCurve2D: CurveFactory<Vector2> = (json) => {
  if (json.type === "LineCurve") return new LineCurve().fromJSON(json);
  if (json.type === "Path") return new Path().fromJSON(json, createCurve2D);
  throw new Error(`Unsupported curve: ${json.type}`);
};
const createCurve3D: CurveFactory<Vector3> = (json) => {
  if (json.type === "LineCurve3") return new LineCurve3().fromJSON(json);
  if (json.type === "CurvePath") return new CurvePath<Vector3>().fromJSON(json, createCurve3D);
  throw new Error(`Unsupported curve: ${json.type}`);
};
const curveJSON: CurveJSON = curves2D[0].toJSON();
new Shape().fromJSON(shape.toJSON(), createCurve2D);
const tube = new TubeGeometry(curvePath, 12, 0.2, 8, false);
const tubeCopy: TubeGeometry = tube.clone().copy(tube);
TubeGeometry.fromJSON(tube.toJSON(), createCurve3D);
const extrudeOptions: ExtrudeGeometryOptions = {
  steps: 4,
  depth: 0.5,
  bevelEnabled: true,
  bevelOffset: 0.1,
  extrudePath: curves3D[0],
  UVGenerator: {
    generateTopUV(_geometry, vertices, a, b, c) {
      return [a, b, c].map((i) => new Vector2(vertices[i * 3], vertices[i * 3 + 1]));
    },
    generateSideWallUV(_geometry, vertices, a, b, c, d) {
      return [a, b, c, d].map((i) => new Vector2(vertices[i * 3], vertices[i * 3 + 2]));
    },
  },
};
const extrusion = new ExtrudeGeometry([shape], extrudeOptions);
const extrusionCopy: ExtrudeGeometry = extrusion.clone().copy(extrusion);
ExtrudeGeometry.fromJSON(extrusion.toJSON(), { [shape.uuid]: shape }, createCurve3D);
const shapeGeometry = new ShapeGeometry([shape], 8);
const shapeGeometryCopy: ShapeGeometry = shapeGeometry.clone().copy(shapeGeometry);
ShapeGeometry.fromJSON(shapeGeometry.toJSON(), { [shape.uuid]: shape });
const triangleIndices: number[][] = ShapeUtils.triangulateShape(contourPoints, []);
const earcutIndices: number[] = Earcut.triangulate([0, 0, 1, 0, 0, 1], []);
void [
  point2D,
  samples3D,
  tangent3D,
  curveFrames,
  maybePoint,
  shapesFromPaths,
  shapeCopy,
  curveJSON,
  tubeCopy,
  extrusionCopy,
  shapeGeometryCopy,
  triangleIndices,
  earcutIndices,
];
// @ts-expect-error Two-dimensional curve targets cannot be three-dimensional.
curves2D[0].getPoint(0.5, new Vector3());
// @ts-expect-error Three-dimensional curve targets cannot be two-dimensional.
curves3D[0].getPoint(0.5, new Vector2());
// @ts-expect-error A path can return null when empty or sampled out of range.
const requiredPoint: Vector3 = curvePath.getPoint(0.5);
void requiredPoint;
// @ts-expect-error Paths cannot mix curve dimensions.
curvePath.add(new LineCurve());
// @ts-expect-error Shape contours are two-dimensional.
new Shape([new Vector3()]);
// @ts-expect-error Tube paths must be three-dimensional.
new TubeGeometry(new LineCurve());
// @ts-expect-error Extrusion paths must be three-dimensional.
new ExtrudeGeometry(shape, { extrudePath: new LineCurve() });
// @ts-expect-error Extrusion options have checked numeric values.
new ExtrudeGeometry(shape, { bevelSize: "wide" });
// @ts-expect-error Extrusion options reject misspelled options.
new ExtrudeGeometry(shape, { bevelSegment: 3 });
// @ts-expect-error Custom UV callbacks must produce vectors.
new ExtrudeGeometry(shape, { UVGenerator: { generateTopUV: () => [0, 1], generateSideWallUV: () => [] } });
// @ts-expect-error Catmull-Rom interpolation modes are explicit.
new CatmullRomCurve3([], false, "linear");
// @ts-expect-error Composite deserialization requires caller-selected curves.
new Path().fromJSON(shape.toJSON());
// @ts-expect-error Tube deserialization requires caller-selected curves.
TubeGeometry.fromJSON(tube.toJSON());
// @ts-expect-error Tube factories must return a three-dimensional curve.
TubeGeometry.fromJSON(tube.toJSON(), createCurve2D);
// @ts-expect-error Shape UUID lookup must contain shapes.
ShapeGeometry.fromJSON(shapeGeometry.toJSON(), { invalid: new Path() });
// @ts-expect-error Serialized shape references are UUIDs, not instances.
ShapeGeometry.fromJSON({ shapes: [shape] }, { [shape.uuid]: shape });

scene.fog = new Fog("steelblue", 1, 20);
scene.fog = new FogExp2(new Color(0x123456), 0.05);
const fogCopy: FogExp2 = scene.fog.clone();
scene.fog = null;
const timer = new Timer();
timer.connect(document);
timer.setTimescale(0.5).update();
timer.update(1000).reset();
const seconds: number = timer.getElapsed() + timer.getDelta() + new Clock(false).getDelta();
timer.disconnect();
timer.dispose();
const colorUniform = new Uniform(new Vector3());
const uniformCopy: Uniform<Vector3> = colorUniform.clone();
const typedScalar = new Uniform(2);
typedScalar.type = "int";
const uniformGroup = new UniformsGroup().setName("Frame").setUsage(BufferUsage.DynamicDraw);
uniformGroup
  .add(colorUniform)
  .add([new Uniform(1), typedScalar])
  .remove(colorUniform);
const uniformGroupCopy: UniformsGroup = uniformGroup.clone();
new ShaderMaterial({ uniformsGroups: [uniformGroup], uniforms: { tint: colorUniform } });
new RawShaderMaterial({ uniformsGroups: [uniformGroupCopy] });
void [fogCopy, seconds, uniformCopy];
// @ts-expect-error Fog ranges are numeric.
new Fog(0x123456, "near", 20);
// @ts-expect-error Exponential density is numeric.
new FogExp2(0x123456, "dense");
// @ts-expect-error A color alone is not a fog object.
scene.fog = new Color();
// @ts-expect-error Visibility tracking needs a document, not a window.
timer.connect(window);
// @ts-expect-error Time is measured with numeric timestamps.
timer.update("now");
// @ts-expect-error Clock autoStart is boolean.
new Clock(1);
// @ts-expect-error Uniform values retain their inferred type.
colorUniform.value = 3;
// @ts-expect-error UBO scalar storage uses float, int or uint.
typedScalar.type = "double";
// @ts-expect-error Groups contain Uniform instances, not raw values.
uniformGroup.add(new Vector3());
// @ts-expect-error Material UBOs require UniformsGroup instances.
new ShaderMaterial({ uniformsGroups: [colorUniform] });

const dashedParameters: LineDashedMaterialParameters = { color: "red", dashSize: 0.2, gapSize: 0.1, scale: 2 };
const lineMaterial = new LineBasicMaterial({ color: 0xff0000, linewidth: 1, fog: true });
const dashedMaterial = new LineDashedMaterial(dashedParameters);
const pointMaterial = new PointsMaterial({ color: new Color(), size: 3, sizeAttenuation: false, map: texture });
const spriteMaterial = new SpriteMaterial({ rotation: Math.PI / 4, sizeAttenuation: true, transparent: true });
const typedLine: Line = new Line(geometry, lineMaterial).computeLineDistances().clone();
const typedLoop: LineLoop = new LineLoop(geometry, [lineMaterial]).computeLineDistances().clone(false);
const typedSegments: LineSegments = new LineSegments(geometry, dashedMaterial).computeLineDistances().clone();
const typedPoints: Points = new Points(geometry, [pointMaterial]).clone();
const typedSprite: Sprite = new Sprite(spriteMaterial).clone();
typedLine.copy(typedLoop);
typedPoints.copy(new Points(geometry, pointMaterial), false);
typedSprite.copy(new Sprite(spriteMaterial));
typedSprite.center.set(0.2, 0.8);
typedSprite.material.rotation = 0.5;
typedLine.updateMorphTargets();
typedPoints.updateMorphTargets();
const lineMorphs: Record<string, number> | undefined = typedLine.morphTargetDictionary;
const pointMorphs: number[] | undefined = typedPoints.morphTargetInfluences;
const objectRaycaster = new Raycaster();
objectRaycaster.setFromCamera(new Vector2(), camera);
objectRaycaster.params.Line.threshold = 0.1;
objectRaycaster.params.Points.threshold = 0.2;
const objectHits: Intersection[] = [];
typedLine.raycast(objectRaycaster, objectHits);
typedPoints.raycast(objectRaycaster, objectHits);
typedSprite.raycast(objectRaycaster, objectHits);
const pickedVertex: number | undefined = objectHits[0]?.index;
const pickedUv: Vector2 | undefined = objectHits[0]?.uv;
const pickedFace: number | null | undefined = objectHits[0]?.faceIndex;
const clonedDashed: LineDashedMaterial = dashedMaterial.clone().copy(dashedMaterial);
const clonedPointsMaterial: PointsMaterial = pointMaterial.clone().copy(pointMaterial);
const clonedSpriteMaterial: SpriteMaterial = spriteMaterial.clone().copy(spriteMaterial);
new WebGLRenderer({
  shaders: {
    LineBasicMaterial: basicShader,
    LineDashedMaterial: dashedShader,
    PointsMaterial: pointsShader,
    SpriteMaterial: spriteShader,
  },
});
void [
  typedSegments,
  lineMorphs,
  pointMorphs,
  pickedVertex,
  pickedUv,
  pickedFace,
  clonedDashed,
  clonedPointsMaterial,
  clonedSpriteMaterial,
];
// @ts-expect-error Geometry and material must be explicit.
new Line();
// @ts-expect-error Inherited line constructors also require material.
new LineLoop(geometry);
// @ts-expect-error Segment geometry cannot be omitted.
new LineSegments(undefined, dashedMaterial);
// @ts-expect-error Points require material.
new Points(geometry);
// @ts-expect-error Sprites require material.
new Sprite();
// @ts-expect-error Sprite material arrays are unsupported.
new Sprite([spriteMaterial]);
// @ts-expect-error Geometry is not a material.
new Points(geometry, geometry);
// @ts-expect-error Dash lengths are numeric.
new LineDashedMaterial({ dashSize: "long" });
// @ts-expect-error Line colors must be Color, string or number.
new LineBasicMaterial({ color: false });
// @ts-expect-error Point sizing is numeric.
new PointsMaterial({ size: "large" });
// @ts-expect-error Sprite rotation is numeric.
new SpriteMaterial({ rotation: "quarter" });
// @ts-expect-error Morph influence values remain numeric.
typedPoints.morphTargetInfluences = ["one"];
// @ts-expect-error Morph dictionaries map names to numeric indices.
typedLine.morphTargetDictionary = { smile: "first" };
// @ts-expect-error Raycasts require a Raycaster.
typedSprite.raycast(camera, objectHits);
// @ts-expect-error Copy requires the corresponding object, not a geometry.
typedPoints.copy(geometry);
// @ts-expect-error Sprite instance counts are a removed WebGPU API.
void typedSprite.count;

const interpolatedUv: Vector2 | null = Triangle.getInterpolation(
  new Vector3(0.25, 0.25, 0),
  new Vector3(),
  new Vector3(1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector2(),
  new Vector2(1, 0),
  new Vector2(0, 1),
  new Vector2(),
);
const interpolatedPosition: Vector3 | null = new Triangle().getInterpolation(v, v, v, v, new Vector3());
void [interpolatedUv, interpolatedPosition];
// @ts-expect-error Interpolation can return null for a degenerate triangle.
const requiredUv: Vector2 = interpolatedUv;
void requiredUv;

const instances = new InstancedMesh(geometry, material, 4);
const groupedInstances = new InstancedMesh(instancedGeometry, [material, litMaterial], 2);
const instancesAsMesh: Mesh = instances;
const instanceMatrix: InstancedBufferAttribute = instances.instanceMatrix;
const instanceColors: InstancedBufferAttribute | null = instances.instanceColor;
const instanceMorphTexture: DataTexture | null = instances.morphTexture;
const instanceBounds: Box3 | null = instances.boundingBox;
const instanceSphere: Sphere | null = instances.boundingSphere;
const instancedFlag: boolean = instances.isInstancedMesh;
const instanceTransform: Matrix4 = instances.getMatrixAt(0, new Matrix4());
const instanceTint: Color = instances.getColorAt(0, new Color());
const updatedInstances: InstancedMesh = instances.setMatrixAt(0, instanceTransform).setColorAt(0, instanceTint);
instances.instanceMatrix.setUsage(BufferUsage.DynamicDraw).addUpdateRange(0, 16);
instances.instanceMatrix.needsUpdate = true;
if (instances.instanceColor !== null) instances.instanceColor.needsUpdate = true;
instances.count = 0;
instances.computeBoundingBox();
instances.computeBoundingSphere();
instances.raycast(objectRaycaster, objectHits);
const pickedInstance: number | undefined = objectHits[0]?.instanceId;
const instanceClone: InstancedMesh = instances.clone(false).copy(groupedInstances);
class TypedInstances extends InstancedMesh {
  label: string = "cluster";
}
const subtypeInstances = new TypedInstances(geometry, material, 2);
const subtypeClone: TypedInstances = subtypeInstances.clone();
const subtypeCopy: TypedInstances = subtypeInstances.copy(instances, false);
const subtypeUpdate: TypedInstances = subtypeInstances.setMatrixAt(0, instanceTransform).setColorAt(0, instanceTint);
const morphSource = Object.assign(new Mesh(geometry, material), { morphTargetInfluences: [0.25, 0.5] });
const morphUpdate: TypedInstances = subtypeInstances.setMorphAt(0, morphSource);
subtypeInstances.getMorphAt(0, morphSource);
if (subtypeInstances.morphTexture !== null) subtypeInstances.morphTexture.needsUpdate = true;
scene.add(instances, groupedInstances, subtypeInstances);
instances.dispose();
void [
  instancesAsMesh,
  instanceMatrix,
  instanceColors,
  instanceMorphTexture,
  instanceBounds,
  instanceSphere,
  instancedFlag,
  updatedInstances,
  pickedInstance,
  instanceClone,
  subtypeClone,
  subtypeCopy,
  subtypeUpdate,
  morphUpdate,
];
// @ts-expect-error All instanced constructor arguments are required.
new InstancedMesh();
// @ts-expect-error Capacity is required even with explicit resources.
new InstancedMesh(geometry, material);
// @ts-expect-error Geometry cannot be implicit.
new InstancedMesh(undefined, material, 2);
// @ts-expect-error Material cannot be implicit.
new InstancedMesh(geometry, undefined, 2);
// @ts-expect-error Instance capacity is numeric.
new InstancedMesh(geometry, material, "2");
// @ts-expect-error Material arrays contain materials, not geometry.
new InstancedMesh(geometry, [geometry], 2);
// @ts-expect-error Active count remains numeric.
instances.count = "2";
// @ts-expect-error Matrix targets must be Matrix4.
instances.getMatrixAt(0, new Vector3());
// @ts-expect-error Color targets must be Color.
instances.getColorAt(0, 0xff0000);
// @ts-expect-error Matrix setters do not accept raw arrays.
instances.setMatrixAt(0, new Float32Array(16));
// @ts-expect-error Color setters require a Color, not a color representation.
instances.setColorAt(0, "red");
// @ts-expect-error Instance indices are numeric.
instances.setColorAt("0", instanceTint);
// @ts-expect-error Instance matrices cannot be nullable.
instances.instanceMatrix = null;
// @ts-expect-error Instance colors use instanced attributes, not ordinary vertex attributes.
instances.instanceColor = new BufferAttribute(new Float32Array(3), 3);
// @ts-expect-error Morph texture storage requires a DataTexture.
instances.morphTexture = new Texture();
// @ts-expect-error Morph inputs must guarantee initialized influences.
instances.setMorphAt(0, mesh);
// @ts-expect-error Morph targets must guarantee initialized influences.
instances.getMorphAt(0, mesh);
// @ts-expect-error Morph weights remain numeric.
new Mesh(geometry, material).morphTargetInfluences = ["one"];
// @ts-expect-error Copy requires instance buffers, not an ordinary Mesh.
instances.copy(mesh);
// @ts-expect-error Instanced raycasts require a Raycaster.
instances.raycast(camera, objectHits);
// @ts-expect-error instanceId does not widen to any.
const stringInstanceId: string | undefined = objectHits[0]?.instanceId;
void stringInstanceId;

const matrixFloat32: Float32Array = new Matrix4().toArray(new Float32Array(32), 16);
const matrixFloat64: Float64Array = new Matrix4().toArray(new Float64Array(16));
const matrixNumbers: number[] = new Matrix4().toArray();
const matrixNumberTarget: number[] = new Matrix4().toArray([], 2);
const colorFloat32: Float32Array = new Color().toArray(new Float32Array(6), 3);
const colorFloat64: Float64Array = new Color().toArray(new Float64Array(3));
const colorNumbers: number[] = new Color().toArray();
const colorNumberTarget: number[] = new Color().toArray([], 1);
new Matrix4().fromArray(matrixFloat32, 16).fromArray(matrixFloat64).fromArray(matrixNumbers);
new Color().fromArray(colorFloat32, 3).fromArray(colorFloat64).fromArray(colorNumbers);
void [matrixNumberTarget, colorNumberTarget];
// @ts-expect-error Matrix serialization preserves the specific typed-array target.
const matrixWrongArray: Float64Array = new Matrix4().toArray(new Float32Array(16));
// @ts-expect-error Color serialization preserves the specific typed-array target.
const colorWrongArray: Float32Array = new Color().toArray(new Float64Array(3));
// @ts-expect-error Matrix components must be numeric.
new Matrix4().fromArray(["1"]);
// @ts-expect-error Color components must be numeric.
new Color().fromArray(["red"]);
// @ts-expect-error Matrix output cannot store strings.
new Matrix4().toArray(["1"]);
// @ts-expect-error Color output cannot store strings.
new Color().toArray(["red"]);
// @ts-expect-error Matrix offsets are numeric.
new Matrix4().toArray(matrixFloat32, "0");
// @ts-expect-error Color offsets are numeric.
new Color().fromArray(colorFloat32, "0");
void [matrixWrongArray, colorWrongArray];

const batch = new BatchedMesh(8, 240, undefined, material);
const batchArrayMaterial = new BatchedMesh(4, 120, 240, [material]);
const batchGeometryId: number = batch.addGeometry(geometry, 30, 48);
const batchInstanceId: number = batch.addInstance(batchGeometryId);
const batchRange: BatchedMeshGeometryRange = batch.getGeometryRangeAt(batchGeometryId, {});
const batchCapacity: number = batch.maxInstanceCount;
const batchActive: number = batch.instanceCount;
const batchUnusedVertices: number = batch.unusedVertexCount;
const batchUnusedIndices: number = batch.unusedIndexCount;
const batchTransform: Matrix4 = batch.getMatrixAt(batchInstanceId, new Matrix4());
const batchColor: Color = batch.getColorAt(batchInstanceId, new Color());
const batchAlpha: Vector4 = batch.getColorAt(batchInstanceId, new Vector4());
batch
  .setMatrixAt(batchInstanceId, batchTransform)
  .setColorAt(batchInstanceId, batchColor)
  .setColorAt(batchInstanceId, batchAlpha);
batch.setVisibleAt(batchInstanceId, false).setGeometryIdAt(batchInstanceId, batchGeometryId);
const batchVisible: boolean = batch.getVisibleAt(batchInstanceId);
const batchGeometryIndex: number = batch.getGeometryIdAt(batchInstanceId);
const batchBox: Box3 | null = batch.getBoundingBoxAt(batchGeometryId, new Box3());
const batchSphere: Sphere | null = batch.getBoundingSphereAt(batchGeometryId, new Sphere());
const batchSort: BatchedMeshSortFunction = function (list, sortCamera) {
  void (this satisfies BatchedMesh);
  const entry: BatchedMeshDrawRange = list[0];
  const distance: number = entry.z;
  const typedCamera: Camera = sortCamera;
  list.sort((a, b) => a.z - b.z);
  void [distance, typedCamera];
};
batch.setCustomSort(batchSort).setCustomSort(null);
batch.customSort = (list, camera) => {
  list.reverse();
  camera.updateMatrixWorld();
};
batch.raycast(raycaster, objectHits);
const pickedBatch: number | undefined = objectHits[0]?.batchId;
batch.setInstanceCount(16);
batch.setGeometrySize(480, 960);
batch.setGeometryAt(batchGeometryId, geometry);
batch.deleteInstance(batchInstanceId).deleteGeometry(batchGeometryId).optimize();
const clonedBatch: BatchedMesh = batch.clone(false).copy(batchArrayMaterial, false);
class TypedBatch extends BatchedMesh {
  label: string = "batch";
}
const typedBatchClone: TypedBatch = new TypedBatch(1, 24, 36, material).clone();
batch.onBeforeRender(renderer, scene, camera, geometry, material);
batch.onBeforeShadow(renderer, mesh, camera, camera, geometry, material);
const lod = new LOD().addLevel(mesh).addLevel(batch, 10, 0.1);
const lodLevel: LODLevel = lod.levels[0];
const levelObject: Object3D = lodLevel.object;
const levelDistance: number = lodLevel.distance;
const levelHysteresis: number = lodLevel.hysteresis;
const currentLevel: number = lod.getCurrentLevel();
const selectedLevel: Object3D | null = lod.getObjectForDistance(10);
const removedLevel: boolean = lod.removeLevel(10);
lod.autoUpdate = false;
lod.update(camera);
lod.update(new OrthographicCamera());
lod.raycast(raycaster, objectHits);
class TypedLOD extends LOD {
  label: string = "detail";
}
const clonedLOD: TypedLOD = new TypedLOD().clone();
const copiedLOD: LOD = new LOD().copy(lod);
void [
  batchRange,
  batchCapacity,
  batchActive,
  batchUnusedVertices,
  batchUnusedIndices,
  batchVisible,
  batchGeometryIndex,
  batchBox,
  batchSphere,
  pickedBatch,
  clonedBatch,
  typedBatchClone,
  levelObject,
  levelDistance,
  levelHysteresis,
  currentLevel,
  selectedLevel,
  removedLevel,
  clonedLOD,
  copiedLOD,
];
// @ts-expect-error Explicit material is required.
new BatchedMesh(4, 24, 36);
// @ts-expect-error Undefined material cannot request a hidden default.
new BatchedMesh(4, 24, undefined, undefined);
// @ts-expect-error Capacity is numeric.
new BatchedMesh("4", 24, 36, material);
// @ts-expect-error Batch capacity is a getter, not mutable state.
batch.maxInstanceCount = 12;
// @ts-expect-error Batch geometry must be CPU geometry, not a material.
batch.addGeometry(material);
// @ts-expect-error Reserved capacities are numeric.
batch.addGeometry(geometry, "24");
// @ts-expect-error Geometry ranges retain numeric fields.
const stringBatchRange: string = batchRange.vertexStart;
// @ts-expect-error Range target fields cannot hold strings.
batch.getGeometryRangeAt(0, { start: "zero" });
// @ts-expect-error Color representations do not replace Color or Vector4.
batch.setColorAt(0, "red");
// @ts-expect-error Matrix setters require Matrix4.
batch.setMatrixAt(0, new Float32Array(16));
// @ts-expect-error Color target controls the result type.
const wrongBatchColor: Color = batch.getColorAt(0, new Vector4());
// @ts-expect-error Instance visibility is boolean.
batch.setVisibleAt(0, 1);
// @ts-expect-error Custom sorts receive draw ranges, not numeric IDs.
batch.setCustomSort((ids: number[]) => ids.reverse());
batch.setCustomSort((list) => {
  // @ts-expect-error Custom sort depth is numeric.
  const depth: string = list[0].z;
  void depth;
});
// @ts-expect-error Picking requires a Raycaster.
batch.raycast(camera, objectHits);
// @ts-expect-error Picking retains numeric batch IDs.
const stringBatchId: string | undefined = objectHits[0]?.batchId;
// @ts-expect-error LOD levels contain actual objects.
lod.addLevel(material);
// @ts-expect-error LOD distance must be numeric.
lod.addLevel(mesh, "10");
// @ts-expect-error Hysteresis must be numeric.
lod.addLevel(mesh, 10, "0.1");
// @ts-expect-error The level array is non-replaceable, matching upstream descriptor.
lod.levels = [];
// @ts-expect-error Level data is typed.
lod.levels.push({ object: mesh, distance: "10", hysteresis: 0 });
// @ts-expect-error Automatic updates use a boolean.
lod.autoUpdate = 0;
// @ts-expect-error LOD update requires a zoom-capable camera.
lod.update(new Camera());
// @ts-expect-error LOD picking requires intersections, not points.
lod.raycast(raycaster, [new Vector3()]);
void [stringBatchRange, wrongBatchColor, stringBatchId];

const ambientLight = new AmbientLight(new Color("white"), 0.25);
const ambientClone: AmbientLight = ambientLight.clone(false);
const ambientCopy: AmbientLight = ambientLight.copy(ambientClone, true);
const spotLight = new SpotLight(0xffffff, 4, 30, Math.PI / 4, 0.3, 2);
spotLight.power = Math.PI * 8;
const spotPower: number = spotLight.power;
spotLight.target = new Object3D();
const spotTarget: Object3D = spotLight.target;
spotLight.map = texture;
const spotCookie: Texture | null = spotLight.map;
spotLight.map = null;
const spotShadow: SpotLightShadow = spotLight.shadow;
const spotCamera: PerspectiveCamera = spotShadow.camera;
spotShadow.focus = 0.8;
spotShadow.aspect = 1.5;
spotShadow.mapSize.set(1024, 512);
spotShadow.updateMatrices(spotLight);
const spotClone: SpotLight = spotLight.clone(false);
const spotCopy: SpotLight = spotLight.copy(spotClone, true);
spotLight.copy(spotClone);
const spotShadowClone: SpotLightShadow = spotShadow.clone();
const spotShadowCopy: SpotLightShadow = spotShadow.copy(spotShadowClone);
const standaloneSpotShadow = new SpotLightShadow();
standaloneSpotShadow.updateMatrices(spotLight);
scene.add(ambientLight, spotLight, spotLight.target);
renderer.render(scene, camera);
spotLight.dispose();
standaloneSpotShadow.dispose();
// @ts-expect-error Ambient colors must be color representations.
new AmbientLight(texture);
// @ts-expect-error Ambient intensity is numeric.
new AmbientLight("white", "bright");
// @ts-expect-error Ambient copy requires a light, not a scene object.
ambientLight.copy(new Object3D());
// @ts-expect-error Ambient recursive copying is boolean.
ambientLight.copy(ambientClone, 1);
// @ts-expect-error Spot colors must be color representations.
new SpotLight([]);
// @ts-expect-error Spot intensity is numeric.
new SpotLight("white", "bright");
// @ts-expect-error Spot range is numeric.
new SpotLight("white", 1, "far");
// @ts-expect-error Spot cone angle is numeric.
new SpotLight("white", 1, 10, "wide");
// @ts-expect-error Spot penumbra is numeric.
new SpotLight("white", 1, 10, 0.5, "soft");
// @ts-expect-error Spot decay is numeric.
new SpotLight("white", 1, 10, 0.5, 0.2, "inverse-square");
// @ts-expect-error Power setter accepts numbers, not strings.
spotLight.power = "100";
// @ts-expect-error Cookie maps must be textures or null.
spotLight.map = new Object3D();
// @ts-expect-error Spot targets must be scene objects, not positions.
spotLight.target = new Vector3();
// @ts-expect-error Spot shadows cannot be replaced by a point shadow.
spotLight.shadow = pointShadow;
// @ts-expect-error Spot shadow cameras are perspective.
spotShadow.camera = directionalCamera;
// @ts-expect-error Focus is numeric.
spotShadow.focus = "0.8";
// @ts-expect-error Aspect is numeric.
spotShadow.aspect = "1.5";
// @ts-expect-error Spot matrix updates require angle, distance and target.
spotShadow.updateMatrices(point);
// @ts-expect-error Spot matrix updates require a light.
spotShadow.updateMatrices(new Object3D());
// @ts-expect-error Spot copies preserve spot-specific properties.
spotLight.copy(ambientLight);
// @ts-expect-error Recursive copying is boolean.
spotLight.copy(spotClone, "recursive");
// @ts-expect-error Shadow copies require focus and aspect.
spotShadow.copy(pointShadow);
// @ts-expect-error Clone recursion is boolean.
spotLight.clone(1);
void [ambientCopy, spotPower, spotTarget, spotCookie, spotCamera, spotCopy, spotShadowCopy];

const harmonics = new SphericalHarmonics3().fromArray(Array(27).fill(0) as number[]);
const radiance: Vector3 = harmonics.getAt(new Vector3(0, 0, 1), new Vector3());
const irradiance: Vector3 = harmonics.getIrradianceAt(new Vector3(0, 1, 0), new Vector3());
const probe: LightProbe = new LightProbe(harmonics, 0.5).clone();
const area: RectAreaLight = new RectAreaLight("white", 2, 3, 4).clone();
area.power = 30;
probe.sh.copy(harmonics);
// @ts-expect-error LightProbe receives SH coefficients, not a color.
new LightProbe("white");
// @ts-expect-error Area dimensions are numeric.
new RectAreaLight("white", 1, "wide", 2);
// @ts-expect-error Irradiance requires a Vector3 target.
harmonics.getIrradianceAt(new Vector3(), new Vector2());

const standardParameters: MeshStandardMaterialParameters = {
  color: "#aabbcc",
  emissive: 0x102030,
  roughness: 0.4,
  metalness: 0.8,
  normalScale: new Vector2(0.5, 0.5),
  normalMap: null,
  envMap: null,
};
const physicalParameters: MeshPhysicalMaterialParameters = {
  ...standardParameters,
  specularColor: "white",
  sheenColor: new Color(0x8899ff),
  attenuationColor: "#cceeff",
  clearcoat: 1,
  clearcoatRoughness: 0.2,
  clearcoatNormalScale: new Vector2(1, 1),
  iridescence: 0.6,
  iridescenceThicknessMinimum: 120,
  iridescenceThicknessMaximum: 400,
  anisotropy: 0.8,
  anisotropyRotation: 0.5,
  diffuseRoughness: 0.4,
  diffuseRoughnessMap: null,
  retroreflectivity: 0.5,
  transmission: 0.9,
  thickness: 0.5,
  ior: 1.5,
  dispersion: 0.2,
};
const standard: MeshStandardMaterial = new MeshStandardMaterial(standardParameters).clone();
const physical: MeshPhysicalMaterial = new MeshPhysicalMaterial(physicalParameters).clone();
const phong: MeshPhongMaterial = new MeshPhongMaterial({ color: "coral", specular: "#ffffff", shininess: 40 }).clone();
const normal: MeshNormalMaterial = new MeshNormalMaterial({ flatShading: true, normalMap: null }).clone();
const matcap: MeshMatcapMaterial = new MeshMatcapMaterial({ color: 0xffffff, matcap: null }).clone();
const toon: MeshToonMaterial = new MeshToonMaterial({ color: "orange", gradientMap: null }).clone();
const shadow: ShadowMaterial = new ShadowMaterial({ color: 0x102030, opacity: 0.5 }).clone();
physical.copy(physical).clearcoatNormalScale.set(0.3, 0.4);
physical.reflectivity = 0.5;
// @ts-expect-error PBR scalar values are numeric.
new MeshStandardMaterial({ roughness: "rough" });
// @ts-expect-error Clearcoat belongs to Physical, not Standard.
new MeshStandardMaterial({ clearcoat: 1 });
// @ts-expect-error Normal material has no color map.
new MeshNormalMaterial({ map: new Texture() });
// @ts-expect-error Maps require Texture or null.
new MeshPhysicalMaterial({ transmissionMap: 42 });
// @ts-expect-error Colors reject arbitrary objects.
new MeshPhysicalMaterial({ sheenColor: {} });
// @ts-expect-error Normal scale requires a Vector2.
new MeshPhysicalMaterial({ clearcoatNormalScale: [1, 1] });
// @ts-expect-error Phong specular is a color input, not a texture.
new MeshPhongMaterial({ specular: new Texture() });
// @ts-expect-error A matcap is a texture, not a color.
new MeshMatcapMaterial({ matcap: "red" });
// @ts-expect-error Gradient maps require a texture.
new MeshToonMaterial({ gradientMap: [] });

const dfg: DataTexture = createDFGLUT();
const ltc = createLTCTextures();
const pbrRenderer = new WebGLRenderer({
  getDFGLUT: () => dfg,
  ltcTextures: ltc,
  createEnvironments: WebGLEnvironments,
  shaders: {
    MeshPhongMaterial: phongShader,
    MeshNormalMaterial: normalShader,
    MeshMatcapMaterial: matcapShader,
    MeshToonMaterial: toonShader,
    ShadowMaterial: shadowShader,
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
  },
});
// @ts-expect-error DFG inputs return a texture synchronously.
new WebGLRenderer({ getDFGLUT: () => 1 });
// @ts-expect-error Async factories cannot supply draw-time uniforms.
new WebGLRenderer({ getDFGLUT: async () => dfg });
// @ts-expect-error LTC inputs are textures.
new WebGLRenderer({ ltcTextures: { LTC_FLOAT_1: 1 } });
// @ts-expect-error Shader source must be GLSL text.
new WebGLRenderer({ shaders: { MeshStandardMaterial: { ...standardShader, fragmentShader: 42 } } });
// @ts-expect-error Uniform entries need a value.
new WebGLRenderer({ shaders: { MeshPhysicalMaterial: { ...physicalShader, uniforms: { color: 42 } } } });
void [radiance, irradiance, standard, physical, phong, normal, matcap, toon, shadow, pbrRenderer];
for (const texture of [dfg, ...Object.values(ltc)]) texture.dispose();

const animationTimes = new Float64Array([0, 1]);
const numericTrack = new NumberKeyframeTrack(".position[x]", animationTimes, new Float32Array([0, 1]));
const vectorTrack = new VectorKeyframeTrack(".position", [0, 1], new Float64Array([0, 0, 0, 1, 2, 3]));
const quaternionTrack = new QuaternionKeyframeTrack(".quaternion", animationTimes, [0, 0, 0, 1, 0, 1, 0, 0]);
const colorTrack = new ColorKeyframeTrack(".material.color", [0, 1], [1, 0, 0, 0, 1, 0]);
const booleanTrack = new BooleanKeyframeTrack(".visible", animationTimes, [true, false]);
const stringTrack = new StringKeyframeTrack(".name", [0, 1], ["first", "second"]);
const numericClone: NumberKeyframeTrack = numericTrack.clone().shift(1).scale(2).trim(0, 3).optimize();
const booleanValues: boolean[] = booleanTrack.values;
const stringValues: string[] = stringTrack.values;
const heterogeneousClip = new AnimationClip("all", -1, [
  numericTrack,
  vectorTrack,
  quaternionTrack,
  colorTrack,
  booleanTrack,
  stringTrack,
]);
const trackBase: KeyframeTrack = booleanTrack;
const convertedTimes: Float32Array = convertArray(animationTimes, Float32Array);
const sortedTimes: Float64Array = sortedArray(animationTimes, 1, getKeyframeOrder(animationTimes));
const sortedStrings: string[] = sortedArray(["b", "a"], 1, [1, 0]);
const numericSample: NumericAnimationBuffer = new LinearInterpolant(animationTimes, [0, 1], 1).evaluate(0.5);
new CubicInterpolant([0, 1], new Float32Array([0, 1]), 1, new Float64Array(1)).evaluate(0.5);
new QuaternionLinearInterpolant([0, 1], quaternionTrack.values, 4).evaluate(0.5);
const discreteBooleans: boolean[] = new DiscreteInterpolant([0, 1], [true, false], 1).evaluate(0.5);
const discreteStrings: string[] = new DiscreteInterpolant(animationTimes, ["a", "b"], 1, []).evaluate(0.5);
numericTrack.createInterpolant(null);
numericTrack.setInterpolation(Interpolation.Linear);
const groupedAnimation = new AnimationObjectGroup(new Object3D(), new Object3D());
groupedAnimation.add(new Object3D());
groupedAnimation.remove(new Object3D());
groupedAnimation.uncache(new Object3D());
const stage4Mixer = new AnimationMixer(groupedAnimation);
const stage4Action: AnimationAction | null = stage4Mixer.clipAction(heterogeneousClip);
stage4Action?.setLoop(Loop.Repeat, 2).play().fadeIn(0.2).warp(1, 2, 0.5);
stage4Mixer.update(1 / 60);
stage4Mixer.existingAction(heterogeneousClip, groupedAnimation);
const parsedAnimationPath = PropertyBinding.parseTrackName(".position[x]");
const individualBinding = new PropertyBinding(new Object3D(), ".position[x]", parsedAnimationPath);
individualBinding.getValue(new Float32Array(1), 0);
individualBinding.setValue([2], 0);
const compositeBinding = PropertyBinding.create(groupedAnimation, ".visible");
new PropertyMixer(compositeBinding, "bool", 1);
subclip(heterogeneousClip, "part", 0, 15);
makeClipAdditive(heterogeneousClip);
const animationBone: Bone = new Bone().clone();
const animationSkeleton = new Skeleton([animationBone], [new Matrix4()]);
animationSkeleton.computeBoneTexture().update();
const skin = new SkinnedMesh(new BufferGeometry(), new MeshBasicMaterial());
skin.add(animationBone);
skin.bind(animationSkeleton);
skin.bind(animationSkeleton, new Matrix4());
const skinnedClone: SkinnedMesh = skin.clone().copy(skin, true);
const skinnedPosition: Vector3 = skin.applyBoneTransform(0, new Vector3());
skin.getVertexPosition(0, new Vector3());

// @ts-expect-error Numeric tracks reject string values.
new NumberKeyframeTrack(".x", [0, 1], ["a", "b"]);
// @ts-expect-error Discrete boolean tracks reject numeric values.
new BooleanKeyframeTrack(".visible", [0, 1], [0, 1]);
// @ts-expect-error Discrete string tracks reject boolean values.
new StringKeyframeTrack(".name", [0, 1], [true, false]);
// @ts-expect-error Track times are numeric.
new VectorKeyframeTrack(".position", ["now"], [0, 0, 0]);
// @ts-expect-error Track interpolation is a numeric mode.
numericTrack.setInterpolation("linear");
// @ts-expect-error Arithmetic interpolation rejects string buffers.
new LinearInterpolant([0, 1], ["a", "b"], 1);
// @ts-expect-error Interpolant sample sizes are numbers, not buffers.
new CubicInterpolant([0, 1], [0, 1], new Float32Array(1));
// @ts-expect-error An animation group contains Object3D instances.
groupedAnimation.add("mesh");
// @ts-expect-error Mixer roots must be scene objects or animation groups.
new AnimationMixer({});
// @ts-expect-error Clip tracks must be KeyframeTrack instances.
new AnimationClip("bad", 1, [42]);
// @ts-expect-error Blend modes are numbers.
new AnimationClip("bad", 1, [], "additive");
// @ts-expect-error Bindings require a string path.
new PropertyBinding(new Object3D(), 42);
// @ts-expect-error Skinning requires a Skeleton.
skin.bind(new Object3D());
// @ts-expect-error Skinning target is a Vector3.
skin.applyBoneTransform(0, new Vector2());
// @ts-expect-error Bone inverses are Matrix4 instances.
new Skeleton([animationBone], [new Vector3()]);
void [
  numericClone,
  booleanValues,
  stringValues,
  trackBase,
  convertedTimes,
  sortedTimes,
  sortedStrings,
  numericSample,
  discreteBooleans,
  discreteStrings,
  skinnedClone,
  skinnedPosition,
];

const cameraChildren = new Object3D<PerspectiveCamera>();
cameraChildren.add(new PerspectiveCamera());
// @ts-expect-error A specialized child collection cannot accept a plain scene object.
cameraChildren.add(new Object3D());
// @ts-expect-error Reparenting must preserve the child collection's type.
cameraChildren.attach(new Object3D());
// @ts-expect-error Recursive copying cannot introduce incompatible child objects.
cameraChildren.copy(new Object3D<Mesh>());
