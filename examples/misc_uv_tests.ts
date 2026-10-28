import { UVsDebug } from "ek3d/addons/utils/UVsDebug";
import type { BufferGeometry } from "ek3d/core/BufferGeometry";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { LatheGeometry } from "ek3d/geometries/LatheGeometry";
import { OctahedronGeometry } from "ek3d/geometries/OctahedronGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { TorusGeometry } from "ek3d/geometries/TorusGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { Vector2 } from "ek3d/math/Vector2";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing UV tests canvas");
const canvas = selected;
const context = canvas.getContext("2d");
if (!context) throw new Error("UV tests require a 2D canvas context");
const ctx = context;
const points = Array.from({ length: 10 }, (_, i) => new Vector2(Math.sin(i * 0.2) * 15 + 50, (i - 5) * 2));
const geometries: Array<[string, BufferGeometry]> = [
  ["PlaneGeometry(100, 100, 4, 4)", new PlaneGeometry(100, 100, 4, 4)],
  ["SphereGeometry(75, 12, 6)", new SphereGeometry(75, 12, 6)],
  ["IcosahedronGeometry(30, 1)", new IcosahedronGeometry(30, 1)],
  ["OctahedronGeometry(30, 2)", new OctahedronGeometry(30, 2)],
  ["CylinderGeometry(25, 75, 100, 10, 5)", new CylinderGeometry(25, 75, 100, 10, 5)],
  ["BoxGeometry(100, 100, 100, 4, 4, 4)", new BoxGeometry(100, 100, 100, 4, 4, 4)],
  ["LatheGeometry(points, 8)", new LatheGeometry(points, 8)],
  ["TorusGeometry(50, 20, 8, 8)", new TorusGeometry(50, 20, 8, 8)],
  ["TorusKnotGeometry(50, 10, 12, 6)", new TorusKnotGeometry(50, 10, 12, 6)],
];
const previews = geometries.map(([name, geometry]) => {
  const image = UVsDebug(geometry);
  geometry.dispose();
  return { name, image };
});
let frames = 0;
function resize(): void {
  const ratio = devicePixelRatio;
  canvas.width = Math.round(innerWidth * ratio);
  canvas.height = Math.round(innerHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  const width = innerWidth / 3;
  const height = innerHeight / 3;
  const size = Math.max(1, Math.min(width - 16, height - 32));
  ctx.textAlign = "center";
  ctx.font = `${Math.max(9, Math.min(14, width / 27))}px sans-serif`;
  previews.forEach(({ name, image }, i) => {
    const x = (i % 3) * width + (width - size) / 2;
    const y = Math.floor(i / 3) * height;
    ctx.fillStyle = "black";
    ctx.fillText(name, ((i % 3) + 0.5) * width, y + 18);
    ctx.drawImage(image, x, y + 26, size, size);
  });
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
}
resize();
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  window.removeEventListener("resize", resize);
  for (const { image } of previews) image.width = image.height = 0;
});
