import { Color } from "../../math/Color";
import { Vector2 } from "../../math/Vector2";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { common, fog } from "../../renderers/shaders/UniformsLib";
import { mergeUniforms } from "../../renderers/shaders/UniformsUtils";
import chunk_common from "../../renderers/shaders/ShaderChunk/common.glsl";
import chunk_color_pars_vertex from "../../renderers/shaders/ShaderChunk/color_pars_vertex.glsl";
import chunk_fog_pars_vertex from "../../renderers/shaders/ShaderChunk/fog_pars_vertex.glsl";
import chunk_logdepthbuf_pars_vertex from "../../renderers/shaders/ShaderChunk/logdepthbuf_pars_vertex.glsl";
import chunk_clipping_planes_pars_vertex from "../../renderers/shaders/ShaderChunk/clipping_planes_pars_vertex.glsl";
import chunk_logdepthbuf_vertex from "../../renderers/shaders/ShaderChunk/logdepthbuf_vertex.glsl";
import chunk_clipping_planes_vertex from "../../renderers/shaders/ShaderChunk/clipping_planes_vertex.glsl";
import chunk_fog_vertex from "../../renderers/shaders/ShaderChunk/fog_vertex.glsl";
import chunk_color_pars_fragment from "../../renderers/shaders/ShaderChunk/color_pars_fragment.glsl";
import chunk_fog_pars_fragment from "../../renderers/shaders/ShaderChunk/fog_pars_fragment.glsl";
import chunk_logdepthbuf_pars_fragment from "../../renderers/shaders/ShaderChunk/logdepthbuf_pars_fragment.glsl";
import chunk_clipping_planes_pars_fragment from "../../renderers/shaders/ShaderChunk/clipping_planes_pars_fragment.glsl";
import chunk_clipping_planes_fragment from "../../renderers/shaders/ShaderChunk/clipping_planes_fragment.glsl";
import chunk_logdepthbuf_fragment from "../../renderers/shaders/ShaderChunk/logdepthbuf_fragment.glsl";
import chunk_color_fragment from "../../renderers/shaders/ShaderChunk/color_fragment.glsl";
import chunk_tonemapping_fragment from "../../renderers/shaders/ShaderChunk/tonemapping_fragment.glsl";
import chunk_colorspace_fragment from "../../renderers/shaders/ShaderChunk/colorspace_fragment.glsl";
import chunk_fog_fragment from "../../renderers/shaders/ShaderChunk/fog_fragment.glsl";
import chunk_premultiplied_alpha_fragment from "../../renderers/shaders/ShaderChunk/premultiplied_alpha_fragment.glsl";

export type LineMaterialParameters = Omit<Partial<LineMaterial>, "color"> & {
  color?: Color | number | string;
};

