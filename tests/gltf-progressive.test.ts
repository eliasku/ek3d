import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { GLTFLoader, GLTFParser, type GLTF } from "../src/addons/loaders/GLTFLoader";
import {
  configureLoader,
  LODsManager,
  NEEDLE_progressive,
  useNeedleProgressive,
} from "../src/addons/loaders/GLTFProgressive";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { BufferGeometry } from "../src/core/BufferGeometry";
import type { Object3D } from "../src/core/Object3D";
import type { Material } from "../src/materials/Material";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { ShaderMaterial } from "../src/materials/ShaderMaterial";
import { Mesh } from "../src/objects/Mesh";
import type { WebGLRenderer } from "../src/renderers/WebGLRenderer";
import { Scene } from "../src/scenes/Scene";
import { Texture } from "../src/textures/Texture";

const extension = (guid: string, path: string) => ({ guid, lods: [{ path }] });

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((callback) => {
    resolve = callback;
  });
  return { promise, resolve };
}

function renderer(): WebGLRenderer {
  return {
    domElement: { height: 100 },
    getRenderTarget: () => null,
    renderLists: {
      get(scene: Object3D) {
        const opaque: Array<{ object: Object3D; material: Material }> = [];
        scene.traverseVisible((object) => {
          if (object instanceof Mesh)
            opaque.push({ object, material: Array.isArray(object.material) ? object.material[0] : object.material });
        });
        return { opaque, transparent: [], transmissive: [] };
      },
    },
    render: () => {},
  } as unknown as WebGLRenderer;
}

function register(mesh: Mesh, texture: Texture, manager?: LODsManager, prefix: string = ""): void {
  const parser = new GLTFParser({
    meshes: [{ extensions: { NEEDLE_progressive: extension(`${prefix}mesh`, "mesh.glb") } }],
    textures: [{ extensions: { NEEDLE_progressive: extension(`${prefix}texture`, "texture.glb") } }],
  });
  parser.options.path = "/model/";
  parser.associations.set(mesh, { meshes: 0, primitives: 0 });
  parser.associations.set(texture, { textures: 0 });
  new NEEDLE_progressive(parser, manager).afterRoot();
}

test("progressive LODs share requests, restore mesh and preserve higher texture quality", async () => {
  const originalGeometry = new BufferGeometry();
  const originalTexture = new Texture();
  originalTexture.flipY = false;
  const material = new MeshBasicMaterial({ map: originalTexture });
  const mesh = new Mesh(originalGeometry, material);
  const detailedGeometry = new BufferGeometry();
  const detailedTexture = new Texture();
  const calls: string[] = [];
  const loader = new GLTFLoader();
  loader.loadAsync = async (url: string) => {
    calls.push(url);
    const isTexture = url.endsWith("texture.glb");
    const parser = new GLTFParser(
      isTexture
        ? { textures: [{ extensions: { NEEDLE_progressive: { guid: "texture" } } }] }
        : { meshes: [{ extensions: { NEEDLE_progressive: { guid: "mesh" } } }] },
    );
    parser.getDependency = () => Promise.resolve(isTexture ? detailedTexture : new Mesh(detailedGeometry, material));
    return { parser } as GLTF;
  };
  const scene = new Scene();
  scene.add(mesh);
  const camera = new PerspectiveCamera();
  const manager = new LODsManager(loader, renderer());
  register(mesh, originalTexture, manager);
  let completed = deferred();
  let count = 0;
  manager.addEventListener("changed", () => {
    if (++count === 2) completed.resolve();
  });
  manager.overrideLodLevel = 0;
  manager.update(scene, camera);
  manager.update(scene, camera);
  manager.update(scene, camera);
  await completed.promise;
  assert.deepEqual(calls.sort(), ["/model/mesh.glb", "/model/texture.glb"]);
  assert.equal(mesh.geometry, detailedGeometry);
  assert.equal(material.map?.source, detailedTexture.source);
  assert.equal(material.map?.flipY, false);
  completed = deferred();
  count = 0;
  manager.overrideLodLevel = 1;
  manager.update(scene, camera);
  await completed.promise;
  assert.equal(mesh.geometry, originalGeometry);
  assert.equal(material.map?.source, detailedTexture.source);
});

