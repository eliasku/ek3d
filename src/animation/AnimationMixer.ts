import type { AnimationObjectGroup } from "./AnimationObjectGroup";
import type { NumericAnimationBuffer } from "../math/Interpolant";
import type { Object3D } from "../core/Object3D";
import { AnimationAction } from "./AnimationAction";
import { EventDispatcher } from "../core/EventDispatcher";
import { LinearInterpolant } from "../math/interpolants/LinearInterpolant";
import { PropertyBinding } from "./PropertyBinding";
import { PropertyMixer } from "./PropertyMixer";
import { AnimationClip } from "./AnimationClip";
import { NormalAnimationBlendMode } from "../constants";
const _controlInterpolantsResultBuffer = new Float32Array(1);
/**
 * `AnimationMixer` is a player for animations on a particular object in
 * the scene. When multiple objects in the scene are animated independently,
 * one `AnimationMixer` may be used for each object.
 */
export class AnimationMixer extends EventDispatcher {
  _root: Object3D | AnimationObjectGroup;
  _accuIndex: number;
  time: number;
  timeScale: number;
  // Initialized together by _initMemoryManager() in the constructor.
  _actions!: any[];
  _nActiveActions!: number;
  _actionsByClip: any;
  _bindings!: any[];
  _nActiveBindings!: number;
  _bindingsByRootAndName: any;
  _controlInterpolants!: any[];
  _nActiveControlInterpolants!: number;
  stats: any;

