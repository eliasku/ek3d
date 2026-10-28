import { CubeCamera } from "../../cameras/CubeCamera";
import { OrthographicCamera } from "../../cameras/OrthographicCamera";
import { TextureType, TextureFilter, PixelFormat } from "../../constants";
import { PlaneGeometry } from "../../geometries/PlaneGeometry";
import { Light } from "../../lights/Light";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { Box3 } from "../../math/Box3";
import { clamp } from "../../math/MathUtils";
import { Vector3 } from "../../math/Vector3";
import { Mesh } from "../../objects/Mesh";
import { WebGL3DRenderTarget } from "../../renderers/WebGL3DRenderTarget";
import { WebGLCubeRenderTarget } from "../../renderers/WebGLCubeRenderTarget";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import common from "../../renderers/shaders/ShaderChunk/common.glsl";
import { Scene } from "../../scenes/Scene";
import { Data3DTexture } from "../../textures/Data3DTexture";
import { replaceSunLights, restoreSunLights } from "./LightProbeGridUtils";
import type { SunLightReplacement } from "./LightProbeGridUtils";

export interface LightProbeGridBakeOptions {
  cubemapSize?: number;
  near?: number;
  far?: number;
  bounces?: number;
  start?: number;
  count?: number;
  pass?: number;
}

// Shared fullscreen-quad scene / camera
let _scene: Scene;
let _camera: OrthographicCamera;
let _mesh: Mesh<ShaderMaterial>;

// SH projection material (depends on cubemapSize)
let _shMaterial: ShaderMaterial;
let _lastCubemapSize = 0;

// Repack materials (one per output sub-volume / texture index)
let _repackMaterials: ShaderMaterial[];

// Cached bake resources
let _cubeRenderTarget: WebGLCubeRenderTarget;
let _cubeCamera: CubeCamera;
let _cachedCubemapSize = 0;
let _cachedNear = 0;
let _cachedFar = 0;

// Cached batch render target
let _batchTarget: WebGLRenderTarget;
let _batchTargetProbes = 0;

// Reusable temp objects
const _position = /*@__PURE__*/ new Vector3();
const _size = /*@__PURE__*/ new Vector3();
const _copyRegion = /*@__PURE__*/ new Box3();

// Direct-light captures use a black atlas without changing the light layout.
let _emptyAtlas: Data3DTexture;

// Number of padding texels added at each boundary of every sub-volume in the atlas.
const ATLAS_PADDING = 1;

export class LightProbeGridWebGL extends Light {
  isLightProbeGrid: boolean;
  width: number;
  height: number;
  depth: number;
  resolution: Vector3;
  boundingBox: Box3;
  texture: Data3DTexture | null;
  _renderTarget: WebGL3DRenderTarget | null;
  _bounceTarget: WebGL3DRenderTarget | null;
  _bouncePass: number;

  constructor(width = 1, height = 1, depth = 1, widthProbes?: number, heightProbes?: number, depthProbes?: number) {
    super(0xffffff, 1);

    this.isLightProbeGrid = true;

    this.type = "LightProbeGridWebGL";

    this.width = width;

    this.height = height;

    this.depth = depth;

    this.resolution = new Vector3(
      widthProbes !== undefined ? widthProbes : Math.max(2, Math.round(width) + 1),
      heightProbes !== undefined ? heightProbes : Math.max(2, Math.round(height) + 1),
      depthProbes !== undefined ? depthProbes : Math.max(2, Math.round(depth) + 1),
    );

    this.boundingBox = new Box3();

    this.texture = null;

    this._renderTarget = null;

    // Indirect captures read a snapshot while the live atlas is updated in place.
    this._bounceTarget = null;
    this._bouncePass = -1;

    this.updateBoundingBox();
  }

  getProbePosition(ix: number, iy: number, iz: number, target: Vector3) {
    const pos = this.position;
    const res = this.resolution;
    const w = this.width,
      h = this.height,
      d = this.depth;

    target.set(
      res.x > 1 ? pos.x - w / 2 + (ix * w) / (res.x - 1) : pos.x,
      res.y > 1 ? pos.y - h / 2 + (iy * h) / (res.y - 1) : pos.y,
      res.z > 1 ? pos.z - d / 2 + (iz * d) / (res.z - 1) : pos.z,
    );

    return target;
  }

  updateBoundingBox() {
    _size.set(this.width, this.height, this.depth);
    this.boundingBox.setFromCenterAndSize(this.position, _size);
  }

