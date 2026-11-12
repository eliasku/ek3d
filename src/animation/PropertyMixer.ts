import type { AnimationBinding } from "./PropertyBinding";
import type { AnimationBuffer, NumericAnimationBuffer } from "../math/Interpolant";
import { Quaternion } from "../math/Quaternion";

type MixFunction = (
  this: PropertyMixer,
  buffer: AnimationBuffer,
  dstOffset: number,
  srcOffset: number,
  t: number,
  stride: number,
) => void;

/**
 * Buffered scene graph property that allows weighted accumulation; used internally.
 */
export class PropertyMixer {
  binding: AnimationBinding;
  valueSize: number;
  buffer: AnimationBuffer;
  _cacheIndex: number | null = null;
  _workIndex: number | undefined;
  _mixBufferRegion: MixFunction;
  _mixBufferRegionAdditive: MixFunction;
  _setIdentity: (this: PropertyMixer) => void;
  _origIndex: number = 3;
  _addIndex: number = 4;
  /**
   * Accumulated weight of the property binding.
   *
   * @default 0
   */
  cumulativeWeight: number = 0;
  /**
   * Accumulated additive weight of the property binding.
   *
   * @default 0
   */
  cumulativeWeightAdditive: number = 0;
  /**
   * Number of active keyframe tracks currently using this property binding.
   *
   * @default 0
   */
  useCount: number = 0;
  /**
   * Number of keyframe tracks referencing this property binding.
   *
   * @default 0
   */
  referenceCount: number = 0;

  /**
   * Constructs a new property mixer.
   *
   * @param binding - The property binding.
   * @param typeName - The keyframe track type name.
   * @param valueSize - The keyframe track value size.
   */
  constructor(binding: AnimationBinding, typeName: string, valueSize: number) {
    /**
     * The property binding.
     *
     */
    this.binding = binding;
    /**
     * The keyframe track value size.
     *
     */
    this.valueSize = valueSize;
    let mixFunction: MixFunction, mixFunctionAdditive: MixFunction, setIdentity: (this: PropertyMixer) => void;
    // buffer layout: [ incoming | accu0 | accu1 | orig | addAccu | (optional work) ]
    //
    // interpolators can use .buffer as their .result
    // the data then goes to 'incoming'
    //
    // 'accu0' and 'accu1' are used frame-interleaved for
    // the cumulative result and are compared to detect
    // changes
    //
    // 'orig' stores the original state of the property
    //
    // 'add' is used for additive cumulative results
    //
    // 'work' is optional and is only present for quaternion types. It is used
    // to store intermediate quaternion multiplication results
    switch (typeName) {
      case "quaternion":
        mixFunction = _slerp;
        mixFunctionAdditive = _slerpAdditive;
        setIdentity = _setAdditiveIdentityQuaternion;
        this.buffer = new Float64Array(valueSize * 6);
        this._workIndex = 5;
        break;
      case "string":
      case "bool":
        mixFunction = _select;
        // Use the regular mix function and for additive on these types,
        // additive is not relevant for non-numeric types
        mixFunctionAdditive = _select;
        setIdentity = _setAdditiveIdentityOther;
        this.buffer = Array<string | boolean>(valueSize * 5);
        break;
      default:
        mixFunction = _lerp;
        mixFunctionAdditive = _lerpAdditive;
        setIdentity = _setAdditiveIdentityNumeric;
        this.buffer = new Float64Array(valueSize * 5);
    }
    this._mixBufferRegion = mixFunction;
    this._mixBufferRegionAdditive = mixFunctionAdditive;
    this._setIdentity = setIdentity;
  }
  /**
   * Accumulates data in the `incoming` region into `accu<i>`.
   *
   * @param accuIndex - The accumulation index.
   * @param weight - The weight.
   */
  accumulate(accuIndex: number, weight: number) {
    // note: happily accumulating nothing when weight = 0, the caller knows
    // the weight and shouldn't have made the call in the first place
    const buffer = this.buffer,
      stride = this.valueSize,
      offset = accuIndex * stride + stride;
    let currentWeight = this.cumulativeWeight;
    if (currentWeight === 0) {
      // accuN := incoming * weight
      for (let i = 0; i !== stride; ++i) {
        buffer[offset + i] = buffer[i];
      }
      currentWeight = weight;
    } else {
      // accuN := accuN + incoming * weight
      currentWeight += weight;
      const mix = weight / currentWeight;
      this._mixBufferRegion(buffer, offset, 0, mix, stride);
    }
    this.cumulativeWeight = currentWeight;
  }
  /**
   * Accumulates data in the `incoming` region into `add`.
   *
   * @param weight - The weight.
   */
  accumulateAdditive(weight: number) {
    const buffer = this.buffer,
      stride = this.valueSize,
      offset = stride * this._addIndex;
    if (this.cumulativeWeightAdditive === 0) {
      // add = identity
      this._setIdentity();
    }
    // add := add + incoming * weight
    this._mixBufferRegionAdditive(buffer, offset, 0, weight, stride);
    this.cumulativeWeightAdditive += weight;
  }
  /**
   * Applies the state of `accu<i>` to the binding when accus differ.
   *
   * @param accuIndex - The accumulation index.
   */
  apply(accuIndex: number) {
    const stride = this.valueSize,
      buffer = this.buffer,
      offset = accuIndex * stride + stride,
      weight = this.cumulativeWeight,
      weightAdditive = this.cumulativeWeightAdditive,
      binding = this.binding;
    this.cumulativeWeight = 0;
    this.cumulativeWeightAdditive = 0;
    if (weight < 1) {
      // accuN := accuN + original * ( 1 - cumulativeWeight )
      const originalValueOffset = stride * this._origIndex;
      this._mixBufferRegion(buffer, offset, originalValueOffset, 1 - weight, stride);
    }
    if (weightAdditive > 0) {
      // accuN := accuN + additive accuN
      this._mixBufferRegionAdditive(buffer, offset, this._addIndex * stride, 1, stride);
    }
    for (let i = stride, e = stride + stride; i !== e; ++i) {
      if (buffer[i] !== buffer[i + stride]) {
        // value has changed -> update scene graph
        binding.setValue(buffer, offset);
        break;
      }
    }
  }
  /**
   * Remembers the state of the bound property and copy it to both accus.
   */
  saveOriginalState() {
    const binding = this.binding;
    const buffer = this.buffer,
      stride = this.valueSize,
      originalValueOffset = stride * this._origIndex;
    binding.getValue(buffer, originalValueOffset);
    // accu[0..1] := orig -- initially detect changes against the original
    for (let i = stride, e = originalValueOffset; i !== e; ++i) {
      buffer[i] = buffer[originalValueOffset + (i % stride)];
    }
    // Add to identity for additive
    this._setIdentity();
    this.cumulativeWeight = 0;
    this.cumulativeWeightAdditive = 0;
  }
  /**
   * Applies the state previously taken via {@link PropertyMixer#saveOriginalState} to the binding.
   */
  restoreOriginalState() {
    const originalValueOffset = this.valueSize * 3;
    this.binding.setValue(this.buffer, originalValueOffset);
  }
}

