import { GL } from "./GL";
import type { Matrix4 } from "./math/Matrix4";
import { DepthFunc } from "./constants";
/**
 * Finds the minimum value in an array.
 *
 * @private
 * @param array - The array to search for the minimum value.
 * @return The minimum value in the array, or Infinity if the array is empty.
 */
export function arrayMin(array: number[]): number {
  if (array.length === 0) return Infinity;
  let min = array[0];
  for (let i = 1, l = array.length; i < l; ++i) {
    if (array[i] < min) min = array[i];
  }
  return min;
}
/**
 * Finds the maximum value in an array.
 *
 * @private
 * @param array - The array to search for the maximum value.
 * @return The maximum value in the array, or -Infinity if the array is empty.
 */
export function arrayMax(array: number[]): number {
  if (array.length === 0) return -Infinity;
  let max = array[0];
  for (let i = 1, l = array.length; i < l; ++i) {
    if (array[i] > max) max = array[i];
  }
  return max;
}
/**
 * Checks if an array contains values that require Uint32 representation.
 *
 * This function determines whether the array contains any values >= 65535,
 * which would require a Uint32Array rather than a Uint16Array for proper storage.
 * The function iterates from the end of the array, assuming larger values are
 * typically located at the end.
 *
 * @private
 * @param array - The array to check.
 * @return True if the array contains values >= 65535, false otherwise.
 */
export function arrayNeedsUint32(array: number[]): boolean {
  // assumes larger values usually on last
  for (let i = array.length - 1; i >= 0; --i) {
    if (array[i] >= 65535) return true; // account for PRIMITIVE_RESTART_FIXED_INDEX, #24565
  }
  return false;
}
/**
 * Map of typed array constructor names to their constructors.
 * This mapping enables dynamic creation of typed arrays based on string type names.
 *
 * @private
 * @constant
 */
const TYPED_ARRAYS: Record<
  string,
  | Int8ArrayConstructor
  | Uint8ArrayConstructor
  | Uint8ClampedArrayConstructor
  | Int16ArrayConstructor
  | Uint16ArrayConstructor
  | Int32ArrayConstructor
  | Uint32ArrayConstructor
  | Float32ArrayConstructor
  | Float64ArrayConstructor
> = {
  Int8Array: Int8Array,
  Uint8Array: Uint8Array,
  Uint8ClampedArray: Uint8ClampedArray,
  Int16Array: Int16Array,
  Uint16Array: Uint16Array,
  Int32Array: Int32Array,
  Uint32Array: Uint32Array,
  Float32Array: Float32Array,
  Float64Array: Float64Array,
};
/**
 * Creates a typed array of the specified type from the given buffer.
 *
 * @private
 * @param type - The name of the typed array type (e.g., 'Float32Array', 'Uint16Array').
 * @param buffer - The buffer to create the typed array from.
 * @return A new typed array of the specified type.
 */
export function getTypedArray(
  type: string,
  buffer: ArrayBuffer,
):
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array {
  return new TYPED_ARRAYS[type](buffer);
}
/**
 * Returns `true` if the given object is a typed array.
 *
 * @param array - The object to check.
 * @return Whether the given object is a typed array.
 */
export function isTypedArray(array?: any): boolean {
  return ArrayBuffer.isView(array) && !(array instanceof DataView);
}
/**
 * Creates an XHTML element with the specified tag name.
 *
 * This function uses the XHTML namespace to create DOM elements,
 * ensuring proper element creation in XML-based contexts.
 *
 * @private
 * @param name - The tag name of the element to create (e.g., 'canvas', 'div').
 * @return The created XHTML element.
 */
export function createElementNS(name: string) {
  return document.createElementNS("http://www.w3.org/1999/xhtml", name);
}
/**
 * Creates a canvas element configured for block display.
 *
 * This is a convenience function that creates a canvas element with
 * display style set to 'block', which is commonly used in three.js
 * rendering contexts to avoid inline element spacing issues.
 *
 * @return A canvas element with display set to 'block'.
 */
