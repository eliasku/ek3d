import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Timer } from "ek3d/core/Timer";
import { Uniform } from "ek3d/core/Uniform";
import { UniformsGroup } from "ek3d/core/UniformsGroup";
import { TetrahedronGeometry } from "ek3d/geometries/TetrahedronGeometry";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { GLSL3, SRGBColorSpace } from "ek3d/constants";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing example canvas");
const canvas = selected;
let disposed = false;
let frames = 0;
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 25;
const scene = new Scene();
camera.lookAt(scene.position);
const timer = new Timer();
timer.connect(document);
const geometry1 = new TetrahedronGeometry();
const geometry2 = new BoxGeometry();
const texture = new TextureLoader().load("/examples/textures/crate.gif", (loaded) => {
  if (disposed) loaded.dispose();
});
texture.colorSpace = SRGBColorSpace;
const viewGroup = new UniformsGroup().setName("ViewData");
viewGroup.add(new Uniform(camera.projectionMatrix)).add(new Uniform(camera.matrixWorldInverse));
const lightGroup = new UniformsGroup().setName("LightingData");
lightGroup
  .add(new Uniform(new Vector3(0, 0, 10)))
  .add(new Uniform(new Color(0x7c7c7c)))
  .add(new Uniform(new Color(0xd5d5d5)))
  .add(new Uniform(new Color(0xe7e7e7)))
  .add(new Uniform(64));
const material1 = new RawShaderMaterial({
  uniforms: { modelMatrix: { value: null }, normalMatrix: { value: null }, color: { value: null } },
  vertexShader: `
uniform ViewData {
  mat4 projectionMatrix;
  mat4 viewMatrix;
};

uniform mat4 modelMatrix;
uniform mat3 normalMatrix;

in vec3 position;
in vec3 normal;

out vec3 vPositionEye;
out vec3 vNormalEye;

void main()  {

  vec4 vertexPositionEye = viewMatrix * modelMatrix * vec4( position, 1.0 );

  vPositionEye = vertexPositionEye.xyz;
  vNormalEye = normalMatrix * normal;

  gl_Position = projectionMatrix * vertexPositionEye;

}
    `,
  fragmentShader: `
precision highp float;

vec4 LinearTosRGB( in vec4 value ) {
  return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}

uniform LightingData {
  vec3 position;
  vec3 ambientColor;
  vec3 diffuseColor;
  vec3 specularColor;
  float shininess;
} Light;

uniform vec3 color;

in vec3 vPositionEye;
in vec3 vNormalEye;

out vec4 fragColor;

void main()  {

  // a very basic lighting equation (Phong reflection model) for testing

  vec3 l = normalize( Light.position - vPositionEye );
  vec3 n = normalize( vNormalEye );
  vec3 e = - normalize( vPositionEye );
  vec3 r = normalize( reflect( - l, n ) );

  float diffuseLightWeighting = max( dot( n, l ), 0.0 );
  float specularLightWeighting = max( dot( r, e ), 0.0 );

  specularLightWeighting = pow( specularLightWeighting, Light.shininess );

  vec3 lightWeighting = Light.ambientColor +
    Light.diffuseColor * diffuseLightWeighting +
    Light.specularColor * specularLightWeighting;

  fragColor = vec4( color.rgb * lightWeighting.rgb, 1.0 );

  fragColor = LinearTosRGB( fragColor );

}
    `,
  glslVersion: GLSL3,
});
const material2 = new RawShaderMaterial({
  uniforms: { modelMatrix: { value: null }, normalMatrix: { value: null }, diffuseMap: { value: null } },
  vertexShader: `
layout(std140) uniform ViewData {
  mat4 projectionMatrix;
  mat4 viewMatrix;
};

uniform mat4 modelMatrix;
uniform mat3 normalMatrix;

in vec3 position;
in vec3 normal;
in vec2 uv;

out vec3 vPositionEye;
out vec3 vNormalEye;
out vec2 vUv;

void main()  {

  vec4 vertexPositionEye = viewMatrix * modelMatrix * vec4( position, 1.0 );

  vPositionEye = vertexPositionEye.xyz;
  vNormalEye = normalMatrix * normal;
  vUv = uv;
  gl_Position = projectionMatrix * vertexPositionEye;

}
    `,
  fragmentShader: `
precision highp float;

vec4 LinearTosRGB( in vec4 value ) {
  return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}

uniform sampler2D diffuseMap;

in vec2 vUv;
in vec3 vPositionEye;
in vec3 vNormalEye;
out vec4 fragColor;

uniform LightingData {
  vec3 position;
  vec3 ambientColor;
  vec3 diffuseColor;
  vec3 specularColor;
  float shininess;
} Light;

void main()  {


  // a very basic lighting equation (Phong reflection model) for testing

  vec3 l = normalize( Light.position - vPositionEye );
  vec3 n = normalize( vNormalEye );
  vec3 e = - normalize( vPositionEye );
  vec3 r = normalize( reflect( - l, n ) );

  float diffuseLightWeighting = max( dot( n, l ), 0.0 );
  float specularLightWeighting = max( dot( r, e ), 0.0 );

  specularLightWeighting = pow( specularLightWeighting, Light.shininess );

  vec3 lightWeighting = Light.ambientColor +
    Light.diffuseColor * diffuseLightWeighting +
    Light.specularColor * specularLightWeighting;

  fragColor = vec4( texture( diffuseMap, vUv ).rgb * lightWeighting.rgb, 1.0 );

  fragColor = LinearTosRGB( fragColor );

}
    `,
  glslVersion: GLSL3,
});
const meshes: Mesh<RawShaderMaterial>[] = [];
for (let i = 0; i < 200; i++) {
  const material = (i % 2 === 0 ? material1 : material2).clone();
  const mesh = new Mesh<RawShaderMaterial>(i % 2 === 0 ? geometry1 : geometry2, material);
  material.uniformsGroups = [viewGroup, lightGroup];
  material.uniforms["modelMatrix"]!.value = mesh.matrixWorld;
  material.uniforms["normalMatrix"]!.value = mesh.normalMatrix;
  if (i % 2 === 0) material.uniforms["color"]!.value = new Color(0xffffff * Math.random());
  else material.uniforms["diffuseMap"]!.value = texture;
  mesh.scale.setScalar(1 + Math.random() * 0.5);
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  mesh.position.set(Math.random() * 40 - 20, Math.random() * 40 - 20, Math.random() * 20 - 10);
  scene.add(mesh);
  meshes.push(mesh);
}
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();
renderer.setAnimationLoop(() => {
  timer.update();
  const delta = timer.getDelta();
  for (const mesh of meshes) {
    mesh.rotation.x += delta * 0.5;
    mesh.rotation.y += delta * 0.3;
  }
  renderer.render(scene, camera);
  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(++frames);
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  timer.dispose();
  disposeObject(scene);
  material1.dispose();
  material2.dispose();
  texture.dispose();
  viewGroup.dispose();
  lightGroup.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
