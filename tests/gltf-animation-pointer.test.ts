import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { GLTFAnimationPointerExtension } from "../src/addons/loaders/GLTFAnimationPointerExtension";
import { GLTFParser } from "../src/addons/loaders/GLTFLoader";
import { AnimationClip } from "../src/animation/AnimationClip";
import { AnimationMixer } from "../src/animation/AnimationMixer";
import { PropertyBinding } from "../src/animation/PropertyBinding";
import { VectorKeyframeTrack } from "../src/animation/tracks/VectorKeyframeTrack";
import { Object3D } from "../src/core/Object3D";
import { Group } from "../src/objects/Group";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { MeshPhysicalMaterial } from "../src/materials/MeshPhysicalMaterial";
import { Mesh } from "../src/objects/Mesh";
import { Texture } from "../src/textures/Texture";

test("animation pointer registration preserves ordinary animation bindings", async () => {
  const root = new Group();
  const child = new Object3D();
  child.name = "animated";
  root.add(child);
  const extension = new GLTFAnimationPointerExtension(new GLTFParser({}));
  await extension.loadAnimationTargetFromChannelWithAnimationPointer({
    sampler: 0,
    target: { node: 0, path: "translation" },
  });
  const mixer = new AnimationMixer(root);
  const clip = new AnimationClip("move", 1, [new VectorKeyframeTrack("animated.position", [0, 1], [0, 0, 0, 2, 4, 6])]);
  mixer.clipAction(clip).play();
  mixer.setTime(0.5);
  assert.deepEqual(child.position.toArray(), [1, 2, 3]);
  assert.equal(PropertyBinding.findNode(root, child.uuid), child);
  assert.equal(PropertyBinding.findNode(root, "missing"), null);
  assert.equal(PropertyBinding.findNode(root, ""), root);
  assert.equal(PropertyBinding.findNode(root, -1), root);
  assert.equal(PropertyBinding.findNode(root, undefined), root);
  mixer.stopAllAction();
  mixer.uncacheRoot(root);
});

test("animation pointers update base and extension texture transforms", async () => {
  const material = new MeshPhysicalMaterial({ map: new Texture(), transmissionMap: new Texture() });
  material.name = "animated";
  const parser = new GLTFParser({
    animations: [
      {
        samplers: [
          { input: 0, output: 1 },
          { input: 0, output: 2 },
        ],
        channels: [
          {
            sampler: 0,
            target: {
              path: "pointer",
              extensions: {
                KHR_animation_pointer: {
                  pointer: "/materials/0/pbrMetallicRoughness/baseColorTexture/extensions/KHR_texture_transform/offset",
                },
              },
            },
          },
          {
            sampler: 1,
            target: {
              path: "pointer",
              extensions: {
                KHR_animation_pointer: {
                  pointer:
                    "/materials/0/extensions/KHR_materials_transmission/transmissionTexture/extensions/KHR_texture_transform/rotation",
                },
              },
            },
          },
        ],
      },
    ],
  });
  parser.cache.add("material:0", material);
  parser.cache.add("accessor:0", new BufferAttribute(new Float32Array([0, 1]), 1));
  parser.cache.add("accessor:1", new BufferAttribute(new Float32Array([0, 0, 1, 2]), 2));
  parser.cache.add("accessor:2", new BufferAttribute(new Float32Array([0, 1]), 1));
  const clip = await new GLTFAnimationPointerExtension(parser).loadAnimation(0);
  const geometry = new BufferGeometry();
  const mesh = new Mesh(geometry, material);
  const mixer = new AnimationMixer(mesh);
  mixer.clipAction(clip).play();
  mixer.setTime(0.5);
  assert.deepEqual(material.map!.offset.toArray(), [0.5, 1]);
  assert.equal(material.transmissionMap!.rotation, 0.5);
  mixer.stopAllAction();
  mixer.uncacheRoot(mesh);
  material.map!.dispose();
  material.transmissionMap!.dispose();
  material.dispose();
  geometry.dispose();
});
