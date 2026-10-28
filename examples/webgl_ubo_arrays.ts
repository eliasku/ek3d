import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Timer } from "ek3d/core/Timer";
import { Uniform } from "ek3d/core/Uniform";
import { UniformsGroup } from "ek3d/core/UniformsGroup";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { Color } from "ek3d/math/Color";
import { Vector4 } from "ek3d/math/Vector4";
import { GLSL } from "ek3d/constants";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import common from "ek3d/renderers/shaders/ShaderChunk/common.glsl";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing example canvas");
const canvas = selected;
let disposed = false;
let frames = 0;
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 50, 50);
const scene = new Scene();
camera.lookAt(scene.position);
const timer = new Timer();
timer.connect(document);
const geometry = new SphereGeometry();
const lightGroup = new UniformsGroup().setName("LightingData");
const lights: Uniform<Vector4>[] = [];
const colors: Uniform<Vector4>[] = [];
const centers: { x: number; z: number }[] = [];
const maxLights = 300;
const api = { count: 200 };
for (let i = 0; i < maxLights; i++) {
  const color = new Color(0xffffff * Math.random());
  const x = Math.random() * 50 - 25;
  const z = Math.random() * 50 - 25;
  lights.push(new Uniform(new Vector4(x, 1, z, 0)));
  colors.push(new Uniform(new Vector4(color.r, color.g, color.b, 0)));
  centers.push({ x, z });
}
const count = new Uniform(api.count);
lightGroup.add(lights).add(colors).add(count);
const viewGroup = new UniformsGroup().setName("ViewData");
viewGroup.add(new Uniform(camera.projectionMatrix)).add(new Uniform(camera.matrixWorldInverse));
const material = new RawShaderMaterial({
  uniforms: { modelMatrix: { value: null }, normalMatrix: { value: null } },
  name: "Box",
  defines: { POINTLIGHTS_MAX: maxLights },
  vertexShader: `
uniform ViewData {
  mat4 projectionMatrix;
  mat4 viewMatrix;
};

uniform mat4 modelMatrix;
uniform mat3 normalMatrix;

in vec3 position;
in vec3 normal;
in vec2 uv;
out vec2 vUv;

out vec3 vPositionEye;
out vec3 vNormalEye;

void main()  {

  vec4 vertexPositionEye = viewMatrix * modelMatrix * vec4( position, 1.0 );

  vPositionEye = (modelMatrix * vec4( position, 1.0 )).xyz;
  vNormalEye = (vec4(normal , 1.)).xyz;

  vUv = uv;

  gl_Position = projectionMatrix * vertexPositionEye;

}
    `,
  fragmentShader: `
precision highp float;
precision highp int;

uniform LightingData {
  vec4 lightPosition[POINTLIGHTS_MAX];
  vec4 lightColor[POINTLIGHTS_MAX];
  float pointLightsCount;
};

#include <common>
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
    
  float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
    
  if ( cutoffDistance > 0.0 ) {
    
    distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
    
  }
    
  return distanceFalloff;

}

in vec2 vUv;
in vec3 vPositionEye;
in vec3 vNormalEye;
out vec4 fragColor;

void main()  {

  vec4 color = vec4(vec3(0.), 1.);
  for (int x = 0; x < int(pointLightsCount); x++) {
    vec3 offset = lightPosition[x].xyz - vPositionEye;
    vec3 dirToLight = normalize( offset );
    float distance = length( offset );

    float diffuse = max(0.0, dot(vNormalEye, dirToLight));
    float attenuation = 1.0 / (distance * distance);

    vec3 lightWeighting = lightColor[x].xyz * getDistanceAttenuation( distance, 4., .7 );
    color.rgb += lightWeighting;
  }
  fragColor = color;

}
    `,
  glslVersion: GLSL.GLSL3,
});
function addMesh(shape: SphereGeometry | PlaneGeometry): Mesh<RawShaderMaterial> {
  const mesh = new Mesh<RawShaderMaterial>(shape, material.clone());
  mesh.material.uniformsGroups = [viewGroup, lightGroup];
  mesh.material.uniforms["modelMatrix"]!.value = mesh.matrixWorld;
  mesh.material.uniforms["normalMatrix"]!.value = mesh.normalMatrix;
  scene.add(mesh);
  return mesh;
}
const plane = addMesh(new PlaneGeometry(100, 100));
plane.rotation.x = -Math.PI / 2;
plane.position.y = -1;
for (let x = 0; x < 10; x++) {
  for (let z = 0; z < 10; z++) addMesh(geometry).position.set(x * 6 - 30, 0, z * 6 - 30);
}
const renderer = new WebGLRenderer({ canvas, antialias: true, shaderChunks: { common } });
const controls = new OrbitControls(camera, canvas);
controls.enablePan = false;
const stats = new Stats();
document.body.appendChild(stats.dom);
const gui = new GUI();
gui
  .add(api, "count", 1, maxLights)
  .step(1)
  .onChange(() => {
    count.value = api.count;
  });
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();
renderer.setAnimationLoop(() => {
  timer.update();
  const elapsed = timer.getElapsed();
  for (let i = 0; i < lights.length; i++) {
    const center = centers[i]!;
    const angle = 0.5 * elapsed + i * 0.5;
    lights[i]!.value.set(center.x + Math.sin(angle) * 5, 1, center.z + Math.cos(angle) * 5, 0);
  }
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(++frames);
  canvas.dataset.lights = String(count.value);
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  timer.dispose();
  disposeObject(scene);
  material.dispose();
  viewGroup.dispose();
  lightGroup.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
