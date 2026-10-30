import { GL } from "ek3d/GL";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { Timer } from "ek3d/core/Timer";
import type { Object3D } from "ek3d/core/Object3D";
import { Raycaster } from "ek3d/core/Raycaster";
import type { Intersection } from "ek3d/core/Raycaster";
import { Vector2 } from "ek3d/math/Vector2";
import { Spherical } from "ek3d/math/Spherical";
import { Float32BufferAttribute, Uint16BufferAttribute } from "ek3d/core/BufferAttribute";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { Bone } from "ek3d/objects/Bone";
import { Skeleton } from "ek3d/objects/Skeleton";
import { SkinnedMesh } from "ek3d/objects/SkinnedMesh";
import { AnimationClip } from "ek3d/animation/AnimationClip";
import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { NumberKeyframeTrack } from "ek3d/animation/tracks/NumberKeyframeTrack";
import type { DirectionalLight } from "ek3d/lights/DirectionalLight";
import type { PointLight } from "ek3d/lights/PointLight";
import type { SpotLight } from "ek3d/lights/SpotLight";
import { ToneMapping } from "ek3d/constants";
import { createRenderer } from "./renderer";
import { createScene } from "./scene";
import { createHud } from "./hud";
import { createAssets } from "./assets";
import { setupHelpers } from "./helpers";
import { createCustomShaders } from "./custom-shaders";
import { createLayerTargets } from "./layer-targets";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const overlay = document.querySelector<HTMLCanvasElement>("#overlay")!;
const hud = overlay.getContext("2d")!;
const events = new AbortController();
const resources: Array<{ dispose(): void }> = [];
let animation = 0;
let disposed = false;

function dispose() {
  if (disposed) return;
  disposed = true;
  cancelAnimationFrame(animation);
  events.abort();
  for (let i = resources.length - 1; i >= 0; i--) resources[i].dispose();
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  canvas.dataset.state = "error";
  canvas.dataset.error = message;
  hud.clearRect(0, 0, overlay.width, overlay.height);
  hud.fillStyle = "#330d18";
  hud.fillRect(0, 0, overlay.width, overlay.height);
  hud.fillStyle = "#fff";
  hud.font = "16px monospace";
  hud.fillText(`Rendering failed: ${message}`, 20, 40, Math.max(1, overlay.width - 40));
  console.error(error);
  dispose();
  throw error;
}

