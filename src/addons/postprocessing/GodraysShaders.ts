import packing from "../../renderers/shaders/ShaderChunk/packing.glsl";
import common from "../../renderers/shaders/ShaderChunk/common.glsl";
import dithering_pars_fragment from "../../renderers/shaders/ShaderChunk/dithering_pars_fragment.glsl";
import dithering_fragment from "../../renderers/shaders/ShaderChunk/dithering_fragment.glsl";

/*
 * Altered from three-good-godrays 0.12.0.
 *
 * Copyright © 2022 Casey Primozic
 *
 * Adapted from original code (https://github.com/N8python/goodGodRays)
 * by https://github.com/n8python
 *
 * This software is provided 'as-is', without any express or implied warranty. In
 * no event will the authors be held liable for any damages arising from the use of
 * this software.
 *
 * Permission is granted to anyone to use this software for any purpose, including
 * commercial applications, and to alter it and redistribute it freely, subject to
 * the following restrictions:
 *
 * 1. The origin of this software must not be misrepresented; you must not claim
 *    that you wrote the original software. If you use this software in a product,
 *    an acknowledgment in the product documentation would be appreciated but is
 *    not required.
 *
 * 2. Altered source versions must be plainly marked as such, and must not be
 *    misrepresented as being the original software.
 *
 * 3. This notice may not be removed or altered from any source distribution.
 */
export const bilateralFilter_default: string = `uniform sampler2D tInput;uniform vec2 resolution;uniform float bSigma;varying vec2 vUv;
#if (KSIZE_ENUM == 0)
#define KSIZE 2
#define MSIZE 5
const float kernel[MSIZE]=float[MSIZE](0.,0.24196934138575799,0.39894,0.24196934138575799,0.);
#elif (KSIZE_ENUM == 1)
#define KSIZE 3
#define MSIZE 7
const float kernel[MSIZE]=float[MSIZE](0.,0.39104045872899694,0.3969502784491287,0.39894,0.3969502784491287,0.39104045872899694,0.);
#elif (KSIZE_ENUM == 2)
#define KSIZE 4
#define MSIZE 9
const float kernel[MSIZE]=float[MSIZE](0.,0.3813856354024969,0.39104045872899694,0.3969502784491287,0.39894,0.3969502784491287,0.39104045872899694,0.3813856354024969,0.);
#elif (KSIZE_ENUM == 3)
#define KSIZE 5
#define MSIZE 11
const float kernel[MSIZE]=float[MSIZE](0.,0.03682680352274845,0.03813856354024969,0.039104045872899694,0.03969502784491287,0.039894,0.03969502784491287,0.039104045872899694,0.03813856354024969,0.03682680352274845,0.);
#elif (KSIZE_ENUM == 4)
#define KSIZE 6
#define MSIZE 13
const float kernel[MSIZE]=float[MSIZE](0.,0.035206331431709856,0.03682680352274845,0.03813856354024969,0.039104045872899694,0.03969502784491287,0.039894,0.03969502784491287,0.039104045872899694,0.03813856354024969,0.03682680352274845,0.035206331431709856,0.);
#elif (KSIZE_ENUM == 5)
#define KSIZE 7
#define MSIZE 15
const float kernel[MSIZE]=float[MSIZE](0.031225216,0.033322271,0.035206333,0.036826804,0.038138565,0.039104044,0.039695028,0.039894000,0.039695028,0.039104044,0.038138565,0.036826804,0.035206333,0.033322271,0.031225216);
#endif
float normpdf(in float x,in float sigma){return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;}void main(){ivec2 fragCoord=ivec2(vUv*resolution);vec4 centerSample=texelFetch(tInput,fragCoord,0);
#if defined(DEBUG_STEPS)
gl_FragColor=centerSample;
#else
float c=centerSample.r;float finalValue=0.;float bZ=1.0/normpdf(0.0,bSigma);float totalFactor=0.;for(int i=-KSIZE;i<=KSIZE;++i){for(int j=-KSIZE;j<=KSIZE;++j){float cc=texelFetch(tInput,fragCoord+ivec2(i,j),0).r;float factor=normpdf(cc-c,bSigma)*bZ*kernel[KSIZE+j]*kernel[KSIZE+i];totalFactor+=factor;finalValue+=factor*cc;}}gl_FragColor=vec4(vec3(finalValue/totalFactor),centerSample.a);
#endif
}`;