const vertexShader: string = /* glsl */ `
		${chunk_common}
		${chunk_color_pars_vertex}
		${chunk_fog_pars_vertex}
		${chunk_logdepthbuf_pars_vertex}
		${chunk_clipping_planes_pars_vertex}

		uniform float linewidth;
		uniform vec2 resolution;

		attribute vec3 instanceStart;
		attribute vec3 instanceEnd;

		attribute vec3 instanceColorStart;
		attribute vec3 instanceColorEnd;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#ifdef USE_DASH

			uniform float dashScale;
			attribute float instanceDistanceStart;
			attribute float instanceDistanceEnd;
			varying float vLineDistance;

		#endif

		float trimSegmentAlpha( const in vec4 start, const in vec4 end ) {

			// compute the interpolation factor needed to trim the segment so it terminates
			// between the camera plane and the near plane

			// conservative estimate of the near plane
			float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
			float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column

			// we need different nearEstimate formula for reversed and default depth buffer
			// a is positive with a reversed depth buffer so it can be used for controlling the code flow
			float nearEstimate = ( a > 0.0 ) ? ( - b / ( a + 1.0 ) ) : ( - 0.5 * b / a );

			return ( nearEstimate - start.z ) / ( end.z - start.z );

		}

		void main() {

			#ifdef USE_COLOR

				vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

			#endif

			float aspect = resolution.x / resolution.y;

			// camera space
			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

			#ifdef USE_DASH

				float lineDistanceStart = dashScale * instanceDistanceStart;
				float lineDistanceEnd = dashScale * instanceDistanceEnd;

			#endif

			#ifdef WORLD_UNITS

				worldStart = start.xyz;
				worldEnd = end.xyz;

			#else

				vUv = uv;

			#endif

			// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
			// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
			// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
			// perhaps there is a more elegant solution -- WestLangley

			bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

			if ( perspective ) {

				if ( start.z < 0.0 && end.z >= 0.0 ) {

					float alpha = trimSegmentAlpha( start, end );
					end.xyz = mix( start.xyz, end.xyz, alpha );

					#ifdef USE_DASH

						lineDistanceEnd = mix( lineDistanceStart, lineDistanceEnd, alpha );

					#endif

				} else if ( end.z < 0.0 && start.z >= 0.0 ) {

					float alpha = trimSegmentAlpha( end, start );
					start.xyz = mix( end.xyz, start.xyz, alpha );

					#ifdef USE_DASH

						lineDistanceStart = mix( lineDistanceEnd, lineDistanceStart, alpha );

					#endif

				}

			}

			#ifdef USE_DASH

				vLineDistance = ( position.y < 0.5 ) ? lineDistanceStart : lineDistanceEnd;
				vUv = uv;

			#endif

			// clip space
			vec4 clipStart = projectionMatrix * start;
			vec4 clipEnd = projectionMatrix * end;

			// ndc space
			vec3 ndcStart = clipStart.xyz / clipStart.w;
			vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

			// direction
			vec2 dir = ndcEnd.xy - ndcStart.xy;

			// account for clip-space aspect ratio
			dir.x *= aspect;
			dir = normalize( dir );

			#ifdef WORLD_UNITS

				vec3 worldDir = normalize( end.xyz - start.xyz );
				vec3 tmpFwd = perspective ? normalize( mix( start.xyz, end.xyz, 0.5 ) ) : vec3( 0.0, 0.0, - 1.0 );
				vec3 worldUp = normalize( cross( worldDir, tmpFwd ) );
				vec3 worldFwd = cross( worldDir, worldUp );
				worldPos = position.y < 0.5 ? start: end;

				// height offset
				float hw = linewidth * 0.5;
				worldPos.xyz += position.x < 0.0 ? hw * worldUp : - hw * worldUp;

				// don't extend the line if we're rendering dashes because we
				// won't be rendering the endcaps
				#ifndef USE_DASH

					// cap extension
					worldPos.xyz += position.y < 0.5 ? - hw * worldDir : hw * worldDir;

					// add width to the box
					worldPos.xyz += worldFwd * hw;

					// endcaps
					if ( position.y > 1.0 || position.y < 0.0 ) {

						worldPos.xyz -= worldFwd * 2.0 * hw;

					}

				#endif

				// project the worldpos
				vec4 clip = projectionMatrix * worldPos;

				// shift the depth of the projected points so the line
				// segments overlap neatly
				vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;

				// only shift the depth of vertices in front of the camera (#35137)
				if ( clip.w > 0.0 ) clip.z = clipPose.z * clip.w;

			#else

				vec2 offset = vec2( dir.y, - dir.x );
				// undo aspect ratio adjustment
				dir.x /= aspect;
				offset.x /= aspect;

				// sign flip
				if ( position.x < 0.0 ) offset *= - 1.0;

				// endcaps
				if ( position.y < 0.0 ) {

					offset += - dir;

				} else if ( position.y > 1.0 ) {

					offset += dir;

				}

				// adjust for linewidth
				offset *= linewidth;

				// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
				offset /= resolution.y;

				// select end
				vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

				// back to clip space
				offset *= clip.w;

				clip.xy += offset;

			#endif

			gl_Position = clip;

			vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

			${chunk_logdepthbuf_vertex}
			${chunk_clipping_planes_vertex}
			${chunk_fog_vertex}

		}
		`;
const fragmentShader: string = /* glsl */ `
		uniform vec3 diffuse;
		uniform float opacity;
		uniform float linewidth;

		#ifdef USE_DASH

			uniform float dashOffset;
			uniform float dashSize;
			uniform float gapSize;

		#endif

		varying float vLineDistance;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		${chunk_common}
		${chunk_color_pars_fragment}
		${chunk_fog_pars_fragment}
		${chunk_logdepthbuf_pars_fragment}
		${chunk_clipping_planes_pars_fragment}

		vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

			float mua;
			float mub;

			vec3 p13 = p1 - p3;
			vec3 p43 = p4 - p3;

			vec3 p21 = p2 - p1;

			float d1343 = dot( p13, p43 );
			float d4321 = dot( p43, p21 );
			float d1321 = dot( p13, p21 );
			float d4343 = dot( p43, p43 );
			float d2121 = dot( p21, p21 );

			float denom = d2121 * d4343 - d4321 * d4321;

			float numer = d1343 * d4321 - d1321 * d4343;

			mua = numer / denom;
			mua = clamp( mua, 0.0, 1.0 );
			mub = ( d1343 + d4321 * ( mua ) ) / d4343;
			mub = clamp( mub, 0.0, 1.0 );

			return vec2( mua, mub );

		}

		void main() {

			float alpha = opacity;
			vec4 diffuseColor = vec4( diffuse, alpha );

			${chunk_clipping_planes_fragment}

			#ifdef USE_DASH

				if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

				if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

			#endif

			#ifdef WORLD_UNITS

				float len;

				if ( isOrthographic ) {

					// View rays are parallel to the z axis so the distance reduces to camera-space XY
					vec2 lineDir = worldEnd.xy - worldStart.xy;
					float t = clamp( dot( worldPos.xy - worldStart.xy, lineDir ) / dot( lineDir, lineDir ), 0.0, 1.0 );
					len = length( worldStart.xy + lineDir * t - worldPos.xy );

				} else {

					// Find the closest points on the view ray and the line segment
					vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
					vec3 lineDir = worldEnd - worldStart;
					vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

					vec3 p1 = worldStart + lineDir * params.x;
					vec3 p2 = rayEnd * params.y;
					vec3 delta = p1 - p2;
					len = length( delta );

				}

				float norm = len / linewidth;

				#ifndef USE_DASH

					#ifdef USE_ALPHA_TO_COVERAGE

						float dnorm = fwidth( norm );
						alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

					#else

						if ( norm > 0.5 ) {

							discard;

						}

					#endif

				#endif

			#else

				#ifdef USE_ALPHA_TO_COVERAGE

					// artifacts appear on some hardware if a derivative is taken within a conditional
					float a = vUv.x;
					float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
					float len2 = a * a + b * b;
					float dlen = fwidth( len2 );

					if ( abs( vUv.y ) > 1.0 ) {

						alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

					}

				#else

					if ( abs( vUv.y ) > 1.0 ) {

						float a = vUv.x;
						float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
						float len2 = a * a + b * b;

						if ( len2 > 1.0 ) discard;

					}

				#endif

			#endif

			${chunk_logdepthbuf_fragment}
			${chunk_color_fragment}

			gl_FragColor = vec4( diffuseColor.rgb, alpha );

			${chunk_tonemapping_fragment}
			${chunk_colorspace_fragment}
			${chunk_fog_fragment}
			${chunk_premultiplied_alpha_fragment}

		}
		`;