  bake(renderer: WebGLRenderer, scene: Scene, options: LightProbeGridBakeOptions = {}) {
    const res = this.resolution;
    const totalProbes = res.x * res.y * res.z;
    const { bounces = 0, start = 0, count = totalProbes - start, pass: firstPass = 0 } = options;
    const end = start + count;

    if (!Number.isInteger(start) || !Number.isInteger(count) || start < 0 || count < 0 || end > totalProbes) {
      throw new RangeError("THREE.LightProbeGridWebGL: Invalid probe range.");
    }

    if (!Number.isInteger(firstPass) || firstPass < 0 || !Number.isInteger(bounces) || bounces < 0) {
      throw new RangeError("THREE.LightProbeGridWebGL: Pass and bounce counts must be non-negative integers.");
    }

    if (bounces > 0 && count !== totalProbes) {
      throw new RangeError("THREE.LightProbeGridWebGL: For ranged baking, use pass instead of bounces.");
    }

    if (count === 0) return;

    if (firstPass > 0 && start > 0 && this._bouncePass !== firstPass) {
      throw new Error("THREE.LightProbeGridWebGL: Start each indirect pass at probe 0.");
    }

    this._ensureTextures();
    this.updateBoundingBox();
    _ensureBakeResources(options);
    _ensureBatchTarget(totalProbes);
    _ensureRepackResources();

    const currentRenderTarget = renderer.getRenderTarget();
    const currentActiveCubeFace = renderer.getActiveCubeFace();
    const currentActiveMipmapLevel = renderer.getActiveMipmapLevel();
    const currentAutoClear = renderer.autoClear;
    const shadowMap = renderer.shadowMap;
    const currentShadowAutoUpdate = shadowMap?.autoUpdate;
    const currentMatrixWorldAutoUpdate = scene.matrixWorldAutoUpdate;
    const currentVisible = this.visible;
    const currentTexture = this.texture;
    const renderTarget = this._renderTarget!;
    const currentViewport = renderTarget.viewport.clone();
    let replacedSunLights: SunLightReplacement[] | null = null;

    try {
      this.visible = true;

      // Scene is static during the bake: update once, disable auto-update.

      if (currentMatrixWorldAutoUpdate === true) {
        scene.updateMatrixWorld(true);
        scene.matrixWorldAutoUpdate = false;
      }

      replacedSunLights = replaceSunLights(scene);

      // Render shadow maps once, not once per cube face.

      if (shadowMap) {
        shadowMap.autoUpdate = false;
        shadowMap.needsUpdate = true;
      }

      for (let pass = firstPass; pass <= firstPass + bounces; pass++) {
        this._updateBakeTexture(renderer, pass, start);
        this._captureProbes(renderer, scene, start, end);
        this._repackProbes(renderer, start, end);
      }
    } finally {
      renderTarget.viewport.copy(currentViewport);
      renderer.setRenderTarget(currentRenderTarget, currentActiveCubeFace, currentActiveMipmapLevel);
      renderer.autoClear = currentAutoClear;
      if (shadowMap && currentShadowAutoUpdate !== undefined) shadowMap.autoUpdate = currentShadowAutoUpdate;

      if (replacedSunLights !== null) restoreSunLights(scene, replacedSunLights);

      scene.matrixWorldAutoUpdate = currentMatrixWorldAutoUpdate;
      this.visible = currentVisible;
      this.texture = currentTexture;
    }
  }

  _updateBakeTexture(renderer: WebGLRenderer, pass: number, start: number) {
    if (pass === 0) {
      this.texture = _emptyAtlas;
      if (start === 0) this._bouncePass = -1;
      return;
    }

    if (start === 0) {
      const renderTarget = this._renderTarget!;

      if (this._bounceTarget === null) this._bounceTarget = renderTarget.clone() as WebGL3DRenderTarget;

      renderer.initRenderTarget(renderTarget);
      renderer.initRenderTarget(this._bounceTarget);
      _copyRegion.min.set(0, 0, 0);
      _copyRegion.max.set(renderTarget.width, renderTarget.height, renderTarget.depth);
      renderer.copyTextureToTexture(renderTarget.texture, this._bounceTarget.texture, _copyRegion);
      this._bouncePass = pass;
    }

    this.texture = this._bounceTarget!.texture;
  }

