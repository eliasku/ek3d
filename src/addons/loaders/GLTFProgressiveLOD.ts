// Adapted from @needle-tools/gltf-progressive, commit 4d423859641a275d322318b0164bc6dce48d36a4.
// Copyright (c) 2026 Needle Tools; MIT license included in GLTFProgressive.ts.
import type { Camera } from "../../cameras/Camera";
import type { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import type { Mesh } from "../../objects/Mesh";
import type { SkinnedMesh } from "../../objects/SkinnedMesh";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import { Box3 } from "../../math/Box3";
import { Matrix4 } from "../../math/Matrix4";
import { Sphere } from "../../math/Sphere";
import { Vector3 } from "../../math/Vector3";

const projection = new Matrix4();
const box = new Box3();
const viewBox = new Box3();
const size = new Vector3();
const viewSize = new Vector3();
const point = new Vector3();
const sphere = new Sphere();

export function calculateProgressiveLOD(
  renderer: WebGLRenderer,
  camera: Camera,
  mesh: Mesh,
  meshLods: { densities?: number[]; density?: number }[] | undefined,
  primitive: number,
  textureLods: { width?: number; height?: number }[][],
  targetTriangleDensity: number,
): { mesh_lod: number; texture_lod: number } {
  const hasMesh = !!meshLods?.length;
  if (!hasMesh && textureLods.length === 0) return { mesh_lod: 0, texture_lod: 0 };

  const perspective = camera as PerspectiveCamera;
  const canvas = renderer.domElement;
  const canvasHeight = ("clientHeight" in canvas && canvas.clientHeight) || canvas.height;
  let bounds = mesh.geometry.boundingBox;
  if (mesh.type === "SkinnedMesh") {
    const skinned = mesh as SkinnedMesh;
    if (!skinned.boundingBox) skinned.computeBoundingBox();
    bounds = skinned.boundingBox;
  }

  let coverage = 0;
  if (bounds) {
    const colors = mesh.geometry.attributes.color;
    if (colors && colors.count < 100 && mesh.geometry.boundingSphere) {
      sphere.copy(mesh.geometry.boundingSphere).applyMatrix4(mesh.matrixWorld);
      if (sphere.containsPoint(camera.getWorldPosition(point))) return { mesh_lod: 0, texture_lod: 0 };
    }

    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    box.copy(bounds).applyMatrix4(mesh.matrixWorld);
    if (perspective.isPerspectiveCamera) {
      point.set((box.min.x + box.max.x) * 0.5, (box.min.y + box.max.y) * 0.5, box.min.z).applyMatrix4(projection);
      if (point.z < 0) return { mesh_lod: 0, texture_lod: 0 };
    }
    box.applyMatrix4(projection);
    box.getSize(size).multiplyScalar(0.5);
    if (typeof screen !== "undefined" && screen.availHeight > 0 && canvasHeight > 0) {
      size.multiplyScalar(canvasHeight / screen.availHeight);
    }
    if (perspective.isPerspectiveCamera) size.x *= perspective.aspect;
    viewBox.copy(bounds).applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse).getSize(viewSize);
    const viewMax = Math.max(viewSize.x, viewSize.y);
    const screenMax = Math.max(size.x, size.y);
    if (viewMax !== 0 && screenMax !== 0) size.z = (viewSize.z / viewMax) * screenMax;
    coverage = Math.max(size.x, size.y, size.z);
  }

  let meshLevel = hasMesh ? -1 : 0;
  if (bounds && meshLods && coverage > 0) {
    for (let i = 0; i < meshLods.length; i++) {
      const lod = meshLods[i];
      if ((lod.densities?.[primitive] || lod.density || 0.00001) / coverage < targetTriangleDensity) {
        if (i < 11) meshLevel = i;
        break;
      }
    }
  }

  let textureLevel = textureLods.length ? -1 : 0;
  const maxCount = textureLods.reduce((max, lods) => Math.max(max, lods.length), 0);
  const navigatorInfo = typeof navigator === "undefined" ? undefined : navigator;
  const saveData = navigatorInfo && "saveData" in navigatorInfo && navigatorInfo.saveData === true;
  const mobile = navigatorInfo ? /iPhone|iPad|iPod|Android|IEMobile/i.test(navigatorInfo.userAgent) : false;
  const pixelSize = (canvasHeight / (typeof window === "undefined" ? 1 : window.devicePixelRatio)) * coverage * 4;
  for (let i = maxCount - 1; i >= 0; i--) {
    let height = 0;
    let present = false;
    for (const lods of textureLods) {
      const lod = lods[i];
      if (lod?.width) {
        present = true;
        height = Math.max(height, lod.height ?? 0);
      }
    }
    if (!present || (saveData && height >= 2048) || (mobile && height > 4096)) continue;
    if (height > pixelSize || i === 0) {
      textureLevel = i;
      break;
    }
  }
  return { mesh_lod: meshLevel, texture_lod: textureLevel };
}
