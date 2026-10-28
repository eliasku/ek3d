import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { USDCParser } from "../src/addons/loaders/usd/USDCParser";

test("USDC parser reads uncompressed paths, fields and specs", () => {
  const buffer = new ArrayBuffer(1024);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = 0;
  const u8 = (value: number) => {
    view.setUint8(offset, value);
    offset += 1;
  };
  const u32 = (value: number) => {
    view.setUint32(offset, value, true);
    offset += 4;
  };
  const u64 = (value: number) => {
    u32(value);
    u32(0);
  };
  const text = (value: string, size: number) => {
    bytes.set(new TextEncoder().encode(value), offset);
    offset += size;
  };
  text("PXR-USDC", 8);
  u8(0);
  u8(3);
  u8(0);
  offset = 16;
  u64(24);
  const sections = ["TOKENS", "FIELDS", "FIELDSETS", "PATHS", "SPECS"];
  u64(sections.length);
  const toc = offset;
  offset += sections.length * 32;
  const starts: number[] = [];
  const sizes: number[] = [];
  const section = (write: () => void) => {
    const start = offset;
    write();
    starts.push(start);
    sizes.push(offset - start);
  };
  section(() => {
    const tokens = "Cube\0specifier\0typeName\0Mesh\0";
    u64(4);
    u64(tokens.length);
    text(tokens, tokens.length);
  });
  section(() => {
    u32(1);
    u32(0);
    u32(0x40000000 | (42 << 16));
    u32(2);
    u32(3);
    u32(0x40000000 | (11 << 16));
  });
  section(() => {
    u32(0);
    u32(1);
    u32(0xffffffff);
  });
  section(() => {
    u64(2);
    u32(0);
    u32(0);
    u8(1);
    u32(1);
    u32(0);
    u8(0);
  });
  section(() => {
    u32(0);
    u32(2);
    u32(7);
    u32(1);
    u32(0);
    u32(6);
  });
  offset = toc;
  sections.forEach((name, index) => {
    text(name, 16);
    u64(starts[index]);
    u64(sizes[index]);
  });

  assert.deepEqual(new USDCParser().parseData(buffer), {
    specsByPath: {
      "/": { specType: 7, fields: {} },
      "/Cube": { specType: 6, fields: { specifier: 0, typeName: "Mesh" } },
    },
  });
  assert.throws(() => new USDCParser().parseData(new ArrayBuffer(24)), /Not a valid USDC file/);
});