export const compositor_default: string = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

export const compositor_default2: string = `${common}
uniform sampler2D godrays;uniform sampler2D sceneDiffuse;uniform sampler2D sceneDepth;uniform vec2 resolution;uniform vec2 godraysResolution;uniform float near;uniform float far;uniform vec3 color;uniform bool gammaCorrection;varying vec2 vUv;
#define DITHERING
${dithering_pars_fragment}
float linearize_depth(float depth,float zNear,float zFar){
#if defined( USE_LOGDEPTHBUF )
float d=pow(2.0,depth*log2(far+1.0))-1.0;float a=far/(far-near);float b=far*near/(near-far);depth=a+b/d;
#endif
return zNear*zFar/(zFar+depth*(zNear-zFar));}vec4 LinearTosRGB_(in vec4 value){return vec4(mix(pow(value.rgb,vec3(0.41666))*1.055-vec3(0.055),value.rgb*12.92,vec3(lessThanEqual(value.rgb,vec3(0.0031308)))),value.a);}void main(){float rawDepth=texture2D(sceneDepth,vUv).x;float correctDepth=linearize_depth(rawDepth,near,far);vec2 texelSize=1.0/godraysResolution;vec2 texelPos=vUv*godraysResolution-0.5;vec2 base=floor(texelPos);vec2 f=texelPos-base;float totalWeight=0.0;float totalIllum=0.0;for(int y=-JBU_EXTENT;y<=1+JBU_EXTENT;y++){for(int x=-JBU_EXTENT;x<=1+JBU_EXTENT;x++){vec2 sampleUv=(base+vec2(float(x),float(y))+0.5)*texelSize;vec4 data=texture2D(godrays,sampleUv);float sampleDepth=data.a;vec2 d=vec2(float(x),float(y))-f;float spatialW=exp(-dot(d,d)/(2.0*JBU_SPATIAL_SIGMA*JBU_SPATIAL_SIGMA));float depthDiff=(sampleDepth-correctDepth)/max(correctDepth,0.001);float depthW=exp(-0.5*depthDiff*depthDiff/(JBU_DEPTH_SIGMA*JBU_DEPTH_SIGMA));float w=spatialW*depthW;totalWeight+=w;totalIllum+=data.r*w;}}float bestChoice=totalWeight>0.0?totalIllum/totalWeight:0.0;vec4 diffuse=texture2D(sceneDiffuse,vUv);
#if defined(DEBUG_STEPS)
vec3 totalColor=vec3(0.0);float totalColorWeight=0.0;for(int y=-JBU_EXTENT;y<=1+JBU_EXTENT;y++){for(int x=-JBU_EXTENT;x<=1+JBU_EXTENT;x++){vec2 sampleUv=(base+vec2(float(x),float(y))+0.5)*texelSize;vec4 data=texture2D(godrays,sampleUv);float sampleDepth=data.a;vec2 d=vec2(float(x),float(y))-f;float spatialW=exp(-dot(d,d)/(2.0*JBU_SPATIAL_SIGMA*JBU_SPATIAL_SIGMA));float depthDiff=(sampleDepth-correctDepth)/max(correctDepth,0.001);float depthW=exp(-0.5*depthDiff*depthDiff/(JBU_DEPTH_SIGMA*JBU_DEPTH_SIGMA));float w=spatialW*depthW;totalColorWeight+=w;totalColor+=data.rgb*w;}}gl_FragColor=vec4(totalColorWeight>0.0?totalColor/totalColorWeight:vec3(0.0),diffuse.a);
#else
gl_FragColor=vec4(mix(diffuse.rgb,color,bestChoice),diffuse.a);
#endif
${dithering_fragment}
if(gammaCorrection){gl_FragColor=LinearTosRGB_(gl_FragColor);}}`;

