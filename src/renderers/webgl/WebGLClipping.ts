import { Matrix3 } from "../../math/Matrix3";
import { Plane } from "../../math/Plane";
import type { WebGLProperties } from "./WebGLProperties";
import type { Camera } from "../../cameras/Camera";
import type { Material } from "../../materials/Material";

export class WebGLClipping {
  private readonly properties: WebGLProperties;
  private globalState: Float32Array | null = null;
  private numGlobalPlanes: number = 0;
  private localClippingEnabled: boolean = false;
  private renderingShadows: boolean = false;
  private readonly plane: Plane = new Plane();
  private readonly viewNormalMatrix: Matrix3 = new Matrix3();
  private readonly clippingUniform: WebGLClipping["uniform"] = { value: null, needsUpdate: false };
  uniform: { value: Float32Array | null; needsUpdate: boolean } = this.clippingUniform;
  numPlanes: number = 0;
  numIntersection: number = 0;

  constructor(properties: WebGLProperties) {
    this.properties = properties;
    this.init = this.init.bind(this);
    this.beginShadows = this.beginShadows.bind(this);
    this.endShadows = this.endShadows.bind(this);
    this.setGlobalState = this.setGlobalState.bind(this);
    this.setState = this.setState.bind(this);
  }

  init(planes: Plane[], enableLocalClipping: boolean) {
    const enabled =
      planes.length !== 0 ||
      enableLocalClipping ||
      // enable state of previous frame - the clipping code has to
      // run another frame in order to reset the state:
      this.numGlobalPlanes !== 0 ||
      this.localClippingEnabled;
    this.localClippingEnabled = enableLocalClipping;
    this.numGlobalPlanes = planes.length;
    return enabled;
  }

  beginShadows() {
    this.renderingShadows = true;
    this.projectPlanes(null);
  }

  endShadows() {
    this.renderingShadows = false;
  }

  setGlobalState(planes: Plane[], camera: Camera) {
    this.globalState = this.projectPlanes(planes, camera, 0);
  }

  setState(material: Material, camera: Camera, useCache: boolean) {
    const planes = material.clippingPlanes,
      clipIntersection = material.clipIntersection,
      clipShadows = material.clipShadows;
    const materialProperties = this.properties.get(material);
    if (
      !this.localClippingEnabled ||
      planes === null ||
      planes.length === 0 ||
      (this.renderingShadows && !clipShadows)
    ) {
      // there's no local clipping
      if (this.renderingShadows) {
        // there's no global clipping
        this.projectPlanes(null);
      } else {
        this.resetGlobalState();
      }
    } else {
      const nGlobal = this.renderingShadows ? 0 : this.numGlobalPlanes,
        lGlobal = nGlobal * 4;
      let dstArray: Float32Array | null = materialProperties.clippingState || null;
      this.clippingUniform.value = dstArray; // ensure unique state
      dstArray = this.projectPlanes(planes, camera, lGlobal, useCache)!;
      for (let i = 0; i !== lGlobal; ++i) {
        dstArray[i] = this.globalState![i];
      }
      materialProperties.clippingState = dstArray;
      this.numIntersection = clipIntersection ? this.numPlanes : 0;
      this.numPlanes += nGlobal;
    }
  }

  private resetGlobalState() {
    if (this.clippingUniform.value !== this.globalState) {
      this.clippingUniform.value = this.globalState;
      this.clippingUniform.needsUpdate = this.numGlobalPlanes > 0;
    }
    this.numPlanes = this.numGlobalPlanes;
    this.numIntersection = 0;
  }

  private projectPlanes(planes: Plane[] | null, camera?: Camera, dstOffset?: number, skipTransform?: boolean) {
    const nPlanes = planes !== null ? planes.length : 0;
    let dstArray: Float32Array | null = null;
    if (nPlanes !== 0) {
      dstArray = this.clippingUniform.value;
      if (skipTransform !== true || dstArray === null) {
        const flatSize = dstOffset! + nPlanes * 4,
          viewMatrix = camera!.matrixWorldInverse;
        this.viewNormalMatrix.getNormalMatrix(viewMatrix);
        if (dstArray === null || dstArray.length < flatSize) {
          dstArray = new Float32Array(flatSize);
        }
        for (let i = 0, i4 = dstOffset!; i !== nPlanes; ++i, i4 += 4) {
          this.plane.copy(planes![i]).applyMatrix4(viewMatrix, this.viewNormalMatrix);
          this.plane.normal.toArray(dstArray, i4);
          dstArray[i4 + 3] = this.plane.constant;
        }
      }
      this.clippingUniform.value = dstArray;
      this.clippingUniform.needsUpdate = true;
    }
    this.numPlanes = nPlanes;
    this.numIntersection = 0;
    return dstArray;
  }
}
