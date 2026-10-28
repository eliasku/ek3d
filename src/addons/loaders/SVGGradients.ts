import {
  ClampToEdgeWrapping,
  DoubleSide,
  MirroredRepeatWrapping,
  RepeatWrapping,
  SRGBColorSpace,
} from "../../constants";
import { ShapePath } from "../../extras/core/ShapePath";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { Box2 } from "../../math/Box2";
import { Color } from "../../math/Color";
import { Matrix3 } from "../../math/Matrix3";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import { CanvasTexture } from "../../textures/CanvasTexture";

export interface SVGPathStyle {
  fill?: string;
  fillOpacity: number;
  fillRule?: string;
  opacity?: number;
  stroke?: string;
  strokeOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  strokeLineJoin: string;
  strokeLineCap: string;
  strokeMiterLimit: number;
  visibility?: string;
}

interface SVGGradientStop {
  offset: number;
  color: string;
  opacity: number;
}
interface SVGGradientBase {
  gradientUnits: "userSpaceOnUse" | "objectBoundingBox";
  spreadMethod: "reflect" | "repeat" | "pad";
  gradientTransform: Matrix3 | null;
  stops: SVGGradientStop[];
}
export type SVGGradient = SVGGradientBase &
  (
    | { type: "linearGradient"; x1: number; y1: number; x2: number; y2: number }
    | { type: "radialGradient"; cx: number; cy: number; r: number; fx: number; fy: number }
  );
export type SVGGradients = Record<string, SVGGradient>;
export type SVGLoadedPath = ShapePath & {
  userData: { node: Element; style: SVGPathStyle; transform: Matrix3; gradients: SVGGradients };
};