export const godrays_default: string = `varying vec2 vUv;varying vec3 vWorldRay;uniform sampler2D sceneDepth;uniform vec3 lightPos;uniform vec3 cameraPos;uniform vec2 resolution;uniform mat4 cameraProjectionMatrixInv;uniform mat4 cameraMatrixWorld;
#if defined(USE_CUBE_SHADOWMAP)
uniform samplerCube shadowMap;
#else
uniform sampler2D shadowMap;
#endif
uniform float texelSizeY;uniform float lightCameraNear;uniform float lightCameraFar;uniform float near;uniform float far;uniform float density;uniform float maxDensity;uniform float distanceAttenuation;uniform vec3[6]fNormals;uniform float[6]fConstants;uniform float raymarchSteps;uniform float raymarchStepSize;uniform float minSteps;uniform float maxSteps;uniform float shadowTexelWorldSize;uniform mat4 premultipliedLightCameraMatrix;
${packing}
float linearize_depth(float depth,float zNear,float zFar){
#if defined( USE_LOGDEPTHBUF )
float d=pow(2.0,depth*log2(zFar+1.0))-1.0;float a=zFar/(zFar-zNear);float b=zFar*zNear/(zNear-zFar);depth=a+b/d;
#endif
return zNear*zFar/(zFar+depth*(zNear-zFar));}vec3 WorldPosFromDepth(float depth){
#if defined( USE_LOGDEPTHBUF )
float d=pow(2.0,depth*log2(far+1.0))-1.0;float a=far/(far-near);float b=far*near/(near-far);depth=a+b/d;
#endif
float ndcZ=depth*2.0-1.0;float invW=1.0/(cameraProjectionMatrixInv[2][3]*ndcZ+cameraProjectionMatrixInv[3][3]);return vWorldRay*invW+cameraMatrixWorld[3].xyz;}vec2 cubeToUV(vec3 v){vec3 absV=abs(v);float scaleToCube=1.0/max(absV.x,max(absV.y,absV.z));absV*=scaleToCube;v*=scaleToCube*(1.0-2.0*texelSizeY);vec2 planar=v.xy;float almostATexel=1.5*texelSizeY;float almostOne=1.0-almostATexel;if(absV.z>=almostOne){if(v.z>0.0)planar.x=4.0-v.x;}else if(absV.x>=almostOne){float signX=sign(v.x);planar.x=v.z*signX+2.0*signX;}else if(absV.y>=almostOne){float signY=sign(v.y);planar.x=v.x+2.0*signY+2.0;planar.y=v.z*signY-2.0;}return vec2(0.125,0.25)*planar+vec2(0.375,0.75);}vec3 projectToShadowMap(vec3 worldPos){vec4 lightSpacePos=premultipliedLightCameraMatrix*vec4(worldPos,1.0);lightSpacePos/=lightSpacePos.w;lightSpacePos=lightSpacePos*0.5+0.5;return lightSpacePos.xyz;}vec2 inShadow(vec3 worldPos){
#if defined(USE_CUBE_SHADOWMAP)
vec3 lightToPos=worldPos-lightPos;float lightDist=length(lightToPos);float shadowMapDepth=textureCube(shadowMap,lightToPos).r;float depth=lightCameraNear+(lightCameraFar-lightCameraNear)*shadowMapDepth;return vec2(float(lightDist>depth+0.005),lightDist);
#else
#if defined(IS_POINT_LIGHT)
vec2 shadowMapUV=cubeToUV(normalize(worldPos-lightPos));
#elif defined(IS_DIRECTIONAL_LIGHT)
vec3 shadowMapUV=projectToShadowMap(worldPos);bool isOutsideShadowMap=shadowMapUV.x<0.0||shadowMapUV.x>1.0||shadowMapUV.y<0.0||shadowMapUV.y>1.0||shadowMapUV.z<0.0||shadowMapUV.z>1.0;if(isOutsideShadowMap){return vec2(1.0,0.0);}
#endif
vec4 packedDepth=texture2D(shadowMap,shadowMapUV.xy);
#if defined( USE_UNPACKED_DEPTH )
#if defined(IS_DIRECTIONAL_LIGHT)
float depth=packedDepth.x;
#else
float depth=1.-packedDepth.x;
#endif
#else
float depth=unpackRGBAToDepth(packedDepth);
#endif
depth=lightCameraNear+(lightCameraFar-lightCameraNear)*depth;
#if defined(IS_POINT_LIGHT)
float lightDist=distance(worldPos,lightPos);
#elif defined(IS_DIRECTIONAL_LIGHT)
float lightDist=(lightCameraNear+(lightCameraFar-lightCameraNear)*shadowMapUV.z);
#endif
float difference=lightDist-depth;return vec2(float(difference>0.0),lightDist);
#endif
}float sdPlane(vec3 p,vec3 n,float h){return dot(p,n)+h;}void main(){float depth=texture2D(sceneDepth,vUv).x;float linearDepth=linearize_depth(depth,near,far);vec3 worldPos=WorldPosFromDepth(depth);vec3 direction=normalize(worldPos-cameraPos);float distToTarget=distance(worldPos,cameraPos);float tEntry=0.0;float tExit=distToTarget;bool missed=false;for(int i=0;i<6;i++){float denom=dot(fNormals[i],direction);float dist=sdPlane(cameraPos,fNormals[i],fConstants[i]);if(abs(denom)<1e-6){if(dist>0.0){missed=true;break;}}else{float t=-dist/denom;if(denom<0.0){tEntry=max(tEntry,t);}else{tExit=min(tExit,t);}}}if(missed||tEntry>=tExit){gl_FragColor=vec4(0.0,0.0,0.0,linearDepth);return;}float startOffset=tEntry>0.0?0.001:0.0;vec3 startPos=cameraPos+(tEntry+startOffset)*direction;worldPos=cameraPos+tExit*direction;float illum=0.0;float rayLength=distance(startPos,worldPos);float densityFactor=rayLength*density;float baseSteps;if(raymarchStepSize>0.0){float effectiveStepSize=max(raymarchStepSize,shadowTexelWorldSize*0.5);baseSteps=clamp(rayLength/effectiveStepSize,minSteps,maxSteps);}else{baseSteps=raymarchSteps;}float noise=fract(52.9829189*fract(0.06711056*gl_FragCoord.x+0.00583715*gl_FragCoord.y));float samplesFloat=round(baseSteps+((baseSteps/8.0)+2.0)*noise);int samples=int(samplesFloat);float earlyOutThreshold=-log(1.0-maxDensity)*samplesFloat;int stepsTaken=samples;for(int i=0;i<samples;i++){vec3 samplePos=mix(startPos,worldPos,float(i)/samplesFloat);vec2 shadowInfo=inShadow(samplePos);float shadowAmount=1.0-shadowInfo.x;illum+=shadowAmount*densityFactor*pow(1.0-shadowInfo.y/lightCameraFar,distanceAttenuation);if(illum>earlyOutThreshold){stepsTaken=i+1;break;}}illum/=samplesFloat;
#if defined(DEBUG_STEPS)
float t=clamp(float(stepsTaken)/150.0,0.0,1.0);gl_FragColor=vec4(0.0,t,0.0,linearDepth);
#else
gl_FragColor=vec4(vec3(clamp(1.0-exp(-illum),0.0,maxDensity)),linearDepth);
#endif
}`;

export const godrays_default2: string = `varying vec2 vUv;varying vec3 vWorldRay;uniform mat4 cameraProjectionMatrixInv;uniform mat4 cameraMatrixWorld;void main(){vec2 ndcXY=position.xy;vUv=ndcXY*0.5+0.5;vec3 viewRay=vec3(cameraProjectionMatrixInv[0][0]*ndcXY.x+cameraProjectionMatrixInv[3][0],cameraProjectionMatrixInv[1][1]*ndcXY.y+cameraProjectionMatrixInv[3][1],cameraProjectionMatrixInv[3][2]);vWorldRay=mat3(cameraMatrixWorld)*viewRay;gl_Position=vec4(ndcXY,1.0,1.0);}`;