test("injected worker loads progressive mesh and texture resources", async () => {
  const loader = new GLTFLoader();
  loader.setKTX2Loader({ load: () => null });
  const geometry = new BufferGeometry();
  const texture = new Texture();
  const calls: string[] = [];
  const manager = useNeedleProgressive(loader, renderer(), {
    enableLODsManager: false,
    worker: {
      async load(url, guid, kind) {
        calls.push(`${url}:${guid}:${kind}`);
        return kind === "mesh" ? [geometry] : texture;
      },
    },
  });
  const initialTexture = new Texture();
  const material = new MeshBasicMaterial({ map: initialTexture });
  const mesh = new Mesh(new BufferGeometry(), material);
  register(mesh, initialTexture, manager, "worker-");
  const scene = new Scene();
  scene.add(mesh);
  const camera = new PerspectiveCamera();
  const done = deferred();
  let count = 0;
  manager.addEventListener("changed", () => {
    if (++count === 2) done.resolve();
  });
  manager.overrideLodLevel = 0;
  manager.update(scene, camera);
  manager.update(scene, camera);
  manager.update(scene, camera);
  await done.promise;
  assert.deepEqual(calls.sort(), ["/model/mesh.glb:worker-mesh:mesh", "/model/texture.glb:worker-texture:texture"]);
  assert.equal(mesh.geometry, geometry);
  assert.equal(material.map?.source, texture.source);
});

test("progressive texture assignment updates shader uniforms", async () => {
  const loader = new GLTFLoader();
  const upgraded = new Texture();
  const manager = new LODsManager(loader, renderer(), {
    async load(_url, _guid, kind) {
      return kind === "texture" ? upgraded : [new BufferGeometry()];
    },
  });
  const original = new Texture();
  const material = new ShaderMaterial({ uniforms: { diffuse: { value: original } } });
  const mesh = new Mesh(new BufferGeometry(), material);
  register(mesh, original, manager, "shader-");
  const result = await NEEDLE_progressive.assignTextureLOD(material, 0);
  assert.equal(result?.[0].slot, "diffuse");
  assert.equal(material.uniforms.diffuse.value.source, upgraded.source);
  assert.equal(material.uniformsNeedUpdate, true);
});

test("shared progressive textures remain alive until the last material switches", async () => {
  const original = new Texture();
  const replacement = new Texture();
  const loader = new GLTFLoader();
  const manager = new LODsManager(loader, renderer(), {
    async load() {
      return replacement;
    },
  });
  const first = new MeshBasicMaterial({ map: original });
  const second = new MeshBasicMaterial({ map: original });
  const scene = new Scene();
  scene.add(new Mesh(new BufferGeometry(), first), new Mesh(new BufferGeometry(), second));
  const parser = new GLTFParser({
    textures: [{ extensions: { NEEDLE_progressive: extension("shared-texture", "texture.glb") } }],
  });
  parser.associations.set(original, { textures: 0 });
  new NEEDLE_progressive(parser, manager).afterRoot({ scenes: [scene] } as unknown as GLTF);
  let disposed = 0;
  original.addEventListener("dispose", () => disposed++);
  await NEEDLE_progressive.assignTextureLOD(first, 0);
  assert.equal(disposed, 0);
  await NEEDLE_progressive.assignTextureLOD(second, 0);
  assert.equal(disposed, 1);
});

test("mesh dependencies receive progressive metadata before root completion", async () => {
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
  const parser = new GLTFParser({
    meshes: [{ extensions: { NEEDLE_progressive: extension("early-mesh", "mesh.glb") } }],
  });
  parser.getDependency = () => Promise.resolve(mesh);
  const plugin = new NEEDLE_progressive(parser);
  assert.equal(await plugin.loadMesh(0), mesh);
  assert.equal(NEEDLE_progressive.getMeshLODExtension(mesh.geometry)?.guid, "early-mesh");
});

