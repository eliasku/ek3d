import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { AMFLoader } from "../src/addons/loaders/AMFLoader";
import { MeshPhongMaterial } from "../src/materials/MeshPhongMaterial";
import { Mesh } from "../src/objects/Mesh";

const zip = new Uint8Array([0x50, 0x4b]).buffer;

test("compressed AMF requires an injected ZIP decoder and an AMF archive entry", () => {
  const loader = new AMFLoader();
  assert.throws(() => loader.parse(zip), /ZIP runtime is required/);
  loader.setZipRuntime({ unzipSync: () => ({ "readme.txt": new Uint8Array() }) });
  assert.throws(() => loader.parse(zip), /contains no AMF file/);
});

test("AMF reads the exact ZIP entry view and applies units and material opacity", () => {
  const make = (
    localName: string,
    textContent = "",
    attributes: Record<string, string> = {},
    children: Element[] = [],
  ): Element => {
    const node = {
      localName,
      textContent,
      children,
      getAttribute: (name: string) => attributes[name] ?? null,
      getElementsByTagName: (name: string) => children.filter((child) => child.localName === name),
    };
    return node as unknown as Element;
  };
  const coordinate = (x: string, y: string, z: string) =>
    make("vertex", "", {}, [make("coordinates", "", {}, [make("x", x), make("y", y), make("z", z)])]);
  const root = make("amf", "", { unit: "inch" }, [
    make("material", "", { id: "1" }, [
      make("color", "", {}, [make("r", "1"), make("g", "0"), make("b", "0"), make("a", "0.5")]),
    ]),
    make("object", "", {}, [
      make("mesh", "", {}, [
        make("vertices", "", {}, [coordinate("1", "0", "0"), coordinate("0", "1", "0"), coordinate("0", "0", "1")]),
        make("volume", "", { materialid: "1" }, [
          make("triangle", "", {}, [make("v1", "0"), make("v2", "1"), make("v3", "2")]),
        ]),
      ]),
    ]),
  ]);
  const previous = globalThis.DOMParser;
  globalThis.DOMParser = class {
    parseFromString(text: string): Document {
      assert.equal(text, "<amf/>");
      return { documentElement: root } as Document;
    }
  } as typeof DOMParser;
  try {
    const padded = new TextEncoder().encode("xx<amf/>yy");
    const result = new AMFLoader()
      .setZipRuntime({ unzipSync: () => ({ "model.AMF": padded.subarray(2, 8) }) })
      .parse(zip);
    const mesh = result.children[0].children[0];
    assert.ok(mesh instanceof Mesh);
    assert.ok(mesh.material instanceof MeshPhongMaterial);
    assert.equal(mesh.material.opacity, 0.5);
    const position = mesh.geometry.getAttribute("position");
    assert.ok(position instanceof BufferAttribute);
    assert.ok(Math.abs(position.getX(0) - 25.4) < 0.0001);
    assert.equal(mesh.material.transparent, true);
    assert.deepEqual(Array.from(mesh.geometry.index!.array), [0, 1, 2]);
    mesh.geometry.dispose();
    mesh.material.dispose();
  } finally {
    globalThis.DOMParser = previous;
  }
});
