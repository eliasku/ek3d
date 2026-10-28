import { GL } from "ek3d/GL";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { Scene } from "ek3d/scenes/Scene";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import type { Material } from "ek3d/materials/Material";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { MeshNormalMaterial } from "ek3d/materials/MeshNormalMaterial";
import { MeshMatcapMaterial } from "ek3d/materials/MeshMatcapMaterial";
import { MeshToonMaterial } from "ek3d/materials/MeshToonMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { MeshPhysicalMaterial } from "ek3d/materials/MeshPhysicalMaterial";
import { ShadowMaterial } from "ek3d/materials/ShadowMaterial";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { LightProbe } from "ek3d/lights/LightProbe";
import { RectAreaLight } from "ek3d/lights/RectAreaLight";
import { SphericalHarmonics3 } from "ek3d/math/SphericalHarmonics3";
import { DataTexture } from "ek3d/textures/DataTexture";
import type { Texture } from "ek3d/textures/Texture";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { matcapShader } from "ek3d/renderers/shaders/MatcapShader";
import { toonShader } from "ek3d/renderers/shaders/ToonShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { shadowShader } from "ek3d/renderers/shaders/ShadowShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { Mapping, ColorSpace, TextureFilter, ShadowMap } from "ek3d/constants";
import { createEnvironmentPixels, environmentWidth, environmentHeight } from "./browser-fixtures";

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Run through the same real-browser entry point as browser-lights.ts.
export async function verifyMaterialRendering() {
  const size = 96;
  const shaders = {
    MeshBasicMaterial: basicShader,
    MeshPhongMaterial: phongShader,
    MeshNormalMaterial: normalShader,
    MeshMatcapMaterial: matcapShader,
    MeshToonMaterial: toonShader,
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
    ShadowMaterial: shadowShader,
    MeshDepthMaterial: depthShader,
  };
  const textures: Texture[] = [];
  const materials: Material[] = [];
  const own = <T extends Material>(material: T): T => {
    materials.push(material);
    return material;
  };
  const texture = (rgba: number[], width = 1, height = 1) => {
    const result = new DataTexture(new Uint8Array(rgba), width, height);
    result.needsUpdate = true;
    textures.push(result);
    return result;
  };
  const red = texture([220, 32, 16, 255]);
  const blue = texture([16, 48, 220, 255]);
  const black = texture([0, 0, 0, 0]);
  const white = texture([255, 255, 255, 255]);
  const middle = texture([64, 64, 64, 64]);
  const tiltedNormal = texture([230, 128, 204, 255]);
  const rampBytes: number[] = [];
  const backdropBytes: number[] = [];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const value = Math.round((x * 255) / 31);
      rampBytes.push(value, value, value, 255);
      const stripe = Math.floor(x / 4) % 3;
      const dark = y % 8 < 4 ? 1 : 0.2;
      backdropBytes.push(
        stripe === 0 ? 255 * dark : 8,
        stripe === 1 ? 255 * dark : 8,
        stripe === 2 ? 255 * dark : 8,
        255,
      );
    }
  const ramp = texture(rampBytes, 32, 32);
  ramp.magFilter = ramp.minFilter = TextureFilter.Linear;
  const backdropMap = texture(backdropBytes, 32, 32);
  const environment = new DataTexture(createEnvironmentPixels(), environmentWidth, environmentHeight);
  environment.mapping = Mapping.EquirectangularReflection;
  environment.needsUpdate = true;
  textures.push(environment);
  const dfg = createDFGLUT();
  const ltc = createLTCTextures();
  textures.push(dfg, ...Object.values(ltc));
  let selectedDFG: Texture = dfg;
  let dfgCalls = 0;
  const renderer = new WebGLRenderer({
    antialias: false,
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    shaders,
    getDFGLUT: () => {
      dfgCalls++;
      return selectedDFG;
    },
    ltcTextures: ltc,
    createEnvironments: WebGLEnvironments,
    createShadowMap: WebGLShadowMap,
  });
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = ColorSpace.LinearSRGB;
  renderer.setClearColor(0x000000, 0);
  const gl = renderer.getContext();
  const scene = new Scene();
  const camera = new OrthographicCamera(-1.1, 1.1, 1.1, -1.1, 0.1, 20);
  camera.position.z = 4;
  const plane = new PlaneGeometry(2, 2, 24, 24);
  const sphere = new SphereGeometry(0.8, 48, 32);
  const box = new BoxGeometry(0.5, 0.5, 0.5);
  const normal = own(new MeshNormalMaterial());
  const matcap = own(new MeshMatcapMaterial({ matcap: red, name: "MaterialFixtureMatcap" }));
  const toon = own(new MeshToonMaterial({ color: 0xffffff }));
  const phong = own(new MeshPhongMaterial({ color: 0x000000, specular: 0xffffff, shininess: 24 }));
  const standard = own(new MeshStandardMaterial({ roughness: 0.35, metalness: 0 }));
  const physical = own(new MeshPhysicalMaterial({ roughness: 0.35, metalness: 0 }));
  const shadow = own(new ShadowMaterial({ opacity: 0.6 }));
  const basic = own(new MeshBasicMaterial({ map: backdropMap }));
  const mesh = new Mesh(plane, normal);
  const backdrop = new Mesh(plane, basic);
  backdrop.position.z = -1.4;
  backdrop.scale.setScalar(2);
  const caster = new Mesh(box, own(new MeshBasicMaterial()));
  caster.layers.set(1);
  caster.position.z = 1;
  caster.castShadow = true;
  const directional = new DirectionalLight(0xffffff, 1);
  directional.position.set(0, 0, 4);
  directional.shadow.camera.layers.set(1);
  directional.shadow.camera.left = directional.shadow.camera.bottom = -1.5;
  directional.shadow.camera.right = directional.shadow.camera.top = 1.5;
  directional.shadow.camera.near = 0.1;
  directional.shadow.camera.far = 10;
  directional.shadow.mapSize.set(128, 128);
  const sh = new SphericalHarmonics3();
  const probe = new LightProbe(sh, 1);
  const area = new RectAreaLight(0xffffff, 2, 1, 1);
  area.position.set(0, 0, 2);
  area.lookAt(0, 0, 0);
  scene.add(mesh);
  const evidence: Record<string, number[]> = {};
  const effects: Record<string, { pixels: number; maximum: number }> = {};
  const rejections: string[] = [];
  const draw = (owner = renderer) => {
    owner.render(scene, camera);
    const context = owner.getContext();
    const result = new Uint8Array(size * size * 4);
    context.readPixels(0, 0, size, size, GL.RGBA, GL.UNSIGNED_BYTE, result);
    check(context.getError() === GL.NO_ERROR, "Material fixture produced a WebGL error");
    for (const program of owner.info.programs ?? [])
      check(
        context.getProgramParameter(program.program, GL.LINK_STATUS),
        `Material shader did not link: ${program.name}`,
      );
    return result;
  };
  const sample = (frame: Uint8Array, x = size / 2, y = size / 2) =>
    Array.from(frame.slice((y * size + x) * 4, (y * size + x) * 4 + 4));
  const near = (name: string, frame: Uint8Array, expected: number[]) => {
    const actual = sample(frame);
    check(
      actual.every((v, i) => Math.abs(v - expected[i]) <= 2),
      `${name}: ${actual.join(",")} != ${expected.join(",")}`,
    );
    evidence[name] = actual;
  };
  const same = (a: Uint8Array, b: Uint8Array, name: string, tolerance = 1) =>
    check(
      a.every((v, i) => Math.abs(v - b[i]) <= tolerance),
      `${name}: rendering did not return to baseline`,
    );
  const different = (name: string, a: Uint8Array, b: Uint8Array, threshold = 3) => {
    let pixels = 0;
    let maximum = 0;
    for (let i = 0; i < a.length; i += 4) {
      let delta = 0;
      for (let c = 0; c < 4; c++) delta = Math.max(delta, Math.abs(a[i + c] - b[i + c]));
      if (delta > threshold) pixels++;
      maximum = Math.max(maximum, delta);
    }
    check(pixels >= 8, `${name}: only ${pixels} changed pixels (max delta ${maximum})`);
    effects[name] = { pixels, maximum };
  };
  const effect = (name: string, apply: () => void, undo: () => void) => {
    const material = mesh.material;
    check(!Array.isArray(material), "Material fixture requires a single material");
    material.needsUpdate = true;
    const before = draw();
    apply();
    material.needsUpdate = true;
    const after = draw();
    different(name, before, after);
    undo();
    material.needsUpdate = true;
    same(draw(), before, name);
  };
  const handle = (texture: Texture, owner = renderer): WebGLTexture => {
    const result: WebGLTexture | undefined = owner.properties.get(texture).__webglTexture;
    check(result !== undefined && owner.getContext().isTexture(result), "Expected a live material GPU texture");
    return result;
  };
  const reject = (action: () => void, expected: string) => {
    try {
      action();
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes(expected)) throw error;
      rejections.push(error.message);
      return;
    }
    throw new Error(`Missing material rejection: ${expected}`);
  };
  try {
    near("normalFront", draw(), [128, 128, 255, 255]);
    mesh.rotation.y = Math.PI / 3;
    near("normalRotated", draw(), [255 * (0.5 + Math.sqrt(3) / 4), 128, 191.25, 255]);
    mesh.rotation.y = 0;
    mesh.material = matcap;
    near("matcapRed", draw(), [220, 32, 16, 255]);
    matcap.matcap = blue;
    near("matcapBlue", draw(), [16, 48, 220, 255]);
    matcap.matcap = red;
    mesh.material = toon;
    scene.add(directional);
    const gradient = texture([64, 0, 0, 255, 64, 0, 0, 255, 64, 0, 0, 255, 192, 0, 0, 255], 4, 1);
    gradient.magFilter = gradient.minFilter = TextureFilter.Nearest;
    toon.gradientMap = gradient;
    near("toonBrightStep", draw(), [192 / Math.PI, 192 / Math.PI, 192 / Math.PI, 255]);
    mesh.rotation.y = Math.PI * 0.4;
    near("toonDarkStep", draw(), [64 / Math.PI, 64 / Math.PI, 64 / Math.PI, 255]);
    mesh.rotation.y = 0;
    mesh.geometry = sphere;
    mesh.material = phong;
    const specular = draw();
    phong.specular.setRGB(0, 0, 0);
    const noSpecular = draw();
    different("phongSpecular", specular, noSpecular);
    check(
      sample(noSpecular)
        .slice(0, 3)
        .every((value) => value === 0),
      "Phong black diffuse leaked light",
    );
    phong.specular.setRGB(1, 1, 1);
    effect(
      "phongShininess",
      () => {
        phong.shininess = 3;
      },
      () => {
        phong.shininess = 24;
      },
    );

    scene.remove(directional);
    mesh.geometry = plane;
    phong.color.setRGB(1, 1, 1);
    phong.specular.setRGB(0, 0, 0);
    sh.coefficients[0].set(0.8, 0.4, 0.2);
    scene.add(probe);
    near("probeConstant", draw(), [
      (255 * 0.8 * 0.886227) / Math.PI,
      (255 * 0.4 * 0.886227) / Math.PI,
      (255 * 0.2 * 0.886227) / Math.PI,
      255,
    ]);
    effect(
      "probeIntensity",
      () => {
        probe.intensity = 2;
      },
      () => {
        probe.intensity = 1;
      },
    );
    sh.coefficients[2].set(0.3, 0, 0);
    const probeFront = draw();
    mesh.rotation.y = Math.PI / 3;
    different("probeDirectionalSH", probeFront, draw());
    near("probeDirectionalRotated", draw(), [
      (255 * (0.8 * 0.886227 + 0.3 * 1.023328 * 0.5)) / Math.PI,
      (255 * 0.4 * 0.886227) / Math.PI,
      (255 * 0.2 * 0.886227) / Math.PI,
      255,
    ]);
    mesh.rotation.y = 0;
    scene.remove(probe);

    mesh.material = shadow;
    mesh.receiveShadow = true;
    scene.add(directional, caster);
    directional.castShadow = true;
    renderer.shadowMap!.enabled = true;
    renderer.shadowMap!.type = ShadowMap.Basic;
    const shadowed = draw();
    const shadowPixel = sample(shadowed);
    check(shadowPixel[3] >= 150 && shadowPixel[3] <= 155, `Shadow alpha did not use opacity: ${shadowPixel.join(",")}`);
    check(sample(shadowed, 80, 80)[3] === 0, "Unshadowed ShadowMaterial pixel is not transparent");
    evidence.shadowAlpha = shadowPixel;
    effect(
      "shadowOpacity",
      () => {
        shadow.opacity = 0.2;
      },
      () => {
        shadow.opacity = 0.6;
      },
    );
    directional.castShadow = false;
    renderer.shadowMap!.enabled = false;
    mesh.receiveShadow = false;
    scene.remove(caster, directional);

    mesh.geometry = sphere;
    mesh.material = standard;
    standard.color.setRGB(0.35, 0.35, 0.35);
    scene.add(area);
    const areaFrame = draw();
    check(sample(areaFrame)[0] > 5, "RectAreaLight produced no diffuse illumination");
    effect(
      "rectIntensity",
      () => {
        area.intensity = 5;
      },
      () => {
        area.intensity = 2;
      },
    );
    effect(
      "rectWidth",
      () => {
        area.width = 3;
      },
      () => {
        area.width = 1;
      },
    );
    effect(
      "rectHeight",
      () => {
        area.height = 3;
      },
      () => {
        area.height = 1;
      },
    );
    effect(
      "rectDirection",
      () => {
        area.rotation.y = Math.PI;
      },
      () => {
        area.rotation.y = 0;
      },
    );
    const floatAvailable = renderer.extensions.has("OES_texture_float_linear");
    if (floatAvailable) {
      handle(ltc.LTC_FLOAT_1);
      handle(ltc.LTC_FLOAT_2);
    }
    const halfRenderer = new WebGLRenderer({
      shaders,
      getDFGLUT: () => dfg,
      ltcTextures: ltc,
      preserveDrawingBuffer: true,
      alpha: true,
      premultipliedAlpha: false,
    });
    const originalHas = halfRenderer.extensions.has;
    halfRenderer.extensions.has = (name: string) =>
      name === "OES_texture_float_linear" ? false : originalHas.call(halfRenderer.extensions, name);
    try {
      halfRenderer.setSize(size, size, false);
      halfRenderer.outputColorSpace = ColorSpace.LinearSRGB;
      halfRenderer.setClearColor(0x000000, 0);
      const halfFrame = draw(halfRenderer);
      handle(ltc.LTC_HALF_1, halfRenderer);
      handle(ltc.LTC_HALF_2, halfRenderer);
      same(halfFrame, areaFrame, "Half-float LTC fallback", 3);
      area.intensity = 5;
      different("rectHalfIntensity", halfFrame, draw(halfRenderer));
      area.intensity = 2;
      same(draw(halfRenderer), halfFrame, "Half-float LTC intensity restoration");
    } finally {
      area.intensity = 2;
      halfRenderer.dispose();
    }
    scene.remove(area);
    scene.add(directional);
    directional.position.set(2, 1, 4);
    directional.intensity = 2;
    scene.environment = environment;
    scene.environmentIntensity = 0.7;
    const pbr = draw();
    handle(dfg);
    check(dfgCalls > 0, "PBR never requested the caller-owned DFG LUT");
    effect(
      "standardRoughness",
      () => {
        standard.roughness = 0.9;
      },
      () => {
        standard.roughness = 0.35;
      },
    );
    effect(
      "standardMetalness",
      () => {
        standard.metalness = 1;
      },
      () => {
        standard.metalness = 0;
      },
    );
    scene.remove(directional);
    const ibl = draw();
    scene.environment = null;
    const noIBL = draw();
    different("standardIBL", ibl, noIBL);
    check(
      sample(noIBL)
        .slice(0, 3)
        .every((value) => value === 0),
      "Unlit Standard manufactured diffuse light",
    );
    scene.environment = environment;
    standard.metalness = 1;
    effect(
      "dfgLUTContribution",
      () => {
        selectedDFG = black;
      },
      () => {
        selectedDFG = dfg;
      },
    );
    standard.metalness = 0;
    scene.add(directional);
    same(draw(), pbr, "Standard light/environment switching");

    // Each map is compared alone and then removed, catching stale defines and sampler bindings.
    for (const material of [standard, physical]) {
      mesh.material = material;
      material.color.setRGB(0.35, 0.35, 0.35);
      const prefix = material.type;
      effect(
        `${prefix}.color`,
        () => {
          material.color.setRGB(0.8, 0.1, 0.05);
        },
        () => {
          material.color.setRGB(0.35, 0.35, 0.35);
        },
      );
      effect(
        `${prefix}.map`,
        () => {
          material.map = red;
        },
        () => {
          material.map = null;
        },
      );
      material.map = red;
      effect(
        `${prefix}.mapSwitch`,
        () => {
          material.map = blue;
        },
        () => {
          material.map = red;
        },
      );
      material.map = null;
      material.transparent = true;
      effect(
        `${prefix}.alphaMap`,
        () => {
          material.alphaMap = middle;
        },
        () => {
          material.alphaMap = null;
        },
      );
      material.transparent = false;
      effect(
        `${prefix}.aoMap`,
        () => {
          material.aoMap = black;
        },
        () => {
          material.aoMap = null;
        },
      );
      material.aoMap = black;
      effect(
        `${prefix}.aoMapIntensity`,
        () => {
          material.aoMapIntensity = 0;
        },
        () => {
          material.aoMapIntensity = 1;
        },
      );
      material.aoMap = null;
      effect(
        `${prefix}.lightMap`,
        () => {
          material.lightMap = red;
        },
        () => {
          material.lightMap = null;
        },
      );
      material.lightMap = red;
      effect(
        `${prefix}.lightMapIntensity`,
        () => {
          material.lightMapIntensity = 0;
        },
        () => {
          material.lightMapIntensity = 1;
        },
      );
      material.lightMap = null;
      material.emissive.setRGB(0.3, 0.3, 0.3);
      effect(
        `${prefix}.emissiveMap`,
        () => {
          material.emissiveMap = red;
        },
        () => {
          material.emissiveMap = null;
        },
      );
      effect(
        `${prefix}.emissiveIntensity`,
        () => {
          material.emissiveIntensity = 0;
        },
        () => {
          material.emissiveIntensity = 1;
        },
      );
      material.emissive.setRGB(0, 0, 0);
      effect(
        `${prefix}.roughnessMap`,
        () => {
          material.roughnessMap = middle;
        },
        () => {
          material.roughnessMap = null;
        },
      );
      material.metalness = 1;
      effect(
        `${prefix}.metalnessMap`,
        () => {
          material.metalnessMap = black;
        },
        () => {
          material.metalnessMap = null;
        },
      );
      material.metalness = 0;
      effect(
        `${prefix}.normalMap`,
        () => {
          material.normalMap = tiltedNormal;
        },
        () => {
          material.normalMap = null;
        },
      );
      material.normalMap = tiltedNormal;
      effect(
        `${prefix}.normalScale`,
        () => {
          material.normalScale.set(0, 0);
        },
        () => {
          material.normalScale.set(1, 1);
        },
      );
      material.normalMap = null;
      material.bumpScale = 0.6;
      effect(
        `${prefix}.bumpMap`,
        () => {
          material.bumpMap = ramp;
        },
        () => {
          material.bumpMap = null;
        },
      );
      material.bumpMap = ramp;
      effect(
        `${prefix}.bumpScale`,
        () => {
          material.bumpScale = 0;
        },
        () => {
          material.bumpScale = 0.6;
        },
      );
      material.bumpMap = null;
      material.displacementScale = 0.25;
      effect(
        `${prefix}.displacementMap`,
        () => {
          material.displacementMap = white;
        },
        () => {
          material.displacementMap = null;
        },
      );
      material.displacementMap = white;
      effect(
        `${prefix}.displacementBias`,
        () => {
          material.displacementBias = -0.25;
        },
        () => {
          material.displacementBias = 0;
        },
      );
      material.displacementMap = null;
      material.envMap = environment;
      effect(
        `${prefix}.envMapIntensity`,
        () => {
          material.envMapIntensity = 0;
        },
        () => {
          material.envMapIntensity = 1;
        },
      );
      material.envMap = null;
      material.needsUpdate = true;
    }

    mesh.material = physical;
    effect(
      "physical.roughness",
      () => {
        physical.roughness = 0.9;
      },
      () => {
        physical.roughness = 0.35;
      },
    );
    effect(
      "physical.metalness",
      () => {
        physical.metalness = 1;
      },
      () => {
        physical.metalness = 0;
      },
    );
    effect(
      "physical.clearcoat",
      () => {
        physical.clearcoat = 1;
      },
      () => {
        physical.clearcoat = 0;
      },
    );
    physical.clearcoat = 1;
    effect(
      "physical.clearcoatMap",
      () => {
        physical.clearcoatMap = black;
      },
      () => {
        physical.clearcoatMap = null;
      },
    );
    effect(
      "physical.clearcoatRoughness",
      () => {
        physical.clearcoatRoughness = 1;
      },
      () => {
        physical.clearcoatRoughness = 0;
      },
    );
    physical.clearcoatRoughness = 0.8;
    effect(
      "physical.clearcoatRoughnessMap",
      () => {
        physical.clearcoatRoughnessMap = middle;
      },
      () => {
        physical.clearcoatRoughnessMap = null;
      },
    );
    effect(
      "physical.clearcoatNormalMap",
      () => {
        physical.clearcoatNormalMap = tiltedNormal;
      },
      () => {
        physical.clearcoatNormalMap = null;
      },
    );
    physical.clearcoatNormalMap = tiltedNormal;
    effect(
      "physical.clearcoatNormalScale",
      () => {
        physical.clearcoatNormalScale.set(0, 0);
      },
      () => {
        physical.clearcoatNormalScale.set(1, 1);
      },
    );
    physical.clearcoatNormalMap = null;
    physical.clearcoat = 0;
    physical.sheenColor.setRGB(1, 0.2, 0.1);
    effect(
      "physical.sheen",
      () => {
        physical.sheen = 1;
      },
      () => {
        physical.sheen = 0;
      },
    );
    physical.sheen = 1;
    effect(
      "physical.sheenColor",
      () => {
        physical.sheenColor.setRGB(0.1, 0.2, 1);
      },
      () => {
        physical.sheenColor.setRGB(1, 0.2, 0.1);
      },
    );
    effect(
      "physical.sheenColorMap",
      () => {
        physical.sheenColorMap = blue;
      },
      () => {
        physical.sheenColorMap = null;
      },
    );
    effect(
      "physical.sheenRoughness",
      () => {
        physical.sheenRoughness = 0.1;
      },
      () => {
        physical.sheenRoughness = 1;
      },
    );
    effect(
      "physical.sheenRoughnessMap",
      () => {
        physical.sheenRoughnessMap = middle;
      },
      () => {
        physical.sheenRoughnessMap = null;
      },
    );
    physical.sheen = 0;
    physical.metalness = 1;
    effect(
      "physical.iridescence",
      () => {
        physical.iridescence = 1;
      },
      () => {
        physical.iridescence = 0;
      },
    );
    physical.iridescence = 1;
    effect(
      "physical.iridescenceMap",
      () => {
        physical.iridescenceMap = black;
      },
      () => {
        physical.iridescenceMap = null;
      },
    );
    effect(
      "physical.iridescenceIOR",
      () => {
        physical.iridescenceIOR = 1.8;
      },
      () => {
        physical.iridescenceIOR = 1.3;
      },
    );
    effect(
      "physical.iridescenceThicknessMaximum",
      () => {
        physical.iridescenceThicknessMaximum = 220;
      },
      () => {
        physical.iridescenceThicknessMaximum = 400;
      },
    );
    effect(
      "physical.iridescenceThicknessMap",
      () => {
        physical.iridescenceThicknessMap = middle;
      },
      () => {
        physical.iridescenceThicknessMap = null;
      },
    );
    physical.iridescenceThicknessMap = middle;
    effect(
      "physical.iridescenceThicknessMinimum",
      () => {
        physical.iridescenceThicknessMinimum = 300;
      },
      () => {
        physical.iridescenceThicknessMinimum = 100;
      },
    );
    physical.iridescenceThicknessMap = null;
    physical.iridescence = 0;
    physical.metalness = 0;
    effect(
      "physical.anisotropy",
      () => {
        physical.anisotropy = 0.95;
      },
      () => {
        physical.anisotropy = 0;
      },
    );
    physical.anisotropy = 0.95;
    effect(
      "physical.anisotropyRotation",
      () => {
        physical.anisotropyRotation = Math.PI / 2;
      },
      () => {
        physical.anisotropyRotation = 0;
      },
    );
    effect(
      "physical.anisotropyMap",
      () => {
        physical.anisotropyMap = black;
      },
      () => {
        physical.anisotropyMap = null;
      },
    );
    const anisotropyHorizontal = texture([255, 128, 255, 255]);
    const anisotropyVertical = texture([128, 255, 255, 255]);
    physical.anisotropyMap = anisotropyHorizontal;
    effect(
      "physical.anisotropyMapDirection",
      () => {
        physical.anisotropyMap = anisotropyVertical;
      },
      () => {
        physical.anisotropyMap = anisotropyHorizontal;
      },
    );
    physical.anisotropyMap = null;
    physical.anisotropy = 0;
    effect(
      "physical.diffuseRoughness",
      () => {
        physical.diffuseRoughness = 1;
      },
      () => {
        physical.diffuseRoughness = 0;
      },
    );
    physical.diffuseRoughness = 1;
    effect(
      "physical.diffuseRoughnessMap",
      () => {
        physical.diffuseRoughnessMap = black;
      },
      () => {
        physical.diffuseRoughnessMap = null;
      },
    );
    physical.diffuseRoughness = 0;
    effect(
      "physical.retroreflectivity",
      () => {
        physical.retroreflectivity = 1;
      },
      () => {
        physical.retroreflectivity = 0;
      },
    );
    effect(
      "physical.specularIntensity",
      () => {
        physical.specularIntensity = 0;
      },
      () => {
        physical.specularIntensity = 1;
      },
    );
    effect(
      "physical.specularIntensityMap",
      () => {
        physical.specularIntensityMap = black;
      },
      () => {
        physical.specularIntensityMap = null;
      },
    );
    effect(
      "physical.specularColor",
      () => {
        physical.specularColor.setRGB(1, 0, 0);
      },
      () => {
        physical.specularColor.setRGB(1, 1, 1);
      },
    );
    effect(
      "physical.specularColorMap",
      () => {
        physical.specularColorMap = red;
      },
      () => {
        physical.specularColorMap = null;
      },
    );
    effect(
      "physical.ior",
      () => {
        physical.ior = 2.3;
      },
      () => {
        physical.ior = 1.5;
      },
    );
    effect(
      "physical.reflectivity",
      () => {
        physical.reflectivity = 0;
      },
      () => {
        physical.ior = 1.5;
      },
    );

    scene.add(backdrop);
    physical.color.setRGB(1, 1, 1);
    physical.roughness = 0.05;
    effect(
      "physical.transmission",
      () => {
        physical.transmission = 1;
      },
      () => {
        physical.transmission = 0;
      },
    );
    physical.transmission = 1;
    effect(
      "physical.transmissionMap",
      () => {
        physical.transmissionMap = black;
      },
      () => {
        physical.transmissionMap = null;
      },
    );
    effect(
      "physical.thickness",
      () => {
        physical.thickness = 0.8;
      },
      () => {
        physical.thickness = 0;
      },
    );
    physical.thickness = 0.8;
    effect(
      "physical.thicknessMap",
      () => {
        physical.thicknessMap = black;
      },
      () => {
        physical.thicknessMap = null;
      },
    );
    effect(
      "physical.transmissionIOR",
      () => {
        physical.ior = 2.2;
      },
      () => {
        physical.ior = 1.5;
      },
    );
    physical.ior = 2;
    physical.thickness = 2;
    effect(
      "physical.dispersion",
      () => {
        physical.dispersion = 8;
      },
      () => {
        physical.dispersion = 0;
      },
    );
    physical.thickness = 0.8;
    physical.attenuationColor.setRGB(0.1, 0.7, 0.3);
    effect(
      "physical.attenuationDistance",
      () => {
        physical.attenuationDistance = 0.3;
      },
      () => {
        physical.attenuationDistance = Infinity;
      },
    );
    physical.attenuationDistance = 0.3;
    effect(
      "physical.attenuationColor",
      () => {
        physical.attenuationColor.setRGB(0.8, 0.1, 0.3);
      },
      () => {
        physical.attenuationColor.setRGB(0.1, 0.7, 0.3);
      },
    );
    physical.attenuationDistance = Infinity;
    effect(
      "physical.transmissionRoughness",
      () => {
        physical.roughness = 0.7;
      },
      () => {
        physical.roughness = 0.05;
      },
    );
    physical.transmission = 0;
    physical.ior = 1.5;
    physical.roughness = 0.35;
    physical.color.setRGB(0.35, 0.35, 0.35);
    scene.remove(backdrop);

    // A different renderer and two same-class instances must not mutate each other's uniforms.
    const other = new WebGLRenderer({
      shaders,
      getDFGLUT: () => dfg,
      createEnvironments: WebGLEnvironments,
      preserveDrawingBuffer: true,
      alpha: true,
      premultipliedAlpha: false,
    });
    const alternate = own(new MeshPhysicalMaterial({ roughness: 0.9, metalness: 1, color: 0x2040ff }));
    try {
      other.setSize(size, size, false);
      other.outputColorSpace = ColorSpace.LinearSRGB;
      other.setClearColor(0x000000, 0);
      const primary = draw();
      mesh.material = alternate;
      const secondary = draw(other);
      different("independentMaterials", primary, secondary);
      const sameRendererAlternate = draw();
      same(sameRendererAlternate, secondary, "Cross-renderer material isolation");
      mesh.material = physical;
      same(draw(), primary, "Same-class uniform restoration");
      same(draw(other), primary, "Cross-renderer uniform restoration");
    } finally {
      other.dispose();
    }

    scene.environment = null;
    mesh.geometry = plane;
    for (const material of [normal, matcap, toon, phong, standard, physical, shadow]) {
      mesh.material = material;
      const candidate = new WebGLRenderer({
        shaders: {},
        getDFGLUT: () => dfg,
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
      });
      try {
        candidate.setSize(size, size, false);
        candidate.outputColorSpace = ColorSpace.LinearSRGB;
        candidate.setClearColor(0x000000, 0);
        reject(() => candidate.render(scene, camera), "No explicit shader selected");
        candidate.shaders = shaders;
        same(draw(candidate), draw(), `${material.type} descriptor recovery`);
      } finally {
        candidate.dispose();
      }
    }
    mesh.geometry = sphere;
    mesh.material = standard;
    const missingDFG = new WebGLRenderer({ shaders });
    try {
      reject(() => missingDFG.render(scene, camera), "getDFGLUT");
      mesh.material = normal;
      missingDFG.setSize(size, size, false);
      missingDFG.outputColorSpace = ColorSpace.LinearSRGB;
      const recovered = draw(missingDFG);
      near("missingDFGRecovery", recovered, sample(draw()));
    } finally {
      missingDFG.dispose();
    }
    mesh.material = standard;
    scene.remove(directional);
    scene.add(area);
    const missingLTC = new WebGLRenderer({ shaders, getDFGLUT: () => dfg });
    try {
      reject(() => missingLTC.render(scene, camera), "ltcTextures");
      scene.remove(area);
      scene.add(directional);
      missingLTC.setSize(size, size, false);
      missingLTC.outputColorSpace = ColorSpace.LinearSRGB;
      near("missingLTCRecovery", draw(missingLTC), sample(draw()));
    } finally {
      missingLTC.dispose();
    }
    const missingEnvironment = new WebGLRenderer({ shaders, getDFGLUT: () => dfg });
    try {
      scene.environment = environment;
      reject(() => missingEnvironment.render(scene, camera), "createEnvironments");
      scene.environment = null;
      missingEnvironment.setSize(size, size, false);
      missingEnvironment.outputColorSpace = ColorSpace.LinearSRGB;
      near("missingEnvironmentRecovery", draw(missingEnvironment), sample(draw()));
    } finally {
      missingEnvironment.dispose();
    }

    scene.environment = environment;
    mesh.material = matcap;
    matcap.matcap = red;
    const beforeDispose = draw();
    const oldTexture = handle(red);
    const oldPrograms = (renderer.info.programs ?? [])
      .filter((program) => program.name === matcap.name)
      .map((program) => program.program);
    check(oldPrograms.length > 0, "Matcap program was not observable");
    red.dispose();
    matcap.dispose();
    check(!gl.isTexture(oldTexture), "Texture.dispose did not delete material GPU storage");
    check(
      oldPrograms.every((program) => !gl.isProgram(program) || gl.getProgramParameter(program, GL.DELETE_STATUS)),
      "Material.dispose retained an unreferenced GPU program",
    );
    same(draw(), beforeDispose, "Material/texture disposal recreation");
    check(handle(red) !== oldTexture, "Disposed texture reused its old GPU handle");

    mesh.material = physical;
    physical.map = red;
    scene.add(area);
    const beforeLoss = draw();
    const ownedTextures = [red, dfg, floatAvailable ? ltc.LTC_FLOAT_1 : ltc.LTC_HALF_1];
    const oldHandles = ownedTextures.map((texture) => handle(texture));
    const oldProgramHandles = (renderer.info.programs ?? []).map((program) => program.program);
    const extension = gl.getExtension("WEBGL_lose_context");
    check(extension !== null, "Material fixture requires WEBGL_lose_context");
    // ES2022 fixtures use the event bridge rather than ES2024 Promise.withResolvers.
    const contextEvent = (name: string, action: () => void) =>
      new Promise<void>((resolve, rejectEvent) => {
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          renderer.domElement.removeEventListener(name, done);
          rejectEvent(new Error(`Timed out waiting for ${name}`));
        }, 10000);
        renderer.domElement.addEventListener(name, done, { once: true });
        action();
      });
    await contextEvent("webglcontextlost", () => extension.loseContext());
    check(
      oldHandles.every((value) => !gl.isTexture(value)),
      "Context loss retained material/LUT textures",
    );
    await contextEvent("webglcontextrestored", () => {
      setTimeout(() => extension.restoreContext(), 0);
    });
    same(draw(), beforeLoss, "PBR/LTC/environment context restoration", 2);
    check(
      ownedTextures.every((texture, i) => handle(texture) !== oldHandles[i]),
      "Context restore reused stale material/LUT storage",
    );
    check(
      (renderer.info.programs ?? []).every((program) => !oldProgramHandles.includes(program.program)),
      "Context restore reused stale programs",
    );
    const liveLUTs = ownedTextures.slice(1).map((texture) => handle(texture));
    physical.dispose();
    check(
      liveLUTs.every((value) => gl.isTexture(value)),
      "Material disposal destroyed caller-owned LUTs",
    );
    same(draw(), beforeLoss, "Physical program recreation", 2);
    return {
      pixels: evidence,
      effects,
      rejections,
      dfgCalls,
      ltcFloatAvailable: floatAvailable,
      ltcHalfDrawn: true,
      callerOwnedLUTs: true,
      contextRestored: true,
      glError: gl.getError(),
    };
  } finally {
    const programs = (renderer.info.programs ?? []).map((program) => program.program);
    const handles = textures
      .map((texture): WebGLTexture | undefined => renderer.properties.get(texture).__webglTexture)
      .filter((value): value is WebGLTexture => value !== undefined);
    directional.dispose();
    area.dispose();
    probe.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    plane.dispose();
    sphere.dispose();
    box.dispose();
    renderer.dispose();
    check(
      handles.every((value) => !gl.isTexture(value)),
      "Material fixture leaked caller-owned textures",
    );
    check(
      programs.every((program) => !gl.isProgram(program) || gl.getProgramParameter(program, GL.DELETE_STATUS)),
      "Material fixture leaked programs",
    );
    check(gl.getError() === GL.NO_ERROR, "Material fixture cleanup produced a WebGL error");
  }
}
