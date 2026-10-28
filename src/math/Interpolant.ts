import { EndingMode } from "../constants";
export type NumericAnimationBuffer =
  | number[]
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;
export type AnimationBuffer = NumericAnimationBuffer | string[] | boolean[] | (number | string | boolean)[];
export interface AnimationBufferConstructor {
  new (values: never): AnimationBuffer;
  BYTES_PER_ELEMENT?: number;
}
export interface InterpolantSettings {
  endingStart?: EndingMode;
  endingEnd?: EndingMode;
  inTangents?: NumericAnimationBuffer;
  outTangents?: NumericAnimationBuffer;
}
/**
 * Abstract base class of interpolants over parametric samples.
 *
 * The parameter domain is one dimensional, typically the time or a path
 * along a curve defined by the data.
 *
 * The sample values can have any dimensionality and derived classes may
 * apply special interpretations to the data.
 *
 * This class provides the interval seek in a Template Method, deferring
 * the actual interpolation to derived classes.
 *
 * Time complexity is O(1) for linear access crossing at most two points
 * and O(log N) for random access, where N is the number of positions.
 *
 * References: {@link http://www.oodesign.com/template-method-pattern.html}
 *
 * @abstract
 */
export class Interpolant<B extends AnimationBuffer = NumericAnimationBuffer> {
  parameterPositions: NumericAnimationBuffer;
  _cachedIndex: number;
  resultBuffer: B;
  sampleValues: B;
  valueSize: number;
  settings: InterpolantSettings | null;
  DefaultSettings_: InterpolantSettings;

  /**
   * Constructs a new interpolant.
   *
   * @param parameterPositions - The parameter positions hold the interpolation factors.
   * @param sampleValues - The sample values.
   * @param sampleSize - The sample size
   * @param [resultBuffer] - The result buffer.
   */
  constructor(
    parameterPositions: NumericAnimationBuffer,
    sampleValues: B,
    sampleSize: number,
    resultBuffer?: B | null,
  ) {
    /**
     * The parameter positions.
     *
     */
    this.parameterPositions = parameterPositions;
    /**
     * A cache index.
     *
     * @private
     * @default 0
     */
    this._cachedIndex = 0;
    /**
     * The result buffer.
     *
     */
    this.resultBuffer = (
      resultBuffer !== undefined ? resultBuffer : new (sampleValues.constructor as any)(sampleSize)
    ) as B;
    /**
     * The sample values.
     *
     */
    this.sampleValues = sampleValues;
    /**
     * The value size.
     *
     */
    this.valueSize = sampleSize;
    /**
     * The interpolation settings.
     *
     * @default null
     */
    this.settings = null;
    /**
     * The default settings object.
     *
     */
    this.DefaultSettings_ = {};
  }
  /**
   * Evaluate the interpolant at position `t`.
   *
   * @param t - The interpolation factor.
   * @return The result buffer.
   */
  evaluate(t: number): B {
    const pp = this.parameterPositions;
    let i1 = this._cachedIndex,
      t1 = pp[i1],
      t0 = pp[i1 - 1];
    validate_interval: {
      seek: {
        let right: any;
        linear_scan: {
          //- See http://jsperf.com/comparison-to-undefined/3
          //- slower code:
          //-
          //- 				if ( t >= t1 || t1 === undefined ) {
          forward_scan: if (!(t < t1)) {
            for (let giveUpAt = i1 + 2; ;) {
              if (t1 === undefined) {
                if (t < t0) break forward_scan;
                // after end
                i1 = pp.length;
                this._cachedIndex = i1;
                return this.copySampleValue_(i1 - 1);
              }
              if (i1 === giveUpAt) break; // this loop
              t0 = t1;
              t1 = pp[++i1];
              if (t < t1) {
                // we have arrived at the sought interval
                break seek;
              }
            }
            // prepare binary search on the right side of the index
            right = pp.length;
            break linear_scan;
          }
          //- slower code:
          //-					if ( t < t0 || t0 === undefined ) {
          if (!(t >= t0)) {
            // looping?
            const t1global = pp[1];
            if (t < t1global) {
              i1 = 2; // + 1, using the scan for the details
              t0 = t1global;
            }
            // linear reverse scan
            for (let giveUpAt = i1 - 2; ;) {
              if (t0 === undefined) {
                // before start
                this._cachedIndex = 0;
                return this.copySampleValue_(0);
              }
              if (i1 === giveUpAt) break; // this loop
              t1 = t0;
              t0 = pp[--i1 - 1];
              if (t >= t0) {
                // we have arrived at the sought interval
                break seek;
              }
            }
            // prepare binary search on the left side of the index
            right = i1;
            i1 = 0;
            break linear_scan;
          }
          // the interval is valid
          break validate_interval;
        } // linear scan
        // binary search
        while (i1 < right) {
          const mid = (i1 + right) >>> 1;
          if (t < pp[mid]) {
            right = mid;
          } else {
            i1 = mid + 1;
          }
        }
        t1 = pp[i1];
        t0 = pp[i1 - 1];
        // check boundary cases, again
        if (t0 === undefined) {
          this._cachedIndex = 0;
          return this.copySampleValue_(0);
        }
        if (t1 === undefined) {
          i1 = pp.length;
          this._cachedIndex = i1;
          return this.copySampleValue_(i1 - 1);
        }
      } // seek
      this._cachedIndex = i1;
      this.intervalChanged_(i1, t0, t1);
    } // validate_interval
    return this.interpolate_(i1, t0, t, t1);
  }
  /**
   * Returns the interpolation settings.
   *
   * @return The interpolation settings.
   */
  getSettings_() {
    return this.settings || this.DefaultSettings_;
  }
  /**
   * Copies a sample value to the result buffer.
   *
   * @param index - An index into the sample value buffer.
   * @return The result buffer.
   */
  copySampleValue_(index: number): B {
    // copies a sample value to the result buffer
    const result = this.resultBuffer,
      values = this.sampleValues,
      stride = this.valueSize,
      offset = index * stride;
    for (let i = 0; i !== stride; ++i) {
      result[i] = values[offset + i];
    }
    return result;
  }
  /**
   * Copies a sample value to the result buffer.
   *
   * @abstract
   * @param _i1 - An index into the sample value buffer.
   * @param _t0 - The previous interpolation factor.
   * @param _t - The current interpolation factor.
   * @param _t1 - The next interpolation factor.
   * @return The result buffer.
   */
  interpolate_(_i1: number, _t0: number, _t: number, _t1: number): B {
    throw new Error("THREE.Interpolant: Call to abstract method.");
    // implementations shall return this.resultBuffer
  }
  /**
   * Optional method that is executed when the interval has changed.
   *
   * @param _i1 - An index into the sample value buffer.
   * @param _t0 - The previous interpolation factor.
   * @param _t1 - The next interpolation factor.
   */
  intervalChanged_(_i1: number, _t0: number, _t1: number) {
    // empty
  }
}
