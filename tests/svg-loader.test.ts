import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { SVGLoader } from "../src/addons/loaders/SVGLoader";

test("SVG document inherits CSS and transforms, resolves use and gradients", () => {
  function make(name: string, attributes: Record<string, string> = {}, children: Element[] = [], text = ""): Element {
    const node = {
      nodeName: name,
      children,
      textContent: text,
      getAttribute: (key: string) => attributes[key] ?? null,
      getAttributeNS: (_namespace: string, key: string) => attributes[key] ?? null,
      hasAttribute: (key: string) => key in attributes,
      querySelectorAll: (selector: string): Element[] => {
        const names = selector.split(",").map((value) => value.trim());
        const result: Element[] = [];
        for (const child of children) {
          if (names.includes(child.nodeName)) result.push(child);
          result.push(...Array.from(child.querySelectorAll(selector)));
        }
        return result;
      },
    };
    return node as unknown as Element;
  }
  const root = make("svg", {}, [
    make("defs", {}, [
      make("style", {}, [], ".paint { fill: red; stroke: blue; stroke-width: 2 }"),
      make("rect", { id: "box", width: "4", height: "3" }),
      make("linearGradient", { id: "base", x2: "50%" }, [
        make("stop", { offset: "0", "stop-color": "red" }),
        make("stop", { offset: "1", "stop-color": "blue", "stop-opacity": "0.5" }),
      ]),
      make("linearGradient", { id: "copy", href: "#base" }),
    ]),
    make("g", { class: "paint", transform: "translate(10 20) scale(2)" }, [
      make("use", { href: "#box", x: "1", y: "2" }),
      make("path", { d: "M0 0 h2 v2 h-2 z", "fill-rule": "evenodd" }),
    ]),
  ]);
  const all = Array.from(root.querySelectorAll("svg, defs, style, rect, linearGradient, stop, g, use, path"));
  const previous = globalThis.DOMParser;
  globalThis.DOMParser = class {
    parseFromString(): Document {
      return {
        documentElement: root,
        querySelector: () => null,
        querySelectorAll: root.querySelectorAll.bind(root),
        getElementById: (id: string) => all.find((node) => node.getAttribute("id") === id) ?? null,
      } as unknown as Document;
    }
  } as typeof DOMParser;
  try {
    const result = new SVGLoader().parse("fixture");
    assert.equal(result.paths.length, 2);
    const box = result.paths[0];
    assert.equal(box.userData.style.fill, "red");
    assert.equal(box.userData.style.stroke, "blue");
    assert.equal(box.userData.style.strokeWidth, 4);
    const first = box.subPaths[0].getPoints()[0];
    assert.deepEqual([first.x, first.y], [12, 24]);
    assert.equal(result.paths[1].userData.style.fillRule, "evenodd");
    assert.equal(SVGLoader.createShapes(result.paths[1]).length, 1);
    const gradient = result.gradients.copy;
    assert.equal(gradient.type, "linearGradient");
    if (gradient.type !== "linearGradient") throw new Error("Expected a linear gradient");
    assert.equal(gradient.x2, 0.5);
    assert.deepEqual(
      gradient.stops.map(({ color, opacity }) => [color, opacity]),
      [
        ["red", 1],
        ["blue", 0.5],
      ],
    );
  } finally {
    globalThis.DOMParser = previous;
  }
});
