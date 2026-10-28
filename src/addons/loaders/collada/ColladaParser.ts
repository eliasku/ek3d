import { SRGBColorSpace } from "../../../constants";
import { Color } from "../../../math/Color";
import { ColorManagement } from "../../../math/ColorManagement";
import * as MathUtils from "../../../math/MathUtils";
import { Matrix4 } from "../../../math/Matrix4";
import { Vector3 } from "../../../math/Vector3";

export interface ColladaSource {
  array: number[] | string[];
  stride: number;
}
export interface ColladaAnimationSampler {
  inputs: Record<string, string>;
}
export interface ColladaAnimationChannel {
  id: string;
  sid: string;
  member?: string;
  indices?: number[];
  arraySyntax: boolean;
  memberSyntax: boolean;
  sampler: string;
}
export interface ColladaAnimation {
  sources: Record<string, ColladaSource>;
  samplers: Record<string, ColladaAnimationSampler>;
  channels: Record<string, ColladaAnimationChannel>;
}
export interface ColladaAnimationClip {
  name: string;
  start: number;
  end: number;
  animations: string[];
}
export interface ColladaInput {
  id: string;
  offset: number;
}
export interface ColladaJoints {
  inputs: Record<string, string>;
}
export interface ColladaVertexWeights {
  inputs: Record<string, ColladaInput>;
  vcount: number[];
  v: number[];
}
export interface ColladaSkin {
  sources: Record<string, ColladaSource>;
  bindShapeMatrix: number[];
  joints: ColladaJoints;
  vertexWeights: ColladaVertexWeights;
}
export interface ColladaController {
  id: string;
  skin: ColladaSkin;
}
export interface ColladaImage {
  init_from: string;
}
export interface ColladaSurface {
  init_from: string;
}
export interface ColladaEffectSampler {
  source: string;
}
export interface ColladaTextureExtra {
  technique: Record<string, number>;
  bump?: ColladaBump;
}
export interface ColladaTexture {
  id: string;
  texcoord?: string;
  extra: ColladaTextureExtra;
}
export interface ColladaBump {
  texture: ColladaTexture;
}
export interface ColladaEffectExtraTechnique {
  double_sided: number;
  bump: ColladaBump;
}
export interface ColladaEffectExtra {
  technique: ColladaEffectExtraTechnique;
}
export interface ColladaEffectParameter {
  color: number[];
  float: number;
  texture: ColladaTexture;
}
export interface ColladaEffectParameters {
  [key: string]: ColladaEffectParameter | { opaque: string; data: ColladaEffectParameter };
  transparent: { opaque: string; data: ColladaEffectParameter };
}
export interface ColladaEffectTechnique {
  type: string;
  parameters: ColladaEffectParameters;
  extra: ColladaEffectExtra;
}
export interface ColladaEffectProfile {
  surfaces: Record<string, ColladaSurface>;
  samplers: Record<string, ColladaEffectSampler>;
  technique: ColladaEffectTechnique;
  extra: ColladaEffectExtra;
}
export interface ColladaEffect {
  profile: ColladaEffectProfile;
}
export interface ColladaMaterial {
  name: string;
  url: string;
}
export interface ColladaCameraParameters {
  [key: string]: number;
}
export interface ColladaCameraOptics {
  technique: string;
  parameters: ColladaCameraParameters;
}
export interface ColladaCamera {
  name: string;
  optics: ColladaCameraOptics;
}
export interface ColladaLightParameters {
  color: Color;
  falloffAngle: number;
  distance: number;
}
export interface ColladaLight {
  technique: string;
  parameters: ColladaLightParameters;
}
export interface ColladaPrimitive {
  type: string;
  material: string;
  count: number;
  inputs: Record<string, ColladaInput>;
  stride: number;
  hasUV: boolean;
  vcount: number[];
  p: number[];
}
export interface ColladaGeometry {
  name: string;
  sources: Record<string, ColladaSource>;
  vertices: Record<string, string>;
  primitives: ColladaPrimitive[];
}
export interface ColladaKinematicsJoint {
  sid: string;
  name: string;
  axis: Vector3;
  limits: { min: number; max: number };
  type: string;
  static: boolean;
  zeroPosition: number;
  middlePosition: number;
}
export interface ColladaKinematicsTransform {
  type: string;
  obj: Matrix4 | Vector3;
  angle: number;
}
export interface ColladaKinematicsLink {
  sid: string;
  name: string;
  attachments: ColladaKinematicsAttachment[];
  transforms: ColladaKinematicsTransform[];
}
export interface ColladaKinematicsAttachment {
  joint: string;
  transforms: ColladaKinematicsTransform[];
  links: ColladaKinematicsLink[];
}
export interface ColladaKinematicsModel {
  name: string;
  joints: Record<string, ColladaKinematicsJoint>;
  links: ColladaKinematicsLink[];
}
export interface ColladaRigidBody {
  inertia: number[];
  mass: number;
}
export interface ColladaPhysicsModel {
  name: string;
  rigidBodies: Record<string, ColladaRigidBody>;
}
export interface ColladaBindJointAxis {
  target: string;
  axis: string;
  jointIndex: string;
}
export interface ColladaKinematicsScene {
  bindJointAxis: ColladaBindJointAxis[];
}
export type ColladaTransformData =
  | { type: "matrix"; array: number[] }
  | { type: "rotate"; axis: number[]; angle: number }
  | { type: "translate" | "scale"; x: number; y: number; z: number };
