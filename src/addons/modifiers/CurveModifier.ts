import { DynamicDrawUsage, HalfFloatType, LinearFilter, RepeatWrapping, RGBAFormat } from "../../constants";
import type { BufferGeometry } from "../../core/BufferGeometry";
import type { Curve } from "../../extras/core/Curve";
import { toHalfFloat } from "../../extras/DataUtils";
import type { Material } from "../../materials/Material";
import { Matrix4 } from "../../math/Matrix4";
import type { Vector3 } from "../../math/Vector3";
import { InstancedMesh } from "../../objects/InstancedMesh";
import { Mesh } from "../../objects/Mesh";
import { DataTexture } from "../../textures/DataTexture";
import beginNormal from "../../renderers/shaders/ShaderChunk/beginnormal_vertex.glsl";
import defaultNormal from "../../renderers/shaders/ShaderChunk/defaultnormal_vertex.glsl";
import beginVertex from "../../renderers/shaders/ShaderChunk/begin_vertex.glsl";
import projectVertex from "../../renderers/shaders/ShaderChunk/project_vertex.glsl";

const WIDTH = 1024,
  HEIGHT = 4;
type FlowUniforms = {
  spineTexture: { value: DataTexture };
  pathOffset: { value: number };
  pathSegment: { value: number };
  spineOffset: { value: number };
  spineLength: { value: number };
  flow: { value: number };
};