try {
  const renderer = createRenderer(canvas, resources);
  const {
    scene,
    fogs,
    stage,
    environment,
    checker,
    litGeometry,
    positions,
    packed,
    packedPositions,
    litMaterial,
    texturedMaterial,
    reflectedMaterial,
    tint,
    pulse,
    floor,
    reflected,
    textured,
    lit,
    primitives,
    normalMap,
    gradientMap,
    phongMaterial,
    normalMaterial,
    matcapMaterial,
    toonMaterial,
    standardMaterial,
    physicalMaterial,
    comparisonMaterials,
    comparisonNames,
    comparisonMeshes,
    shadowMaterial,
    shadowReceiver,
    comparisonSet,
    materialPositionKeys,
    instances,
    instanceColors,
    instanceHighlight,
    instanceTransform,
    instanceScreen,
    instancePositionKeys,
    instancedSet,
    batches,
    batchGeometryIds,
    batchIds,
    batchPositionKeys,
    lod,
    lodMaterials,
    batchedSet,
    tubeMaterial,
    extrudeMaterial,
    shapeMaterial,
    tube,
    extrude,
    shape,
    curves,
    lineMaterial,
    loopMaterial,
    edgesMaterial,
    pointsMaterial,
    spriteMaterial,
    line,
    loop,
    edges,
    points,
    sprite,
    objects,
    hemisphere,
    ambient,
    directional,
    point,
    spot,
    cookie,
    probe,
    area,
  } = createScene(resources);
  const skinGeometry = new CylinderGeometry(0.45, 0.45, 2.8, 24, 12);
  skinGeometry.translate(0, 1.4, 0);
  const skinPositions = skinGeometry.getAttribute("position");
  if (!skinPositions || !("getY" in skinPositions)) throw new Error("Skin geometry is missing CPU positions");
  const skinIndices = new Uint16Array(skinPositions.count * 4);
  const skinWeights = new Float32Array(skinPositions.count * 4);
  for (let i = 0; i < skinPositions.count; i++) {
    const weight = Math.max(0, Math.min(1, skinPositions.getY(i) / 2.8));
    skinIndices[i * 4 + 1] = 1;
    skinWeights[i * 4] = 1 - weight;
    skinWeights[i * 4 + 1] = weight;
  }
  skinGeometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
  skinGeometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));
  const skinMaterial = new MeshPhongMaterial({ color: 0x55ccee, shininess: 60 });
  const skinned = new SkinnedMesh(skinGeometry, skinMaterial);
  skinned.name = "Skinned cylinder";
  skinned.position.x = -1.5;
  const rootBone = new Bone();
  const bendBone = new Bone();
  bendBone.position.y = 1.4;
  rootBone.add(bendBone);
  skinned.add(rootBone);
  const skeleton = new Skeleton([rootBone, bendBone]);
  skinned.bind(skeleton);
  const morphGeometry = new SphereGeometry(0.85, 32, 20);
  const morphTarget = morphGeometry.clone().scale(1.65, 0.6, 1);
  morphGeometry.morphAttributes.position = [morphTarget.getAttribute("position") as Float32BufferAttribute];
  morphGeometry.morphAttributes.normal = [morphTarget.getAttribute("normal") as Float32BufferAttribute];
  const morphMaterial = new MeshPhongMaterial({ color: 0xff9955, shininess: 60 });
  const morph = new Mesh(morphGeometry, morphMaterial);
  morph.name = "Morph sphere";
  morph.position.set(1.5, 1, 0);
  const animationSet = [skinned, morph];
  for (const mesh of animationSet) mesh.castShadow = mesh.receiveShadow = true;
  // Bind both tracks while their targets are attached, then restore the initial scene.
  stage.add(...animationSet);
  const mixer = new AnimationMixer(stage);
  const clip = new AnimationClip("Bend and squash", 2, [
    new NumberKeyframeTrack(`${bendBone.uuid}.rotation[z]`, [0, 0.5, 1, 1.5, 2], [0, 0.7, 0, -0.7, 0]),
    new NumberKeyframeTrack(`${morph.uuid}.morphTargetInfluences[0]`, [0, 0.5, 1, 1.5, 2], [0, 1, 0, 1, 0]),
  ]);
  mixer.clipAction(clip).play();
  mixer.update(0);
  stage.remove(...animationSet);
  resources.push(skinGeometry, skinMaterial, morphGeometry, morphTarget, morphMaterial, skeleton, {
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(stage);
      stage.remove(...animationSet);
    },
  });
  const assets = createAssets(canvas, texturedMaterial, () => {
    draw();
    drawHud();
  });
  resources.push(assets);
  let fogIndex = 0;
  const help = createHud(overlay);
  const timer = new Timer();
  timer.connect(document);
  resources.push(timer);
  const perspective = new PerspectiveCamera(50, 1, 0.1, 100);
  const orthographic = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  let camera: PerspectiveCamera | OrthographicCamera = perspective;
  const helpers = setupHelpers(scene, {
    object: reflected,
    camera: perspective,
    directional,
    point,
    hemisphere,
    skeletonRoot: skinned,
  });
  resources.push(helpers);
  let helpersVisible = false;
  const customShaders = createCustomShaders();
  scene.add(customShaders.mesh);
  resources.push(customShaders);
  let shaderTime = 0;
  const layerTargets = createLayerTargets(renderer);
  scene.add(layerTargets.object);
  resources.push(layerTargets);
  let targetMode = "off";
  const orbit = new Spherical();
  const pointer = new Vector2();
  const raycaster = new Raycaster();
  raycaster.params.Line.threshold = 0.12;
  raycaster.params.Points.threshold = 0.16;
  const intersections: Intersection[] = [];
  let instancePhase = 0;
  function updateInstances() {
    for (let i = 0; i < instances.count; i++) {
      instanceTransform.position.set((i - 1) * 2.2, 0.9 + Math.sin(instancePhase + i) * 0.22, 0);
      instanceTransform.rotation.set(0.1 + instancePhase * 0.2, 0.35 + i * 0.4 + instancePhase, i * 0.12);
      instanceTransform.scale.set(0.9, 1 + i * 0.2, 0.8);
      instanceTransform.updateMatrix();
      instances.setMatrixAt(i, instanceTransform.matrix);
    }
    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingBox();
    instances.computeBoundingSphere();
  }
  updateInstances();
  let batchPhase = 0;
  function updateBatches() {
    for (let i = 0; i < batchIds.length; i++) {
      const id = batchIds[i];
      if (id === null) continue;
      instanceTransform.position.set((i - 1) * 2.2, 0.9 + Math.sin(batchPhase + i) * 0.22, 0);
      instanceTransform.rotation.set(0.1, 0.35 + batchPhase + i * 0.4, 0);
      instanceTransform.scale.set(1.3, 1.3, 1.3);
      instanceTransform.updateMatrix();
      batches.setMatrixAt(id, instanceTransform.matrix);
    }
    batches.computeBoundingBox();
    batches.computeBoundingSphere();
  }
  updateBatches();
  let meshSet = primitives;
  let objectsEnabled = false;
  let instancesEnabled = false;
  let batchingEnabled = false;
  let materialMode = false;
  let animationMode = false;
  let animationStageRotation = 0;
  let materialLighting = true;
  let materialIbl = true;
  let materialExtraLights = 0;
  let materialMaps = true;
  let previousStageRotation = 0;
  let pickable: Object3D[] = primitives;
  let selected: Object3D | null = null;
  let selectedInstance: number | null = null;
  let selectedBatch: number | null = null;
  let expanded = false;
  let ambientEnabled = false;
  let light: DirectionalLight | PointLight | SpotLight = directional;
  let paused = false;
  let environmentEnabled = true;
  let angle = 0.55;
  let elevation = 0.65;
  let distance = 11;
  let frames = 0;
  let tone = 0;
  const tones = [ToneMapping.ACESFilmic, ToneMapping.Reinhard, ToneMapping.AgX, ToneMapping.Neutral, ToneMapping.No];
  const toneNames = ["ACES", "Reinhard", "AgX", "Neutral", "None"];

  function updateMaterialLighting() {
    light.visible = hemisphere.visible = !materialMode || materialLighting;
    ambient.visible = ambientEnabled && (!materialMode || materialLighting);
    probe.visible = materialMode && (materialExtraLights === 1 || materialExtraLights === 3);
    area.visible = materialMode && materialExtraLights >= 2;
    scene.environment = materialMode && materialIbl ? environment : null;
  }

  function setMaterialMode(enabled: boolean) {
    if (materialMode === enabled) return;
    stage.remove(...pickable);
    materialMode = enabled;
    if (enabled) {
      previousStageRotation = stage.rotation.y;
      stage.rotation.y = 0;
      pickable = comparisonSet;
    } else {
      stage.rotation.y = previousStageRotation;
      pickable = animationMode
        ? animationSet
        : batchingEnabled
          ? batchedSet
          : instancesEnabled
            ? instancedSet
            : objectsEnabled
              ? objects
              : meshSet;
    }
    stage.add(...pickable);
    updateMaterialLighting();
    select(null);
  }

  function setAnimationMode(enabled: boolean) {
    if (animationMode === enabled) return;
    if (materialMode) setMaterialMode(false);
    stage.remove(...pickable);
    animationMode = enabled;
    if (enabled) {
      animationStageRotation = stage.rotation.y;
      stage.rotation.y = 0;
      pickable = animationSet;
    } else {
      stage.rotation.y = animationStageRotation;
      pickable = batchingEnabled ? batchedSet : instancesEnabled ? instancedSet : objectsEnabled ? objects : meshSet;
    }
    stage.add(...pickable);
    select(null);
  }

  function drawHud() {
    const status = `${paused ? "Paused" : "Animating"} · ${camera === perspective ? "Perspective" : "Orthographic"} · selected: ${selected?.name ?? "none"}`;
    const lines = materialMode
      ? [
          "ek3d · Phong / Normal / Matcap · Toon / Standard / Physical + Shadow",
          "P: return · Drag: orbit · Wheel: zoom · Space: pause · C: camera",
          "V: ordinary lights · Y: IBL · Q: probe/area · D: maps · Click: select",
          "L: light · S: shadows · T: tone · U: texture · E: background · +/-: exposure",
          `Lights ${materialLighting ? "on" : "off"} · IBL ${materialIbl ? "on" : "off"} · ${["no probe/area", "probe", "area", "probe + area"][materialExtraLights]} · maps ${materialMaps ? "on" : "off"}`,
          `${paused ? "Paused" : "Animating"} · ${camera === perspective ? "Perspective" : "Orthographic"} · selected: ${selected?.name ?? "none"}`,
          `${toneNames[tone]} · exposure ${renderer.toneMappingExposure.toFixed(1)} · shadows ${floor.receiveShadow ? "on" : "off"} · ${light === spot ? "Spot" : light === point ? "Point" : "Directional"}`,
        ]
      : [
          `ek3d · ${animationMode ? "skinned cylinder / morph sphere · AnimationMixer" : batchingEnabled ? `batched sphere/cylinder · LOD ${lod.getCurrentLevel() === 0 ? "sphere" : "box"}` : instancesEnabled ? "instanced boxes / colors / transforms" : objectsEnabled ? "lines / dashed loop / edges / points / sprite" : meshSet === primitives ? "sphere / cylinder / capsule" : "tube / beveled extrusion / flat shape"}`,
          "Drag: orbit · Wheel: zoom · Space: pause · C: camera",
          "L: light · S: shadows · B: blur · E: background/reflection",
          "A: ambient fill · K: spot cookie (select Spot with L)",
          "U: texture update · T: tone mapping · +/-: exposure",
          "P: materials · G: geometry · O: objects · Click: select",
          "F: fog · N: tint · I: packed update · M: instances · R: step",
          "H: batch/LOD · J: hide/show first · X: delete/add second",
          `W: animation · [ / ]: seek · Z: restart · time ${mixer.time.toFixed(2)}s`,
          `${paused ? "Paused" : "Animating"} · ${light === spot ? "Spot" : light === point ? "Point" : "Directional"} + hemisphere · ambient ${ambient.visible ? "on" : "off"}`,
          `Shadows ${floor.receiveShadow ? "on" : "off"} · spot cookie ${spot.map ? "on" : "off"} · F: fog`,
          `${toneNames[tone]} · exposure ${renderer.toneMappingExposure.toFixed(1)} · environment ${environmentEnabled ? "on" : "off"}`,
          `${camera === perspective ? "Perspective" : "Orthographic"} · fog: ${["off", "linear", "exp2"][fogIndex]} · selected: ${selected?.name ?? "none"}${selectedInstance === null ? "" : ` #${selectedInstance}`}${selectedBatch === null ? "" : ` #${selectedBatch}`}`,
        ];
    lines.push("4: target layers · 5: helpers · 6: custom shader · 7/8: compile/link diagnostics");
    lines.push(assets.status);
    lines.push(customShaders.status);
    help.draw(lines, status, customShaders.diagnostic ? customShaders.status : assets.status);
  }

  function draw() {
    orbit.set(distance, Math.PI / 2 - elevation, angle);
    camera.position.setFromSpherical(orbit);
    camera.position.y += 0.5;
    camera.lookAt(0, 0.6, 0);
    if (animationMode) {
      stage.updateMatrixWorld(true);
      skinned.computeBoundingSphere();
    }
    if (helpersVisible) helpers.update();
    layerTargets.update();
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    if (gl.isContextLost() || gl.getError() !== GL.NO_ERROR) throw new Error("WebGL rendering failed");
    canvas.dataset.state = "rendered";
    canvas.dataset.frame = String(++frames);
    canvas.dataset.paused = String(paused);
    canvas.dataset.camera = camera === perspective ? "perspective" : "orthographic";
    canvas.dataset.fog = ["off", "linear", "exp2"][fogIndex];
    canvas.dataset.helpers = String(helpersVisible);
    canvas.dataset.targetMode = targetMode;
    canvas.dataset.customShader = String(customShaders.mesh.visible);
    canvas.dataset.shaderDiagnostic = customShaders.diagnostic?.kind ?? "";
    canvas.dataset.shaderLog = customShaders.diagnostic ? JSON.stringify(customShaders.diagnostic) : "";
    canvas.dataset.selected = selected?.name ?? "";
    canvas.dataset.geometries = materialMode
      ? "materials"
      : animationMode
        ? "animation"
        : batchingEnabled
          ? "batching"
          : instancesEnabled
            ? "instances"
            : objectsEnabled
              ? "objects"
              : meshSet === primitives
                ? "primitives"
                : "curves";
    canvas.dataset.materialMode = String(materialMode);
    canvas.dataset.materialLighting = String(materialLighting);
    canvas.dataset.materialIbl = String(materialIbl);
    canvas.dataset.materialExtraLights = ["off", "probe", "area", "both"][materialExtraLights];
    canvas.dataset.materialMaps = String(materialMaps);
    canvas.dataset.materialNames = comparisonNames.join(",");
    canvas.dataset.animationMode = String(animationMode);
    canvas.dataset.animationTime = String(mixer.time);
    canvas.dataset.boneAngle = String(bendBone.rotation.z);
    canvas.dataset.morphWeight = String(morph.morphTargetInfluences![0]);
    if (animationMode && !materialMode) {
      for (const [mesh, key] of [
        [skinned, "skinnedPosition"],
        [morph, "morphPosition"],
      ] as const) {
        instanceScreen
          .set(0, mesh === skinned ? 0.5 : 0, 0)
          .applyMatrix4(mesh.matrixWorld)
          .project(camera);
        canvas.dataset[key] =
          `${((instanceScreen.x + 1) * canvas.clientWidth) / 2},${((1 - instanceScreen.y) * canvas.clientHeight) / 2}`;
      }
    } else {
      delete canvas.dataset.skinnedPosition;
      delete canvas.dataset.morphPosition;
    }
    if (materialMode) {
      for (let i = 0; i < comparisonSet.length; i++) {
        if (i === comparisonMeshes.length) {
          // Pick the exposed front of the receiver, not a sphere covering its center.
          instanceScreen.set(0, 0.035, 2.6).applyMatrix4(stage.matrixWorld);
        } else {
          comparisonSet[i].getWorldPosition(instanceScreen);
        }
        instanceScreen.project(camera);
        canvas.dataset[materialPositionKeys[i]] =
          `${((instanceScreen.x + 1) * canvas.clientWidth) / 2},${((1 - instanceScreen.y) * canvas.clientHeight) / 2}`;
      }
    } else {
      for (const key of materialPositionKeys) delete canvas.dataset[key];
    }
    canvas.dataset.instanceId = selectedInstance === null ? "" : String(selectedInstance);
    canvas.dataset.instanceVersion = String(instances.instanceMatrix.version);
    canvas.dataset.light = light === spot ? "spot" : light === point ? "point" : "directional";
    canvas.dataset.ambient = String(ambient.visible);
    canvas.dataset.cookie = String(spot.map !== null);
    canvas.dataset.shadows = String(floor.receiveShadow);
    if (instancesEnabled && !batchingEnabled && !materialMode && !animationMode) {
      for (let i = 0; i < instances.count; i++) {
        instances.getMatrixAt(i, instanceTransform.matrix);
        instanceScreen
          .setFromMatrixPosition(instanceTransform.matrix)
          .applyMatrix4(instances.matrixWorld)
          .project(camera);
        canvas.dataset[instancePositionKeys[i]] =
          `${((instanceScreen.x + 1) * canvas.clientWidth) / 2},${((1 - instanceScreen.y) * canvas.clientHeight) / 2}`;
      }
    } else {
      for (let i = 0; i < instancePositionKeys.length; i++) delete canvas.dataset[instancePositionKeys[i]];
    }
    canvas.dataset.batchId = selectedBatch === null ? "" : String(selectedBatch);
    canvas.dataset.batchCount = String(batches.instanceCount);
    canvas.dataset.batchVisible = String(batches.getVisibleAt(batchIds[0]!));
    canvas.dataset.batchPhase = String(batchPhase);
    canvas.dataset.lodLevel = String(lod.getCurrentLevel());
    if (batchingEnabled && !materialMode && !animationMode) {
      for (let i = 0; i < batchIds.length; i++) {
        const id = batchIds[i];
        if (id === null || !batches.getVisibleAt(id)) {
          delete canvas.dataset[batchPositionKeys[i]];
          continue;
        }
        batches.getMatrixAt(id, instanceTransform.matrix);
        instanceScreen
          .setFromMatrixPosition(instanceTransform.matrix)
          .applyMatrix4(batches.matrixWorld)
          .project(camera);
        canvas.dataset[batchPositionKeys[i]] =
          `${((instanceScreen.x + 1) * canvas.clientWidth) / 2},${((1 - instanceScreen.y) * canvas.clientHeight) / 2}`;
      }
      lod.getWorldPosition(instanceScreen).project(camera);
      canvas.dataset.lodPosition = `${((instanceScreen.x + 1) * canvas.clientWidth) / 2},${((1 - instanceScreen.y) * canvas.clientHeight) / 2}`;
    } else {
      for (const key of batchPositionKeys) delete canvas.dataset[key];
      delete canvas.dataset.lodPosition;
    }
  }

  function updateProjection() {
    const aspect = window.innerWidth / window.innerHeight;
    perspective.aspect = aspect;
    perspective.updateProjectionMatrix();
    const halfHeight = distance * Math.tan((perspective.fov * Math.PI) / 360);
    orthographic.left = -halfHeight * aspect;
    orthographic.right = halfHeight * aspect;
    orthographic.top = halfHeight;
    orthographic.bottom = -halfHeight;
    orthographic.updateProjectionMatrix();
  }

  function select(object: Object3D | null, instanceId?: number, batchId?: number) {
    if (selectedInstance !== null) {
      instances.setColorAt(selectedInstance, instanceColors[selectedInstance]);
      instances.instanceColor!.needsUpdate = true;
    }
    selectedInstance = object === instances && instanceId !== undefined ? instanceId : null;
    if (selectedInstance !== null) {
      instances.setColorAt(selectedInstance, instanceHighlight);
      instances.instanceColor!.needsUpdate = true;
    }
    if (selectedBatch !== null) batches.setColorAt(selectedBatch, instanceColors[batchIds.indexOf(selectedBatch)]);
    selectedBatch = object === batches && batchId !== undefined ? batchId : null;
    if (selectedBatch !== null) batches.setColorAt(selectedBatch, instanceHighlight);
    for (const material of lodMaterials) material.wireframe = object === lod;
    selected = object;
    for (let i = 0; i < comparisonMaterials.length; i++) {
      comparisonMaterials[i].wireframe = selected === comparisonMeshes[i];
    }
    shadowMaterial.color.setHex(selected === shadowReceiver ? 0x773399 : 0x18233e);
    reflectedMaterial.wireframe = selected === reflected;
    texturedMaterial.wireframe = selected === textured;
    litMaterial.wireframe = selected === lit;
    skinMaterial.wireframe = selected === skinned;
    morphMaterial.wireframe = selected === morph;
    tubeMaterial.wireframe = selected === tube;
    extrudeMaterial.wireframe = selected === extrude;
    shapeMaterial.wireframe = selected === shape;
    lineMaterial.color.setHex(selected === line ? 0xffffff : 0x55ccee);
    loopMaterial.color.setHex(selected === loop ? 0xffffff : 0xffbb55);
    edgesMaterial.color.setHex(selected === edges ? 0xffffff : 0xaa77ee);
    pointsMaterial.color.setHex(selected === points ? 0xffffff : 0x55ee99);
    spriteMaterial.color.setHex(selected === sprite ? 0xffffff : 0xff6688);
  }

  function pick(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, 1 - ((clientY - rect.top) / rect.height) * 2);
    raycaster.setFromCamera(pointer, camera);
    intersections.length = 0;
    // LOD delegates picking to one distance-selected level; don't also visit every hidden child.
    for (const candidate of pickable) raycaster.intersectObject(candidate, candidate !== lod, intersections);
    let object: Object3D | null = intersections[0]?.object ?? null;
    while (object && object.parent !== stage) object = object.parent;
    select(
      pickable.find((candidate) => candidate === object) ?? null,
      intersections[0]?.instanceId,
      intersections[0]?.batchId,
    );
    draw();
    drawHud();
  }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    overlay.width = window.innerWidth;
    overlay.height = window.innerHeight;
    updateProjection();
    draw();
    drawHud();
  }

  function frame(time: number) {
    try {
      timer.update(time);
      if (!paused) {
        const delta = Math.min(timer.getDelta(), 0.05);
        shaderTime += delta;
        customShaders.update(shaderTime);
        if (materialMode) {
          for (const mesh of comparisonMeshes) mesh.rotation.y += delta * 0.3;
        } else if (animationMode) {
          mixer.update(delta);
        } else if (batchingEnabled) {
          batchPhase += delta * 0.8;
          updateBatches();
        } else if (instancesEnabled) {
          instancePhase += delta * 0.8;
          updateInstances();
        } else {
          stage.rotation.y += delta * 0.12;
          reflected.rotation.y += delta * 0.35;
          textured.rotation.x += delta * 0.25;
          lit.rotation.y -= delta * 0.3;
          pulse.value = 1 + 0.2 * Math.sin(stage.rotation.y * 10);
        }
        draw();
      }
      animation = requestAnimationFrame(frame);
    } catch (error) {
      fail(error);
    }
  }

  window.addEventListener(
    "keydown",
    (event) => {
      try {
        const key = event.key.toLowerCase();
        if (materialMode && (key === "g" || key === "o" || key === "m" || key === "h" || key === "w"))
          setMaterialMode(false);
        if (animationMode && (key === "g" || key === "o" || key === "m" || key === "h")) setAnimationMode(false);
        switch (event.key.toLowerCase()) {
          case "1":
          case "2":
          case "3":
            if (event.repeat) return;
            assets.load(key === "1" ? "texture" : key === "2" ? "corrupt" : "missing");
            break;
          case "4":
            targetMode = layerTargets.cycle();
            break;
          case "5":
            helpersVisible = !helpersVisible;
            helpers.setVisible(helpersVisible);
            break;
          case "6":
            customShaders.mesh.visible = !customShaders.mesh.visible;
            break;
          case "7":
          case "8":
            if (event.repeat) return;
            customShaders.diagnose(renderer, camera, key === "7" ? "compile" : "link");
            break;
          case "?":
            if (event.repeat) return;
            help.toggle();
            break;
          case "w":
            setAnimationMode(!animationMode);
            break;
          case "[":
          case "]":
            if (!animationMode || materialMode) return;
            mixer.setTime(Math.max(0, mixer.time + (key === "]" ? 0.25 : -0.25)));
            break;
          case "z":
            if (!animationMode || materialMode) return;
            mixer.setTime(0);
            break;
          case "p":
            setMaterialMode(!materialMode);
            break;
          case "v":
            materialLighting = !materialLighting;
            updateMaterialLighting();
            break;
          case "y":
            materialIbl = !materialIbl;
            updateMaterialLighting();
            break;
          case "q":
            materialExtraLights = (materialExtraLights + 1) % 4;
            updateMaterialLighting();
            break;
          case "d":
            materialMaps = !materialMaps;
            for (const material of [phongMaterial, toonMaterial, standardMaterial, physicalMaterial]) {
              material.map = materialMaps ? checker : null;
              material.needsUpdate = true;
            }
            normalMaterial.normalMap = matcapMaterial.normalMap = materialMaps ? normalMap : null;
            toonMaterial.gradientMap = materialMaps ? gradientMap : null;
            normalMaterial.needsUpdate = matcapMaterial.needsUpdate = true;
            break;
          case " ":
            paused = !paused;
            break;
          case "c":
            camera = camera === perspective ? orthographic : perspective;
            break;
          case "f":
            fogIndex = (fogIndex + 1) % fogs.length;
            scene.fog = fogs[fogIndex];
            break;
          case "n":
            if (tint.value.x < 1) tint.value.set(4, 0.5, 0.2);
            else tint.value.set(0.3, 2, 4);
            break;
          case "m":
            stage.remove(...pickable);
            batchingEnabled = false;
            instancesEnabled = !instancesEnabled;
            pickable = instancesEnabled ? instancedSet : objectsEnabled ? objects : meshSet;
            stage.add(...pickable);
            select(null);
            break;
          case "h":
            stage.remove(...pickable);
            batchingEnabled = !batchingEnabled;
            pickable = batchingEnabled
              ? batchedSet
              : instancesEnabled
                ? instancedSet
                : objectsEnabled
                  ? objects
                  : meshSet;
            stage.add(...pickable);
            select(null);
            break;
          case "j":
            if (!batchingEnabled) return;
            select(null);
            batches.setVisibleAt(batchIds[0]!, !batches.getVisibleAt(batchIds[0]!));
            break;
          case "x":
            if (!batchingEnabled) return;
            select(null);
            if (batchIds[1] === null) {
              batchIds[1] = batches.addInstance(batchGeometryIds[1]);
              batches.setColorAt(batchIds[1], instanceColors[1]);
            } else {
              batches.deleteInstance(batchIds[1]);
              batchIds[1] = null;
            }
            updateBatches();
            break;
          case "r":
            if (batchingEnabled) {
              batchPhase += 0.5;
              updateBatches();
            } else if (instancesEnabled) {
              instancePhase += 0.5;
              updateInstances();
            } else return;
            break;
          case "g":
          case "o":
            stage.remove(...pickable);
            instancesEnabled = false;
            batchingEnabled = false;
            if (event.key.toLowerCase() === "g") {
              meshSet = meshSet === primitives ? curves : primitives;
              objectsEnabled = false;
            } else {
              objectsEnabled = !objectsEnabled;
            }
            pickable = objectsEnabled ? objects : meshSet;
            stage.add(...pickable);
            select(null);
            break;
          case "i":
            expanded = !expanded;
            for (let i = 0; i < packedPositions.count; i++) {
              packedPositions.setXYZ(i, positions.getX(i) * (expanded ? 1.5 : 1), positions.getY(i), positions.getZ(i));
              packed.addUpdateRange(i * packed.stride, 3);
            }
            packedPositions.needsUpdate = true;
            litGeometry.computeBoundingBox();
            litGeometry.computeBoundingSphere();
            break;
          case "l":
            scene.remove(light);
            light = light === directional ? point : light === point ? spot : directional;
            scene.add(light);
            updateMaterialLighting();
            break;
          case "a":
            ambientEnabled = !ambientEnabled;
            updateMaterialLighting();
            break;
          case "k":
            spot.map = spot.map === null ? cookie : null;
            break;
          case "s":
            floor.receiveShadow = !floor.receiveShadow;
            for (const mesh of comparisonSet) mesh.receiveShadow = floor.receiveShadow;
            for (const mesh of animationSet) mesh.receiveShadow = floor.receiveShadow;
            break;
          case "b":
            scene.backgroundBlurriness = scene.backgroundBlurriness === 0 ? 0.35 : 0;
            break;
          case "e":
            environmentEnabled = !environmentEnabled;
            scene.background = environmentEnabled ? environment : null;
            reflectedMaterial.envMap = environmentEnabled ? environment : null;
            reflectedMaterial.needsUpdate = true;
            if (environmentEnabled) environment.needsUpdate = true;
            else if (scene.environment === null) environment.dispose();
            break;
          case "u":
            for (let i = 0; i < checker.image.data!.length; i += 4) {
              const red = checker.image.data![i];
              checker.image.data![i] = checker.image.data![i + 2];
              checker.image.data![i + 2] = red;
            }
            checker.needsUpdate = true;
            break;
          case "t":
            tone = (tone + 1) % tones.length;
            renderer.toneMapping = tones[tone];
            break;
          case "+":
          case "=":
            renderer.toneMappingExposure = Math.min(3, renderer.toneMappingExposure + 0.2);
            break;
          case "-":
            renderer.toneMappingExposure = Math.max(0.2, renderer.toneMappingExposure - 0.2);
            break;
          default:
            return;
        }
        event.preventDefault();
        draw();
        drawHud();
      } catch (error) {
        fail(error);
      }
    },
    { signal: events.signal },
  );
  let pointerX = 0;
  let pointerY = 0;
  let startX = 0;
  let startY = 0;
  let dragged = false;
  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) return;
      if (help.hitTitle(event.clientX, event.clientY)) {
        help.toggle();
        drawHud();
        return;
      }
      canvas.setPointerCapture(event.pointerId);
      startX = pointerX = event.clientX;
      startY = pointerY = event.clientY;
      dragged = false;
    },
    { signal: events.signal },
  );
  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (!canvas.hasPointerCapture(event.pointerId)) return;
      dragged ||= Math.hypot(event.clientX - startX, event.clientY - startY) > 4;
      if (!dragged) return;
      try {
        angle -= (event.clientX - pointerX) * 0.008;
        elevation = Math.max(0.15, Math.min(1.35, elevation + (event.clientY - pointerY) * 0.008));
        pointerX = event.clientX;
        pointerY = event.clientY;
        draw();
        drawHud();
      } catch (error) {
        fail(error);
      }
    },
    { signal: events.signal },
  );
  canvas.addEventListener(
    "pointerup",
    (event) => {
      if (!canvas.hasPointerCapture(event.pointerId)) return;
      canvas.releasePointerCapture(event.pointerId);
      try {
        if (!dragged) pick(event.clientX, event.clientY);
      } catch (error) {
        fail(error);
      }
    },
    { signal: events.signal },
  );
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      try {
        distance = Math.max(6, Math.min(18, distance + event.deltaY * 0.01));
        updateProjection();
        draw();
        drawHud();
      } catch (error) {
        fail(error);
      }
    },
    { passive: false, signal: events.signal },
  );
  window.addEventListener(
    "resize",
    () => {
      try {
        resize();
      } catch (error) {
        fail(error);
      }
    },
    { signal: events.signal },
  );
  canvas.addEventListener("webglcontextlost", () => fail(new Error("WebGL context lost")), { signal: events.signal });
  window.addEventListener("pagehide", dispose, { once: true, signal: events.signal });
  resize();
  timer.reset();
  animation = requestAnimationFrame(frame);
} catch (error) {
  fail(error);
}