export interface ColladaNodeInstance {
  id: string;
  materials: Record<string, string>;
  skeletons: string[];
}
export interface ColladaNode {
  name: string;
  type: string;
  id: string;
  sid: string;
  matrix: Matrix4;
  nodes: string[];
  instanceCameras: string[];
  instanceControllers: ColladaNodeInstance[];
  instanceLights: string[];
  instanceGeometries: ColladaNodeInstance[];
  instanceNodes: string[];
  transforms: Record<string, string>;
  transformData: Record<string, ColladaTransformData>;
  transformOrder: string[];
}
export interface ColladaVisualScene {
  name: string;
  children: ColladaNode[];
}
export interface ColladaLibrary {
  animations: Record<string, ColladaAnimation>;
  clips: Record<string, ColladaAnimationClip>;
  controllers: Record<string, ColladaController>;
  images: Record<string, ColladaImage>;
  effects: Record<string, ColladaEffect>;
  materials: Record<string, ColladaMaterial>;
  cameras: Record<string, ColladaCamera>;
  lights: Record<string, ColladaLight>;
  geometries: Record<string, ColladaGeometry>;
  nodes: Record<string, ColladaNode>;
  visualScenes: Record<string, ColladaVisualScene>;
  kinematicsModels: Record<string, ColladaKinematicsModel>;
  physicsModels: Record<string, ColladaPhysicsModel>;
  kinematicsScenes: Record<string, ColladaKinematicsScene>;
  joints: Record<string, ColladaKinematicsJoint>;
}
export interface ColladaParseResult {
  library: ColladaLibrary;
  asset: { unit: number; upAxis: string };
  collada: Element;
}

/**
 * Utility functions for parsing
 */

export function getElementsByTagName(xml: Node, name: string): Element[] {
  // Non recursive xml.getElementsByTagName() ...

  const array: Element[] = [];
  const childNodes = xml.childNodes;

  for (let i = 0, l = childNodes.length; i < l; i++) {
    const child = childNodes[i];

    if (child.nodeName === name) {
      array.push(child as Element);
    }
  }

  return array;
}

export function parseStrings(text: string) {
  if (text.length === 0) return [];

  return text.trim().split(/\s+/);
}

export function parseFloats(text: string) {
  if (text.length === 0) return [];

  return text.trim().split(/\s+/).map(parseFloat);
}

export function parseInts(text: string) {
  if (text.length === 0) return [];

  return text
    .trim()
    .split(/\s+/)
    .map((s) => parseInt(s));
}

export function parseId(text: string) {
  return text.substring(1);
}

/**
 * ColladaParser handles XML parsing and converts Collada XML to intermediate data structures.
 */
export class ColladaParser {
  library: ColladaLibrary | undefined;
  collada: Element | undefined;
  count: number;

  constructor() {
    this.count = 0;
  }

  generateId() {
    return "three_default_" + this.count++;
  }