function modifyShader(material: Material, uniforms: FlowUniforms, count: number): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `
      uniform sampler2D spineTexture;
      uniform float pathOffset;
      uniform float pathSegment;
      uniform float spineOffset;
      uniform float spineLength;
      uniform int flow;
      float textureLayers = ${HEIGHT * count}.;
      float textureStacks = ${HEIGHT / 4}.;
      ${shader.vertexShader}`
      .replace(beginNormal, "")
      .replace(defaultNormal, "")
      .replace(beginVertex, "")
      .replace(
        /void\s*main\s*\(\)\s*\{/,
        `
void main() {
${beginNormal}
vec4 worldPos = modelMatrix * vec4(position, 1.);
bool bend = flow > 0;
float xWeight = bend ? 0. : 1.;
#ifdef USE_INSTANCING
float pathOffsetFromInstanceMatrix = instanceMatrix[3][2];
float spineLengthFromInstanceMatrix = instanceMatrix[3][0];
float spinePortion = bend ? (worldPos.x + spineOffset) / spineLengthFromInstanceMatrix : 0.;
float mt = (spinePortion * pathSegment + pathOffset + pathOffsetFromInstanceMatrix)*textureStacks;
#else
float spinePortion = bend ? (worldPos.x + spineOffset) / spineLength : 0.;
float mt = (spinePortion * pathSegment + pathOffset)*textureStacks;
#endif
mt = mod(mt, textureStacks);
float rowOffset = floor(mt);
#ifdef USE_INSTANCING
rowOffset += instanceMatrix[3][1] * ${HEIGHT}.;
#endif
vec3 spinePos = texture2D(spineTexture, vec2(mt, (0. + rowOffset + 0.5) / textureLayers)).xyz;
vec3 a = texture2D(spineTexture, vec2(mt, (1. + rowOffset + 0.5) / textureLayers)).xyz;
vec3 b = texture2D(spineTexture, vec2(mt, (2. + rowOffset + 0.5) / textureLayers)).xyz;
vec3 c = texture2D(spineTexture, vec2(mt, (3. + rowOffset + 0.5) / textureLayers)).xyz;
mat3 basis = mat3(a, b, c);
vec3 transformed = basis * vec3(worldPos.x * xWeight, worldPos.y * 1., worldPos.z * 1.) + spinePos;
vec3 transformedNormal = normalMatrix * (basis * objectNormal);
`,
      )
      .replace(
        projectVertex,
        `vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  material.customProgramCacheKey = () => `CurveModifier:${count}`;
}

/** Bends a cloned mesh along a sampled curve in a WebGL shader. */
export class Flow<T extends Mesh = Mesh> {
  object3D: T;
  splineTexture: DataTexture;
  uniforms: FlowUniforms;
  curveArray: (Curve<Vector3> | undefined)[];
  curveLengthArray: number[];

  constructor(mesh: T, numberOfCurves = 1) {
    const texture = new DataTexture(
      new Uint16Array(WIDTH * HEIGHT * numberOfCurves * 4),
      WIDTH,
      HEIGHT * numberOfCurves,
      RGBAFormat,
      HalfFloatType,
    );
    texture.wrapS = RepeatWrapping;
    texture.magFilter = texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    this.splineTexture = texture;
    this.uniforms = {
      spineTexture: { value: texture },
      pathOffset: { value: 0 },
      pathSegment: { value: 1 },
      spineOffset: { value: 161 },
      spineLength: { value: 400 },
      flow: { value: 1 },
    };
    this.object3D = mesh.clone();
    this.object3D.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const clone = (material: Material): Material => {
        const result = material.clone();
        modifyShader(result, this.uniforms, numberOfCurves);
        return result;
      };
      child.material = Array.isArray(child.material) ? child.material.map(clone) : clone(child.material);
    });
    this.curveArray = [];
    this.curveArray.length = numberOfCurves;
    this.curveLengthArray = [];
    this.curveLengthArray.length = numberOfCurves;
  }

  updateCurve(index: number, curve: Curve<Vector3>): void {
    if (index >= this.curveArray.length) throw new Error("Flow: Index out of range.");
    const length = curve.getLength();
    this.uniforms.spineLength.value = length;
    this.curveLengthArray[index] = length;
    this.curveArray[index] = curve;
    curve.arcLengthDivisions = WIDTH / 2;
    curve.updateArcLengths();
    const points = curve.getSpacedPoints(WIDTH);
    const frames = curve.computeFrenetFrames(WIDTH, true);
    const data = this.splineTexture.image.data as Uint16Array;
    const vectors: Vector3[] = [];
    for (let i = 0; i < WIDTH; i++) {
      vectors[0] = points[i];
      vectors[1] = frames.tangents[i];
      vectors[2] = frames.normals[i];
      vectors[3] = frames.binormals[i];
      for (let row = 0; row < HEIGHT; row++) {
        const offset = 4 * (WIDTH * (row + HEIGHT * index) + i);
        data[offset] = toHalfFloat(vectors[row].x);
        data[offset + 1] = toHalfFloat(vectors[row].y);
        data[offset + 2] = toHalfFloat(vectors[row].z);
        data[offset + 3] = toHalfFloat(1);
      }
    }
    this.splineTexture.needsUpdate = true;
  }

  moveAlongCurve(amount: number): void {
    this.uniforms.pathOffset.value += amount;
  }
}

const matrix = new Matrix4();
export class InstancedFlow extends Flow<InstancedMesh> {
  offsets: number[];
  whichCurve: number[];
  constructor(count: number, curveCount: number, geometry: BufferGeometry, material: Material | Material[]) {
    const mesh = new InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    super(mesh, curveCount);
    this.offsets = [];
    this.offsets.length = count;
    this.offsets.fill(0);
    this.whichCurve = [];
    this.whichCurve.length = count;
    this.whichCurve.fill(0);
  }
  writeChanges(index: number): void {
    matrix.makeTranslation(this.curveLengthArray[this.whichCurve[index]], this.whichCurve[index], this.offsets[index]);
    this.object3D.setMatrixAt(index, matrix);
    this.object3D.instanceMatrix.needsUpdate = true;
  }
  moveIndividualAlongCurve(index: number, offset: number): void {
    this.offsets[index] += offset;
    this.writeChanges(index);
  }
  setCurve(index: number, curveNo: number): void {
    if (Number.isNaN(curveNo)) throw new Error("InstancedFlow: Curve index being set is Not a Number (NaN).");
    this.whichCurve[index] = curveNo;
    this.writeChanges(index);
  }
}
