import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Float32BufferAttribute, Uint16BufferAttribute, type BufferAttribute } from "ek3d/core/BufferAttribute";
import type { BufferGeometry } from "ek3d/core/BufferGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { Bone } from "ek3d/objects/Bone";
import { Skeleton } from "ek3d/objects/Skeleton";
import { SkinnedMesh } from "ek3d/objects/SkinnedMesh";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshNormalMaterial } from "ek3d/materials/MeshNormalMaterial";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { PointLight } from "ek3d/lights/PointLight";
import { Vector3 } from "ek3d/math/Vector3";
import { Matrix4 } from "ek3d/math/Matrix4";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { distanceShader } from "ek3d/renderers/shaders/DistanceShader";
import { LinearSRGBColorSpace } from "ek3d/constants";
import { configureShadowScene } from "./browser-fixtures";

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export async function verifyDeformationRendering() {
  const renderer = new WebGLRenderer({
    antialias: false,
    preserveDrawingBuffer: true,
    createShadowMap: WebGLShadowMap,
    shaders: {
      MeshBasicMaterial: basicShader,
      MeshNormalMaterial: normalShader,
      MeshLambertMaterial: lambertShader,
      MeshDepthMaterial: depthShader,
      MeshDistanceMaterial: distanceShader,
    },
  });
  const gl = renderer.getContext();
  const scene = new Scene();
  const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 20);
  camera.position.z = 5;
  const basic = new MeshBasicMaterial({ color: 0xffffff });
  const colored = new MeshBasicMaterial({ vertexColors: true });
  const normal = new MeshNormalMaterial();
  const lambert = new MeshLambertMaterial({ color: 0xb8c4d0 });
  const geometries: BufferGeometry[] = [];
  const skeletons: Skeleton[] = [];
  const keep = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };
  const constantAttribute = (geometry: BufferGeometry, values: number[]) => {
    const array = new Float32Array(geometry.attributes.position.count * values.length);
    for (let i = 0; i < array.length; i += values.length) array.set(values, i);
    return new Float32BufferAttribute(array, values.length);
  };
  const morphPosition = (geometry: BufferGeometry, x: number, y = 0) => {
    const target = (geometry.attributes.position as BufferAttribute).clone();
    for (let i = 0; i < target.count; i++) target.setXYZ(i, target.getX(i) + x, target.getY(i) + y, target.getZ(i));
    geometry.morphAttributes.position = [target];
  };
  const skin = (geometry: BufferGeometry, material: MeshBasicMaterial | MeshLambertMaterial) => {
    const count = geometry.attributes.position.count;
    const indices = new Uint16Array(count * 4);
    const weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      indices[i * 4] = 1;
      weights[i * 4] = 1;
    }
    geometry.setAttribute("skinIndex", new Uint16BufferAttribute(indices, 4));
    geometry.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
    const root = new Bone();
    const child = new Bone();
    root.add(child);
    const mesh = new SkinnedMesh(geometry, material);
    mesh.add(root);
    const skeleton = new Skeleton([root, child]);
    skeletons.push(skeleton);
    mesh.bind(skeleton);
    return { mesh, root, child, skeleton };
  };
  const morphGeometry = keep(new PlaneGeometry(0.75, 0.75));
  morphGeometry.translate(-1, 0, 0);
  morphPosition(morphGeometry, 2);
  morphGeometry.setAttribute("color", constantAttribute(morphGeometry, [1, 0, 0]));
  morphGeometry.morphAttributes.color = [constantAttribute(morphGeometry, [0, 1, 0])];
  morphGeometry.morphAttributes.normal = [constantAttribute(morphGeometry, [1, 0, 0])];
  const morphMesh = new Mesh(morphGeometry, colored);
  const normalGeometry = keep(new PlaneGeometry(0.75, 0.75));
  normalGeometry.morphAttributes.normal = [constantAttribute(normalGeometry, [1, 0, 0])];
  const normalMesh = new Mesh(normalGeometry, normal);
  const colorGeometry = keep(new PlaneGeometry(0.75, 0.75));
  colorGeometry.setAttribute("color", constantAttribute(colorGeometry, [1, 0, 0]));
  colorGeometry.morphAttributes.color = [constantAttribute(colorGeometry, [0, 0, 1])];
  const colorMesh = new Mesh(colorGeometry, colored);
  const skinGeometry = keep(new PlaneGeometry(0.75, 0.75));
  morphPosition(skinGeometry, 0, 1);
  const skinned = skin(skinGeometry, basic);
  skinned.mesh.position.x = -1;
  const instanceGeometry = keep(new PlaneGeometry(0.75, 0.75));
  morphPosition(instanceGeometry, 0, 1);
  const instances = new InstancedMesh(instanceGeometry, basic, 2);
  instances.setMatrixAt(0, new Matrix4().makeTranslation(-1, -0.5, 0));
  instances.setMatrixAt(1, new Matrix4().makeTranslation(1, -0.5, 0));
  const instancePose = Object.assign(new Mesh(instanceGeometry, basic), { morphTargetInfluences: [0] });
  const shadowScene = new Scene();
  const shadowCamera = new PerspectiveCamera(50, 4 / 3, 0.1, 100);
  const receiver = new Mesh(keep(new BoxGeometry()), lambert);
  const casterGeometry = keep(new BoxGeometry(1.2, 1.2, 1.2));
  morphPosition(casterGeometry, 2);
  const caster = skin(casterGeometry, lambert);
  const directional = new DirectionalLight(0xffffff, 3);
  const point = new PointLight(0xffffff, 150);
  const readPixels = (width = 64, height = 64) => {
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    check(gl.getError() === gl.NO_ERROR, "Deformation produced a GL error");
    return pixels;
  };
  const draw = (mesh?: Mesh) => {
    scene.clear();
    if (mesh !== undefined) scene.add(mesh);
    renderer.render(scene, camera);
    return readPixels();
  };
  const color = (pixels: Uint8Array, x: number, y: number, expected: number[], label: string) => {
    const actual = pixels.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 3);
    check(
      actual.every((value, i) => Math.abs(value - expected[i]) <= 1),
      `${label}: ${actual.join(",")} != ${expected.join(",")}`,
    );
  };
  const same = (actual: Uint8Array, expected: Uint8Array, label: string) =>
    check(
      actual.every((value, i) => value === expected[i]),
      label,
    );
  const texture = (name: string, binding: number) => {
    const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
    const location = gl.getUniformLocation(program, name);
    if (location === null) throw new Error(`Missing active ${name} sampler`);
    const unit = gl.getUniform(program, location) as number;
    const active = gl.getParameter(gl.ACTIVE_TEXTURE) as number;
    gl.activeTexture(gl.TEXTURE0 + unit);
    const handle = gl.getParameter(binding) as WebGLTexture;
    gl.activeTexture(active);
    check(gl.isTexture(handle), `Missing GPU ${name} texture`);
    return handle;
  };
  const allocation = () => {
    draw(skinned.mesh);
    return {
      bone: texture("boneTexture", gl.TEXTURE_BINDING_2D),
      morph: texture("morphTargetsTexture", gl.TEXTURE_BINDING_2D_ARRAY),
    };
  };
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(64, 64, false);
    renderer.outputColorSpace = LinearSRGBColorSpace;
    renderer.setClearColor(0x000000, 1);
    const initialMorph = draw(morphMesh);
    color(initialMorph, 16, 32, [255, 0, 0], "Base morph color/position");
    morphMesh.morphTargetInfluences![0] = 1;
    let pixels = draw(morphMesh);
    color(pixels, 16, 32, [0, 0, 0], "Morph retained base position");
    color(pixels, 48, 32, [0, 255, 0], "Absolute morph position/color");
    morphMesh.morphTargetInfluences![0] = 0.5;
    color(draw(morphMesh), 32, 32, [128, 128, 0], "Fractional absolute morph");
    morphMesh.morphTargetInfluences![0] = 0;
    same(draw(morphMesh), initialMorph, "Morph reset did not recover base pixels");
    morphMesh.material = normal;
    morphMesh.morphTargetInfluences![0] = 1;
    color(draw(morphMesh), 48, 32, [255, 128, 128], "Combined morph normal");
    morphMesh.material = colored;

    color(draw(normalMesh), 32, 32, [128, 128, 255], "Base normal");
    normalMesh.morphTargetInfluences![0] = 1;
    color(draw(normalMesh), 32, 32, [255, 128, 128], "Normal-only morph");
    color(draw(colorMesh), 32, 32, [255, 0, 0], "Base standalone color");
    colorMesh.morphTargetInfluences![0] = 1;
    color(draw(colorMesh), 32, 32, [0, 0, 255], "Color-only morph");

    const relativeGeometry = keep(new PlaneGeometry(0.75, 0.75));
    relativeGeometry.translate(-1, 0, 0);
    relativeGeometry.morphTargetsRelative = true;
    relativeGeometry.morphAttributes.position = [constantAttribute(relativeGeometry, [2, 0, 0])];
    const relativeMesh = new Mesh(relativeGeometry, basic);
    relativeMesh.morphTargetInfluences![0] = 0.5;
    color(draw(relativeMesh), 32, 32, [255, 255, 255], "Relative morph half influence");
    relativeMesh.morphTargetInfluences![0] = 1;
    pixels = draw(relativeMesh);
    color(pixels, 48, 32, [255, 255, 255], "Relative morph full influence");
    color(pixels, 16, 32, [0, 0, 0], "Relative morph retained base");

    instancePose.morphTargetInfluences![0] = 0;
    instances.setMorphAt(0, instancePose);
    instancePose.morphTargetInfluences![0] = 1;
    instances.setMorphAt(1, instancePose);
    instances.morphTexture!.needsUpdate = true;
    const initialInstances = draw(instances);
    color(initialInstances, 16, 24, [255, 255, 255], "First instance base morph");
    color(initialInstances, 16, 40, [0, 0, 0], "First instance inherited second morph");
    color(initialInstances, 48, 40, [255, 255, 255], "Second instance full morph");
    color(initialInstances, 48, 24, [0, 0, 0], "Second instance retained base morph");
    const firstInstanceTexture = texture("morphTexture", gl.TEXTURE_BINDING_2D);
    const sharedInstanceMorph = texture("morphTargetsTexture", gl.TEXTURE_BINDING_2D_ARRAY);
    instances.setMorphAt(0, instancePose);
    instancePose.morphTargetInfluences![0] = 0.5;
    instances.setMorphAt(1, instancePose);
    same(draw(instances), initialInstances, "Instance morph CPU writes uploaded without needsUpdate");
    instances.morphTexture!.needsUpdate = true;
    const instanceSnapshot = draw(instances);
    color(instanceSnapshot, 16, 40, [255, 255, 255], "First instance updated morph");
    color(instanceSnapshot, 16, 24, [0, 0, 0], "First instance retained old morph");
    color(instanceSnapshot, 48, 32, [255, 255, 255], "Second instance fractional morph");
    color(instanceSnapshot, 48, 40, [0, 0, 0], "Second instance retained full morph");
    instances.dispose();
    check(!gl.isTexture(firstInstanceTexture), "Instance disposal retained morph influence texture");
    check(gl.isTexture(sharedInstanceMorph), "Instance disposal deleted geometry morph array texture");
    check(instances.morphTexture === null, "Instance disposal retained CPU morph influence texture");
    instancePose.morphTargetInfluences![0] = 1;
    instances.setMorphAt(0, instancePose);
    instancePose.morphTargetInfluences![0] = 0.5;
    instances.setMorphAt(1, instancePose);
    instances.morphTexture!.needsUpdate = true;
    same(draw(instances), instanceSnapshot, "Instance morph disposal/reallocation pixels");
    const reallocatedInstanceTexture = texture("morphTexture", gl.TEXTURE_BINDING_2D);
    check(reallocatedInstanceTexture !== firstInstanceTexture, "Instance morph reused deleted influence texture");
    check(
      texture("morphTargetsTexture", gl.TEXTURE_BINDING_2D_ARRAY) === sharedInstanceMorph,
      "Instance morph reallocation replaced shared target data",
    );

    const initialSkin = draw(skinned.mesh);
    color(initialSkin, 16, 32, [255, 255, 255], "Bind pose");
    skinned.root.position.x = 0.5;
    skinned.child.position.x = 1.5;
    pixels = draw(skinned.mesh);
    color(pixels, 16, 32, [0, 0, 0], "Bone update retained bind position");
    color(pixels, 48, 32, [255, 255, 255], "Parent/child bone texture update");
    const vertex = new Vector3();
    skinned.mesh.getVertexPosition(0, vertex);
    check(
      Math.abs(vertex.x - ((skinGeometry.attributes.position as BufferAttribute).getX(0) + 2)) < 1e-6,
      "CPU/GPU skin pose differs",
    );
    skinned.mesh.morphTargetInfluences![0] = 1;
    pixels = draw(skinned.mesh);
    color(pixels, 48, 48, [255, 255, 255], "Morph-before-skinning composition");
    color(pixels, 48, 32, [0, 0, 0], "Combined deformation retained old position");
    skinned.mesh.morphTargetInfluences![0] = 0;
    skinned.skeleton.pose();
    same(draw(skinned.mesh), initialSkin, "Skeleton pose did not recover bind pixels");
    skinned.child.position.x = 20;
    skinned.mesh.updateMatrixWorld(true);
    skinned.mesh.computeBoundingBox();
    skinned.mesh.computeBoundingSphere();
    check(
      skinned.mesh.boundingBox!.min.x > 19 && skinned.mesh.boundingSphere!.center.x > 19,
      "Skin bounds ignored bones",
    );
    draw(skinned.mesh);
    check(renderer.info.render.calls === 0, "Updated skin bounds did not cull offscreen pose");
    skinned.child.position.x = 2;
    draw(skinned.mesh);
    check(renderer.info.render.calls === 0, "Bone writes unexpectedly recomputed cached bounds");
    skinned.mesh.updateMatrixWorld(true);
    skinned.mesh.computeBoundingBox();
    skinned.mesh.computeBoundingSphere();
    color(draw(skinned.mesh), 48, 32, [255, 255, 255], "Updated visible skin bounds did not recover draw");

    configureShadowScene(renderer, shadowScene, shadowCamera, receiver, caster.mesh, directional, point);
    renderer.setSize(96, 72, false);
    // Bounds must include each new CPU pose before the shadow camera culls it.
    const poseCaster = (mode: string, moved: boolean) => {
      caster.child.position.x = mode === "skin" && moved ? 2 : 0;
      caster.mesh.morphTargetInfluences![0] = mode === "morph" && moved ? 1 : 0;
      caster.mesh.updateMatrixWorld(true);
      caster.mesh.computeBoundingBox();
      caster.mesh.computeBoundingSphere();
    };
    const shadowDraw = () => {
      renderer.render(shadowScene, shadowCamera);
      return readPixels(96, 72);
    };
    const shadowMask = () => {
      receiver.receiveShadow = true;
      const shadowed = shadowDraw();
      receiver.receiveShadow = false;
      const lit = shadowDraw();
      receiver.receiveShadow = true;
      const mask = new Uint8Array(96 * 72);
      for (let i = 0; i < mask.length; i++)
        if (lit[i * 4] - shadowed[i * 4] > 12 && lit[i * 4 + 1] - shadowed[i * 4 + 1] > 12) mask[i] = 1;
      check(mask.reduce((sum, value) => sum + value, 0) > 16, "Deformed caster produced no meaningful receiver shadow");
      caster.mesh.castShadow = false;
      same(shadowDraw(), lit, "Disabling deformed caster retained receiver shadow");
      caster.mesh.castShadow = true;
      return mask;
    };
    const shadowPasses = new Set<string>();
    const shadows: { light: string; mode: string; changedPixels: number }[] = [];
    for (const light of [directional, point]) {
      shadowScene.remove(directional, point);
      shadowScene.add(light);
      caster.mesh.onAfterShadow = () => {
        texture("boneTexture", gl.TEXTURE_BINDING_2D);
        texture("morphTargetsTexture", gl.TEXTURE_BINDING_2D_ARRAY);
        shadowPasses.add(light.type);
      };
      for (const mode of ["skin", "morph"]) {
        poseCaster(mode, false);
        const before = shadowMask();
        poseCaster(mode, true);
        const after = shadowMask();
        const changedPixels = after.reduce((sum, value, i) => sum + Number(value !== before[i]), 0);
        check(changedPixels > 8, `${light.type}: ${mode} did not move depth/distance receiver shadow`);
        poseCaster(mode, false);
        same(shadowMask(), before, `${light.type}: ${mode} shadow reset differed`);
        shadows.push({ light: light.type, mode, changedPixels });
      }
    }
    check(shadowPasses.size === 2, "Missing directional depth or point distance deformation pass");
    caster.mesh.onAfterShadow = () => {};
    directional.dispose();
    point.dispose();
    renderer.setSize(64, 64, false);
    renderer.setClearColor(0x000000, 1);

    skinned.mesh.morphTargetInfluences![0] = 1;
    skinned.mesh.updateMatrixWorld(true);
    skinned.mesh.computeBoundingSphere();
    const snapshot = draw(skinned.mesh);
    const first = allocation();
    const boneTexture = skinned.skeleton.boneTexture;
    check(boneTexture !== null, "Renderer did not allocate skeleton bone texture");
    skinned.skeleton.dispose();
    check(!gl.isTexture(first.bone) && gl.isTexture(first.morph), "Skeleton disposal did not isolate bone texture");
    check(skinned.skeleton.boneTexture === null, "Skeleton disposal retained CPU texture");
    same(draw(skinned.mesh), snapshot, "Skeleton disposal/reallocation pixels");
    const second = allocation();
    check(
      second.bone !== first.bone && second.morph === first.morph,
      "Bone texture reallocation damaged morph texture",
    );
    check(skinned.skeleton.boneTexture !== boneTexture, "Skeleton reused disposed CPU texture");
    skinGeometry.dispose();
    check(!gl.isTexture(second.morph) && gl.isTexture(second.bone), "Geometry disposal did not isolate morph texture");
    same(draw(skinned.mesh), snapshot, "Morph texture disposal/reallocation pixels");
    const third = allocation();
    check(third.morph !== second.morph && third.bone === second.bone, "Morph reallocation damaged bone texture");

    const oldMorph = third.morph;
    skinGeometry.morphAttributes.position!.push(skinGeometry.morphAttributes.position![0].clone());
    skinned.mesh.updateMorphTargets();
    skinned.mesh.morphTargetInfluences![1] = 1;
    same(draw(skinned.mesh), snapshot, "Morph layer count reallocation pixels");
    const resized = allocation();
    check(!gl.isTexture(oldMorph) && resized.morph !== oldMorph, "Morph layer resize retained old array texture");
    const extension = gl.getExtension("WEBGL_lose_context");
    if (extension === null) throw new Error("Deformation restoration requires WEBGL_lose_context");
    // ES2022 does not provide Promise.withResolvers.
    const contextEvent = (name: string, action: () => void) =>
      new Promise<void>((resolve, reject) => {
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          renderer.domElement.removeEventListener(name, done);
          reject(new Error(`Timed out waiting for ${name}`));
        }, 10000);
        renderer.domElement.addEventListener(name, done, { once: true });
        action();
      });
    await contextEvent("webglcontextlost", () => extension.loseContext());
    check(gl.isContextLost(), "Deformation fixture did not lose actual context");
    await contextEvent("webglcontextrestored", () => setTimeout(() => extension.restoreContext(), 0));
    same(draw(skinned.mesh), snapshot, "Context restoration changed combined skin/morph pixels");
    const restored = allocation();
    check(
      restored.bone !== resized.bone && restored.morph !== resized.morph,
      "Restoration reused stale deformation handles",
    );
    skinned.skeleton.dispose();
    skinGeometry.dispose();
    check(
      !gl.isTexture(restored.bone) && !gl.isTexture(restored.morph),
      "Restored deformation textures survived disposal",
    );
    same(draw(skinned.mesh), snapshot, "Restored disposal/reallocation changed pixels");
    same(draw(instances), instanceSnapshot, "Context restoration changed per-instance morph pixels");
    const restoredInstanceTexture = texture("morphTexture", gl.TEXTURE_BINDING_2D);
    const restoredInstanceMorph = texture("morphTargetsTexture", gl.TEXTURE_BINDING_2D_ARRAY);
    check(
      restoredInstanceTexture !== reallocatedInstanceTexture && restoredInstanceMorph !== sharedInstanceMorph,
      "Instance morph restoration reused stale textures",
    );
    instances.dispose();
    check(
      !gl.isTexture(restoredInstanceTexture) && gl.isTexture(restoredInstanceMorph),
      "Restored instance disposal did not isolate influence texture",
    );
    instanceGeometry.dispose();
    check(!gl.isTexture(restoredInstanceMorph), "Restored instance geometry retained morph array texture");
    return {
      absoluteRelativeAndFractionalMorphs: true,
      positionNormalColorMorphs: true,
      standaloneNormalColorMorphs: true,
      perInstanceMorphUpdatesAndLifecycle: true,
      hierarchicalBonesAndPose: true,
      morphSkinComposition: true,
      recomputedBoundsCulling: true,
      shadows,
      boneAndMorphTextureDisposal: true,
      morphTextureLayerReallocation: true,
      contextRestored: true,
      glError: gl.getError(),
    };
  } finally {
    directional.dispose();
    point.dispose();
    instances.dispose();
    for (const skeleton of skeletons) skeleton.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const material of [basic, colored, normal, lambert]) material.dispose();
    renderer.dispose();
  }
}