const gradientURL = /^\s*url\(\s*(?:["']\s*)?#([^)'"\s]+)(?:\s*["'])?\s*\)\s*$/;

export function parseSVGGradients(
  xml: Document,
  parseTransform: (text: string) => Matrix3,
  parseLength: (value: string) => number,
): SVGGradients {
  const attrs = [
    "x1",
    "y1",
    "x2",
    "y2",
    "cx",
    "cy",
    "r",
    "fx",
    "fy",
    "gradientUnits",
    "gradientTransform",
    "spreadMethod",
  ];
  interface Entry {
    type: "linearGradient" | "radialGradient";
    attrs: Record<string, string>;
    stops: SVGGradientStop[] | null;
    href: string | null;
  }
  const parsed: Record<string, Entry> = {};
  for (const node of xml.querySelectorAll("linearGradient, radialGradient")) {
    const id = node.getAttribute("id");
    if (!id) continue;
    const entry: Entry = {
      type: node.nodeName === "radialGradient" ? "radialGradient" : "linearGradient",
      attrs: {},
      stops: null,
      href: null,
    };
    const href = node.getAttributeNS("http://www.w3.org/1999/xlink", "href") || node.getAttribute("href") || "";
    if (href.startsWith("#")) entry.href = href.substring(1);
    for (const name of attrs) {
      const value = node.getAttribute(name);
      if (value !== null) entry.attrs[name] = value;
    }
    const stops = node.querySelectorAll("stop");
    if (stops.length > 0) {
      entry.stops = [];
      for (const stop of stops) {
        const style = (stop as SVGElement).style;
        const color = stop.getAttribute("stop-color") || style?.getPropertyValue("stop-color") || "#000";
        const opacityText = stop.getAttribute("stop-opacity") || style?.getPropertyValue("stop-opacity");
        const opacity = opacityText ? Math.max(0, Math.min(1, parseFloat(opacityText))) : 1;
        const offset = Math.max(0, Math.min(1, parseFloat(stop.getAttribute("offset") || "0")));
        entry.stops.push({ offset, color, opacity });
      }
    }
    parsed[id] = entry;
  }
  function inherit(id: string, visited: Set<string>): Entry | undefined {
    const entry = parsed[id];
    if (!entry || visited.has(id)) return entry;
    visited.add(id);
    if (entry.href && parsed[entry.href]) {
      const parent = inherit(entry.href, visited);
      if (parent) {
        if (!entry.stops) entry.stops = parent.stops;
        for (const key in parent.attrs) if (!(key in entry.attrs)) entry.attrs[key] = parent.attrs[key];
      }
    }
    return entry;
  }
  for (const id in parsed) inherit(id, new Set());
  const gradients: SVGGradients = {};
  function coord(value: string): number {
    if (value.endsWith("%")) return parseFloat(value) / 100;
    return parseLength(value);
  }
  for (const id in parsed) {
    const entry = parsed[id],
      a = entry.attrs;
    const gradientUnits = a.gradientUnits === "userSpaceOnUse" ? "userSpaceOnUse" : "objectBoundingBox";
    const base: SVGGradientBase = {
      gradientUnits,
      spreadMethod: a.spreadMethod === "reflect" || a.spreadMethod === "repeat" ? a.spreadMethod : "pad",
      gradientTransform: a.gradientTransform ? parseTransform(a.gradientTransform) : null,
      stops: (entry.stops || []).slice().sort((x, y) => x.offset - y.offset),
    };
    if (entry.type === "linearGradient") {
      gradients[id] = {
        ...base,
        type: entry.type,
        x1: a.x1 !== undefined ? coord(a.x1) : 0,
        y1: a.y1 !== undefined ? coord(a.y1) : 0,
        x2: a.x2 !== undefined ? coord(a.x2) : gradientUnits === "objectBoundingBox" ? 1 : 0,
        y2: a.y2 !== undefined ? coord(a.y2) : 0,
      };
    } else {
      const center = gradientUnits === "objectBoundingBox" ? 0.5 : 0;
      const cx = a.cx !== undefined ? coord(a.cx) : center,
        cy = a.cy !== undefined ? coord(a.cy) : center;
      gradients[id] = {
        ...base,
        type: entry.type,
        cx,
        cy,
        r: a.r !== undefined ? coord(a.r) : center,
        fx: a.fx !== undefined ? coord(a.fx) : cx,
        fy: a.fy !== undefined ? coord(a.fy) : cy,
      };
    }
  }
  return gradients;
}

export function createSVGFillMaterial(path: SVGLoadedPath): MeshBasicMaterial | null {
  const style = path.userData.style;
  if (style.fill === undefined || style.fill === "none") return null;
  const match = gradientURL.exec(style.fill);
  const texture = match ? buildGradientTexture(path.userData.gradients[match[1]], path) : null;
  const material = new MeshBasicMaterial({
    opacity: style.fillOpacity * (style.opacity || 1),
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
  if (texture !== null) material.map = texture;
  else material.color = path.color;
  return material;
}

export function createSVGStrokeMaterial(path: SVGLoadedPath): MeshBasicMaterial | null {
  const style = path.userData.style;
  if (style.stroke === undefined || style.stroke === "none") return null;
  if (gradientURL.test(style.stroke)) console.warn("THREE.SVGLoader: Gradient strokes are not supported.");
  return new MeshBasicMaterial({
    color: new Color().setStyle(style.stroke, SRGBColorSpace),
    opacity: style.strokeOpacity * (style.opacity || 1),
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
}

function buildGradientTexture(gradient: SVGGradient | undefined, path: SVGLoadedPath): CanvasTexture | null {
  if (!gradient || !Array.isArray(gradient.stops) || gradient.stops.length === 0) return null;
  const world = path.userData.transform;
  const isBBox = gradient.gradientUnits === "objectBoundingBox";
  const bbox = isBBox ? computeLocalBBox(path, world) : null;
  if (isBBox && bbox === null) return null;
  function resolvePoint(x: number, y: number, out: Vector3): void {
    out.set(x, y, 1);
    if (gradient!.gradientTransform) out.applyMatrix3(gradient!.gradientTransform);
    if (bbox) out.set(bbox.minX + out.x * bbox.width, bbox.minY + out.y * bbox.height, 1);
    if (world) out.applyMatrix3(world);
  }
  const resolution = 256;
  const canvas = document.createElement("canvas");
  let matrix: Matrix3;
  if (gradient.type === "linearGradient") {
    canvas.width = resolution;
    canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, resolution, 0);
    addStops(grad, gradient.stops);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, resolution, 1);
    const p1 = new Vector3(),
      p2 = new Vector3();
    resolvePoint(gradient.x1, gradient.y1, p1);
    resolvePoint(gradient.x2, gradient.y2, p2);
    const dx = p2.x - p1.x,
      dy = p2.y - p1.y,
      len2 = dx * dx + dy * dy || 1e-20;
    const a = dx / len2,
      b = dy / len2,
      c = -(a * p1.x + b * p1.y);
    matrix = new Matrix3().set(a, b, c, 0, 0, 0.5, 0, 0, 1);
  } else {
    let { cx, cy, fx, fy, r } = gradient;
    if (gradient.gradientTransform) {
      const tmp = new Vector3().set(cx, cy, 1).applyMatrix3(gradient.gradientTransform);
      cx = tmp.x;
      cy = tmp.y;
      tmp.set(fx, fy, 1).applyMatrix3(gradient.gradientTransform);
      fx = tmp.x;
      fy = tmp.y;
    }
    if (bbox) {
      cx = bbox.minX + cx * bbox.width;
      cy = bbox.minY + cy * bbox.height;
      fx = bbox.minX + fx * bbox.width;
      fy = bbox.minY + fy * bbox.height;
      r *= Math.sqrt((bbox.width * bbox.width + bbox.height * bbox.height) / 2);
    }
    if (r <= 0) return null;
    canvas.width = resolution;
    canvas.height = resolution;
    const ctx = canvas.getContext("2d")!;
    const minX = cx - r,
      minY = cy - r,
      span = 2 * r,
      scale = resolution / span;
    ctx.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);
    const grad = ctx.createRadialGradient(fx, fy, 0, cx, cy, r);
    addStops(grad, gradient.stops);
    ctx.fillStyle = grad;
    ctx.fillRect(minX, minY, span, span);
    const inv = world ? world.clone().invert() : new Matrix3();
    matrix = new Matrix3().set(1 / span, 0, -minX / span, 0, 1 / span, -minY / span, 0, 0, 1).multiply(inv);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
  texture.matrixAutoUpdate = false;
  texture.matrix = matrix;
  const wrap =
    gradient.spreadMethod === "reflect"
      ? MirroredRepeatWrapping
      : gradient.spreadMethod === "repeat"
        ? RepeatWrapping
        : ClampToEdgeWrapping;
  texture.wrapS = wrap;
  texture.wrapT = wrap;
  return texture;
}

function computeLocalBBox(
  path: SVGLoadedPath,
  world: Matrix3,
): { minX: number; minY: number; width: number; height: number } | null {
  const inv = world ? world.clone().invert() : null;
  const tmp = new Vector2(),
    box = new Box2();
  for (const subPath of path.subPaths)
    for (const point of subPath.getPoints()) {
      tmp.copy(point);
      if (inv) tmp.applyMatrix3(inv);
      box.expandByPoint(tmp);
    }
  if (box.isEmpty()) return null;
  return { minX: box.min.x, minY: box.min.y, width: box.max.x - box.min.x, height: box.max.y - box.min.y };
}

function addStops(gradient: CanvasGradient, stops: SVGGradientStop[]): void {
  const color = new Color();
  for (const stop of stops) {
    let css = stop.color;
    if (stop.opacity < 1) {
      color.setStyle(stop.color, SRGBColorSpace);
      const match = /rgb\(([^)]+)\)/.exec(color.getStyle(SRGBColorSpace));
      if (match) css = `rgba(${match[1]},${stop.opacity})`;
    }
    gradient.addColorStop(Math.max(0, Math.min(1, stop.offset)), css);
  }
}