function _setAdditiveIdentityNumeric(this: PropertyMixer): void {
  const startIndex = this._addIndex * this.valueSize;
  const endIndex = startIndex + this.valueSize;
  for (let i = startIndex; i < endIndex; i++) {
    this.buffer[i] = 0;
  }
}

function _setAdditiveIdentityQuaternion(this: PropertyMixer): void {
  _setAdditiveIdentityNumeric.call(this);
  this.buffer[this._addIndex * this.valueSize + 3] = 1;
}

function _setAdditiveIdentityOther(this: PropertyMixer): void {
  const startIndex = this._origIndex * this.valueSize;
  const targetIndex = this._addIndex * this.valueSize;
  for (let i = 0; i < this.valueSize; i++) {
    this.buffer[targetIndex + i] = this.buffer[startIndex + i];
  }
}

function _select(buffer: AnimationBuffer, dstOffset: number, srcOffset: number, t: number, stride: number): void {
  if (t >= 0.5) {
    for (let i = 0; i !== stride; ++i) {
      buffer[dstOffset + i] = buffer[srcOffset + i];
    }
  }
}

function _slerp(buffer: AnimationBuffer, dstOffset: number, srcOffset: number, t: number): void {
  const values = buffer as NumericAnimationBuffer;
  Quaternion.slerpFlat(values, dstOffset, values, dstOffset, values, srcOffset, t);
}

function _slerpAdditive(
  this: PropertyMixer,
  buffer: AnimationBuffer,
  dstOffset: number,
  srcOffset: number,
  t: number,
  stride: number,
): void {
  const values = buffer as NumericAnimationBuffer;
  // Only quaternion mixers select this function and initialize the work region.
  const workOffset = this._workIndex! * stride;
  // Store result in intermediate buffer offset
  Quaternion.multiplyQuaternionsFlat(values, workOffset, values, dstOffset, values, srcOffset);
  // Slerp to the intermediate result
  Quaternion.slerpFlat(values, dstOffset, values, dstOffset, values, workOffset, t);
}

function _lerp(buffer: AnimationBuffer, dstOffset: number, srcOffset: number, t: number, stride: number): void {
  const values = buffer as NumericAnimationBuffer;
  const s = 1 - t;
  for (let i = 0; i !== stride; ++i) {
    const j = dstOffset + i;
    values[j] = values[j] * s + values[srcOffset + i] * t;
  }
}

function _lerpAdditive(buffer: AnimationBuffer, dstOffset: number, srcOffset: number, t: number, stride: number): void {
  const values = buffer as NumericAnimationBuffer;
  for (let i = 0; i !== stride; ++i) {
    const j = dstOffset + i;
    values[j] = values[j] + values[srcOffset + i] * t;
  }
}
