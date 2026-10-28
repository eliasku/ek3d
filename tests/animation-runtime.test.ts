import { test, vi } from "vite-plus/test";
import assert from "node:assert/strict";
import { AnimationClip } from "../src/animation/AnimationClip";
import { AnimationMixer } from "../src/animation/AnimationMixer";
import { AnimationObjectGroup } from "../src/animation/AnimationObjectGroup";
import { PropertyBinding } from "../src/animation/PropertyBinding";
import { PropertyMixer } from "../src/animation/PropertyMixer";
import { NumberKeyframeTrack } from "../src/animation/tracks/NumberKeyframeTrack";
import { VectorKeyframeTrack } from "../src/animation/tracks/VectorKeyframeTrack";
import { QuaternionKeyframeTrack } from "../src/animation/tracks/QuaternionKeyframeTrack";
import { BooleanKeyframeTrack } from "../src/animation/tracks/BooleanKeyframeTrack";
import { StringKeyframeTrack } from "../src/animation/tracks/StringKeyframeTrack";
import { Object3D } from "../src/core/Object3D";
import { LoopOnce, LoopRepeat, LoopPingPong, AdditiveAnimationBlendMode } from "../src/constants";
import { AnimationMixer as UpstreamMixer } from "../upstream/three.js/src/animation/AnimationMixer.js";
import { AnimationObjectGroup as UpstreamGroup } from "../upstream/three.js/src/animation/AnimationObjectGroup.js";
import { PropertyBinding as UpstreamBinding } from "../upstream/three.js/src/animation/PropertyBinding.js";
import { PropertyMixer as UpstreamPropertyMixer } from "../upstream/three.js/src/animation/PropertyMixer.js";

const mixers = [AnimationMixer, UpstreamMixer as unknown as typeof AnimationMixer];
function scalar(name = "move", end = 10, duration = 1) {
  return new AnimationClip(name, duration, [new NumberKeyframeTrack(".position[x]", [0, duration], [0, end])]);
}

test("binding dispatch tables stay shared while callbacks bind and unbind per instance", () => {
  const root = new Object3D();
  const binding = new PropertyBinding(root, ".position[x]");
  const other = new PropertyBinding(root, ".position[y]");
  assert.equal(binding.GetterByBindingType, other.GetterByBindingType);
  assert.equal(binding.SetterByBindingTypeAndVersioning, other.SetterByBindingTypeAndVersioning);
  assert.equal(Object.hasOwn(binding, "GetterByBindingType"), false);
  assert.equal(Object.hasOwn(binding, "BindingType"), false);
  const sharedGetters = binding.GetterByBindingType;
  binding.GetterByBindingType = sharedGetters.slice();
  assert.equal(Object.hasOwn(binding, "GetterByBindingType"), true);
  assert.equal(other.GetterByBindingType, sharedGetters);
  binding.setValue([7], 0);
  assert.equal(root.position.x, 7);
  binding.unbind();
  const buffer = [0];
  binding.getValue(buffer, 0);
  assert.deepEqual(buffer, [7]);
});

test("mixer once/repeat/pingpong, reverse playback and finish/loop events match upstream", () => {
  for (const mode of [LoopOnce, LoopRepeat, LoopPingPong]) {
    for (const reverse of [false, true]) {
      const results = mixers.map((Mixer) => {
        const root = new Object3D();
        root.position.x = 3;
        const mixer = new Mixer(root);
        const action = mixer.clipAction(scalar()).setLoop(mode, 2);
        action.clampWhenFinished = true;
        if (reverse) {
          action.time = 1;
          action.timeScale = -1;
        }
        const events: { type: string; direction?: number; loopDelta?: number }[] = [];
        mixer.addEventListener("loop", (event) => {
          assert.equal(event.action, action);
          events.push({ type: event.type, loopDelta: event.loopDelta });
        });
        mixer.addEventListener("finished", (event) => {
          assert.equal(event.action, action);
          events.push({ type: event.type, direction: event.direction });
        });
        action.play();
        const samples = [0, 0.25, 0.75, 0.125, 0.875, 1, 0.125].map((delta) => {
          mixer.update(delta);
          return [
            root.position.x,
            action.time,
            action.enabled,
            action.paused,
            action.isRunning(),
            action.isScheduled(),
          ];
        });
        assert.equal(events.filter((event) => event.type === "finished").length, 1);
        assert.equal(action.paused, true);
        action.stop();
        assert.equal(root.position.x, 3);
        return { samples, events };
      });
      assert.deepEqual(results[0], results[1]);
    }
  }
});