  /**
   * Constructs a new animation mixer.
   *
   * @param root - The object whose animations shall be played by this mixer.
   */
  constructor(root: Object3D | AnimationObjectGroup) {
    super();
    this._root = root;
    this._initMemoryManager();
    this._accuIndex = 0;
    /**
     * The global mixer time (in seconds; starting with `0` on the mixer's creation).
     *
     * @default 0
     */
    this.time = 0;
    /**
     * A scaling factor for the global time.
     *
     * Note: Setting this member to `0` and later back to `1` is a
     * possibility to pause/unpause all actions that are controlled by this
     * mixer.
     *
     * @default 1
     */
    this.timeScale = 1.0;
  }
  _bindAction(action: any, prototypeAction?: any) {
    const root = action._localRoot || this._root,
      tracks = action._clip.tracks,
      nTracks = tracks.length,
      bindings = action._propertyBindings,
      interpolants = action._interpolants,
      rootUuid = root.uuid,
      bindingsByRoot = this._bindingsByRootAndName;
    let bindingsByName = (bindingsByRoot as any)[rootUuid];
    if (bindingsByName === undefined) {
      bindingsByName = {};
      (bindingsByRoot as any)[rootUuid] = bindingsByName;
    }
    for (let i = 0; i !== nTracks; ++i) {
      const track = tracks[i],
        trackName = track.name;
      let binding = bindingsByName[trackName];
      if (binding !== undefined) {
        ++binding.referenceCount;
        bindings[i] = binding;
      } else {
        binding = bindings[i];
        if (binding !== undefined) {
          // existing binding, make sure the cache knows
          if (binding._cacheIndex === null) {
            ++binding.referenceCount;
            this._addInactiveBinding(binding, rootUuid, trackName);
          }
          continue;
        }
        const path = prototypeAction && prototypeAction._propertyBindings[i].binding.parsedPath;
        binding = new PropertyMixer(
          PropertyBinding.create(root, trackName, path),
          track.ValueTypeName,
          track.getValueSize(),
        );
        ++binding.referenceCount;
        this._addInactiveBinding(binding, rootUuid, trackName);
        bindings[i] = binding;
      }
      interpolants[i].resultBuffer = binding.buffer;
    }
  }
  _activateAction(action?: any) {
    if (!this._isActiveAction(action)) {
      if (action._cacheIndex === null) {
        // this action has been forgotten by the cache, but the user
        // appears to be still using it -> rebind
        const rootUuid = (action._localRoot || this._root).uuid,
          clipUuid = action._clip.uuid,
          actionsForClip = (this._actionsByClip as any)[clipUuid];
        this._bindAction(action, actionsForClip && actionsForClip.knownActions[0]);
        this._addInactiveAction(action, clipUuid, rootUuid);
      }
      const bindings = action._propertyBindings;
      // increment reference counts / sort out state
      for (let i = 0, n = bindings.length; i !== n; ++i) {
        const binding = bindings[i];
        if (binding.useCount++ === 0) {
          this._lendBinding(binding);
          binding.saveOriginalState();
        }
      }
      this._lendAction(action);
    }
  }
  _deactivateAction(action?: any) {
    if (this._isActiveAction(action)) {
      const bindings = action._propertyBindings;
      // decrement reference counts / sort out state
      for (let i = 0, n = bindings.length; i !== n; ++i) {
        const binding = bindings[i];
        if (--binding.useCount === 0) {
          binding.restoreOriginalState();
          this._takeBackBinding(binding);
        }
      }
      this._takeBackAction(action);
    }
  }
  // Memory manager
  _initMemoryManager() {
    this._actions = []; // 'nActiveActions' followed by inactive ones
    this._nActiveActions = 0;
    this._actionsByClip = {};
    // inside:
    // {
    // 	knownActions: Array< AnimationAction > - used as prototypes
    // 	actionByRoot: AnimationAction - lookup
    // }
    this._bindings = []; // 'nActiveBindings' followed by inactive ones
    this._nActiveBindings = 0;
    this._bindingsByRootAndName = {}; // inside: Map< name, PropertyMixer >
    this._controlInterpolants = []; // same game as above
    this._nActiveControlInterpolants = 0;
    // oxlint-disable-next-line typescript/no-this-alias -- Stats getters have their own receiver, distinct from the mixer.
    const scope = this;
    this.stats = {
      actions: {
        get total() {
          return scope._actions.length;
        },
        get inUse() {
          return scope._nActiveActions;
        },
      },
      bindings: {
        get total() {
          return scope._bindings.length;
        },
        get inUse() {
          return scope._nActiveBindings;
        },
      },
      controlInterpolants: {
        get total() {
          return scope._controlInterpolants.length;
        },
        get inUse() {
          return scope._nActiveControlInterpolants;
        },
      },
    };
  }
  // Memory management for AnimationAction objects
  _isActiveAction(action?: any) {
    const index = action._cacheIndex;
    return index !== null && index < this._nActiveActions;
  }
  _addInactiveAction(action: any, clipUuid: any, rootUuid?: any) {
    const actions = this._actions,
      actionsByClip = this._actionsByClip;
    let actionsForClip = (actionsByClip as any)[clipUuid];
    if (actionsForClip === undefined) {
      actionsForClip = {
        knownActions: [action],
        actionByRoot: {},
      };
      action._byClipCacheIndex = 0;
      (actionsByClip as any)[clipUuid] = actionsForClip;
    } else {
      const knownActions = actionsForClip.knownActions;
      action._byClipCacheIndex = knownActions.length;
      knownActions.push(action);
    }
    action._cacheIndex = actions.length;
    actions.push(action);
    actionsForClip.actionByRoot[rootUuid] = action;
  }
  _removeInactiveAction(action?: any) {
    const actions = this._actions,
      lastInactiveAction = actions[actions.length - 1],
      cacheIndex = action._cacheIndex;
    lastInactiveAction._cacheIndex = cacheIndex;
    actions[cacheIndex] = lastInactiveAction;
    actions.pop();
    action._cacheIndex = null;
    const clipUuid = action._clip.uuid,
      actionsByClip = this._actionsByClip,
      actionsForClip = (actionsByClip as any)[clipUuid],
      knownActionsForClip = actionsForClip.knownActions,
      lastKnownAction = knownActionsForClip[knownActionsForClip.length - 1],
      byClipCacheIndex = action._byClipCacheIndex;
    lastKnownAction._byClipCacheIndex = byClipCacheIndex;
    knownActionsForClip[byClipCacheIndex] = lastKnownAction;
    knownActionsForClip.pop();
    action._byClipCacheIndex = null;
    const actionByRoot = actionsForClip.actionByRoot,
      rootUuid = (action._localRoot || this._root).uuid;
    delete actionByRoot[rootUuid];
    if (knownActionsForClip.length === 0) {
      delete (actionsByClip as any)[clipUuid];
    }
    this._removeInactiveBindingsForAction(action);
  }
  _removeInactiveBindingsForAction(action?: any) {
    const bindings = action._propertyBindings;
    for (let i = 0, n = bindings.length; i !== n; ++i) {
      const binding = bindings[i];
      if (--binding.referenceCount === 0) {
        this._removeInactiveBinding(binding);
      }
    }
  }
  _lendAction(action?: any) {
    // [ active actions |  inactive actions  ]
    // [  active actions >| inactive actions ]
    //                 s        a
    //                  <-swap->
    //                 a        s
    const actions = this._actions,
      prevIndex = action._cacheIndex,
      lastActiveIndex = this._nActiveActions++,
      firstInactiveAction = actions[lastActiveIndex];
    action._cacheIndex = lastActiveIndex;
    actions[lastActiveIndex] = action;
    firstInactiveAction._cacheIndex = prevIndex;
    actions[prevIndex] = firstInactiveAction;
  }
  _takeBackAction(action?: any) {
    // [  active actions  | inactive actions ]
    // [ active actions |< inactive actions  ]
    //        a        s
    //         <-swap->
    //        s        a
    const actions = this._actions,
      prevIndex = action._cacheIndex,
      firstInactiveIndex = --this._nActiveActions,
      lastActiveAction = actions[firstInactiveIndex];
    action._cacheIndex = firstInactiveIndex;
    actions[firstInactiveIndex] = action;
    lastActiveAction._cacheIndex = prevIndex;
    actions[prevIndex] = lastActiveAction;
  }
  // Memory management for PropertyMixer objects
  _addInactiveBinding(binding: any, rootUuid: any, trackName?: any) {
    const bindingsByRoot = this._bindingsByRootAndName,
      bindings = this._bindings;
    let bindingByName = (bindingsByRoot as any)[rootUuid];
    if (bindingByName === undefined) {
      bindingByName = {};
      (bindingsByRoot as any)[rootUuid] = bindingByName;
    }
    bindingByName[trackName] = binding;
    binding._cacheIndex = bindings.length;
    bindings.push(binding);
  }
  _removeInactiveBinding(binding?: any) {
    const bindings = this._bindings,
      propBinding = binding.binding,
      rootUuid = propBinding.rootNode.uuid,
      trackName = propBinding.path,
      bindingsByRoot = this._bindingsByRootAndName,
      bindingByName = (bindingsByRoot as any)[rootUuid],
      lastInactiveBinding = bindings[bindings.length - 1],
      cacheIndex = binding._cacheIndex;
    lastInactiveBinding._cacheIndex = cacheIndex;
    bindings[cacheIndex] = lastInactiveBinding;
    bindings.pop();
    binding._cacheIndex = null;
    delete bindingByName[trackName];
    if (Object.keys(bindingByName).length === 0) {
      delete (bindingsByRoot as any)[rootUuid];
    }
  }
  _lendBinding(binding?: any) {
    const bindings = this._bindings,
      prevIndex = binding._cacheIndex,
      lastActiveIndex = this._nActiveBindings++,
      firstInactiveBinding = bindings[lastActiveIndex];
    binding._cacheIndex = lastActiveIndex;
    bindings[lastActiveIndex] = binding;
    firstInactiveBinding._cacheIndex = prevIndex;
    bindings[prevIndex] = firstInactiveBinding;
  }
  _takeBackBinding(binding?: any) {
    const bindings = this._bindings,
      prevIndex = binding._cacheIndex,
      firstInactiveIndex = --this._nActiveBindings,
      lastActiveBinding = bindings[firstInactiveIndex];
    binding._cacheIndex = firstInactiveIndex;
    bindings[firstInactiveIndex] = binding;
    lastActiveBinding._cacheIndex = prevIndex;
    bindings[prevIndex] = lastActiveBinding;
  }
  // Memory management of Interpolants for weight and time scale
  _lendControlInterpolant(): LinearInterpolant {
    const interpolants = this._controlInterpolants,
      lastActiveIndex = this._nActiveControlInterpolants++;
    let interpolant = interpolants[lastActiveIndex];
    if (interpolant === undefined) {
      interpolant = new LinearInterpolant(
        new Float32Array(2),
        new Float32Array(2) as NumericAnimationBuffer,
        1,
        _controlInterpolantsResultBuffer as NumericAnimationBuffer | null | undefined,
      );
      interpolant.__cacheIndex = lastActiveIndex;
      interpolants[lastActiveIndex] = interpolant;
    }
    return interpolant;
  }
  _takeBackControlInterpolant(interpolant?: any) {
    const interpolants = this._controlInterpolants,
      prevIndex = interpolant.__cacheIndex,
      firstInactiveIndex = --this._nActiveControlInterpolants,
      lastActiveInterpolant = interpolants[firstInactiveIndex];
    interpolant.__cacheIndex = firstInactiveIndex;
    interpolants[firstInactiveIndex] = interpolant;
    lastActiveInterpolant.__cacheIndex = prevIndex;
    interpolants[prevIndex] = lastActiveInterpolant;
  }
  /**
   * Returns an instance of {@link AnimationAction} for the passed clip.
   *
   * If an action fitting the clip and root parameters doesn't yet exist, it
   * will be created by this method. Calling this method several times with the
   * same clip and root parameters always returns the same action.
   *
   * @param clip - An animation clip or alternatively the name of the animation clip.
   * @param [optionalRoot] - An alternative root object.
   * @param [blendMode] - The blend mode.
   * @return The animation action.
   */
  clipAction(clip: AnimationClip, optionalRoot?: Object3D | AnimationObjectGroup, blendMode?: number): AnimationAction;
  clipAction(
    clip: AnimationClip | string,
    optionalRoot?: Object3D | AnimationObjectGroup,
    blendMode?: number,
  ): AnimationAction | null;
  clipAction(clip?: any, optionalRoot?: any, blendMode?: number): AnimationAction | null {
    const root = optionalRoot || this._root,
      rootUuid = root.uuid;
    let clipObject = typeof clip === "string" ? AnimationClip.findByName(root, clip) : clip;
    const clipUuid = clipObject !== null ? clipObject.uuid : clip;
    const actionsForClip = (this._actionsByClip as any)[clipUuid];
    let prototypeAction: any = null;
    if (blendMode === undefined) {
      if (clipObject !== null) {
        blendMode = clipObject.blendMode;
      } else {
        blendMode = NormalAnimationBlendMode;
      }
    }
    if (actionsForClip !== undefined) {
      const existingAction = actionsForClip.actionByRoot[rootUuid];
      if (existingAction !== undefined && existingAction.blendMode === blendMode) {
        return existingAction;
      }
      // we know the clip, so we don't have to parse all
      // the bindings again but can just copy
      prototypeAction = actionsForClip.knownActions[0];
      // also, take the clip from the prototype action
      if (clipObject === null) clipObject = prototypeAction._clip;
    }
    // clip must be known when specified via string
    if (clipObject === null) return null;
    // allocate all resources required to run it
    const newAction = new AnimationAction(this, clipObject, optionalRoot, blendMode);
    this._bindAction(newAction, prototypeAction);
    // and make the action known to the memory manager
    this._addInactiveAction(newAction, clipUuid, rootUuid);
    return newAction;
  }
  /**
   * Returns an existing animation action for the passed clip.
   *
   * @param clip - An animation clip or alternatively the name of the animation clip.
   * @param [optionalRoot] - An alternative root object.
   * @return The animation action. Returns `null` if no action was found.
   */
  existingAction(clip: AnimationClip | string, optionalRoot?: Object3D | AnimationObjectGroup): AnimationAction | null;
  existingAction(clip?: any, optionalRoot?: any): AnimationAction | null {
    const root = optionalRoot || this._root,
      rootUuid = root.uuid,
      clipObject = typeof clip === "string" ? AnimationClip.findByName(root, clip) : clip,
      clipUuid = clipObject ? clipObject.uuid : clip,
      actionsForClip = (this._actionsByClip as any)[clipUuid];
    if (actionsForClip !== undefined) {
      return actionsForClip.actionByRoot[rootUuid] || null;
    }
    return null;
  }
  /**
   * Deactivates all previously scheduled actions on this mixer.
   *
   * @return A reference to this animation mixer.
   */
  stopAllAction(): AnimationMixer {
    const actions = this._actions,
      nActions = this._nActiveActions;
    for (let i = nActions - 1; i >= 0; --i) {
      actions[i].stop();
    }
    return this;
  }
  /**
   * Advances the global mixer time and updates the animation.
   *
   * This is usually done in the render loop by passing the delta
   * time from {@link Clock} or {@link Timer}.
   *
   * @param deltaTime - The delta time in seconds.
   * @return A reference to this animation mixer.
   */
  update(deltaTime: number): AnimationMixer {
    deltaTime *= this.timeScale;
    const actions = this._actions,
      nActions = this._nActiveActions,
      time = (this.time += deltaTime),
      timeDirection = Math.sign(deltaTime),
      accuIndex = (this._accuIndex ^= 1);
    // run active actions
    for (let i = 0; i !== nActions; ++i) {
      const action = actions[i];
      action._update(time, deltaTime, timeDirection, accuIndex);
    }
    // update scene graph
    const bindings = this._bindings,
      nBindings = this._nActiveBindings;
    for (let i = 0; i !== nBindings; ++i) {
      bindings[i].apply(accuIndex);
    }
    return this;
  }
  /**
   * Sets the global mixer to a specific time and updates the animation accordingly.
   *
   * This is useful when you need to jump to an exact time in an animation. The
   * input parameter will be scaled by {@link AnimationMixer#timeScale}
   *
   * @param time - The time to set in seconds.
   * @return A reference to this animation mixer.
   */
  setTime(time: number): AnimationMixer {
    this.time = 0; // Zero out time attribute for AnimationMixer object;
    for (let i = 0; i < this._actions.length; i++) {
      this._actions[i].time = 0; // Zero out time attribute for all associated AnimationAction objects.
    }
    return this.update(time); // Update used to set exact time. Returns "this" AnimationMixer object.
  }
  /**
   * Returns this mixer's root object.
   *
   * @return The mixer's root object.
   */
  getRoot(): Object3D | AnimationObjectGroup {
    return this._root;
  }
  /**
   * Deallocates all memory resources for a clip. Before using this method make
   * sure to call {@link AnimationAction#stop} for all related actions.
   *
   * @param clip - The clip to uncache.
   */
  uncacheClip(clip: AnimationClip) {
    const actions = this._actions,
      clipUuid = clip.uuid,
      actionsByClip = this._actionsByClip,
      actionsForClip = (actionsByClip as any)[clipUuid];
    if (actionsForClip !== undefined) {
      // note: just calling _removeInactiveAction would mess up the
      // iteration state and also require updating the state we can
      // just throw away
      const actionsToRemove = actionsForClip.knownActions;
      for (let i = 0, n = actionsToRemove.length; i !== n; ++i) {
        const action = actionsToRemove[i];
        this._deactivateAction(action);
        const cacheIndex = action._cacheIndex,
          lastInactiveAction = actions[actions.length - 1];
        action._byClipCacheIndex = null;
        lastInactiveAction._cacheIndex = cacheIndex;
        actions[cacheIndex] = lastInactiveAction;
        actions.pop();
        action._cacheIndex = null;
        this._removeInactiveBindingsForAction(action);
      }
      delete (actionsByClip as any)[clipUuid];
    }
  }
  /**
   * Deallocates all memory resources for a root object. Before using this
   * method make sure to call {@link AnimationAction#stop} for all related
   * actions or alternatively {@link AnimationMixer#stopAllAction} when the
   * mixer operates on a single root.
   *
   * @param root - The root object to uncache.
   */
  uncacheRoot(root: Object3D | AnimationObjectGroup): void;
  uncacheRoot(root?: any) {
    const rootUuid = root.uuid,
      actionsByClip = this._actionsByClip;
    for (const clipUuid in actionsByClip) {
      const knownActions = (actionsByClip as any)[clipUuid].knownActions;
      for (let i = knownActions.length - 1; i >= 0; --i) {
        const action = knownActions[i];
        if ((action._localRoot || this._root).uuid === rootUuid) {
          this._deactivateAction(action);
          this._removeInactiveAction(action);
        }
      }
    }
    const bindingsByRoot = this._bindingsByRootAndName,
      bindingByName = (bindingsByRoot as any)[rootUuid];
    if (bindingByName !== undefined) {
      for (const trackName in bindingByName) {
        const binding = bindingByName[trackName];
        binding.restoreOriginalState();
        this._removeInactiveBinding(binding);
      }
    }
  }
  /**
   * Deallocates all memory resources for an action. The action is identified by the
   * given clip and an optional root object. Before using this method make
   * sure to call {@link AnimationAction#stop} to deactivate the action.
   *
   * @param clip - An animation clip or alternatively the name of the animation clip.
   * @param [optionalRoot] - An alternative root object.
   */
  uncacheAction(clip: AnimationClip | string, optionalRoot?: Object3D | AnimationObjectGroup): void;
  uncacheAction(clip?: any, optionalRoot?: any) {
    const action = this.existingAction(clip, optionalRoot);
    if (action !== null) {
      this._deactivateAction(action);
      this._removeInactiveAction(action);
    }
  }
}
