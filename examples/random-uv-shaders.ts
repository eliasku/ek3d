export const randomUV = /* glsl */ `

			uniform sampler2D noiseMap;
			uniform float enableRandom;
			uniform float useNoiseMap;
			uniform float debugNoise;
			uniform float useSuslikMethod;

			float directNoise(vec2 p){
			    vec2 ip = floor(p);
			    vec2 u = fract(p);
			    u = u*u*(3.0-2.0*u);

			    float res = mix(
			        mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
			        mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
			    return res*res;
			}

			float sum( vec4 v ) { return v.x+v.y+v.z; }

			vec4 textureNoTile( sampler2D mapper, in vec2 uv ){

			    // sample variation pattern
			    float k = 0.0;
			    if( useNoiseMap == 1.0 ) k = texture2D( noiseMap, 0.005*uv ).x;
			    else k = directNoise( uv );

			    // compute index
			    float index = k*8.0;
			    float f = fract( index );
			    float ia = 0.0;
			    float ib = 0.0;

			    if( useSuslikMethod == 1.0 ){
			    	ia = floor(index+0.5);
			    	ib = floor(index);
			    	f = min(f, 1.0-f)*2.0;
			    } else {
			    	ia = floor( index );
			    	ib = ia + 1.0;
			    }

			    // offsets for the different virtual patterns
			    vec2 offa = sin(vec2(3.0,7.0)*ia); // can replace with any other hash
			    vec2 offb = sin(vec2(3.0,7.0)*ib); // can replace with any other hash

			    // compute derivatives for mip-mapping
			    vec2 dx = dFdx(uv);
			    vec2 dy = dFdy(uv);

			    // sample the two closest virtual patterns
			    vec4 cola = textureGrad( mapper, uv + offa, dx, dy );
			    vec4 colb = textureGrad( mapper, uv + offb, dx, dy );
			    if( debugNoise == 1.0 ){
			    	cola = vec4( 0.1,0.0,0.0,1.0 );
			    	colb = vec4( 0.0,0.0,1.0,1.0 );
			    }

			    // interpolate between the two virtual patterns
			    return mix( cola, colb, smoothstep(0.2,0.8,f-0.1*sum(cola-colb)) );

			}`;
export const map_fragment = /* glsl */ `
			#ifdef USE_MAP

				if( enableRandom == 1.0 ) diffuseColor *= textureNoTile( map, vMapUv );
				else diffuseColor *= texture2D( map, vMapUv );

			#endif
			`;
export const alphamap_pars_fragment = /* glsl */ `
			#ifdef USE_ALPHAMAP
				uniform sampler2D alphaMap;
				uniform float disolve;
				uniform float threshold;
			#endif
			`;
export const alphamap_fragment = /* glsl */ `
			#ifdef USE_ALPHAMAP
			    float vv = texture2D( alphaMap, vAlphaMapUv ).g;
			    float r = disolve * (1.0 + threshold * 2.0) - threshold;
			    float mixf = clamp((vv - r)*(1.0/threshold), 0.0, 1.0);
				diffuseColor.a = mixf;
			#endif
			`;