test("pause, exact seek, delayed start, time scaling and reset retain action behavior", () => {
  const results = mixers.map((Mixer) => {
    const root = new Object3D();
    const mixer = new Mixer(root);
    const clip = scalar();
    root.animations.push(clip);
    const action = mixer.clipAction("move");
    assert.ok(action);
    assert.equal(action.getClip(), clip);
    assert.equal(action.getMixer(), mixer);
    assert.equal(action.getRoot(), root);
    action.play();
    mixer.update(0.25);
    assert.equal(root.position.x, 2.5);
    action.paused = true;
    mixer.update(0.25);
    assert.equal(root.position.x, 2.5);
    action.time = 0.75;
    mixer.update(0);
    assert.equal(root.position.x, 7.5);
    action.paused = false;
    mixer.setTime(0.125);
    assert.equal(root.position.x, 1.25);
    action
      .stop()
      .reset()
      .startAt(mixer.time + 0.5)
      .play();
    mixer.update(0.25);
    assert.equal(action.isRunning(), false);
    mixer.update(0.5);
    assert.equal(root.position.x, 2.5);
    action.setDuration(2);
    mixer.update(0.5);
    assert.equal(root.position.x, 5);
    action.halt(0.5);
    mixer.update(0.25);
    const halfway = root.position.x;
    mixer.update(0.5);
    assert.equal(action.paused, true);
    action.reset();
    assert.equal(action.paused, false);
    assert.equal(action.time, 0);
    mixer.stopAllAction();
    assert.equal(root.position.x, 0);
    return halfway;
  });
  assert.equal(results[0], results[1]);
});

test("normal/additive blending, crossfade and warp match upstream and restore original state", () => {
  const results = mixers.map((Mixer) => {
    const root = new Object3D();
    root.position.x = 2;
    const mixer = new Mixer(root);
    const a = mixer.clipAction(scalar("a", 10));
    const b = mixer.clipAction(scalar("b", 20, 2));
    a.setEffectiveWeight(0.25).play();
    b.setEffectiveWeight(0.5).play();
    mixer.update(0.5);
    assert.equal(root.position.x, 4.25);
    a.setEffectiveWeight(1);
    b.setEffectiveWeight(1).reset();
    a.crossFadeTo(b, 0.5, true);
    const states = [0, 0.125, 0.125, 0.25, 0.25].map((delta) => {
      mixer.update(delta);
      return [
        root.position.x,
        a.getEffectiveWeight(),
        b.getEffectiveWeight(),
        a.getEffectiveTimeScale(),
        b.getEffectiveTimeScale(),
      ];
    });
    assert.equal(a.enabled, false);
    assert.equal(b.getEffectiveWeight(), 1);
    mixer.stopAllAction();
    assert.equal(root.position.x, 2);
    const additiveClip = new AnimationClip(
      "additive",
      1,
      [new NumberKeyframeTrack(".position[x]", [0, 1], [4, 4])],
      AdditiveAnimationBlendMode,
    );
    const additive = mixer.clipAction(additiveClip).setEffectiveWeight(0.5).play();
    mixer.update(0.25);
    assert.equal(root.position.x, 4);
    additive.stop();
    assert.equal(root.position.x, 2);
    return states;
  });
  assert.deepEqual(results[0], results[1]);
});

test("cached actions reuse per root and blend mode, and every uncache path releases bindings", () => {
  for (const Mixer of [AnimationMixer]) {
    const root = new Object3D(),
      other = new Object3D();
    root.position.x = 7;
    other.position.x = 9;
    const mixer = new Mixer(root),
      clip = scalar();
    const a = mixer.clipAction(clip),
      b = mixer.clipAction(clip, other);
    assert.equal(mixer.clipAction(clip), a);
    assert.equal(mixer.existingAction(clip), a);
    assert.notEqual(a, b);
    const additive = mixer.clipAction(clip, root, AdditiveAnimationBlendMode);
    assert.notEqual(additive, a);
    a.play();
    b.play();
    mixer.update(0.25);
    mixer.uncacheAction(clip, other);
    assert.equal(other.position.x, 9);
    assert.equal(mixer.existingAction(clip, other), null);
    assert.equal(mixer.stats.actions.inUse, 1);
    mixer.uncacheRoot(root);
    assert.equal(root.position.x, 7);
    assert.equal(mixer.stats.bindings.total, 0);
    assert.equal(mixer.stats.actions.total, 0);
    const again = mixer.clipAction(clip).play();
    assert.notEqual(again, a);
    mixer.update(0.5);
    assert.equal(root.position.x, 5);
    mixer.uncacheClip(clip);
    assert.equal(root.position.x, 7);
    assert.equal(mixer.existingAction(clip), null);
    assert.equal(mixer.stats.actions.total, 0);
    assert.equal(mixer.stats.bindings.total, 0);
    assert.equal(mixer.stats.controlInterpolants.inUse, 0);
    again.reset().play();
    mixer.update(0.25);
    assert.equal(root.position.x, 2.5);
    again.stop();
    assert.equal(root.position.x, 7);
    mixer.uncacheClip(clip);
  }
});