  _captureProbes(renderer: WebGLRenderer, scene: Scene, start: number, end: number) {
    const { x: nx, y: ny, z: nz } = this.resolution;
    const probesPerLayer = nx * nz;

    _mesh.material = _shMaterial;
    _shMaterial.uniforms.envMap.value = _cubeRenderTarget.texture;

    for (let probeIndex = start; probeIndex < end; probeIndex++) {
      const ix = probeIndex % nx;
      const iy = Math.floor(probeIndex / probesPerLayer);
      const iz = Math.floor(probeIndex / nx) % nz;

      this.getProbePosition(ix, iy, iz, _position);
      _cubeCamera.position.copy(_position);

      // The cube faces must be cleared per face.
      renderer.autoClear = true;
      _cubeCamera.update(renderer, scene);

      // Keep batch rows in texture order (X, Y, Z).
      const batchRow = ix + iy * nx + iz * nx * ny;

      renderer.autoClear = false;
      _batchTarget.viewport.set(0, batchRow, 9, 1);
      renderer.setRenderTarget(_batchTarget);
      renderer.render(_scene, _camera);
    }
  }

  _repackProbes(renderer: WebGLRenderer, start: number, end: number) {
    const { x: nx, y: ny, z: nz } = this.resolution;
    const probesPerLayer = nx * nz;
    const startY = Math.floor(start / probesPerLayer);
    const endY = Math.floor(end / probesPerLayer);
    const paddedSlices = nz + 2 * ATLAS_PADDING;
    const renderTarget = this._renderTarget!;

    for (const material of _repackMaterials) {
      material.uniforms.batchTexture.value = _batchTarget.texture;
      material.uniforms.resolution.value.copy(this.resolution);
    }

    // Map the horizontal bake range to contiguous rows in each Z slice.
    for (let iz = 0; iz < nz; iz++) {
      const sliceStart = startY * nx + clamp((start % probesPerLayer) - iz * nx, 0, nx);
      const sliceEnd = endY * nx + clamp((end % probesPerLayer) - iz * nx, 0, nx);

      for (let probeIndex = sliceStart; probeIndex < sliceEnd;) {
        const ix = probeIndex % nx;
        const iy = Math.floor(probeIndex / nx);

        // Coalesce complete rows within a slice into one rectangle.
        const width = Math.min(nx - ix, sliceEnd - probeIndex);
        let height = 1;

        if (width === nx) {
          height = Math.min(ny - iy, Math.floor((sliceEnd - probeIndex) / nx));
        }

        renderTarget.viewport.set(ix, iy, width, height);

        for (let t = 0; t < 7; t++) {
          _mesh.material = _repackMaterials[t];
          _mesh.material.uniforms.sliceZ.value = iz;
          const base = t * paddedSlices;

          renderer.setRenderTarget(renderTarget, base + ATLAS_PADDING + iz);
          renderer.render(_scene, _camera);

          if (iz === 0) {
            renderer.setRenderTarget(renderTarget, base);
            renderer.render(_scene, _camera);
          }

          if (iz === nz - 1) {
            renderer.setRenderTarget(renderTarget, base + ATLAS_PADDING + nz);
            renderer.render(_scene, _camera);
          }
        }

        probeIndex += width * height;
      }
    }
  }

  _ensureTextures() {
    if (this._renderTarget !== null) return;

    const res = this.resolution;
    const nx = res.x,
      ny = res.y,
      nz = res.z;

    // Atlas depth: 7 sub-volumes, each with ATLAS_PADDING slices at both ends
    const atlasDepth = 7 * (nz + 2 * ATLAS_PADDING);

    const rt = new WebGL3DRenderTarget(nx, ny, atlasDepth, {
      format: PixelFormat.RGBA,
      type: TextureType.Float,
      minFilter: TextureFilter.Linear,
      magFilter: TextureFilter.Linear,
      generateMipmaps: false,
      depthBuffer: false,
    });

    this._renderTarget = rt;
    this.texture = rt.texture;
  }

  dispose() {
    if (this._bounceTarget !== null) {
      this._bounceTarget.dispose();
      this._bounceTarget = null;
      this._bouncePass = -1;
    }

    if (this._renderTarget !== null) {
      this._renderTarget.dispose();
      this._renderTarget = null;
      this.texture = null;
    }

    super.dispose();
  }
}

// Internal: Ensure the shared fullscreen-quad scene exists
function _ensureScene() {
  if (!_scene) {
    _camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    _mesh = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial());
    _scene = new Scene();
    _scene.add(_mesh);
  }
}