export function createCanvasElement(): HTMLCanvasElement {
  const canvas = createElementNS("canvas") as HTMLCanvasElement;
  canvas.style.display = "block";
  return canvas;
}
/**
 * Internal cache for tracking warning messages to prevent duplicate warnings.
 *
 * @private
 */
const _cache: Record<string, boolean> = {};
/**
 * Custom console function handler for intercepting log, warn, and error calls.
 *
 * @private
 */
let _setConsoleFunction: ((...args: any[]) => any) | null = null;
/**
 * Sets a custom function to handle console output.
 *
 * This allows external code to intercept and handle console.log, console.warn,
 * and console.error calls made by three.js, which is useful for custom logging,
 * testing, or debugging workflows.
 *
 * @param fn - The function to handle console output. Should accept
 *                        (type, message, ...params) where type is 'log', 'warn', or 'error'.
 */
export function setConsoleFunction(fn: (...args: any[]) => any) {
  _setConsoleFunction = fn;
}
/**
 * Gets the currently set custom console function.
 *
 * @return The custom console function, or null if not set.
 */
export function getConsoleFunction() {
  return _setConsoleFunction;
}
/**
 * Logs an informational message with the 'THREE.' prefix.
 *
 * If a custom console function is set via setConsoleFunction(), it will be used
 * instead of the native console.log. The first parameter is treated as the
 * method name and is automatically prefixed with 'THREE.'.
 *
 * @param params - The message components. The first param is used as
 *                          the method name and prefixed with 'THREE.'.
 */
export function log(...params: any[]) {
  const message = "THREE." + params.shift();
  if (_setConsoleFunction) {
    _setConsoleFunction("log", message, ...params);
  } else {
    console.log(message, ...params);
  }
}
/**
 * Logs a warning message with the 'THREE.' prefix.
 *
 * If a custom console function is set via setConsoleFunction(), it will be used
 * instead of the native console.warn. The first parameter is treated as the
 * method name and is automatically prefixed with 'THREE.'.
 *
 * @param params - The message components. The first param is used as
 *                          the method name and prefixed with 'THREE.'.
 */
export function warn(...params: any[]) {
  const message = "THREE." + params.shift();
  if (_setConsoleFunction) {
    _setConsoleFunction("warn", message, ...params);
  } else {
    console.warn(message, ...params);
  }
}
/**
 * Logs an error message with the 'THREE.' prefix.
 *
 * If a custom console function is set via setConsoleFunction(), it will be used
 * instead of the native console.error. The first parameter is treated as the
 * method name and is automatically prefixed with 'THREE.'.
 *
 * @param params - The message components. The first param is used as
 *                          the method name and prefixed with 'THREE.'.
 */
export function error(...params: any[]) {
  const message = "THREE." + params.shift();
  if (_setConsoleFunction) {
    _setConsoleFunction("error", message, ...params);
  } else {
    console.error(message, ...params);
  }
}
/**
 * Logs a warning message only once, preventing duplicate warnings.
 *
 * This function maintains an internal cache of warning messages and will only
 * output each unique warning message once. Useful for warnings that may be
 * triggered repeatedly but should only be shown to the user once.
 *
 * @param params - The warning message components.
 */
export function warnOnce(...params: any[]) {
  const message = params.join(" ");
  if (message in _cache) return;
  (_cache as any)[message] = true;
  warn(...params);
}
/**
 * Yields execution to the main thread to allow rendering and other tasks.
 * Uses scheduler.yield() when available (Chrome 115+), falls back to requestAnimationFrame.
 *
 * @return
 */
