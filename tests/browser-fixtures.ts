import type { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import type { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import type { Scene } from "ek3d/scenes/Scene";
import type { Mesh } from "ek3d/objects/Mesh";
import type { DirectionalLight } from "ek3d/lights/DirectionalLight";
import type { PointLight } from "ek3d/lights/PointLight";

export const environmentWidth = 128;
export const environmentHeight = 64;
export function createEnvironmentPixels(): Uint8Array {
  const pixels = new Uint8Array(environmentWidth * environmentHeight * 4);
  const colors = [
    [240, 48, 24],
    [24, 192, 80],
    [32, 80, 240],
    [240, 176, 32],
  ];
  for (let y = 0; y < environmentHeight; y++) {
    for (let x = 0; x < environmentWidth; x++) {
      const color = colors[Math.floor(x / 32)];
      const shade = ((x >> 3) + (y >> 3)) % 2 === 0 ? 1 : 0.35;
      const offset = (y * environmentWidth + x) * 4;
      for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = Math.round(color[channel] * shade);
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

export function configureShadowScene(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  receiver: Mesh,
  caster: Mesh,
  directional: DirectionalLight,
  point: PointLight,
): void {
  renderer.setPixelRatio(1);
  renderer.setSize(640, 480, false);
  renderer.setClearColor(0x152238, 1);
  if (renderer.shadowMap !== null) renderer.shadowMap.enabled = true;
  camera.position.set(6, 5, 8);
  camera.lookAt(0, 0, 0);
  receiver.scale.set(8, 0.2, 8);
  receiver.position.y = -0.1;
  receiver.receiveShadow = true;
  caster.position.y = 0.6;
  caster.castShadow = true;
  directional.position.set(-3, 6, 3);
  point.position.copy(directional.position);
  for (const light of [directional, point]) {
    light.castShadow = true;
    light.shadow.mapSize.set(256, 256);
    light.shadow.bias = -0.001;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 30;
  }
  directional.shadow.camera.left = directional.shadow.camera.bottom = -5;
  directional.shadow.camera.right = directional.shadow.camera.top = 5;
  directional.shadow.camera.updateProjectionMatrix();
  scene.add(receiver, caster, directional);
}