test("vector, quaternion and discrete string/boolean property mixing match upstream", () => {
  const results = mixers.map((Mixer) => {
    const root = new Object3D();
    root.name = "original";
    const mixer = new Mixer(root);
    const clip = new AnimationClip("properties", 2, [
      new VectorKeyframeTrack(".position", [0, 1, 2], [0, 0, 0, 2, 4, 6, 4, 8, 12]),
      new QuaternionKeyframeTrack(".quaternion", [0, 1, 2], [0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1]),
      new BooleanKeyframeTrack(".visible", [0, 1, 2], [true, false, true]),
      new StringKeyframeTrack(".name", [0, 1, 2], ["first", "second", "last"]),
    ]);
    const action = mixer.clipAction(clip).play();
    const states = [0, 0.5, 0.5, 0.5].map((delta) => {
      mixer.update(delta);
      assert.ok(Math.abs(root.quaternion.length() - 1) < 1e-6);
      return [root.position.toArray(), root.quaternion.toArray(), root.visible, root.name];
    });
    assert.equal(root.visible, false);
    assert.equal(root.name, "second");
    action.stop();
    assert.equal(root.name, "original");
    assert.equal(root.visible, true);
    assert.deepEqual(root.position.toArray(), [0, 0, 0]);
    return states;
  });
  assert.deepEqual(results[0], results[1]);
});

test("object group add/remove/reactivate/uncache and composite bindings retain upstream partition behavior", () => {
  const results = [
    [AnimationMixer, AnimationObjectGroup],
    [UpstreamMixer as unknown as typeof AnimationMixer, UpstreamGroup as unknown as typeof AnimationObjectGroup],
  ].map(([Mixer, Group]) => {
    // The tuple keeps the concrete constructors distinct for the runtime comparison.
    const GroupType = Group as typeof AnimationObjectGroup;
    const MixerType = Mixer as typeof AnimationMixer;
    const a = new Object3D(),
      b = new Object3D(),
      c = new Object3D();
    const group = new GroupType(a, b);
    const mixer = new MixerType(group);
    const clip = scalar();
    const action = mixer.clipAction(clip).play();
    mixer.update(0.25);
    assert.equal(a.position.x, 2.5);
    assert.equal(b.position.x, 2.5);
    group.remove(b);
    mixer.update(0.25);
    assert.equal(a.position.x, 5);
    assert.equal(b.position.x, 2.5);
    group.add(b, c);
    mixer.update(0.25);
    assert.deepEqual([a.position.x, b.position.x, c.position.x], [7.5, 7.5, 7.5]);
    group.remove(a);
    group.uncache(a);
    mixer.update(0.125);
    assert.equal(a.position.x, 7.5);
    assert.equal(group.stats.objects.total, 2);
    assert.equal(group.stats.objects.inUse, 2);
    const values = [a.position.x, b.position.x, c.position.x];
    action.stop();
    assert.equal(b.position.x, 0);
    assert.equal(c.position.x, 0);
    // Upstream Composite lacks the root/path metadata needed by mixer uncache.
    if (Mixer === AnimationMixer) mixer.uncacheRoot(group);
    group.uncache(b, c);
    assert.equal(group.stats.objects.total, 0);
    return values;
  });
  assert.deepEqual(results[0], results[1]);
});