// Internal: Ensure GPU resources for SH projection are created
function _ensureGPUResources(cubemapSize: number) {
  _ensureScene();

  // Recreate material when cubemap size changes
  if (cubemapSize !== _lastCubemapSize) {
    if (_shMaterial) _shMaterial.dispose();

    _shMaterial = new ShaderMaterial({
      precision: "highp",
      defines: {
        CUBEMAP_SIZE: cubemapSize,
      },
      uniforms: {
        envMap: { value: null },
      },
      vertexShader: /* glsl */ `
				void main() {
					gl_Position = vec4( position.xy, 0.0, 1.0 );
				}
			`,
      fragmentShader: /* glsl */ `
				${common}

				uniform samplerCube envMap;

				void main() {

					int coefIndex = int( gl_FragCoord.x );

					vec3 accum0 = vec3( 0.0 );
					vec3 accum1 = vec3( 0.0 );
					vec3 accum2 = vec3( 0.0 );
					vec3 accum3 = vec3( 0.0 );
					vec3 accum4 = vec3( 0.0 );
					vec3 accum5 = vec3( 0.0 );
					vec3 accum6 = vec3( 0.0 );
					vec3 accum7 = vec3( 0.0 );
					vec3 accum8 = vec3( 0.0 );
					float totalWeight = 0.0;
					float pixelSize = 2.0 / float( CUBEMAP_SIZE );

					for ( int face = 0; face < 6; face ++ ) {

						for ( int iy = 0; iy < CUBEMAP_SIZE; iy ++ ) {

							for ( int ix = 0; ix < CUBEMAP_SIZE; ix ++ ) {

								// WebGL cubemaps have a left-handed orientation (flip = -1)
								float col = ( float( ix ) + 0.5 ) * pixelSize - 1.0;
								float row = 1.0 - ( float( iy ) + 0.5 ) * pixelSize;

								vec3 coord;

								if ( face == 0 ) coord = vec3( 1.0, row, -col );
								else if ( face == 1 ) coord = vec3( -1.0, row, col );
								else if ( face == 2 ) coord = vec3( col, 1.0, -row );
								else if ( face == 3 ) coord = vec3( col, -1.0, row );
								else if ( face == 4 ) coord = vec3( col, row, 1.0 );
								else coord = vec3( -col, row, -1.0 );

								float lengthSq = dot( coord, coord );
								float weight = 4.0 / ( sqrt( lengthSq ) * lengthSq );
								totalWeight += weight;

								vec3 dir = normalize( coord );
								vec3 cw = textureCube( envMap, coord ).rgb * weight;

								// band 0
								accum0 += cw * 0.282095;

								// band 1
								accum1 += cw * ( 0.488603 * dir.y );
								accum2 += cw * ( 0.488603 * dir.z );
								accum3 += cw * ( 0.488603 * dir.x );

								// band 2
								accum4 += cw * ( 1.092548 * ( dir.x * dir.y ) );
								accum5 += cw * ( 1.092548 * ( dir.y * dir.z ) );
								accum6 += cw * ( 0.315392 * ( 3.0 * dir.z * dir.z - 1.0 ) );
								accum7 += cw * ( 1.092548 * ( dir.x * dir.z ) );
								accum8 += cw * ( 0.546274 * ( dir.x * dir.x - dir.y * dir.y ) );

							}

						}

					}

					float norm = 4.0 * PI / totalWeight;

					vec3 accum;
					if ( coefIndex == 0 ) accum = accum0;
					else if ( coefIndex == 1 ) accum = accum1;
					else if ( coefIndex == 2 ) accum = accum2;
					else if ( coefIndex == 3 ) accum = accum3;
					else if ( coefIndex == 4 ) accum = accum4;
					else if ( coefIndex == 5 ) accum = accum5;
					else if ( coefIndex == 6 ) accum = accum6;
					else if ( coefIndex == 7 ) accum = accum7;
					else accum = accum8;

					gl_FragColor = vec4( accum * norm, 1.0 );

				}
			`,
    });

    _lastCubemapSize = cubemapSize;
  }
}

