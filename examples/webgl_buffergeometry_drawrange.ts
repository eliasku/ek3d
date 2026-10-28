import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { Points } from "ek3d/objects/Points";
import { LineSegments } from "ek3d/objects/LineSegments";
import { BoxHelper } from "ek3d/helpers/BoxHelper";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { Vector3 } from "ek3d/math/Vector3";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { AdditiveBlending, DynamicDrawUsage } from "ek3d/constants";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing drawrange canvas");
const maxParticleCount = 1000,
  r = 800,
  rHalf = r / 2;
const settings = {
  showDots: true,
  showLines: true,
  minDistance: 150,
  limitConnections: false,
  maxConnections: 20,
  particleCount: 500,
};
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 4000);
camera.position.z = 1750;
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 1000;
controls.maxDistance = 3000;
const scene = new Scene();
const group = new Group();
scene.add(group);
const boxGeometry = new BoxGeometry(r, r, r);
const boxMaterial = new MeshBasicMaterial();
const box = new Mesh(boxGeometry, boxMaterial);
const helper = new BoxHelper(box);
boxGeometry.dispose();
boxMaterial.dispose();
helper.material.color.setHex(0x474747);
helper.material.blending = AdditiveBlending;
helper.material.transparent = true;
group.add(helper);
const positions = new Float32Array(maxParticleCount * maxParticleCount * 3);
const colors = new Float32Array(maxParticleCount * maxParticleCount * 3);
const particlePositions = new Float32Array(maxParticleCount * 3);
const particlesData: { velocity: Vector3; numConnections: number }[] = [];
for (let i = 0; i < maxParticleCount; i++) {
  particlePositions[i * 3] = Math.random() * r - rHalf;
  particlePositions[i * 3 + 1] = Math.random() * r - rHalf;
  particlePositions[i * 3 + 2] = Math.random() * r - rHalf;
  particlesData.push({
    velocity: new Vector3(-1 + Math.random() * 2, -1 + Math.random() * 2, -1 + Math.random() * 2),
    numConnections: 0,
  });
}
const particles = new BufferGeometry();
particles.setDrawRange(0, settings.particleCount);
const particleAttribute = new BufferAttribute(particlePositions, 3).setUsage(DynamicDrawUsage);
particles.setAttribute("position", particleAttribute);
const pointCloud = new Points(
  particles,
  new PointsMaterial({
    color: 0xffffff,
    size: 3,
    blending: AdditiveBlending,
    transparent: true,
    sizeAttenuation: false,
  }),
);
group.add(pointCloud);
const geometry = new BufferGeometry();
const positionAttribute = new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage);
const colorAttribute = new BufferAttribute(colors, 3).setUsage(DynamicDrawUsage);
geometry.setAttribute("position", positionAttribute);
geometry.setAttribute("color", colorAttribute);
geometry.computeBoundingSphere();
geometry.setDrawRange(0, 0);
const lines = new LineSegments(
  geometry,
  new LineBasicMaterial({ vertexColors: true, blending: AdditiveBlending, transparent: true }),
);
group.add(lines);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { LineBasicMaterial: basicShader, PointsMaterial: pointsShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
const gui = new GUI();
gui.add(settings, "showDots").onChange(() => {
  pointCloud.visible = settings.showDots;
});
gui.add(settings, "showLines").onChange(() => {
  lines.visible = settings.showLines;
});
gui.add(settings, "minDistance", 10, 300);
gui.add(settings, "limitConnections");
gui.add(settings, "maxConnections", 0, 30, 1);
gui.add(settings, "particleCount", 0, maxParticleCount, 1).onChange(() => {
  particles.setDrawRange(0, settings.particleCount);
});
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
let frames = 0,
  disposed = false;
renderer.setAnimationLoop(() => {
  let offset = 0,
    connected = 0;
  for (let i = 0; i < settings.particleCount; i++) particlesData[i].numConnections = 0;
  for (let i = 0; i < settings.particleCount; i++) {
    const data = particlesData[i];
    particlePositions[i * 3] += data.velocity.x;
    particlePositions[i * 3 + 1] += data.velocity.y;
    particlePositions[i * 3 + 2] += data.velocity.z;
    if (Math.abs(particlePositions[i * 3]) > rHalf) data.velocity.x = -data.velocity.x;
    if (Math.abs(particlePositions[i * 3 + 1]) > rHalf) data.velocity.y = -data.velocity.y;
    if (Math.abs(particlePositions[i * 3 + 2]) > rHalf) data.velocity.z = -data.velocity.z;
    if (settings.limitConnections && data.numConnections >= settings.maxConnections) continue;
    for (let j = i + 1; j < settings.particleCount; j++) {
      const other = particlesData[j];
      if (settings.limitConnections && other.numConnections >= settings.maxConnections) continue;
      const dx = particlePositions[i * 3] - particlePositions[j * 3];
      const dy = particlePositions[i * 3 + 1] - particlePositions[j * 3 + 1];
      const dz = particlePositions[i * 3 + 2] - particlePositions[j * 3 + 2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance < settings.minDistance) {
        data.numConnections++;
        other.numConnections++;
        const alpha = 1 - distance / settings.minDistance;
        for (let k = 0; k < 3; k++) {
          positions[offset + k] = particlePositions[i * 3 + k];
          positions[offset + 3 + k] = particlePositions[j * 3 + k];
          colors[offset + k] = colors[offset + 3 + k] = alpha;
        }
        offset += 6;
        connected++;
      }
    }
  }
  geometry.setDrawRange(0, connected * 2);
  positionAttribute.needsUpdate = true;
  colorAttribute.needsUpdate = true;
  particleAttribute.needsUpdate = true;
  group.rotation.y = Date.now() * 0.0001;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  stats.update();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