test("disposing a progressive GUID releases its original geometry and registration", () => {
  const geometry = new BufferGeometry();
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  const parser = new GLTFParser({
    meshes: [{ extensions: { NEEDLE_progressive: extension("dispose-mesh", "mesh.glb") } }],
  });
  parser.associations.set(mesh, { meshes: 0, primitives: 0 });
  new NEEDLE_progressive(parser).afterRoot();
  let disposed = 0;
  geometry.addEventListener("dispose", () => disposed++);
  assert.equal(NEEDLE_progressive.hasLODLevelAvailable(mesh), true);
  NEEDLE_progressive.dispose("dispose-mesh");
  assert.equal(disposed, 1);
  assert.equal(NEEDLE_progressive.hasLODLevelAvailable(mesh), false);
});

test("disposing progressive resources rejects pending assignments", async () => {
  const gate = deferred();
  const geometry = new BufferGeometry();
  const texture = new Texture();
  const initialTexture = new Texture();
  const material = new MeshBasicMaterial({ map: initialTexture });
  const initialGeometry = new BufferGeometry();
  const mesh = new Mesh(initialGeometry, material);
  const manager = new LODsManager(new GLTFLoader(), renderer(), {
    async load(_url, _guid, kind) {
      await gate.promise;
      return kind === "mesh" ? [geometry] : texture;
    },
  });
  register(mesh, initialTexture, manager, "pending-");
  const meshTask = NEEDLE_progressive.assignMeshLOD(mesh, 0);
  const textureTask = NEEDLE_progressive.assignTextureLOD(material, 0);
  NEEDLE_progressive.dispose("pending-mesh");
  NEEDLE_progressive.dispose("pending-texture");
  gate.resolve();
  await Promise.all([meshTask, textureTask]);
  assert.equal(mesh.geometry, initialGeometry);
  assert.equal(material.map, initialTexture);
});

test("disabling the manager restores the original render function", () => {
  const target = renderer();
  const render = target.render;
  const manager = LODsManager.get(target);
  assert.equal(LODsManager.get(target), manager);
  manager.enable();
  assert.notEqual(target.render, render);
  manager.disable();
  assert.equal(target.render, render);
});

test("Needle smart loading hints do not modify unrelated requests", () => {
  const loader = new GLTFLoader();
  const headers: Array<string | undefined> = [];
  loader.load = () => {
    headers.push(loader.requestHeader.Accept);
  };
  configureLoader(loader, { progressive: true, usecase: "product" });
  loader.load("https://example.com/model.glb", () => {});
  loader.load("https://cloud.needle.tools/model.glb", () => {});
  assert.deepEqual(headers, [undefined, "*/*;progressive=allowed;usecase=product"]);
  configureLoader(loader, { progressive: false });
  loader.load("https://cloud.needle.tools/model.glb", () => {});
  assert.equal(headers[2], "*/*;usecase=product");
});

test("dot-relative LOD paths are passed through unchanged", async () => {
  const requested: string[] = [];
  const replacement = new Texture();
  const manager = new LODsManager(new GLTFLoader(), renderer(), {
    async load(url) {
      requested.push(url);
      return replacement;
    },
  });
  const original = new Texture();
  const parser = new GLTFParser({
    textures: [{ extensions: { NEEDLE_progressive: extension("dot-relative", "./texture.glb") } }],
  });
  parser.options.path = "/model/";
  parser.associations.set(original, { textures: 0 });
  new NEEDLE_progressive(parser, manager).afterRoot();
  const result = await NEEDLE_progressive.assignTextureLOD(original, 0);
  assert.equal(result?.source, replacement.source);
  assert.deepEqual(requested, ["./texture.glb"]);
});
