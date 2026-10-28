import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { ColladaComposer, type ColladaKinematics } from "../src/addons/loaders/collada/ColladaComposer";
import type { ColladaLibrary } from "../src/addons/loaders/collada/ColladaParser";
import { TextureLoader } from "../src/loaders/TextureLoader";
import { Vector3 } from "../src/math/Vector3";
import { Group } from "../src/objects/Group";

test("Collada kinematics applies a revolute joint and respects its limits", () => {
  const link = new Group();
  link.name = "link";
  const scene = new Group();
  scene.add(link);
  const transform = {
    nodeType: 1,
    nodeName: "rotate",
    textContent: "0 0 1 0",
    getAttribute: (name: string) => (name === "sid" ? "joint0" : null),
  };
  const visual = {
    id: "link-id",
    childNodes: [transform],
    getAttribute: (name: string) => (name === "name" ? "link" : null),
  };
  const collada = {
    querySelector: (selector: string) => (selector === '[sid="joint0"]' ? { parentElement: visual } : visual),
  } as unknown as Element;
  const joint = {
    sid: "joint0",
    name: "joint0",
    axis: new Vector3(0, 0, 1),
    limits: { min: -90, max: 90 },
    type: "revolute",
    static: false,
    zeroPosition: 0,
    middlePosition: 0,
  };
  const library = {
    kinematicsModels: { model: { joints: { joint0: joint } } },
    kinematicsScenes: { kinematics: { bindJointAxis: [{ target: "joint0", jointIndex: "joint0" }] } },
    visualScenes: { visual: { build: scene } },
  } as unknown as ColladaLibrary;
  const composer = new ColladaComposer(library, collada, new TextureLoader(), undefined);
  composer.setupKinematics();
  const kinematics = composer.kinematics as Extract<ColladaKinematics, { joints: unknown }>;
  assert.ok("joints" in kinematics);
  assert.equal(kinematics.getJointValue("joint0"), 0);
  kinematics.setJointValue("joint0", 90);
  assert.equal(kinematics.getJointValue("joint0"), 90);
  assert.ok(Math.abs(link.quaternion.z - Math.SQRT1_2) < 1e-12);
  kinematics.setJointValue("joint0", 100);
  assert.equal(kinematics.getJointValue("joint0"), 90);
});