/**
 * Wide line material for LineSegments2 and Line2 with WebGLRenderer.
 * Width and dashes can use screen or world units.
 */
export class LineMaterial extends ShaderMaterial {
  readonly isLineMaterial: true = true;

  constructor(parameters?: LineMaterialParameters) {
    super();
    this.type = "LineMaterial";
    this.uniforms = mergeUniforms([
      common,
      fog,
      {
        worldUnits: { value: 1 },
        linewidth: { value: 1 },
        resolution: { value: new Vector2() },
        dashOffset: { value: 0 },
        dashScale: { value: 1 },
        dashSize: { value: 1 },
        gapSize: { value: 1 },
      },
    ]);
    this.vertexShader = vertexShader;
    this.fragmentShader = fragmentShader;
    this.clipping = true;

    // Base classes initialize these as fields, so install their uniform-backed accessors here.
    Object.defineProperties(this, {
      linewidth: {
        configurable: true,
        get: () => this.uniforms.linewidth.value as number,
        set: (value: number) => {
          this.uniforms.linewidth.value = value;
        },
      },
      opacity: {
        configurable: true,
        get: () => this.uniforms.opacity.value as number,
        set: (value: number) => {
          this.uniforms.opacity.value = value;
        },
      },
      alphaToCoverage: {
        configurable: true,
        get: () => "USE_ALPHA_TO_COVERAGE" in this.defines,
        set: (value: boolean) => {
          if ((value === true) !== this.alphaToCoverage) this.needsUpdate = true;
          if (value === true) this.defines.USE_ALPHA_TO_COVERAGE = "";
          else delete this.defines.USE_ALPHA_TO_COVERAGE;
        },
      },
    });
    this.setValues(parameters);
  }

  /** Line color. */
  get color(): Color {
    return this.uniforms.diffuse.value as Color;
  }
  set color(value: Color) {
    this.uniforms.diffuse.value = value;
  }

  /** Whether widths and dash gaps use world units instead of screen pixels. */
  get worldUnits(): boolean {
    return "WORLD_UNITS" in this.defines;
  }
  set worldUnits(value: boolean) {
    if ((value === true) !== this.worldUnits) this.needsUpdate = true;
    if (value === true) this.defines.WORLD_UNITS = "";
    else delete this.defines.WORLD_UNITS;
  }

  /** Whether the line is dashed. */
  get dashed(): boolean {
    return "USE_DASH" in this.defines;
  }
  set dashed(value: boolean) {
    if ((value === true) !== this.dashed) this.needsUpdate = true;
    if (value === true) this.defines.USE_DASH = "";
    else delete this.defines.USE_DASH;
  }

  /** Scale of dashes and gaps. */
  get dashScale(): number {
    return this.uniforms.dashScale.value as number;
  }
  set dashScale(value: number) {
    this.uniforms.dashScale.value = value;
  }

  /** Dash length. */
  get dashSize(): number {
    return this.uniforms.dashSize.value as number;
  }
  set dashSize(value: number) {
    this.uniforms.dashSize.value = value;
  }

  /** Offset into the dash cycle. */
  get dashOffset(): number {
    return this.uniforms.dashOffset.value as number;
  }
  set dashOffset(value: number) {
    this.uniforms.dashOffset.value = value;
  }

  /** Gap length. */
  get gapSize(): number {
    return this.uniforms.gapSize.value as number;
  }
  set gapSize(value: number) {
    this.uniforms.gapSize.value = value;
  }

  /** Viewport size in screen pixels; updated by LineSegments2 when rendered. */
  get resolution(): Vector2 {
    return this.uniforms.resolution.value as Vector2;
  }
  set resolution(value: Vector2) {
    (this.uniforms.resolution.value as Vector2).copy(value);
  }
}
