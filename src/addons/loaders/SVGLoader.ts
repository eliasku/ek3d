import { ColorSpace } from "../../constants";
import { Path } from "../../extras/core/Path";
import { ShapePath } from "../../extras/core/ShapePath";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { Matrix3 } from "../../math/Matrix3";
import { SVGStroke } from "../utils/SVGStroke";
import { parseSVGPath } from "./SVGPath";
import { createSVGFillMaterial, createSVGStrokeMaterial, parseSVGGradients } from "./SVGGradients";
import type { SVGGradients, SVGLoadedPath, SVGPathStyle } from "./SVGGradients";
import { getSVGTransformScale, parseSVGTransform, transformSVGPath } from "./SVGTransforms";

export interface SVGResult {
  paths: SVGLoadedPath[];
  gradients: SVGGradients;
  xml: Element;
}
type SVGUnit = "mm" | "cm" | "in" | "pt" | "pc" | "px";

export class SVGLoader extends Loader<SVGResult> {
  defaultDPI: number = 90;
  defaultUnit: SVGUnit = "px";

  constructor(manager?: LoadingManager) {
    super(manager);
  }

  load(
    url: string,
    onLoad?: (data: SVGResult) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setPath(this.path);
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      (data) => {
        try {
          if (typeof data !== "string") throw new Error("SVGLoader: Expected text");
          onLoad?.(this.parse(data));
        } catch (error) {
          if (onError) onError(error);
          else console.error(error);
          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }

  parse(text: string): SVGResult {
    const xml = new DOMParser().parseFromString(text, "image/svg+xml");
    if (xml.querySelector("parsererror")) throw new Error("SVGLoader: Invalid SVG XML");
    const paths: SVGLoadedPath[] = [];
    const stylesheets: Record<string, Record<string, string>> = {};
    const inches: Record<SVGUnit, number> = {
      mm: 1 / 25.4,
      cm: 1 / 2.54,
      in: 1,
      pt: 1 / 72,
      pc: 1 / 6,
      px: 1 / this.defaultDPI,
    };
    const number = (value: string | null): number => {
      if (value === null) return NaN;
      const match = value.trim().match(/(mm|cm|in|pt|pc|px)$/);
      const unit = (match?.[1] ?? "px") as SVGUnit;
      return (parseFloat(value) * inches[unit]) / inches[this.defaultUnit];
    };
    const gradients = parseSVGGradients(xml, parseSVGTransform, number);
    const attr = (node: Element, name: string, fallback = "0"): number => number(node.getAttribute(name) || fallback);
    const parseCSS = (node: Element): void => {
      const sheet = (node as SVGStyleElement).sheet;
      if (sheet?.cssRules) {
        for (const rule of Array.from(sheet.cssRules)) {
          if (!(rule instanceof CSSStyleRule)) continue;
          const definitions: Record<string, string> = {};
          for (const property of Array.from(rule.style)) definitions[property] = rule.style.getPropertyValue(property);
          for (const selector of rule.selectorText.split(","))
            Object.assign((stylesheets[selector.trim()] ??= {}), definitions);
        }
      } else {
        const css = (node.textContent ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
        for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
          const definitions: Record<string, string> = {};
          for (const declaration of match[2].split(";")) {
            const colon = declaration.indexOf(":");
            if (colon !== -1) definitions[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
          }
          for (const selector of match[1].split(",")) Object.assign((stylesheets[selector.trim()] ??= {}), definitions);
        }
      }
    };
    const parseStyle = (node: Element, inherited: SVGPathStyle): SVGPathStyle => {
      const result = { ...inherited };
      const css: Record<string, string> = {};
      for (const name of (node.getAttribute("class") ?? "").split(/\s+/).filter(Boolean))
        Object.assign(css, stylesheets[`.${name}`]);
      if (node.hasAttribute("id")) Object.assign(css, stylesheets[`#${node.getAttribute("id")}`]);
      const inline = (node as SVGElement).style;
      const value = (name: string): string | undefined =>
        inline?.getPropertyValue(name) || css[name] || node.getAttribute(name) || undefined;
      const fill = value("fill");
      if (fill !== undefined) result.fill = fill;
      const stroke = value("stroke");
      if (stroke !== undefined) result.stroke = stroke;
      const fillRule = value("fill-rule");
      if (fillRule !== undefined) result.fillRule = fillRule;
      const visibility = value("visibility");
      if (visibility !== undefined) result.visibility = visibility;
      const lineJoin = value("stroke-linejoin");
      if (lineJoin !== undefined) result.strokeLineJoin = lineJoin;
      const lineCap = value("stroke-linecap");
      if (lineCap !== undefined) result.strokeLineCap = lineCap;
      const clamp = (name: string): number | undefined => {
        const v = value(name);
        return v === undefined ? undefined : Math.max(0, Math.min(1, number(v)));
      };
      const opacity = clamp("opacity");
      if (opacity !== undefined) result.opacity = opacity;
      const fillOpacity = clamp("fill-opacity");
      if (fillOpacity !== undefined) result.fillOpacity = fillOpacity;
      const strokeOpacity = clamp("stroke-opacity");
      if (strokeOpacity !== undefined) result.strokeOpacity = strokeOpacity;
      const width = value("stroke-width");
      if (width !== undefined) result.strokeWidth = Math.max(0, number(width));
      const miter = value("stroke-miterlimit");
      if (miter !== undefined) result.strokeMiterLimit = Math.max(0, number(miter));
      result.strokeColor = result.stroke ?? "#000";
      return result;
    };
    const primitive = (node: Element): ShapePath | null => {
      const path = new ShapePath();
      switch (node.nodeName) {
        case "path":
          return node.hasAttribute("d") ? parseSVGPath(node.getAttribute("d") ?? "") : null;
        case "rect": {
          const x = attr(node, "x"),
            y = attr(node, "y"),
            w = number(node.getAttribute("width")),
            h = number(node.getAttribute("height"));
          const rx = number(node.getAttribute("rx") || node.getAttribute("ry") || "0"),
            ry = number(node.getAttribute("ry") || node.getAttribute("rx") || "0"),
            b = 1 - 0.551915024494;
          path.moveTo(x + rx, y);
          path.lineTo(x + w - rx, y);
          if (rx || ry) path.bezierCurveTo(x + w - rx * b, y, x + w, y + ry * b, x + w, y + ry);
          path.lineTo(x + w, y + h - ry);
          if (rx || ry) path.bezierCurveTo(x + w, y + h - ry * b, x + w - rx * b, y + h, x + w - rx, y + h);
          path.lineTo(x + rx, y + h);
          if (rx || ry) path.bezierCurveTo(x + rx * b, y + h, x, y + h - ry * b, x, y + h - ry);
          path.lineTo(x, y + ry);
          if (rx || ry) path.bezierCurveTo(x, y + ry * b, x + rx * b, y, x + rx, y);
          return path;
        }
        case "polygon":
        case "polyline": {
          const points = node.getAttribute("points") ?? "";
          const regex =
            /([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)(?:,|\s)([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)/g;
          for (const match of points.matchAll(regex)) {
            const x = number(match[1]),
              y = number(match[2]);
            if (path.currentPath === null) path.moveTo(x, y);
            else path.lineTo(x, y);
          }
          if (path.currentPath) path.currentPath.autoClose = node.nodeName === "polygon";
          return path;
        }
        case "circle":
        case "ellipse": {
          const subpath = new Path();
          const x = attr(node, "cx"),
            y = attr(node, "cy");
          if (node.nodeName === "circle") subpath.absarc(x, y, attr(node, "r"), 0, Math.PI * 2);
          else subpath.absellipse(x, y, attr(node, "rx"), attr(node, "ry"), 0, Math.PI * 2);
          path.subPaths.push(subpath);
          return path;
        }
        case "line":
          path.moveTo(attr(node, "x1"), attr(node, "y1"));
          path.lineTo(attr(node, "x2"), attr(node, "y2"));
          return path;
        default:
          return null;
      }
    };
    const visit = (node: Element, inherited: SVGPathStyle, parent: Matrix3): void => {
      if (node.hasAttribute("filter")) console.warn("SVGLoader: Filters are not supported.");
      let transform = parent;
      if (
        node.hasAttribute("transform") ||
        (node.nodeName === "use" && (node.hasAttribute("x") || node.hasAttribute("y")))
      ) {
        const local = parseSVGTransform(node.getAttribute("transform") ?? "");
        if (node.nodeName === "use")
          local.multiply(new Matrix3().set(1, 0, attr(node, "x"), 0, 1, attr(node, "y"), 0, 0, 1));
        transform = parent.clone().multiply(local);
      }
      if (node.nodeName === "style") parseCSS(node);
      let style = inherited;
      if (
        ["svg", "g", "path", "rect", "polygon", "polyline", "circle", "ellipse", "line", "use"].includes(node.nodeName)
      )
        style = parseStyle(node, inherited);
      if (node.nodeName === "use") {
        const href = node.getAttributeNS("http://www.w3.org/1999/xlink", "href") || node.getAttribute("href") || "";
        const used = xml.getElementById(href.substring(1));
        if (used) visit(used, style, transform);
        else console.warn(`SVGLoader: 'use node' references non-existent node id: ${href.substring(1)}`);
      }
      const path = primitive(node);
      if (path) {
        if (style.fill !== undefined && style.fill !== "none" && !style.fill.startsWith("url"))
          path.color.setStyle(style.fill, ColorSpace.SRGB);
        transformSVGPath(path, transform);
        const loaded = path as SVGLoadedPath;
        loaded.userData = {
          node,
          style: { ...style, strokeWidth: style.strokeWidth * getSVGTransformScale(transform) },
          transform: transform.clone(),
          gradients,
        };
        paths.push(loaded);
      }
      for (const child of Array.from(node.children)) {
        if (node.nodeName === "defs" && child.nodeName !== "style" && child.nodeName !== "defs") continue;
        visit(child, style, transform);
      }
    };
    visit(
      xml.documentElement,
      {
        fill: "#000",
        fillOpacity: 1,
        strokeOpacity: 1,
        strokeWidth: 1,
        strokeLineJoin: "miter",
        strokeLineCap: "butt",
        strokeMiterLimit: 4,
        strokeColor: "#000",
      },
      new Matrix3(),
    );
    return { paths, gradients, xml: xml.documentElement };
  }

  static createFillMaterial(path: SVGLoadedPath) {
    return createSVGFillMaterial(path);
  }
  static createStrokeMaterial(path: SVGLoadedPath) {
    return createSVGStrokeMaterial(path);
  }
  static createShapes(path: ShapePath) {
    return path.toShapes();
  }
  static getStrokeStyle(...args: Parameters<typeof SVGStroke.getStrokeStyle>) {
    return SVGStroke.getStrokeStyle(...args);
  }
  static pointsToStroke(...args: Parameters<typeof SVGStroke.pointsToStroke>) {
    return SVGStroke.pointsToStroke(...args);
  }
  static pointsToStrokeWithBuffers(...args: Parameters<typeof SVGStroke.pointsToStrokeWithBuffers>) {
    return SVGStroke.pointsToStrokeWithBuffers(...args);
  }
}
