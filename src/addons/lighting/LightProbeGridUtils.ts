import { DirectionalLight } from "../../lights/DirectionalLight";
import { Box3 } from "../../math/Box3";
import { Sphere } from "../../math/Sphere";
import { Vector3 } from "../../math/Vector3";
import { Mesh } from "../../objects/Mesh";
import type { Scene } from "../../scenes/Scene";
import { SunLight } from "../lights/SunLight";

const casterBox = new Box3();
const casterSphere = new Sphere();
const sunDirection = new Vector3();
const bakeLights = new WeakMap<SunLight, DirectionalLight>();

export interface SunLightReplacement {
  sunLight: SunLight;
  bakeLight: DirectionalLight;
}

export function replaceSunLights(scene: Scene): SunLightReplacement[] | null {
  const sunLights: SunLight[] = [];
  scene.traverse((object) => {
    if (object instanceof SunLight && object.visible && object.castShadow) sunLights.push(object);
  });
  if (sunLights.length === 0) return null;

  casterBox.makeEmpty();
  scene.traverse((object) => {
    if (object instanceof Mesh && object.castShadow) casterBox.expandByObject(object);
  });
  casterBox.getBoundingSphere(casterSphere);
  const center = casterSphere.center;
  const radius = Math.max(casterSphere.radius, 1);
  const replacements: SunLightReplacement[] = [];
  for (const sunLight of sunLights) {
    let bakeLight = bakeLights.get(sunLight);
    if (!bakeLight) {
      bakeLight = new DirectionalLight();
      bakeLight.castShadow = true;
      bakeLights.set(sunLight, bakeLight);
    }
    bakeLight.color.copy(sunLight.color);
    bakeLight.intensity = sunLight.intensity;
    bakeLight.shadow.mapSize.copy(sunLight.shadow.mapSize);
    const camera = bakeLight.shadow.camera;
    camera.left = -radius;
    camera.right = radius;
    camera.top = radius;
    camera.bottom = -radius;
    camera.near = radius * 0.5;
    camera.far = radius * 3.5;
    camera.updateProjectionMatrix();
    sunDirection.setFromMatrixPosition(sunLight.matrixWorld).normalize();
    bakeLight.target.position.copy(center);
    bakeLight.position.copy(center).addScaledVector(sunDirection, radius * 2);
    scene.add(bakeLight, bakeLight.target);
    bakeLight.target.updateMatrixWorld();
    bakeLight.updateMatrixWorld();
    sunLight.visible = false;
    replacements.push({ sunLight, bakeLight });
  }
  return replacements;
}

export function restoreSunLights(scene: Scene, replacements: SunLightReplacement[]): void {
  for (const { sunLight, bakeLight } of replacements) {
    scene.remove(bakeLight, bakeLight.target);
    sunLight.visible = true;
  }
}