  parse(text: string): ColladaParseResult | null {
    if (text.length === 0) {
      return null;
    }

    const xml = new DOMParser().parseFromString(text, "application/xml");

    const collada = getElementsByTagName(xml, "COLLADA")[0];

    const parserError = xml.getElementsByTagName("parsererror")[0];
    if (parserError !== undefined) {
      // Chrome will return parser error with a div in it

      const errorElement = getElementsByTagName(parserError, "div")[0];
      let errorText;

      if (errorElement) {
        errorText = errorElement.textContent!;
      } else {
        errorText = this.parserErrorToText(parserError);
      }

      console.error("THREE.ColladaLoader: Failed to parse collada file.\n", errorText);

      return null;
    }

    // metadata

    const version = collada.getAttribute("version")!;
    console.debug("THREE.ColladaLoader: File version", version);

    const asset = this.parseAsset(getElementsByTagName(collada, "asset")[0]);

    //

    const library: ColladaLibrary = {
      animations: {},
      clips: {},
      controllers: {},
      images: {},
      effects: {},
      materials: {},
      cameras: {},
      lights: {},
      geometries: {},
      nodes: {},
      visualScenes: {},
      kinematicsModels: {},
      physicsModels: {},
      kinematicsScenes: {},
      joints: {},
    };

    this.library = library;
    this.collada = collada;

    this.parseLibrary(collada, "library_animations", "animation", this.parseAnimation.bind(this));
    this.parseLibrary(collada, "library_animation_clips", "animation_clip", this.parseAnimationClip.bind(this));
    this.parseLibrary(collada, "library_controllers", "controller", this.parseController.bind(this));
    this.parseLibrary(collada, "library_images", "image", this.parseImage.bind(this));
    this.parseLibrary(collada, "library_effects", "effect", this.parseEffect.bind(this));
    this.parseLibrary(collada, "library_materials", "material", this.parseMaterial.bind(this));
    this.parseLibrary(collada, "library_cameras", "camera", this.parseCamera.bind(this));
    this.parseLibrary(collada, "library_lights", "light", this.parseLight.bind(this));
    this.parseLibrary(collada, "library_geometries", "geometry", this.parseGeometry.bind(this));
    this.parseLibrary(collada, "library_nodes", "node", this.parseNode.bind(this));
    this.parseLibrary(collada, "library_visual_scenes", "visual_scene", this.parseVisualScene.bind(this));
    this.parseLibrary(collada, "library_joints", "joint", this.parseLibraryJoint.bind(this));
    this.parseLibrary(collada, "library_kinematics_models", "kinematics_model", this.parseKinematicsModel.bind(this));
    this.parseLibrary(collada, "library_physics_models", "physics_model", this.parsePhysicsModel.bind(this));
    this.parseLibrary(collada, "scene", "instance_kinematics_scene", this.parseKinematicsScene.bind(this));

    return {
      library: library,
      asset: asset,
      collada: collada,
    };
  }

  // convert the parser error element into text with each child elements text
  // separated by new lines.