export function yieldToMain() {
  if (
    typeof self !== "undefined" &&
    typeof self.scheduler !== "undefined" &&
    typeof self.scheduler.yield !== "undefined"
  ) {
    return self.scheduler.yield();
  }
  return new Promise<void>((resolve: () => void) => {
    requestAnimationFrame(resolve);
  });
}
/**
 * Asynchronously probes for WebGL sync object completion.
 *
 * This function creates a promise that resolves when the WebGL sync object
 * signals completion or rejects if the sync operation fails. It uses polling
 * at the specified interval to check the sync status without blocking the
 * main thread. This is useful for GPU-CPU synchronization in WebGL contexts.
 *
 * @private
 * @param gl - The WebGL rendering context.
 * @param sync - The WebGL sync object to wait for.
 * @param interval - The polling interval in milliseconds.
 * @return A promise that resolves when the sync completes or rejects if it fails.
 */
export function probeAsync(gl: WebGL2RenderingContext, sync: WebGLSync, interval: number) {
  return new Promise<void>(function (resolve: () => void, reject: (reason?: any) => void) {
    function probe() {
      switch (gl.clientWaitSync(sync, GL.SYNC_FLUSH_COMMANDS_BIT, 0)) {
        case GL.WAIT_FAILED:
          reject();
          break;
        case GL.TIMEOUT_EXPIRED:
          setTimeout(probe, interval);
          break;
        default:
          resolve();
      }
    }
    setTimeout(probe, interval);
  });
}
/**
 * Converts a projection matrix from normalized device coordinates (NDC)
 * range [-1, 1] to [0, 1].
 *
 * This conversion is commonly needed when working with depth textures or
 * render targets that expect depth values in the [0, 1] range rather than
 * the standard OpenGL NDC range of [-1, 1]. The function modifies the
 * projection matrix in place.
 *
 * @private
 * @param projectionMatrix - The projection matrix to convert (modified in place).
 */
export function toNormalizedProjectionMatrix(projectionMatrix: Matrix4) {
  const m = projectionMatrix.elements;
  // Convert [-1, 1] to [0, 1] projection matrix
  m[2] = 0.5 * m[2] + 0.5 * m[3];
  m[6] = 0.5 * m[6] + 0.5 * m[7];
  m[10] = 0.5 * m[10] + 0.5 * m[11];
  m[14] = 0.5 * m[14] + 0.5 * m[15];
}
/**
 * Reverses the depth range of a projection matrix.
 *
 * This function inverts the depth mapping of a projection matrix, which is
 * useful for reversed-Z depth buffer techniques that can improve depth
 * precision. The function handles both perspective and orthographic projection
 * matrices differently and modifies the matrix in place.
 *
 * For perspective matrices (where m[11] === -1), the depth mapping is
 * reversed with an offset. For orthographic matrices, a simpler reversal
 * is applied.
 *
 * @private
 * @param projectionMatrix - The projection matrix to reverse (modified in place).
 */
export function toReversedProjectionMatrix(projectionMatrix: Matrix4) {
  const m = projectionMatrix.elements;
  const isPerspectiveMatrix = m[11] === -1;
  // Reverse [0, 1] projection matrix
  if (isPerspectiveMatrix) {
    m[10] = -m[10] - 1;
    m[14] = -m[14];
  } else {
    m[10] = -m[10];
    m[14] = -m[14] + 1;
  }
}
/**
 * Used to select the correct depth functions
 * when reversed depth buffer is used.
 *
 * @private
 */
export const ReversedDepthFuncs: any = {
  [DepthFunc.Never]: DepthFunc.Always,
  [DepthFunc.Less]: DepthFunc.Greater,
  [DepthFunc.Equal]: DepthFunc.NotEqual,
  [DepthFunc.LessEqual]: DepthFunc.GreaterEqual,
  [DepthFunc.Always]: DepthFunc.Never,
  [DepthFunc.Greater]: DepthFunc.Less,
  [DepthFunc.NotEqual]: DepthFunc.Equal,
  [DepthFunc.GreaterEqual]: DepthFunc.LessEqual,
};