// Internal: Ensure GPU resources for repacking SH into the atlas 3D texture
function _ensureRepackResources() {
  if (_repackMaterials) return;

  _ensureScene();

  // Create 7 materials, one per output texture packing
  // Texture 0: (c0.r, c0.g, c0.b, c1.r)
  // Texture 1: (c1.g, c1.b, c2.r, c2.g)
  // Texture 2: (c2.b, c3.r, c3.g, c3.b)
  // Texture 3: (c4.r, c4.g, c4.b, c5.r)
  // Texture 4: (c5.g, c5.b, c6.r, c6.g)
  // Texture 5: (c6.b, c7.r, c7.g, c7.b)
  // Texture 6: (c8.r, c8.g, c8.b, 0.0)

  const repackVertexShader = /* glsl */ `
		void main() {
			gl_Position = vec4( position.xy, 0.0, 1.0 );
		}
	`;

  _repackMaterials = [];

  for (let t = 0; t < 7; t++) {
    _repackMaterials[t] = new ShaderMaterial({
      precision: "highp",
      defines: {
        TEXTURE_INDEX: t,
      },
      uniforms: {
        batchTexture: { value: null },
        resolution: { value: new Vector3() },
        sliceZ: { value: 0 },
      },
      vertexShader: repackVertexShader,
      fragmentShader: /* glsl */ `
				uniform sampler2D batchTexture;
				uniform vec3 resolution;
				uniform int sliceZ;

				void main() {

					int ix = int( gl_FragCoord.x );
					int iy = int( gl_FragCoord.y );
					int iz = sliceZ;

					int probeIndex = ix + iy * int( resolution.x ) + iz * int( resolution.x ) * int( resolution.y );

					// Read 9 SH coefficients from the batch texture row
					vec4 c0 = texelFetch( batchTexture, ivec2( 0, probeIndex ), 0 );
					vec4 c1 = texelFetch( batchTexture, ivec2( 1, probeIndex ), 0 );
					vec4 c2 = texelFetch( batchTexture, ivec2( 2, probeIndex ), 0 );
					vec4 c3 = texelFetch( batchTexture, ivec2( 3, probeIndex ), 0 );
					vec4 c4 = texelFetch( batchTexture, ivec2( 4, probeIndex ), 0 );
					vec4 c5 = texelFetch( batchTexture, ivec2( 5, probeIndex ), 0 );
					vec4 c6 = texelFetch( batchTexture, ivec2( 6, probeIndex ), 0 );
					vec4 c7 = texelFetch( batchTexture, ivec2( 7, probeIndex ), 0 );
					vec4 c8 = texelFetch( batchTexture, ivec2( 8, probeIndex ), 0 );

					// Pack into the output format for this texture index
					#if TEXTURE_INDEX == 0
						gl_FragColor = vec4( c0.rgb, c1.r );
					#elif TEXTURE_INDEX == 1
						gl_FragColor = vec4( c1.gb, c2.rg );
					#elif TEXTURE_INDEX == 2
						gl_FragColor = vec4( c2.b, c3.rgb );
					#elif TEXTURE_INDEX == 3
						gl_FragColor = vec4( c4.rgb, c5.r );
					#elif TEXTURE_INDEX == 4
						gl_FragColor = vec4( c5.gb, c6.rg );
					#elif TEXTURE_INDEX == 5
						gl_FragColor = vec4( c6.b, c7.rgb );
					#else
						gl_FragColor = vec4( c8.rgb, 0.0 );
					#endif

				}
			`,
    });
  }
}

// Internal: Ensure cube render target and camera exist with the right parameters
function _ensureBakeResources(options: LightProbeGridBakeOptions) {
  if (!_emptyAtlas) {
    _emptyAtlas = new Data3DTexture(new Uint16Array(4), 1, 1, 1);
    _emptyAtlas.type = TextureType.HalfFloat;
    _emptyAtlas.minFilter = TextureFilter.Linear;
    _emptyAtlas.magFilter = TextureFilter.Linear;
    _emptyAtlas.needsUpdate = true;
  }

  const { cubemapSize = 8, near = 0.1, far = 100 } = options;

  if (!_cubeRenderTarget || cubemapSize !== _cachedCubemapSize || near !== _cachedNear || far !== _cachedFar) {
    if (_cubeRenderTarget) _cubeRenderTarget.dispose();

    _cubeRenderTarget = new WebGLCubeRenderTarget(cubemapSize, { type: TextureType.HalfFloat });
    _cubeCamera = new CubeCamera(near, far, _cubeRenderTarget);
    _cachedCubemapSize = cubemapSize;
    _cachedNear = near;
    _cachedFar = far;
  }

  _ensureGPUResources(cubemapSize);
}

function _ensureBatchTarget(totalProbes: number) {
  if (!_batchTarget || _batchTargetProbes !== totalProbes) {
    if (_batchTarget) _batchTarget.dispose();

    _batchTarget = new WebGLRenderTarget(9, totalProbes, {
      type: TextureType.Float,
      minFilter: TextureFilter.Nearest,
      magFilter: TextureFilter.Nearest,
      depthBuffer: false,
    });

    _batchTargetProbes = totalProbes;
  }
}
