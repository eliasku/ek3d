import { BufferAttribute } from "../../core/BufferAttribute";
import { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";
import type { BufferGeometry } from "../../core/BufferGeometry";
import { Vector2 } from "../../math/Vector2";

/**
 * Draws triangle contours, face numbers and vertex labels in UV space.
 *
 * ```typescript
 * import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
 * import { UVsDebug } from "ek3d/addons/utils/UVsDebug";
 * document.body.appendChild(UVsDebug(new SphereGeometry()));
 * ```
 *
 * Only horizontal UV wrapping is visualized, matching upstream.
 */
export function UVsDebug(geometry: BufferGeometry, size = 1024): HTMLCanvasElement {
  const abc = "abc";
  const center = new Vector2();
  const midpoint = new Vector2();
  const uvs = [new Vector2(), new Vector2(), new Vector2()];
  const face: number[] = [];
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("UVsDebug requires a 2D canvas context.");
  const ctx = context;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgb(63, 63, 63)";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgb(255, 255, 255)";
  ctx.fillRect(0, 0, size, size);
  const index = geometry.index;
  const uvAttribute = geometry.attributes.uv;
  if (!(uvAttribute instanceof BufferAttribute || uvAttribute instanceof InterleavedBufferAttribute)) {
    throw new Error("UVsDebug requires CPU-readable UV coordinates.");
  }
  for (let i = 0, count = index ? index.count : uvAttribute.count; i < count; i += 3) {
    for (let j = 0; j < 3; j++) {
      face[j] = index ? index.getX(i + j) : i + j;
      uvs[j].fromBufferAttribute(uvAttribute, face[j]);
    }
    processFace(i / 3);
  }
  return canvas;

  function processFace(index: number): void {
    ctx.beginPath();
    center.set(0, 0);
    for (let j = 0; j < uvs.length; j++) {
      const uv = uvs[j];
      center.add(uv);
      const x = uv.x * (size - 2) + 0.5;
      const y = (1 - uv.y) * (size - 2) + 0.5;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    center.divideScalar(uvs.length);
    ctx.font = "18px Arial";
    ctx.fillStyle = "rgb(63, 63, 63)";
    ctx.fillText(String(index), center.x * size, (1 - center.y) * size);
    if (center.x > 0.95) ctx.fillText(String(index), (center.x % 1) * size, (1 - center.y) * size);
    ctx.font = "12px Arial";
    ctx.fillStyle = "rgb(191, 191, 191)";
    for (let j = 0; j < uvs.length; j++) {
      midpoint.addVectors(center, uvs[j]).divideScalar(2);
      const label = abc[j] + face[j];
      ctx.fillText(label, midpoint.x * size, (1 - midpoint.y) * size);
      if (midpoint.x > 0.95) ctx.fillText(label, (midpoint.x % 1) * size, (1 - midpoint.y) * size);
    }
  }
}
