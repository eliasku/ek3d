import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { ThreeMFLoader } from "../src/addons/loaders/3MFLoader";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { MeshPhongMaterial } from "../src/materials/MeshPhongMaterial";
import { Mesh } from "../src/objects/Mesh";

const data = new Uint8Array([1]).buffer;

test("3MF requires an injected ZIP runtime and a relationship part", () => {
  const loader = new ThreeMFLoader();
  assert.throws(() => loader.parse(data), /ZIP runtime is required/);
  loader.setZipRuntime({ unzipSync: () => ({}) });
  assert.throws(() => loader.parse(data), /relationship file/);
});

test("3MF applies mesh extensions, base materials and build transforms", () => {
  const make = (localName: string, attributes: Record<string, string> = {}, children: Element[] = []): Element => {
    const node = {
      localName,
      children,
      attributes: Object.entries(attributes).map(([name, value]) => ({ name, value })),
      getAttribute: (name: string) => attributes[name] ?? null,
      hasAttribute: (name: string) => name in attributes,
      getElementsByTagNameNS: () => [],
      querySelectorAll: (selector: string): Element[] => {
        const parts = selector.split(" ");
        const find = (nodes: Element[], index: number): Element[] => {
          const matches: Element[] = [];
          for (const child of nodes) {
            if (child.localName === parts[index]) {
              if (index === parts.length - 1) matches.push(child);
              else matches.push(...find(Array.from(child.children), index + 1));
            }
            matches.push(...find(Array.from(child.children), index));
          }
          return matches;
        };
        return find(children, 0);
      },
      querySelector(selector: string): Element | null {
        return this.querySelectorAll(selector)[0] ?? null;
      },
    };
    return node as unknown as Element;
  };
  const root = make("model", { "xmlns:ext": "urn:test" }, [
    make("resources", {}, [
      make("basematerials", { id: "7" }, [make("base", { name: "red", displaycolor: "#ff000080" })]),
      make("object", { id: "1", pid: "7", pindex: "0" }, [
        make("mesh", {}, [
          make("vertices", {}, [
            make("vertex", { x: "0", y: "0", z: "0" }),
            make("vertex", { x: "1", y: "0", z: "0" }),
            make("vertex", { x: "0", y: "1", z: "0" }),
          ]),
          make("triangles", {}, [make("triangle", { v1: "0", v2: "1", v3: "2" })]),
        ]),
      ]),
    ]),
    make("build", {}, [make("item", { objectid: "1", transform: "1 0 0 0 1 0 0 0 1 2 3 4" })]),
  ]);
  const rels = make("Relationships", {}, [make("Relationship", { Target: "/3D/model.model" })]);
  const previous = globalThis.DOMParser;
  globalThis.DOMParser = class {
    parseFromString(text: string): Document {
      const element = text === "rels" ? rels : root;
      return {
        documentElement: element,
        querySelectorAll: element.querySelectorAll.bind(element),
      } as unknown as Document;
    }
  } as typeof DOMParser;
  try {
    const encode = (value: string) => new TextEncoder().encode(value);
    const loader = new ThreeMFLoader().setZipRuntime({
      unzipSync: () => ({ "_rels/.rels": encode("rels"), "3D/model.model": encode("model") }),
    });
    loader.addExtension({
      ns: "urn:test",
      apply: (_model, prefix, mesh) => {
        assert.equal(prefix, "ext");
        mesh.vertices[0] = 2;
      },
    });
    const group = loader.parse(data);
    assert.deepEqual(group.children[0].position.toArray(), [2, 3, 4]);
    const mesh = group.children[0].children[0];
    assert.ok(mesh instanceof Mesh);
    assert.ok(mesh.material instanceof MeshPhongMaterial);
    assert.equal(mesh.material.name, "red");
    assert.equal(mesh.material.opacity, 128 / 255);
    const position = mesh.geometry.getAttribute("position");
    assert.ok(position instanceof BufferAttribute);
    assert.equal(position.getX(0), 2);
    mesh.geometry.dispose();
    mesh.material.dispose();
  } finally {
    globalThis.DOMParser = previous;
  }
});
