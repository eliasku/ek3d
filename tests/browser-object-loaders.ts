import { ObjectLoader } from "ek3d/loaders/ObjectLoader";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { Mesh } from "ek3d/objects/Mesh";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { Texture } from "ek3d/textures/Texture";
import { CubeTexture } from "ek3d/textures/CubeTexture";
import type { Object3D } from "ek3d/core/Object3D";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function objectLoaderBrowserChecks(): Promise<{ checks: string[] }> {
  const checks: string[] = [];
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d");
  assert(context, "Missing 2D canvas");
  context.fillStyle = "#ff8040";
  context.fillRect(0, 0, 1, 1);
  const geometry = new BufferGeometry().setAttribute(
    "position",
    new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
  );
  const textures = [new Texture(canvas), new CubeTexture(Array.from({ length: 6 }, () => canvas))];
  const factories = { objects: { Mesh }, materials: { MeshBasicMaterial } };
  for (const texture of textures) {
    const material = new MeshBasicMaterial({ map: texture });
    const original = new Mesh(geometry, material);
    const json = original.toJSON();
    let callbacks = 0;
    const restored = await new Promise<Object3D>((resolve, reject) => {
      new ObjectLoader(undefined, factories).parse(
        json,
        (object) => {
          callbacks++;
          try {
            assert(object instanceof Mesh && object.material instanceof MeshBasicMaterial, "Missing mesh or material");
            const image = object.material.map?.image;
            const images = Array.isArray(image) ? image : [image];
            assert(
              images.every((item) => item instanceof HTMLImageElement && item.complete && item.naturalWidth === 1),
              "onLoad ran before all images decoded",
            );
            resolve(object);
          } catch (error) {
            reject(error);
          }
        },
        reject,
      );
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert(callbacks === 1, "ObjectLoader onLoad must run once");
    assert(restored instanceof Mesh && restored.material instanceof MeshBasicMaterial, "Missing parsed mesh");
    assert(restored.material.map?.uuid === texture.uuid, "Texture UUID changed");
    assert(restored.material.map.source.uuid === texture.source.uuid, "Image source UUID changed");
    const asyncObject = await new ObjectLoader(undefined, factories).parseAsync(json);
    assert(asyncObject.uuid === original.uuid, "parseAsync object UUID changed");
    assert(
      asyncObject instanceof Mesh && asyncObject.material instanceof MeshBasicMaterial,
      "Missing async parsed mesh",
    );
    restored.material.map.dispose();
    restored.material.dispose();
    restored.geometry.dispose();
    asyncObject.material.map?.dispose();
    asyncObject.material.dispose();
    asyncObject.geometry.dispose();
    material.dispose();
    texture.dispose();
  }
  checks.push(
    "single/cube image completion exactly once",
    "parseAsync and source UUID preservation",
    "loaded resource disposal",
  );

  let managerErrors = 0;
  let complete!: () => void;
  const completion = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const manager = new LoadingManager(complete, undefined, () => {
    managerErrors++;
  });
  const loader = new ObjectLoader(manager, factories);
  const badImage = {
    metadata: { type: "Object" },
    images: [{ uuid: "bad-image", url: "data:image/png;base64,bm90LWFuLWltYWdl" }],
    textures: [{ uuid: "bad-texture", image: "bad-image" }],
    materials: [{ uuid: "bad-material", type: "MeshBasicMaterial", map: "bad-texture" }],
    geometries: [geometry.toJSON()],
    object: { uuid: "bad-object", type: "Mesh", geometry: geometry.uuid, material: "bad-material" },
  };
  let loaded = false;
  let failedObject!: Object3D;
  const error = await new Promise<unknown>((resolve) => {
    failedObject = loader.parse(
      badImage,
      () => {
        loaded = true;
      },
      resolve,
    );
  });
  await completion;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert(error instanceof Event, "Image decode failure did not reach onError");
  assert(
    managerErrors === 1 && !loaded,
    "Failed image must report manager error, complete accounting, and not succeed",
  );
  assert(
    failedObject instanceof Mesh && failedObject.material instanceof MeshBasicMaterial,
    "Missing failed resource owner",
  );
  failedObject.material.map?.dispose();
  failedObject.material.dispose();
  failedObject.geometry.dispose();
  checks.push("image decode error callback and manager completion");

  let malformedErrors = 0;
  const malformedManager = new LoadingManager(undefined, undefined, () => {
    malformedErrors++;
  });
  const malformed = new ObjectLoader(malformedManager, factories);
  const parseError = await new Promise<unknown>((resolve) => {
    malformed.load(
      "data:application/json,%7Bbroken",
      () => {
        throw new Error("Malformed JSON unexpectedly loaded");
      },
      undefined,
      resolve,
    );
  });
  assert(parseError instanceof Error && malformedErrors === 1, "Malformed JSON error must reach callback and manager");
  checks.push("malformed JSON callback and manager error");
  geometry.dispose();
  return { checks };
}