test("property binding parsing, child resolution, unbinding and failed-binding recovery match upstream", () => {
  for (const Binding of [PropertyBinding, UpstreamBinding as unknown as typeof PropertyBinding]) {
    assert.deepEqual(Binding.parseTrackName("rig.bones[Arm].position[x]"), {
      nodeName: "rig",
      objectName: "bones",
      objectIndex: "Arm",
      propertyName: "position",
      propertyIndex: "x",
    });
    assert.equal(Binding.sanitizeNodeName("a b.c[d]"), "a_bcd");
    assert.throws(() => Binding.parseTrackName("invalid"), /Cannot parse/);
    const root = new Object3D(),
      child = new Object3D();
    child.name = "child";
    root.add(child);
    assert.equal(Binding.findNode(root, child.uuid), child);
    const binding = Binding.create(root, "child.position[x]");
    const buffer = [99, 0, 99];
    binding.getValue(buffer, 1);
    assert.equal(buffer[1], 0);
    binding.setValue([8], 0);
    assert.equal(child.position.x, 8);
    binding.unbind();
    binding.setValue([4], 0);
    assert.equal(child.position.x, 4);
    const missing = Binding.create(root, "later.position[x]");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      missing.setValue([9], 0);
      assert.equal(warn.mock.calls.length, 1);
    } finally {
      warn.mockRestore();
    }
    const later = new Object3D();
    later.name = "later";
    root.add(later);
    missing.unbind();
    missing.setValue([9], 0);
    assert.equal(later.position.x, 9);
  }
});

test("direct property mixer accumulates weights and restores saved state without aliasing input", () => {
  for (const Mixer of [PropertyMixer, UpstreamPropertyMixer as unknown as typeof PropertyMixer]) {
    const root = new Object3D();
    root.position.x = 2;
    const binding = PropertyBinding.create(root, ".position[x]");
    const mixer = new Mixer(binding, "number", 1);
    mixer.saveOriginalState();
    mixer.buffer[0] = 10;
    mixer.accumulate(0, 0.25);
    mixer.buffer[0] = 20;
    mixer.accumulate(0, 0.25);
    mixer.apply(0);
    assert.equal(root.position.x, 8.5);
    mixer.restoreOriginalState();
    assert.equal(root.position.x, 2);
    mixer.buffer[0] = 4;
    mixer.accumulateAdditive(0.5);
    mixer.apply(1);
    assert.equal(root.position.x, 4);
    mixer.restoreOriginalState();
    assert.equal(root.position.x, 2);
  }
});

test("unclamped finish disables once actions and restores the original property", () => {
  for (const Mixer of mixers) {
    const root = new Object3D();
    root.position.x = 6;
    const mixer = new Mixer(root);
    const action = mixer.clipAction(scalar()).setLoop(LoopOnce, 1).play();
    let finished = 0;
    mixer.addEventListener("finished", () => {
      finished++;
    });
    mixer.update(0.5);
    assert.equal(root.position.x, 5);
    mixer.update(0.5);
    assert.equal(action.enabled, false);
    assert.equal(root.position.x, 6);
    mixer.update(1);
    assert.equal(finished, 1);
    action.reset().play();
    mixer.update(0.25);
    assert.equal(root.position.x, 2.5);
    mixer.stopAllAction();
  }
});

test("quaternion additive blending and discrete weight thresholds match upstream", () => {
  const results = mixers.map((Mixer) => {
    const root = new Object3D();
    root.name = "original";
    const mixer = new Mixer(root);
    const clip = new AnimationClip(
      "add",
      1,
      [new QuaternionKeyframeTrack(".quaternion", [0, 1], [0, 1, 0, 0, 0, 1, 0, 0])],
      AdditiveAnimationBlendMode,
    );
    const additive = mixer.clipAction(clip).setEffectiveWeight(0.5).play();
    const discrete = mixer
      .clipAction(
        new AnimationClip("discrete", 1, [
          new StringKeyframeTrack(".name", [0, 1], ["animated", "animated"]),
          new BooleanKeyframeTrack(".visible", [0, 1], [false, false]),
        ]),
      )
      .setEffectiveWeight(0.25)
      .play();
    mixer.update(0.25);
    assert.equal(root.name, "original");
    assert.equal(root.visible, true);
    assert.ok(Math.abs(root.quaternion.length() - 1) < 1e-6);
    const quaternion = root.quaternion.toArray();
    discrete.setEffectiveWeight(0.75);
    mixer.update(0.25);
    assert.equal(root.name, "animated");
    assert.equal(root.visible, false);
    additive.stop();
    assert.deepEqual(root.quaternion.toArray(), [0, 0, 0, 1]);
    discrete.stop();
    assert.equal(root.name, "original");
    assert.equal(root.visible, true);
    return quaternion;
  });
  assert.deepEqual(results[0], results[1]);
});