  parserErrorToText(parserError: Node) {
    const parts = [];
    const stack = [parserError];

    while (stack.length) {
      const node = stack.shift()!;

      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent!);
      } else {
        parts.push("\n");
        stack.push(...node.childNodes);
      }
    }

    return parts.join("").trim();
  }

  // asset

  parseAsset(xml: Element) {
    return {
      unit: this.parseAssetUnit(getElementsByTagName(xml, "unit")[0]),
      upAxis: this.parseAssetUpAxis(getElementsByTagName(xml, "up_axis")[0]),
    };
  }

  parseAssetUnit(xml: Element | undefined) {
    if (xml !== undefined && xml.hasAttribute("meter") === true) {
      return parseFloat(xml.getAttribute("meter")!);
    } else {
      return 1; // default 1 meter
    }
  }

  parseAssetUpAxis(xml: Element | undefined) {
    return xml !== undefined ? xml.textContent! : "Y_UP";
  }

  // library

  parseLibrary(xml: Element, libraryName: string, nodeName: string, parser: (xml: Element) => void) {
    const library = getElementsByTagName(xml, libraryName)[0];

    if (library !== undefined) {
      const elements = getElementsByTagName(library, nodeName);

      for (let i = 0; i < elements.length; i++) {
        parser(elements[i]);
      }
    }
  }

  // animation

  parseAnimation(xml: Element): void {
    const data = {
      sources: {},
      samplers: {},
      channels: {},
    } as ColladaAnimation;

    let hasChildren = false;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      let id;

      switch (child.nodeName) {
        case "source":
          id = child.getAttribute("id")!;
          data.sources[id] = this.parseSource(child);
          break;

        case "sampler":
          id = child.getAttribute("id")!;
          data.samplers[id] = this.parseAnimationSampler(child);
          break;

        case "channel":
          id = child.getAttribute("target")!;
          data.channels[id] = this.parseAnimationChannel(child);
          break;

        case "animation":
          // hierarchy of related animations
          this.parseAnimation(child);
          hasChildren = true;
          break;

        default:
      }
    }

    if (hasChildren === false) {
      // since 'id' attributes can be optional, it's necessary to generate a UUID for unique assignment

      this.library!.animations[xml.getAttribute("id")! || MathUtils.generateUUID()] = data;
    }
  }

  parseAnimationSampler(xml: Element) {
    const data = {
      inputs: {},
    } as ColladaAnimationSampler;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "input":
          const id = parseId(child.getAttribute("source")!);
          const semantic = child.getAttribute("semantic")!;
          data.inputs[semantic] = id;
          break;
      }
    }

    return data;
  }

  parseAnimationChannel(xml: Element) {
    const data = {} as ColladaAnimationChannel;

    const target = xml.getAttribute("target")!;

    // parsing SID Addressing Syntax

    let parts = target.split("/");

    const id = parts.shift()!;
    let sid = parts.shift()!;

    // check selection syntax

    const arraySyntax = sid.indexOf("(") !== -1;
    const memberSyntax = sid.indexOf(".") !== -1;

    if (memberSyntax) {
      //  member selection access

      parts = sid.split(".");
      sid = parts.shift()!;
      data.member = parts.shift();
    } else if (arraySyntax) {
      // array-access syntax. can be used to express fields in one-dimensional vectors or two-dimensional matrices.

      const indexParts = sid.split("(");
      sid = indexParts.shift()!;
      const indices: number[] = [];

      for (let i = 0; i < indexParts.length; i++) {
        indices[i] = parseInt(indexParts[i].replace(/\)/, ""));
      }

      data.indices = indices;
    }

    data.id = id;
    data.sid = sid;

    data.arraySyntax = arraySyntax;
    data.memberSyntax = memberSyntax;

    data.sampler = parseId(xml.getAttribute("source")!);

    return data;
  }

  // animation clips

  parseAnimationClip(xml: Element) {
    const data = {
      name: xml.getAttribute("id")! || "default",
      start: parseFloat(xml.getAttribute("start")! || "0"),
      end: parseFloat(xml.getAttribute("end")! || "0"),
      animations: [],
    } as ColladaAnimationClip;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "instance_animation":
          data.animations.push(parseId(child.getAttribute("url")!));
          break;
      }
    }

    this.library!.clips[xml.getAttribute("id")!] = data;
  }

  // controller

  parseController(xml: Element) {
    const data = {} as ColladaController;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "skin":
          // there is exactly one skin per controller
          data.id = parseId(child.getAttribute("source")!);
          data.skin = this.parseSkin(child);
          break;

        case "morph":
          data.id = parseId(child.getAttribute("source")!);
          console.warn("THREE.ColladaLoader: Morph target animation not supported yet.");
          break;
      }
    }

    this.library!.controllers[xml.getAttribute("id")!] = data;
  }

  parseSkin(xml: Element) {
    const data = {
      sources: {},
    } as ColladaSkin;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "bind_shape_matrix":
          data.bindShapeMatrix = parseFloats(child.textContent!);
          break;

        case "source":
          const id = child.getAttribute("id")!;
          data.sources[id] = this.parseSource(child);
          break;

        case "joints":
          data.joints = this.parseJoints(child);
          break;

        case "vertex_weights":
          data.vertexWeights = this.parseVertexWeights(child);
          break;
      }
    }

    return data;
  }

  parseJoints(xml: Element) {
    const data = {
      inputs: {},
    } as ColladaJoints;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "input":
          const semantic = child.getAttribute("semantic")!;
          const id = parseId(child.getAttribute("source")!);
          data.inputs[semantic] = id;
          break;
      }
    }

    return data;
  }

  parseVertexWeights(xml: Element) {
    const data = {
      inputs: {},
    } as ColladaVertexWeights;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "input":
          const semantic = child.getAttribute("semantic")!;
          const id = parseId(child.getAttribute("source")!);
          const offset = parseInt(child.getAttribute("offset")!);
          data.inputs[semantic] = { id: id, offset: offset };
          break;

        case "vcount":
          data.vcount = parseInts(child.textContent!);
          break;

        case "v":
          data.v = parseInts(child.textContent!);
          break;
      }
    }

    return data;
  }

  // image

  parseImage(xml: Element) {
    const data = {
      init_from: getElementsByTagName(xml, "init_from")[0].textContent!,
    } as ColladaImage;

    this.library!.images[xml.getAttribute("id")!] = data;
  }

  // effect

  parseEffect(xml: Element) {
    const data = {} as ColladaEffect;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "profile_COMMON":
          data.profile = this.parseEffectProfileCOMMON(child);
          break;
      }
    }

    this.library!.effects[xml.getAttribute("id")!] = data;
  }

  parseEffectProfileCOMMON(xml: Element) {
    const data = {
      surfaces: {},
      samplers: {},
    } as ColladaEffectProfile;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "newparam":
          this.parseEffectNewparam(child, data);
          break;

        case "technique":
          data.technique = this.parseEffectTechnique(child);
          break;

        case "extra":
          data.extra = this.parseEffectExtra(child);
          break;
      }
    }

    return data;
  }

  parseEffectNewparam(xml: Element, data: ColladaEffectProfile) {
    const sid = xml.getAttribute("sid")!;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "surface":
          data.surfaces[sid] = this.parseEffectSurface(child);
          break;

        case "sampler2D":
          data.samplers[sid] = this.parseEffectSampler(child);
          break;
      }
    }
  }

  parseEffectSurface(xml: Element) {
    const data = {} as ColladaSurface;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "init_from":
          data.init_from = child.textContent!;
          break;
      }
    }

    return data;
  }

  parseEffectSampler(xml: Element) {
    const data = {} as ColladaEffectSampler;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "source":
          data.source = child.textContent!;
          break;
      }
    }

    return data;
  }

  parseEffectTechnique(xml: Element) {
    const data = {} as ColladaEffectTechnique;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "constant":
        case "lambert":
        case "blinn":
        case "phong":
          data.type = child.nodeName;
          data.parameters = this.parseEffectParameters(child);
          break;

        case "extra":
          data.extra = this.parseEffectExtra(child);
          break;
      }
    }

    return data;
  }

  parseEffectParameters(xml: Element) {
    const data = {} as ColladaEffectParameters;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "emission":
        case "diffuse":
        case "specular":
        case "bump":
        case "ambient":
        case "shininess":
        case "transparency":
          data[child.nodeName] = this.parseEffectParameter(child);
          break;
        case "transparent":
          data.transparent = {
            opaque: child.hasAttribute("opaque") ? child.getAttribute("opaque")! : "A_ONE",
            data: this.parseEffectParameter(child),
          };
          break;
      }
    }

    return data;
  }

  parseEffectParameter(xml: Element) {
    const data = {} as ColladaEffectParameter;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "color":
          data.color = parseFloats(child.textContent!);
          break;

        case "float":
          data.float = parseFloat(child.textContent!);
          break;

        case "texture":
          data.texture = { id: child.getAttribute("texture")!, extra: this.parseEffectParameterTexture(child) };
          break;
      }
    }

    return data;
  }

  parseEffectParameterTexture(xml: Element) {
    const data = {
      technique: {},
    } as ColladaTextureExtra;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "extra":
          this.parseEffectParameterTextureExtra(child, data);
          break;
      }
    }

    return data;
  }

  parseEffectParameterTextureExtra(xml: Element, data: ColladaTextureExtra) {
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "technique":
          this.parseEffectParameterTextureExtraTechnique(child, data);
          break;
      }
    }
  }

  parseEffectParameterTextureExtraTechnique(xml: Element, data: ColladaTextureExtra) {
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "repeatU":
        case "repeatV":
        case "offsetU":
        case "offsetV":
          data.technique[child.nodeName] = parseFloat(child.textContent!);
          break;

        case "wrapU":
        case "wrapV":
          // some files have values for wrapU/wrapV which become NaN via parseInt

          if (child.textContent!.toUpperCase() === "TRUE") {
            data.technique[child.nodeName] = 1;
          } else if (child.textContent!.toUpperCase() === "FALSE") {
            data.technique[child.nodeName] = 0;
          } else {
            data.technique[child.nodeName] = parseInt(child.textContent!);
          }

          break;

        case "bump":
          data.bump = this.parseEffectExtraTechniqueBump(child);
          break;
      }
    }
  }

  parseEffectExtra(xml: Element) {
    const data = {} as ColladaEffectExtra;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "technique":
          data.technique = this.parseEffectExtraTechnique(child);
          break;
      }
    }

    return data;
  }

  parseEffectExtraTechnique(xml: Element) {
    const data = {} as ColladaEffectExtraTechnique;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "double_sided":
          data.double_sided = parseInt(child.textContent!);
          break;

        case "bump":
          data.bump = this.parseEffectExtraTechniqueBump(child);
          break;
      }
    }

    return data;
  }

  parseEffectExtraTechniqueBump(xml: Element) {
    const data = {} as ColladaBump;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "texture":
          data.texture = {
            id: child.getAttribute("texture")!,
            texcoord: child.getAttribute("texcoord")!,
            extra: this.parseEffectParameterTexture(child),
          };
          break;
      }
    }

    return data;
  }

  // material

  parseMaterial(xml: Element) {
    const data = {
      name: xml.getAttribute("name")!,
    } as ColladaMaterial;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "instance_effect":
          data.url = parseId(child.getAttribute("url")!);
          break;
      }
    }

    this.library!.materials[xml.getAttribute("id")!] = data;
  }

  // camera

  parseCamera(xml: Element) {
    const data = {
      name: xml.getAttribute("name")!,
    } as ColladaCamera;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "optics":
          data.optics = this.parseCameraOptics(child);
          break;
      }
    }

    this.library!.cameras[xml.getAttribute("id")!] = data;
  }

  parseCameraOptics(xml: Element) {
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      switch (child.nodeName) {
        case "technique_common":
          return this.parseCameraTechnique(child);
      }
    }

    return {} as ColladaCameraOptics;
  }

  parseCameraTechnique(xml: Element) {
    const data = {} as ColladaCameraOptics;

    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      switch (child.nodeName) {
        case "perspective":
        case "orthographic":
          data.technique = child.nodeName;
          data.parameters = this.parseCameraParameters(child);

          break;
      }
    }

    return data;
  }

  parseCameraParameters(xml: Element) {
    const data = {} as ColladaCameraParameters;

    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      switch (child.nodeName) {
        case "xfov":
        case "yfov":
        case "xmag":
        case "ymag":
        case "znear":
        case "zfar":
        case "aspect_ratio":
          data[child.nodeName] = parseFloat(child.textContent!);
          break;
      }
    }

    return data;
  }

  // light

  parseLight(xml: Element) {
    let data = {} as ColladaLight;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "technique_common":
          data = this.parseLightTechnique(child);
          break;
      }
    }

    this.library!.lights[xml.getAttribute("id")!] = data;
  }

  parseLightTechnique(xml: Element) {
    const data = {} as ColladaLight;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "directional":
        case "point":
        case "spot":
        case "ambient":
          data.technique = child.nodeName;
          data.parameters = this.parseLightParameters(child);
          break;
      }
    }

    return data;
  }

  parseLightParameters(xml: Element) {
    const data = {} as ColladaLightParameters;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "color":
          const array = parseFloats(child.textContent!);
          data.color = new Color().fromArray(array);
          ColorManagement.colorSpaceToWorking(data.color, SRGBColorSpace);
          break;

        case "falloff_angle":
          data.falloffAngle = parseFloat(child.textContent!);
          break;

        case "quadratic_attenuation":
          const f = parseFloat(child.textContent!);
          data.distance = f ? Math.sqrt(1 / f) : 0;
          break;
      }
    }

    return data;
  }

  // geometry

  parseGeometry(xml: Element) {
    const data = {
      name: xml.getAttribute("name")!,
      sources: {},
      vertices: {},
      primitives: [],
    } as ColladaGeometry;

    const mesh = getElementsByTagName(xml, "mesh")[0];

    // the following tags inside geometry are not supported yet (see https://github.com/mrdoob/three.js/pull/12606): convex_mesh, spline, brep
    if (mesh === undefined) return;

    for (let i = 0; i < mesh.childNodes.length; i++) {
      const child = mesh.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      const id = child.getAttribute("id")!;

      switch (child.nodeName) {
        case "source":
          data.sources[id] = this.parseSource(child);
          break;

        case "vertices":
          // data.sources[ id ] = data.sources[ parseId( getElementsByTagName( child, 'input' )[ 0 ].getAttribute( 'source' )! ) ];
          data.vertices = this.parseGeometryVertices(child);
          break;

        case "polygons":
        case "lines":
        case "linestrips":
        case "polylist":
        case "triangles":
          data.primitives.push(this.parseGeometryPrimitive(child));
          break;

        default:
      }
    }

    this.library!.geometries[xml.getAttribute("id")!] = data;
  }

  parseSource(xml: Element) {
    const data = {
      array: [],
      stride: 3,
    } as ColladaSource;

    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "float_array":
          data.array = parseFloats(child.textContent!);
          break;

        case "Name_array":
          data.array = parseStrings(child.textContent!);
          break;

        case "technique_common":
          const accessor = getElementsByTagName(child, "accessor")[0];

          if (accessor !== undefined) {
            data.stride = parseInt(accessor.getAttribute("stride")!);
          }

          break;
      }
    }

    return data;
  }

  parseGeometryVertices(xml: Element) {
    const data = {} as Record<string, string>;

    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      data[child.getAttribute("semantic")!] = parseId(child.getAttribute("source")!);
    }

    return data;
  }

  parseGeometryPrimitive(xml: Element) {
    const primitive = {
      type: xml.nodeName,
      material: xml.getAttribute("material")!,
      count: parseInt(xml.getAttribute("count")!),
      inputs: {},
      stride: 0,
      hasUV: false,
    } as ColladaPrimitive;

    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "input":
          const id = parseId(child.getAttribute("source")!);
          const semantic = child.getAttribute("semantic")!;
          const offset = parseInt(child.getAttribute("offset")!);
          const set = parseInt(child.getAttribute("set")!);
          const inputname = set > 0 ? semantic + set : semantic;
          primitive.inputs[inputname] = { id: id, offset: offset };
          primitive.stride = Math.max(primitive.stride, offset + 1);
          if (semantic === "TEXCOORD") primitive.hasUV = true;
          break;

        case "vcount":
          primitive.vcount = parseInts(child.textContent!);
          break;

        case "p":
          primitive.p = parseInts(child.textContent!);
          break;
      }
    }

    if (primitive.type === "polygons") {
      primitive.vcount = [primitive.p.length / primitive.stride];
    }

    return primitive;
  }

  // kinematics

  parseLibraryJoint(xml: Element) {
    this.library!.joints[xml.getAttribute("id")!] = this.parseKinematicsJoint(xml);
  }

  parseKinematicsModel(xml: Element) {
    const data = {
      name: xml.getAttribute("name")! || "",
      joints: {},
      links: [],
    } as ColladaKinematicsModel;

    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "technique_common":
          this.parseKinematicsTechniqueCommon(child, data);
          break;
      }
    }

    this.library!.kinematicsModels[xml.getAttribute("id")!] = data;
  }

  parseKinematicsTechniqueCommon(xml: Element, data: ColladaKinematicsModel) {
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "joint":
          data.joints[child.getAttribute("sid")!] = this.parseKinematicsJoint(child);
          break;

        case "instance_joint":
          data.joints[child.getAttribute("sid")!] = this.library!.joints[parseId(child.getAttribute("url")!)];
          break;

        case "link":
          data.links.push(this.parseKinematicsLink(child));
          break;
      }
    }
  }

  parseKinematicsJoint(xml: Element) {
    let data: ColladaKinematicsJoint | undefined;

    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "prismatic":
        case "revolute":
          data = this.parseKinematicsJointParameter(child);
          break;
      }
    }

    return data!;
  }

  parseKinematicsJointParameter(xml: Element) {
    const data = {
      sid: xml.getAttribute("sid")!,
      name: xml.getAttribute("name")! || "",
      axis: new Vector3(),
      limits: {
        min: 0,
        max: 0,
      },
      type: xml.nodeName,
      static: false,
      zeroPosition: 0,
      middlePosition: 0,
    } as ColladaKinematicsJoint;

    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "axis":
          const array = parseFloats(child.textContent!);
          data.axis.fromArray(array);
          break;
        case "limits":
          const max = child.getElementsByTagName("max")[0];
          const min = child.getElementsByTagName("min")[0];

          data.limits.max = parseFloat(max.textContent!);
          data.limits.min = parseFloat(min.textContent!);
          break;
      }
    }

    // if min is equal to or greater than max, consider the joint static

    if (data.limits.min >= data.limits.max) {
      data.static = true;
    }

    // calculate middle position

    data.middlePosition = (data.limits.min + data.limits.max) / 2.0;

    return data;
  }

  parseKinematicsLink(xml: Element): ColladaKinematicsLink {
    const data = {
      sid: xml.getAttribute("sid")!,
      name: xml.getAttribute("name")! || "",
      attachments: [],
      transforms: [],
    } as ColladaKinematicsLink;

    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "attachment_full":
          data.attachments.push(this.parseKinematicsAttachment(child));
          break;

        case "matrix":
        case "translate":
        case "rotate":
          data.transforms.push(this.parseKinematicsTransform(child));
          break;
      }
    }

    return data;
  }

  parseKinematicsAttachment(xml: Element): ColladaKinematicsAttachment {
    const data = {
      joint: xml.getAttribute("joint")!.split("/").pop()!,
      transforms: [],
      links: [],
    } as ColladaKinematicsAttachment;

    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "link":
          data.links.push(this.parseKinematicsLink(child));
          break;

        case "matrix":
        case "translate":
        case "rotate":
          data.transforms.push(this.parseKinematicsTransform(child));
          break;
      }
    }

    return data;
  }

  parseKinematicsTransform(xml: Element) {
    const data = {
      type: xml.nodeName,
    } as ColladaKinematicsTransform;

    const array = parseFloats(xml.textContent!);

    switch (data.type) {
      case "matrix":
        data.obj = new Matrix4();
        data.obj.fromArray(array).transpose();
        break;

      case "translate":
        data.obj = new Vector3();
        data.obj.fromArray(array);
        break;

      case "rotate":
        data.obj = new Vector3();
        data.obj.fromArray(array);
        data.angle = MathUtils.degToRad(array[3]);
        break;
    }

    return data;
  }

  // physics

  parsePhysicsModel(xml: Element) {
    const data = {
      name: xml.getAttribute("name")! || "",
      rigidBodies: {},
    } as ColladaPhysicsModel;

    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "rigid_body":
          data.rigidBodies[child.getAttribute("name")!] = {} as ColladaRigidBody;
          this.parsePhysicsRigidBody(child, data.rigidBodies[child.getAttribute("name")!]);
          break;
      }
    }

    this.library!.physicsModels[xml.getAttribute("id")!] = data;
  }

  parsePhysicsRigidBody(xml: Element, data: ColladaRigidBody) {
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "technique_common":
          this.parsePhysicsTechniqueCommon(child, data);
          break;
      }
    }
  }

  parsePhysicsTechniqueCommon(xml: Element, data: ColladaRigidBody) {
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "inertia":
          data.inertia = parseFloats(child.textContent!);
          break;

        case "mass":
          data.mass = parseFloats(child.textContent!)[0];
          break;
      }
    }
  }

  // scene

  parseKinematicsScene(xml: Element) {
    const data = {
      bindJointAxis: [],
    } as ColladaKinematicsScene;

    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "bind_joint_axis":
          data.bindJointAxis.push(this.parseKinematicsBindJointAxis(child));
          break;
      }
    }

    this.library!.kinematicsScenes[parseId(xml.getAttribute("url")!)] = data;
  }

  parseKinematicsBindJointAxis(xml: Element) {
    const data = {
      target: xml.getAttribute("target")!.split("/").pop()!,
    } as ColladaBindJointAxis;

    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      switch (child.nodeName) {
        case "axis":
          const param = child.getElementsByTagName("param")[0];
          data.axis = param.textContent!;
          const tmpJointIndex = data.axis.split("inst_").pop()!.split("axis")[0];
          data.jointIndex = tmpJointIndex.substring(0, tmpJointIndex.length - 1);
          break;
      }
    }

    return data;
  }

  // nodes

  prepareNodes(xml: Element) {
    const elements = xml.getElementsByTagName("node");

    // ensure all node elements have id attributes

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      if (element.hasAttribute("id") === false) {
        element.setAttribute("id", this.generateId());
      }
    }
  }

  parseNode(xml: Element): ColladaNode {
    const matrix = new Matrix4();
    const vector = new Vector3();

    const data = {
      name: xml.getAttribute("name")! || "",
      type: xml.getAttribute("type")!,
      id: xml.getAttribute("id")!,
      sid: xml.getAttribute("sid")!,
      matrix: new Matrix4(),
      nodes: [],
      instanceCameras: [],
      instanceControllers: [],
      instanceLights: [],
      instanceGeometries: [],
      instanceNodes: [],
      transforms: {},
      transformData: {},
      transformOrder: [],
    } as ColladaNode;

    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      if (child.nodeType !== 1) continue;

      let array;

      switch (child.nodeName) {
        case "node":
          data.nodes.push(child.getAttribute("id")!);
          this.parseNode(child);
          break;

        case "instance_camera":
          data.instanceCameras.push(parseId(child.getAttribute("url")!));
          break;

        case "instance_controller":
          data.instanceControllers.push(this.parseNodeInstance(child));
          break;

        case "instance_light":
          data.instanceLights.push(parseId(child.getAttribute("url")!));
          break;

        case "instance_geometry":
          data.instanceGeometries.push(this.parseNodeInstance(child));
          break;

        case "instance_node":
          data.instanceNodes.push(parseId(child.getAttribute("url")!));
          break;

        case "matrix":
          array = parseFloats(child.textContent!);
          data.matrix.multiply(matrix.fromArray(array).transpose());
          {
            const sid = child.getAttribute("sid")!;
            data.transforms[sid] = child.nodeName;
            data.transformData[sid] = { type: "matrix", array: array };
            data.transformOrder.push(sid);
          }

          break;

        case "translate":
          array = parseFloats(child.textContent!);
          vector.fromArray(array);
          data.matrix.multiply(matrix.makeTranslation(vector.x, vector.y, vector.z));
          {
            const sid = child.getAttribute("sid")!;
            data.transforms[sid] = child.nodeName;
            data.transformData[sid] = { type: "translate", x: array[0], y: array[1], z: array[2] };
            data.transformOrder.push(sid);
          }

          break;

        case "rotate":
          array = parseFloats(child.textContent!);
          {
            const angle = MathUtils.degToRad(array[3]);
            data.matrix.multiply(matrix.makeRotationAxis(vector.fromArray(array), angle));
            const sid = child.getAttribute("sid")!;
            data.transforms[sid] = child.nodeName;
            data.transformData[sid] = { type: "rotate", axis: [array[0], array[1], array[2]], angle: array[3] };
            data.transformOrder.push(sid);
          }

          break;

        case "scale":
          array = parseFloats(child.textContent!);
          data.matrix.scale(vector.fromArray(array));
          {
            const sid = child.getAttribute("sid")!;
            data.transforms[sid] = child.nodeName;
            data.transformData[sid] = { type: "scale", x: array[0], y: array[1], z: array[2] };
            data.transformOrder.push(sid);
          }

          break;

        case "extra":
          break;

        default:
      }
    }

    if (this.hasNode(data.id)) {
      console.warn(
        "THREE.ColladaLoader: There is already a node with ID %s. Exclude current node from further processing.",
        data.id,
      );
    } else {
      this.library!.nodes[data.id] = data;
    }

    return data;
  }

  parseNodeInstance(xml: Element) {
    const data = {
      id: parseId(xml.getAttribute("url")!),
      materials: {},
      skeletons: [],
    } as ColladaNodeInstance;

    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i] as Element;

      switch (child.nodeName) {
        case "bind_material":
          const instances = child.getElementsByTagName("instance_material");

          for (let j = 0; j < instances.length; j++) {
            const instance = instances[j];
            const symbol = instance.getAttribute("symbol")!;
            const target = instance.getAttribute("target")!;

            data.materials[symbol] = parseId(target);
          }

          break;

        case "skeleton":
          data.skeletons.push(parseId(child.textContent!));
          break;

        default:
          break;
      }
    }

    return data;
  }

  // visual scenes

  parseVisualScene(xml: Element) {
    const data = {
      name: xml.getAttribute("name")!,
      children: [],
    } as ColladaVisualScene;

    this.prepareNodes(xml);

    const elements = getElementsByTagName(xml, "node");

    for (let i = 0; i < elements.length; i++) {
      data.children.push(this.parseNode(elements[i]));
    }

    this.library!.visualScenes[xml.getAttribute("id")!] = data;
  }

  hasNode(id: string) {
    return this.library!.nodes[id] !== undefined;
  }
}
