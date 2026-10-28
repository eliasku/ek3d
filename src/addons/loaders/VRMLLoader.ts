import { Side, Wrapping, ColorSpace } from "../../constants";
import { OrthographicCamera } from "../../cameras/OrthographicCamera";
import { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import { Object3D } from "../../core/Object3D";
import { SphereGeometry } from "../../geometries/SphereGeometry";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import { LoaderUtils } from "../../loaders/LoaderUtils";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { TextureLoader } from "../../loaders/TextureLoader";
import { LineBasicMaterial } from "../../materials/LineBasicMaterial";
import { Material } from "../../materials/Material";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { MeshPhongMaterial } from "../../materials/MeshPhongMaterial";
import { PointsMaterial } from "../../materials/PointsMaterial";
import { Color } from "../../math/Color";
import { radToDeg } from "../../math/MathUtils";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import { Group } from "../../objects/Group";
import { LineSegments } from "../../objects/LineSegments";
import { Mesh } from "../../objects/Mesh";
import { Points } from "../../objects/Points";
import { Scene } from "../../scenes/Scene";
import { DataTexture } from "../../textures/DataTexture";
import { Texture } from "../../textures/Texture";
import { buildVRMLGeometry, paintFaces, toColorArray } from "./vrml-geometry";
import type { VRMLGeometry } from "./vrml-geometry";
import { parseVRML } from "./vrml-parser";
import type { ChevrotainRuntime, VRMLNode, VRMLUse } from "./vrml-parser";

type MaterialData = {
  diffuseColor?: Color;
  emissiveColor?: Color;
  shininess?: number;
  specularColor?: Color;
  transparency?: number;
};
type TransformData = { center: Vector2; rotation: number | Vector2; scale: Vector2; translation: Vector2 };
type PixelTexture = DataTexture & { __type?: number };
type SceneMaterial = MeshBasicMaterial | MeshPhongMaterial;

export class VRMLLoader extends Loader<Scene> {
  constructor(
    private readonly runtime: ChevrotainRuntime,
    manager?: LoadingManager,
  ) {
    super(manager);
  }

  load(
    url: string,
    onLoad?: (scene: Scene) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const path = this.path === "" ? LoaderUtils.extractUrlBase(url) : this.path;
    const loader = new FileLoader(this.manager);
    loader
      .setPriority(this.priority)
      .setCache(this.cache)
      .setPath(this.path)
      .setRequestHeader(this.requestHeader)
      .setWithCredentials(this.withCredentials);
    loader.load(
      url,
      (text) => {
        try {
          const scene = this.parse(text as string, path);
          onLoad?.(scene);
        } catch (error) {
          if (onError) onError(error);
          else console.error(error);
          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }

  parse(data: string, path = ""): Scene {
    if (!data.includes("#VRML V2.0")) throw Error("THREE.VRMLLexer: Version of VRML asset not supported.");
    const tree = parseVRML(data, this.runtime);
    const textureLoader = new TextureLoader(this.manager);
    textureLoader
      .setPriority(this.priority)
      .setCache(this.cache)
      .setPath(this.resourcePath || path)
      .setCrossOrigin(this.crossOrigin);
    const definitions: Record<string, VRMLNode> = {};
    const builds = new WeakMap<VRMLNode, unknown>();
    const collect = (node: VRMLNode): void => {
      if (node.DEF) definitions[node.DEF] = node;
      for (const field of node.fields)
        if (field.type === "node") for (const value of field.values) collect(value as VRMLNode);
    };
    for (const node of tree.nodes) collect(node);

    const getNode = (node: VRMLNode | VRMLUse): unknown => {
      if ("USE" in node) {
        const value = getNode(definitions[node.USE]);
        return value instanceof Object3D || value instanceof Material ? value.clone() : value;
      }
      const cached = builds.get(node);
      if (cached !== undefined) return cached;
      const value = buildNode(node);
      if (node.DEF && value !== undefined && Object.prototype.hasOwnProperty.call(value, "name"))
        (value as { name: string }).name = node.DEF;
      builds.set(node, value);
      return value;
    };
    const child = (value: unknown): unknown => getNode(value as VRMLNode | VRMLUse);
    const buildNode = (node: VRMLNode): unknown => {
      switch (node.name) {
        case "Anchor":
        case "Group":
        case "Transform":
        case "Collision":
          return grouping(node);
        case "Background":
          return background(node);
        case "Shape":
          return shape(node);
        case "Appearance":
          return appearance(node);
        case "Material":
          return material(node);
        case "ImageTexture":
          return imageTexture(node);
        case "PixelTexture":
          return pixelTexture(node);
        case "TextureTransform":
          return textureTransform(node);
        case "IndexedFaceSet":
        case "IndexedLineSet":
        case "PointSet":
        case "Box":
        case "Cone":
        case "Cylinder":
        case "Sphere":
        case "ElevationGrid":
        case "Extrusion":
          return buildVRMLGeometry(node, getNode);
        case "Color":
        case "Coordinate":
        case "Normal":
        case "TextureCoordinate":
          return node.fields[0].values;
        case "WorldInfo": {
          const result: { title?: unknown; info?: unknown } = {};
          for (const field of node.fields) {
            if (field.name === "title") result.title = field.values[0];
            else if (field.name === "info") result.info = field.values;
            else unknownField(field.name);
          }
          return result;
        }
        case "PerspectiveCamera":
        case "OrthographicCamera":
          return camera(node);
        case "Billboard":
        case "Inline":
        case "LOD":
        case "Switch":
        case "AudioClip":
        case "DirectionalLight":
        case "PointLight":
        case "Script":
        case "Sound":
        case "SpotLight":
        case "CylinderSensor":
        case "PlaneSensor":
        case "ProximitySensor":
        case "SphereSensor":
        case "TimeSensor":
        case "TouchSensor":
        case "VisibilitySensor":
        case "Text":
        case "FontStyle":
        case "MovieTexture":
        case "ColorInterpolator":
        case "CoordinateInterpolator":
        case "NormalInterpolator":
        case "OrientationInterpolator":
        case "PositionInterpolator":
        case "ScalarInterpolator":
        case "Fog":
        case "NavigationInfo":
        case "Viewpoint":
          return undefined;
        default:
          console.warn("THREE.VRMLLoader: Unknown node:", node.name);
          return undefined;
      }
    };
    const grouping = (node: VRMLNode): Group => {
      const result = new Group();
      for (const field of node.fields) {
        const v = field.values as number[];
        switch (field.name) {
          case "children":
            for (const value of field.values) {
              const object = child(value);
              if (object instanceof Object3D) result.add(object);
            }
            break;
          case "translation":
            result.position.set(v[0], v[1], v[2]);
            break;
          case "scale":
            result.scale.set(v[0], v[1], v[2]);
            break;
          case "rotation":
            result.quaternion.setFromAxisAngle(new Vector3(v[0], v[1], v[2]).normalize(), v[3]);
            break;
          case "bboxCenter":
          case "bboxSize":
          case "center":
          case "description":
          case "collide":
          case "parameter":
          case "scaleOrientation":
          case "proxy":
          case "url":
            break;
          default:
            unknownField(field.name);
        }
      }
      return result;
    };
    const background = (node: VRMLNode): Group => {
      const group = new Group();
      let groundAngle: number[] | undefined,
        groundColor: number[] | undefined,
        skyAngle: number[] | undefined,
        skyColor: number[] | undefined;
      for (const field of node.fields) {
        const v = field.values as number[];
        switch (field.name) {
          case "groundAngle":
            groundAngle = v;
            break;
          case "groundColor":
            groundColor = v;
            break;
          case "skyAngle":
            skyAngle = v;
            break;
          case "skyColor":
            skyColor = v;
            break;
          case "backUrl":
          case "bottomUrl":
          case "frontUrl":
          case "leftUrl":
          case "rightUrl":
          case "topUrl":
            break;
          default:
            unknownField(field.name);
        }
      }
      const radius = 10000;
      if (skyColor) {
        const geometry = new SphereGeometry(radius, 32, 16);
        const mat = new MeshBasicMaterial({ fog: false, side: Side.Back, depthWrite: false, depthTest: false });
        if (skyColor.length > 3) {
          paintFaces(geometry, radius, skyAngle as number[], toColorArray(skyColor), true);
          mat.vertexColors = true;
        } else mat.color.setRGB(skyColor[0], skyColor[1], skyColor[2], ColorSpace.SRGB);
        group.add(new Mesh(geometry, mat));
      }
      if (groundColor && groundColor.length > 0) {
        const geometry = new SphereGeometry(radius, 32, 16, 0, 2 * Math.PI, 0.5 * Math.PI, 1.5 * Math.PI);
        const mat = new MeshBasicMaterial({
          fog: false,
          side: Side.Back,
          vertexColors: true,
          depthWrite: false,
          depthTest: false,
        });
        paintFaces(geometry, radius, groundAngle as number[], toColorArray(groundColor), false);
        group.add(new Mesh(geometry, mat));
      }
      group.renderOrder = -Infinity;
      return group;
    };
    const shape = (node: VRMLNode): Object3D => {
      let mat: SceneMaterial = new MeshBasicMaterial({ name: Loader.DEFAULT_MATERIAL_NAME, color: 0 });
      let geometry: VRMLGeometry | undefined;
      for (const field of node.fields) {
        if (field.name === "appearance") {
          if (field.values[0] !== null) mat = child(field.values[0]) as SceneMaterial;
        } else if (field.name === "geometry") {
          if (field.values[0] !== null) geometry = child(field.values[0]) as VRMLGeometry;
        } else unknownField(field.name);
      }
      if (!geometry || !geometry.attributes.position) {
        const object = new Object3D();
        object.visible = false;
        return object;
      }
      if (geometry._type === "points" || geometry._type === "line") {
        const params = {
          name: Loader.DEFAULT_MATERIAL_NAME,
          color: 0xffffff,
          opacity: mat.opacity,
          transparent: mat.transparent,
        };
        const lineMat = geometry._type === "points" ? new PointsMaterial(params) : new LineBasicMaterial(params);
        if (geometry.attributes.color !== undefined) lineMat.vertexColors = true;
        else if (mat instanceof MeshPhongMaterial) lineMat.color.copy(mat.emissive);
        return geometry._type === "points"
          ? new Points(geometry, lineMat as PointsMaterial)
          : new LineSegments(geometry, lineMat as LineBasicMaterial);
      }
      if (geometry._solid !== undefined) mat.side = geometry._solid ? Side.Front : Side.Double;
      if (geometry.attributes.color !== undefined) mat.vertexColors = true;
      return new Mesh(geometry, mat);
    };
    const appearance = (node: VRMLNode): SceneMaterial => {
      let mat: SceneMaterial = new MeshPhongMaterial();
      let transform: TransformData | undefined;
      for (const field of node.fields) {
        const value = field.values[0];
        switch (field.name) {
          case "material":
            if (value !== null) {
              const m = child(value) as MaterialData;
              if (m.diffuseColor) mat.color.copy(m.diffuseColor);
              if (m.emissiveColor) (mat as MeshPhongMaterial).emissive.copy(m.emissiveColor);
              if (m.shininess) (mat as MeshPhongMaterial).shininess = m.shininess;
              if (m.specularColor) (mat as MeshPhongMaterial).specular.copy(m.specularColor);
              if (m.transparency) mat.opacity = 1 - m.transparency;
              if (m.transparency && m.transparency > 0) mat.transparent = true;
            } else mat = new MeshBasicMaterial({ name: Loader.DEFAULT_MATERIAL_NAME, color: 0 });
            break;
          case "texture":
            if (
              (value !== null && (value as VRMLNode).name === "ImageTexture") ||
              (value !== null && (value as VRMLNode).name === "PixelTexture")
            )
              mat.map = child(value) as Texture;
            break;
          case "textureTransform":
            if (value !== null) transform = child(value) as TransformData;
            break;
          default:
            unknownField(field.name);
        }
      }
      if (mat.map) {
        const map = mat.map as PixelTexture;
        if (map.__type) {
          if (map.__type === 2 || map.__type === 4) mat.opacity = 1;
          if (map.__type === 3 || map.__type === 4) mat.color.set(0xffffff);
          delete map.__type;
        }
        if (transform) {
          mat.map.center.copy(transform.center);
          Reflect.set(mat.map, "rotation", transform.rotation);
          mat.map.repeat.copy(transform.scale);
          mat.map.offset.copy(transform.translation);
        }
      }
      return mat;
    };
    const material = (node: VRMLNode): MaterialData => {
      const result: MaterialData = {};
      for (const field of node.fields) {
        const v = field.values as number[];
        switch (field.name) {
          case "ambientIntensity":
            break;
          case "diffuseColor":
            result.diffuseColor = new Color().setRGB(v[0], v[1], v[2], ColorSpace.SRGB);
            break;
          case "emissiveColor":
            result.emissiveColor = new Color().setRGB(v[0], v[1], v[2], ColorSpace.SRGB);
            break;
          case "specularColor":
            result.specularColor = new Color().setRGB(v[0], v[1], v[2], ColorSpace.SRGB);
            break;
          case "shininess":
            result.shininess = v[0];
            break;
          case "transparency":
            result.transparency = v[0];
            break;
          default:
            unknownField(field.name);
        }
      }
      return result;
    };
    const imageTexture = (node: VRMLNode): Texture | undefined => {
      let texture: Texture | undefined,
        wrapS: Wrapping = Wrapping.Repeat,
        wrapT: Wrapping = Wrapping.Repeat;
      for (const field of node.fields) {
        switch (field.name) {
          case "url":
            if (field.values[0]) texture = textureLoader.load(field.values[0] as string);
            break;
          case "repeatS":
            if (field.values[0] === false) wrapS = Wrapping.ClampToEdge;
            break;
          case "repeatT":
            if (field.values[0] === false) wrapT = Wrapping.ClampToEdge;
            break;
          default:
            unknownField(field.name);
        }
      }
      if (texture) {
        texture.wrapS = wrapS;
        texture.wrapT = wrapT;
        texture.colorSpace = ColorSpace.SRGB;
      }
      return texture;
    };
    const pixelTexture = (node: VRMLNode): PixelTexture | undefined => {
      let texture: PixelTexture | undefined,
        wrapS: Wrapping = Wrapping.Repeat,
        wrapT: Wrapping = Wrapping.Repeat;
      for (const field of node.fields) {
        switch (field.name) {
          case "image": {
            const values = field.values;
            const width = values[0] as number,
              height = values[1] as number,
              type = values[2] as number;
            const bytes = new Uint8Array(4 * width * height);
            const color = { r: 0, g: 0, b: 0, a: 0 };
            for (let i = 3; i < values.length; i++) {
              const hex = values[i] as string;
              if (type === 1) {
                color.r = parseInt(hex);
                color.g = color.r;
                color.b = color.r;
                color.a = 1;
              } else if (type === 2) {
                color.r = parseInt("0x" + hex.substring(2, 4));
                color.g = color.r;
                color.b = color.r;
                color.a = parseInt("0x" + hex.substring(4, 6));
              } else if (type === 3 || type === 4) {
                color.r = parseInt("0x" + hex.substring(2, 4));
                color.g = parseInt("0x" + hex.substring(4, 6));
                color.b = parseInt("0x" + hex.substring(6, 8));
                color.a = type === 3 ? 1 : parseInt("0x" + hex.substring(8, 10));
              }
              const offset = (i - 3) * 4;
              bytes[offset] = color.r;
              bytes[offset + 1] = color.g;
              bytes[offset + 2] = color.b;
              bytes[offset + 3] = color.a;
            }
            texture = new DataTexture(bytes, width, height) as PixelTexture;
            texture.colorSpace = ColorSpace.SRGB;
            texture.needsUpdate = true;
            texture.__type = type >= 1 && type <= 4 ? type : undefined;
            break;
          }
          case "repeatS":
            if (field.values[0] === false) wrapS = Wrapping.ClampToEdge;
            break;
          case "repeatT":
            if (field.values[0] === false) wrapT = Wrapping.ClampToEdge;
            break;
          default:
            unknownField(field.name);
        }
      }
      if (texture) {
        texture.wrapS = wrapS;
        texture.wrapT = wrapT;
      }
      return texture;
    };
    const textureTransform = (node: VRMLNode): TransformData => {
      const result: TransformData = {
        center: new Vector2(),
        rotation: new Vector2(),
        scale: new Vector2(),
        translation: new Vector2(),
      };
      for (const field of node.fields) {
        const v = field.values as number[];
        switch (field.name) {
          case "center":
            result.center.set(v[0], v[1]);
            break;
          case "rotation":
            result.rotation = v[0];
            break;
          case "scale":
            result.scale.set(v[0], v[1]);
            break;
          case "translation":
            result.translation.set(v[0], v[1]);
            break;
          default:
            unknownField(field.name);
        }
      }
      return result;
    };
    const camera = (node: VRMLNode): PerspectiveCamera | OrthographicCamera => {
      const result = node.name === "PerspectiveCamera" ? new PerspectiveCamera() : new OrthographicCamera();
      const aspect =
        (typeof window !== "undefined" ? window.innerWidth : 1) /
        (typeof window !== "undefined" ? window.innerHeight : 1);
      for (const field of node.fields) {
        const v = field.values as number[];
        switch (field.name) {
          case "position":
            result.position.set(v[0], v[1], v[0]);
            break;
          case "orientation":
            result.quaternion.setFromAxisAngle(new Vector3(v[0], v[1], v[2]).normalize(), v[3]);
            break;
          case "focalDistance":
            result.userData.focalDistance = v[0];
            break;
          case "heightAngle":
            (result as PerspectiveCamera).fov = radToDeg(v[0]);
            (result as PerspectiveCamera).aspect = aspect;
            result.updateProjectionMatrix();
            break;
          case "height": {
            const h = v[0] / 2,
              w = h * aspect;
            const ortho = result as OrthographicCamera;
            ortho.left = -w;
            ortho.right = w;
            ortho.top = h;
            ortho.bottom = -h;
            result.updateProjectionMatrix();
            break;
          }
          default:
            unknownField(field.name);
        }
      }
      return result;
    };
    const scene = new Scene();
    for (const node of tree.nodes) {
      const object = getNode(node);
      if (object instanceof Object3D) scene.add(object);
      if (node.name === "WorldInfo") scene.userData.worldInfo = object;
    }
    return scene;
  }
}

function unknownField(name: string): void {
  console.warn("THREE.VRMLLoader: Unknown field:", name);
}
