import { CubeTexture } from "../../textures/CubeTexture";
import { Texture } from "../../textures/Texture";
import { DataArrayTexture } from "../../textures/DataArrayTexture";
import { Data3DTexture } from "../../textures/Data3DTexture";
import { DepthTexture } from "../../textures/DepthTexture";
import { CubeDepthTexture } from "../../textures/CubeDepthTexture";
import { AlwaysCompare } from "../../constants";
const emptyTexture = /*@__PURE__*/ new Texture();
const emptyShadowTexture = /*@__PURE__*/ new DepthTexture(1, 1);
const emptyCubeShadowTexture = /*@__PURE__*/ new CubeDepthTexture(1);
const emptyArrayTexture = /*@__PURE__*/ new DataArrayTexture();
const empty3dTexture = /*@__PURE__*/ new Data3DTexture();
const emptyCubeTexture = /*@__PURE__*/ new CubeTexture();
// --- Utilities ---
// Array Caches (provide typed arrays for temporary by size)
const arrayCacheF32: any[] = [];
const arrayCacheI32: any[] = [];
// Float32Array caches used for uploading Matrix uniforms
const mat4array = new Float32Array(16);
const mat3array = new Float32Array(9);
const mat2array = new Float32Array(4);
// Flattening for arrays of vectors and matrices
function flatten(array?: any, nBlocks?: any, blockSize?: any) {
  const firstElem = array[0];
  if (firstElem <= 0 || firstElem > 0) return array;
  // unoptimized: ! isNaN( firstElem )
  // see http://jacksondunstan.com/articles/983
  const n = nBlocks * blockSize;
  let r = arrayCacheF32[n];
  if (r === undefined) {
    r = new Float32Array(n);
    arrayCacheF32[n] = r;
  }
  if (nBlocks !== 0) {
    firstElem.toArray(r, 0);
    for (let i = 1, offset = 0; i !== nBlocks; ++i) {
      offset += blockSize;
      array[i].toArray(r, offset);
    }
  }
  return r;
}
function arraysEqual(a?: any, b?: any) {
  if (a.length !== b.length) return false;
  for (let i = 0, l = a.length; i < l; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
function copyArray(a?: any, b?: any) {
  for (let i = 0, l = b.length; i < l; i++) {
    a[i] = b[i];
  }
}
// Texture unit allocation
function allocTexUnits(textures?: any, n?: any) {
  let r = arrayCacheI32[n];
  if (r === undefined) {
    r = new Int32Array(n);
    arrayCacheI32[n] = r;
  }
  for (let i = 0; i !== n; ++i) {
    r[i] = textures.allocateTextureUnit();
  }
  return r;
}
// --- Setters ---
// Note: Defining these methods externally, because they come in a bunch
// and this way their names minify.
// Single scalar
function setValueV1f(this: any, gl?: any, v?: any) {
  const cache = this.cache;
  if (cache[0] === v) return;
  gl.uniform1f(this.addr, v);
  cache[0] = v;
}
// Single float vector (from flat array or THREE.VectorN)
function setValueV2f(this: any, gl?: any, v?: any) {
  const cache = this.cache;
  if (v.x !== undefined) {
    if (cache[0] !== v.x || cache[1] !== v.y) {
      gl.uniform2f(this.addr, v.x, v.y);
      cache[0] = v.x;
      cache[1] = v.y;
    }
  } else {
    if (arraysEqual(cache, v)) return;
    gl.uniform2fv(this.addr, v);
    copyArray(cache, v);
  }
}
function setValueV3f(this: any, gl?: any, v?: any) {
  const cache = this.cache;
  if (v.x !== undefined) {
    if (cache[0] !== v.x || cache[1] !== v.y || cache[2] !== v.z) {
      gl.uniform3f(this.addr, v.x, v.y, v.z);
      cache[0] = v.x;
      cache[1] = v.y;
      cache[2] = v.z;
    }
  } else if (v.r !== undefined) {
    if (cache[0] !== v.r || cache[1] !== v.g || cache[2] !== v.b) {
      gl.uniform3f(this.addr, v.r, v.g, v.b);
      cache[0] = v.r;
      cache[1] = v.g;
      cache[2] = v.b;
    }
  } else {
    if (arraysEqual(cache, v)) return;
    gl.uniform3fv(this.addr, v);
    copyArray(cache, v);
  }
}
function setValueV4f(this: any, gl?: any, v?: any) {
  const cache = this.cache;
  if (v.x !== undefined) {
    if (cache[0] !== v.x || cache[1] !== v.y || cache[2] !== v.z || cache[3] !== v.w) {
      gl.uniform4f(this.addr, v.x, v.y, v.z, v.w);
      cache[0] = v.x;
      cache[1] = v.y;
      cache[2] = v.z;
      cache[3] = v.w;
    }
  } else {
    if (arraysEqual(cache, v)) return;
    gl.uniform4fv(this.addr, v);
    copyArray(cache, v);
  }
}
// Single matrix (from flat array or THREE.MatrixN)
function setValueM2(this: any, gl?: any, v?: any) {
  const cache = this.cache;
  const elements = v.elements;
  if (elements === undefined) {
    if (arraysEqual(cache, v)) return;
    gl.uniformMatrix2fv(this.addr, false, v);
    copyArray(cache, v);
  } else {
    if (arraysEqual(cache, elements)) return;
    mat2array.set(elements);
    gl.uniformMatrix2fv(this.addr, false, mat2array);
    copyArray(cache, elements);
  }
}
function setValueM3(this: any, gl?: any, v?: any) {
  const cache = this.cache;
  const elements = v.elements;
  if (elements === undefined) {
    if (arraysEqual(cache, v)) return;
    gl.uniformMatrix3fv(this.addr, false, v);
    copyArray(cache, v);
  } else {
    if (arraysEqual(cache, elements)) return;
    mat3array.set(elements);
    gl.uniformMatrix3fv(this.addr, false, mat3array);
    copyArray(cache, elements);
  }
}
function setValueM4(this: any, gl?: any, v?: any) {
  const cache = this.cache;
  const elements = v.elements;
  if (elements === undefined) {
    if (arraysEqual(cache, v)) return;
    gl.uniformMatrix4fv(this.addr, false, v);
    copyArray(cache, v);
  } else {
    if (arraysEqual(cache, elements)) return;
    mat4array.set(elements);
    gl.uniformMatrix4fv(this.addr, false, mat4array);
    copyArray(cache, elements);
  }
}
// Single integer / boolean
function setValueV1i(this: any, gl?: any, v?: any) {
  const cache = this.cache;
  if (cache[0] === v) return;
  gl.uniform1i(this.addr, v);
  cache[0] = v;
}
// Single integer / boolean vector (from flat array or THREE.VectorN)
function setValueV2i(this: any, gl?: any, v?: any) {
  const cache = this.cache;
  if (v.x !== undefined) {
    if (cache[0] !== v.x || cache[1] !== v.y) {
      gl.uniform2i(this.addr, v.x, v.y);
      cache[0] = v.x;
      cache[1] = v.y;
    }
  } else {
    if (arraysEqual(cache, v)) return;
    gl.uniform2iv(this.addr, v);
    copyArray(cache, v);
  }
}
function setValueV3i(this: any, gl?: any, v?: any) {
  const cache = this.cache;
  if (v.x !== undefined) {
    if (cache[0] !== v.x || cache[1] !== v.y || cache[2] !== v.z) {
      gl.uniform3i(this.addr, v.x, v.y, v.z);
      cache[0] = v.x;
      cache[1] = v.y;
      cache[2] = v.z;
    }
  } else {
    if (arraysEqual(cache, v)) return;
    gl.uniform3iv(this.addr, v);
    copyArray(cache, v);
  }
}
function setValueV4i(this: any, gl?: any, v?: any) {
  const cache = this.cache;
  if (v.x !== undefined) {
    if (cache[0] !== v.x || cache[1] !== v.y || cache[2] !== v.z || cache[3] !== v.w) {
      gl.uniform4i(this.addr, v.x, v.y, v.z, v.w);
      cache[0] = v.x;
      cache[1] = v.y;
      cache[2] = v.z;
      cache[3] = v.w;
    }
  } else {
    if (arraysEqual(cache, v)) return;
    gl.uniform4iv(this.addr, v);
    copyArray(cache, v);
  }
}
// Single unsigned integer
function setValueV1ui(this: any, gl?: any, v?: any) {
  const cache = this.cache;
  if (cache[0] === v) return;
  gl.uniform1ui(this.addr, v);
  cache[0] = v;
}
// Single unsigned integer vector (from flat array or THREE.VectorN)
function setValueV2ui(this: any, gl?: any, v?: any) {
  const cache = this.cache;
  if (v.x !== undefined) {
    if (cache[0] !== v.x || cache[1] !== v.y) {
      gl.uniform2ui(this.addr, v.x, v.y);
      cache[0] = v.x;
      cache[1] = v.y;
    }
  } else {
    if (arraysEqual(cache, v)) return;
    gl.uniform2uiv(this.addr, v);
    copyArray(cache, v);
  }
}
function setValueV3ui(this: any, gl?: any, v?: any) {
  const cache = this.cache;
  if (v.x !== undefined) {
    if (cache[0] !== v.x || cache[1] !== v.y || cache[2] !== v.z) {
      gl.uniform3ui(this.addr, v.x, v.y, v.z);
      cache[0] = v.x;
      cache[1] = v.y;
      cache[2] = v.z;
    }
  } else {
    if (arraysEqual(cache, v)) return;
    gl.uniform3uiv(this.addr, v);
    copyArray(cache, v);
  }
}
function setValueV4ui(this: any, gl?: any, v?: any) {
  const cache = this.cache;
  if (v.x !== undefined) {
    if (cache[0] !== v.x || cache[1] !== v.y || cache[2] !== v.z || cache[3] !== v.w) {
      gl.uniform4ui(this.addr, v.x, v.y, v.z, v.w);
      cache[0] = v.x;
      cache[1] = v.y;
      cache[2] = v.z;
      cache[3] = v.w;
    }
  } else {
    if (arraysEqual(cache, v)) return;
    gl.uniform4uiv(this.addr, v);
    copyArray(cache, v);
  }
}
function initShadowTexture(texture?: any) {
  if (texture.version === 0) {
    texture.compareFunction = AlwaysCompare;
    texture.needsUpdate = true;
  }
  return texture;
}
// Single texture (2D / Cube)
function setValueT1(this: any, gl?: any, v?: any, textures?: any) {
  const cache = this.cache;
  const unit = textures.allocateTextureUnit();
  if (cache[0] !== unit) {
    gl.uniform1i(this.addr, unit);
    cache[0] = unit;
  }
  let emptyTexture2D: any;
  if (this.type === gl.SAMPLER_2D_SHADOW) {
    emptyTexture2D = initShadowTexture(emptyShadowTexture);
  } else {
    emptyTexture2D = emptyTexture;
  }
  textures.setTexture2D(v || emptyTexture2D, unit);
}
function setValueT3D1(this: any, gl?: any, v?: any, textures?: any) {
  const cache = this.cache;
  const unit = textures.allocateTextureUnit();
  if (cache[0] !== unit) {
    gl.uniform1i(this.addr, unit);
    cache[0] = unit;
  }
  textures.setTexture3D(v || empty3dTexture, unit);
}
function setValueT6(this: any, gl?: any, v?: any, textures?: any) {
  const cache = this.cache;
  const unit = textures.allocateTextureUnit();
  if (cache[0] !== unit) {
    gl.uniform1i(this.addr, unit);
    cache[0] = unit;
  }
  let emptyTextureCube: any;
  if (this.type === gl.SAMPLER_CUBE_SHADOW) {
    emptyTextureCube = initShadowTexture(emptyCubeShadowTexture);
  } else {
    emptyTextureCube = emptyCubeTexture;
  }
  textures.setTextureCube(v || emptyTextureCube, unit);
}
function setValueT2DArray1(this: any, gl?: any, v?: any, textures?: any) {
  const cache = this.cache;
  const unit = textures.allocateTextureUnit();
  if (cache[0] !== unit) {
    gl.uniform1i(this.addr, unit);
    cache[0] = unit;
  }
  textures.setTexture2DArray(v || emptyArrayTexture, unit);
}
// Helper to pick the right setter for the singular case
function getSingularSetter(type?: any) {
  switch (type) {
    case 0x1406:
      return setValueV1f; // FLOAT
    case 0x8b50:
      return setValueV2f; // _VEC2
    case 0x8b51:
      return setValueV3f; // _VEC3
    case 0x8b52:
      return setValueV4f; // _VEC4
    case 0x8b5a:
      return setValueM2; // _MAT2
    case 0x8b5b:
      return setValueM3; // _MAT3
    case 0x8b5c:
      return setValueM4; // _MAT4
    case 0x1404:
    case 0x8b56:
      return setValueV1i; // INT, BOOL
    case 0x8b53:
    case 0x8b57:
      return setValueV2i; // _VEC2
    case 0x8b54:
    case 0x8b58:
      return setValueV3i; // _VEC3
    case 0x8b55:
    case 0x8b59:
      return setValueV4i; // _VEC4
    case 0x1405:
      return setValueV1ui; // UINT
    case 0x8dc6:
      return setValueV2ui; // _VEC2
    case 0x8dc7:
      return setValueV3ui; // _VEC3
    case 0x8dc8:
      return setValueV4ui; // _VEC4
    case 0x8b5e: // SAMPLER_2D
    case 0x8d66: // SAMPLER_EXTERNAL_OES
    case 0x8dca: // INT_SAMPLER_2D
    case 0x8dd2: // UNSIGNED_INT_SAMPLER_2D
    case 0x8b62: // SAMPLER_2D_SHADOW
      return setValueT1;
    case 0x8b5f: // SAMPLER_3D
    case 0x8dcb: // INT_SAMPLER_3D
    case 0x8dd3: // UNSIGNED_INT_SAMPLER_3D
      return setValueT3D1;
    case 0x8b60: // SAMPLER_CUBE
    case 0x8dcc: // INT_SAMPLER_CUBE
    case 0x8dd4: // UNSIGNED_INT_SAMPLER_CUBE
    case 0x8dc5: // SAMPLER_CUBE_SHADOW
      return setValueT6;
    case 0x8dc1: // SAMPLER_2D_ARRAY
    case 0x8dcf: // INT_SAMPLER_2D_ARRAY
    case 0x8dd7: // UNSIGNED_INT_SAMPLER_2D_ARRAY
    case 0x8dc4: // SAMPLER_2D_ARRAY_SHADOW
      return setValueT2DArray1;
  }
}
// Array of scalars
function setValueV1fArray(this: any, gl?: any, v?: any) {
  gl.uniform1fv(this.addr, v);
}
// Array of vectors (from flat array or array of THREE.VectorN)
function setValueV2fArray(this: any, gl?: any, v?: any) {
  const data = flatten(v, this.size, 2);
  gl.uniform2fv(this.addr, data);
}
function setValueV3fArray(this: any, gl?: any, v?: any) {
  const data = flatten(v, this.size, 3);
  gl.uniform3fv(this.addr, data);
}
function setValueV4fArray(this: any, gl?: any, v?: any) {
  const data = flatten(v, this.size, 4);
  gl.uniform4fv(this.addr, data);
}
// Array of matrices (from flat array or array of THREE.MatrixN)
function setValueM2Array(this: any, gl?: any, v?: any) {
  const data = flatten(v, this.size, 4);
  gl.uniformMatrix2fv(this.addr, false, data);
}
function setValueM3Array(this: any, gl?: any, v?: any) {
  const data = flatten(v, this.size, 9);
  gl.uniformMatrix3fv(this.addr, false, data);
}
function setValueM4Array(this: any, gl?: any, v?: any) {
  const data = flatten(v, this.size, 16);
  gl.uniformMatrix4fv(this.addr, false, data);
}
// Array of integer / boolean
function setValueV1iArray(this: any, gl?: any, v?: any) {
  gl.uniform1iv(this.addr, v);
}
// Array of integer / boolean vectors (from flat array)
function setValueV2iArray(this: any, gl?: any, v?: any) {
  gl.uniform2iv(this.addr, v);
}
function setValueV3iArray(this: any, gl?: any, v?: any) {
  gl.uniform3iv(this.addr, v);
}
function setValueV4iArray(this: any, gl?: any, v?: any) {
  gl.uniform4iv(this.addr, v);
}
// Array of unsigned integer
function setValueV1uiArray(this: any, gl?: any, v?: any) {
  gl.uniform1uiv(this.addr, v);
}
// Array of unsigned integer vectors (from flat array)
function setValueV2uiArray(this: any, gl?: any, v?: any) {
  gl.uniform2uiv(this.addr, v);
}
function setValueV3uiArray(this: any, gl?: any, v?: any) {
  gl.uniform3uiv(this.addr, v);
}
function setValueV4uiArray(this: any, gl?: any, v?: any) {
  gl.uniform4uiv(this.addr, v);
}
// Array of textures (2D / 3D / Cube / 2DArray)
function setValueT1Array(this: any, gl?: any, v?: any, textures?: any) {
  const cache = this.cache;
  const n = v.length;
  const units = allocTexUnits(textures, n);
  if (!arraysEqual(cache, units)) {
    gl.uniform1iv(this.addr, units);
    copyArray(cache, units);
  }
  let emptyTexture2D: any;
  if (this.type === gl.SAMPLER_2D_SHADOW) {
    emptyTexture2D = initShadowTexture(emptyShadowTexture);
  } else {
    emptyTexture2D = emptyTexture;
  }
  for (let i = 0; i !== n; ++i) {
    textures.setTexture2D(v[i] || emptyTexture2D, units[i]);
  }
}
function setValueT3DArray(this: any, gl?: any, v?: any, textures?: any) {
  const cache = this.cache;
  const n = v.length;
  const units = allocTexUnits(textures, n);
  if (!arraysEqual(cache, units)) {
    gl.uniform1iv(this.addr, units);
    copyArray(cache, units);
  }
  for (let i = 0; i !== n; ++i) {
    textures.setTexture3D(v[i] || empty3dTexture, units[i]);
  }
}
function setValueT6Array(this: any, gl?: any, v?: any, textures?: any) {
  const cache = this.cache;
  const n = v.length;
  const units = allocTexUnits(textures, n);
  if (!arraysEqual(cache, units)) {
    gl.uniform1iv(this.addr, units);
    copyArray(cache, units);
  }
  let emptyTextureCube: any;
  if (this.type === gl.SAMPLER_CUBE_SHADOW) {
    emptyTextureCube = initShadowTexture(emptyCubeShadowTexture);
  } else {
    emptyTextureCube = emptyCubeTexture;
  }
  for (let i = 0; i !== n; ++i) {
    textures.setTextureCube(v[i] || emptyTextureCube, units[i]);
  }
}
function setValueT2DArrayArray(this: any, gl?: any, v?: any, textures?: any) {
  const cache = this.cache;
  const n = v.length;
  const units = allocTexUnits(textures, n);
  if (!arraysEqual(cache, units)) {
    gl.uniform1iv(this.addr, units);
    copyArray(cache, units);
  }
  for (let i = 0; i !== n; ++i) {
    textures.setTexture2DArray(v[i] || emptyArrayTexture, units[i]);
  }
}
// Helper to pick the right setter for a pure (bottom-level) array
function getPureArraySetter(type?: any) {
  switch (type) {
    case 0x1406:
      return setValueV1fArray; // FLOAT
    case 0x8b50:
      return setValueV2fArray; // _VEC2
    case 0x8b51:
      return setValueV3fArray; // _VEC3
    case 0x8b52:
      return setValueV4fArray; // _VEC4
    case 0x8b5a:
      return setValueM2Array; // _MAT2
    case 0x8b5b:
      return setValueM3Array; // _MAT3
    case 0x8b5c:
      return setValueM4Array; // _MAT4
    case 0x1404:
    case 0x8b56:
      return setValueV1iArray; // INT, BOOL
    case 0x8b53:
    case 0x8b57:
      return setValueV2iArray; // _VEC2
    case 0x8b54:
    case 0x8b58:
      return setValueV3iArray; // _VEC3
    case 0x8b55:
    case 0x8b59:
      return setValueV4iArray; // _VEC4
    case 0x1405:
      return setValueV1uiArray; // UINT
    case 0x8dc6:
      return setValueV2uiArray; // _VEC2
    case 0x8dc7:
      return setValueV3uiArray; // _VEC3
    case 0x8dc8:
      return setValueV4uiArray; // _VEC4
    case 0x8b5e: // SAMPLER_2D
    case 0x8d66: // SAMPLER_EXTERNAL_OES
    case 0x8dca: // INT_SAMPLER_2D
    case 0x8dd2: // UNSIGNED_INT_SAMPLER_2D
    case 0x8b62: // SAMPLER_2D_SHADOW
      return setValueT1Array;
    case 0x8b5f: // SAMPLER_3D
    case 0x8dcb: // INT_SAMPLER_3D
    case 0x8dd3: // UNSIGNED_INT_SAMPLER_3D
      return setValueT3DArray;
    case 0x8b60: // SAMPLER_CUBE
    case 0x8dcc: // INT_SAMPLER_CUBE
    case 0x8dd4: // UNSIGNED_INT_SAMPLER_CUBE
    case 0x8dc5: // SAMPLER_CUBE_SHADOW
      return setValueT6Array;
    case 0x8dc1: // SAMPLER_2D_ARRAY
    case 0x8dcf: // INT_SAMPLER_2D_ARRAY
    case 0x8dd7: // UNSIGNED_INT_SAMPLER_2D_ARRAY
    case 0x8dc4: // SAMPLER_2D_ARRAY_SHADOW
      return setValueT2DArrayArray;
  }
}
// --- Uniform Classes ---
class SingleUniform {
  id: any;
  addr: any;
  cache: any[];
  type: any;
  setValue: ((...args: any[]) => void) | undefined;

  constructor(id: any, activeInfo: any, addr?: any) {
    this.id = id;
    this.addr = addr;
    this.cache = [];
    this.type = activeInfo.type;
    this.setValue = getSingularSetter(activeInfo.type);
    // this.path = activeInfo.name; // DEBUG
  }
}
class PureArrayUniform {
  id: any;
  addr: any;
  cache: any[];
  type: any;
  size: any;
  setValue: ((...args: any[]) => void) | undefined;

  constructor(id: any, activeInfo: any, addr?: any) {
    this.id = id;
    this.addr = addr;
    this.cache = [];
    this.type = activeInfo.type;
    this.size = activeInfo.size;
    this.setValue = getPureArraySetter(activeInfo.type);
    // this.path = activeInfo.name; // DEBUG
  }
}
class StructuredUniform {
  id: any;
  seq: any[];
  map: any;

  constructor(id?: any) {
    this.id = id;
    this.seq = [];
    this.map = {};
  }
  setValue(gl: any, value: any, textures?: any) {
    const seq = this.seq;
    for (let i = 0, n = seq.length; i !== n; ++i) {
      const u = seq[i];
      u.setValue(gl, value[u.id], textures);
    }
  }
}
// --- Top-level ---
// Parser - builds up the property tree from the path strings
const RePathPart = /(\w+)(\])?(\[|\.)?/g;
// extracts
// 	- the identifier (member name or array index)
//  - followed by an optional right bracket (found when array index)
//  - followed by an optional left bracket or dot (type of subscript)
//
// Note: These portions can be read in a non-overlapping fashion and
// allow straightforward parsing of the hierarchy that WebGL encodes
// in the uniform names.
function addUniform(container?: any, uniformObject?: any) {
  container.seq.push(uniformObject);
  container.map[uniformObject.id] = uniformObject;
}
function parseUniform(activeInfo?: any, addr?: any, container?: any) {
  const path = activeInfo.name,
    pathLength = path.length;
  // reset RegExp object, because of the early exit of a previous run
  RePathPart.lastIndex = 0;
  while (true) {
    const match = RePathPart.exec(path)!,
      matchEnd = RePathPart.lastIndex;
    let id: any = (match as any)[1];
    const idIsIndex = (match as any)[2] === "]",
      subscript = (match as any)[3];
    if (idIsIndex) id = id | 0; // convert to integer
    if (subscript === undefined || (subscript === "[" && matchEnd + 2 === pathLength)) {
      // bare name or "pure" bottom-level array "[0]" suffix
      addUniform(
        container,
        subscript === undefined ? new SingleUniform(id, activeInfo, addr) : new PureArrayUniform(id, activeInfo, addr),
      );
      break;
    } else {
      // step into inner node / create it in case it doesn't exist
      const map = container.map;
      let next = map[id];
      if (next === undefined) {
        next = new StructuredUniform(id);
        addUniform(container, next);
      }
      container = next;
    }
  }
}
// Root Container
export class WebGLUniforms {
  seq: any[];
  map: any;

  constructor(gl: any, program?: any) {
    this.seq = [];
    this.map = {};
    const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; ++i) {
      const info = gl.getActiveUniform(program, i),
        addr = gl.getUniformLocation(program, info.name);
      parseUniform(info, addr, this);
    }
    // Sort uniforms to prioritize shadow samplers first (for optimal texture unit allocation)
    const shadowSamplers: any[] = [];
    const otherUniforms: any[] = [];
    for (const u of this.seq) {
      if (
        u.type === gl.SAMPLER_2D_SHADOW ||
        u.type === gl.SAMPLER_CUBE_SHADOW ||
        u.type === gl.SAMPLER_2D_ARRAY_SHADOW
      ) {
        shadowSamplers.push(u);
      } else {
        otherUniforms.push(u);
      }
    }
    if (shadowSamplers.length > 0) {
      this.seq = shadowSamplers.concat(otherUniforms);
    }
  }
  setValue(gl: any, name: any, value: any, textures?: any) {
    const u = (this.map as any)[name];
    if (u !== undefined) u.setValue(gl, value, textures);
  }
  setOptional(gl: any, object: any, name?: any) {
    const v = object[name];
    if (v !== undefined) this.setValue(gl, name, v);
  }
  static upload(gl: any, seq: any, values: any, textures?: any) {
    for (let i = 0, n = seq.length; i !== n; ++i) {
      const u = seq[i],
        v = values[u.id];
      if (v.needsUpdate !== false) {
        // note: always updating when .needsUpdate is undefined
        u.setValue(gl, v.value, textures);
      }
    }
  }
  static seqWithValue(seq: any, values?: any) {
    const r: any[] = [];
    for (let i = 0, n = seq.length; i !== n; ++i) {
      const u = seq[i];
      if (u.id in values) r.push(u);
    }
    return r;
  }
}
