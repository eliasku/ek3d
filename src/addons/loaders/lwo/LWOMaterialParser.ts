import type { TextureLoader } from "../../../loaders/TextureLoader";
import type { Texture } from "../../../textures/Texture";
import type { LWOAttributes, LWOForm, LWOSurface, LWOTree } from "./IFFParser";
import { Combine, Side, Wrapping, Mapping, ColorSpace } from "../../../constants";
import { Color } from "../../../math/Color";
import { Vector2 } from "../../../math/Vector2";
import { MeshPhongMaterial } from "../../../materials/MeshPhongMaterial";
import { MeshPhysicalMaterial } from "../../../materials/MeshPhysicalMaterial";
import { MeshStandardMaterial } from "../../../materials/MeshStandardMaterial";

type ScalarAttribute = LWOForm & { value: number };
type ColorAttribute = LWOForm & { value: number[] };
type MaterialAttributes = LWOAttributes & {
  Color?: ColorAttribute;
  "Luminous Color"?: ColorAttribute;
  Transparency?: ScalarAttribute;
  "Bump Height"?: ScalarAttribute;
  Clearcoat?: ScalarAttribute;
  "Clearcoat Gloss"?: ScalarAttribute;
  Luminous?: ScalarAttribute;
  Roughness?: ScalarAttribute;
  Metallic?: ScalarAttribute;
  "Refraction Index"?: ScalarAttribute;
  Diffuse?: ScalarAttribute;
  Reflection?: ScalarAttribute;
  Luminosity?: ScalarAttribute;
  Specular?: ScalarAttribute;
  "Color Highlight"?: ScalarAttribute;
  Glossiness?: ScalarAttribute;
};
type MaterialNode = LWOForm & {
  fileName?: string;
  widthWrappingMode?: number;
  heightWrappingMode?: number;
  amplitude?: number;
};
type ImageMap = LWOForm & { imageIndex: number; wrap?: { w: number; h: number } };
type MaterialParams = {
  name?: string;
  side?: Side;
  flatShading?: boolean;
  color?: Color;
  map?: Texture;
  aoMap?: Texture;
  roughnessMap?: Texture;
  roughness?: number;
  specularMap?: Texture;
  specular?: Color | number;
  emissiveMap?: Texture;
  emissive?: Color | number;
  emissiveIntensity?: number;
  metalnessMap?: Texture;
  metalness?: number;
  alphaMap?: Texture;
  transparent?: boolean;
  normalMap?: Texture;
  normalScale?: Vector2;
  bumpMap?: Texture;
  bumpScale?: number;
  envMap?: Texture;
  opacity?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  refractionRatio?: number;
  reflectivity?: number;
  combine?: Combine;
  shininess?: number;
};
type AttributeParams = MaterialParams & { color: Color };
type MaterialConnections = {
  maps: Record<string, MaterialNode>;
  attributes: MaterialAttributes;
  envMap?: string;
  name?: string;
};

export class LWOMaterialParser {
  constructor(
    private readonly tree: LWOTree,
    private readonly textureLoader: TextureLoader,
  ) {}

  parse(): (MeshPhongMaterial | MeshStandardMaterial | MeshPhysicalMaterial)[] {
    const materials: (MeshPhongMaterial | MeshStandardMaterial | MeshPhysicalMaterial)[] = [];
    for (const name in this.tree.materials) {
      if (this.tree.format === "LWO3") materials.push(this.parseMaterial(this.tree.materials[name], name));
      else if (this.tree.format === "LWO2") materials.push(this.parseMaterialLwo2(this.tree.materials[name], name));
    }
    return materials;
  }

  private parseMaterial(materialData: LWOSurface, name: string) {
    let params: MaterialParams = {
      name,
      side: this.getSide(materialData.attributes),
      flatShading: this.getSmooth(materialData.attributes),
    };
    const connections = this.parseConnections(materialData.connections, materialData.nodes);
    const maps = this.parseTextureNodes(connections.maps)!;
    this.parseAttributeImageMaps(connections.attributes, maps);
    const attributes = this.parseAttributes(connections.attributes, maps);
    this.parseEnvMap(connections, maps, attributes);
    params = Object.assign(maps, params);
    params = Object.assign(params, attributes);
    const materialType = this.getMaterialType(connections.attributes);
    if (materialType !== MeshPhongMaterial) delete params.refractionRatio;
    return new materialType(params);
  }

  private parseMaterialLwo2(materialData: LWOSurface, name: string) {
    let params: MaterialParams = {
      name,
      side: this.getSide(materialData.attributes),
      flatShading: this.getSmooth(materialData.attributes),
    };
    const attributes = this.parseAttributes(materialData.attributes as MaterialAttributes, {});
    params = Object.assign(params, attributes);
    return new MeshPhongMaterial(params);
  }

  // The handedness conversion switches front and back faces.
  private getSide(attributes: LWOAttributes): Side | undefined {
    if (!attributes.side) return Side.Back;
    switch (attributes.side) {
      case 0:
      case 1:
        return Side.Back;
      case 2:
        return Side.Front;
      case 3:
        return Side.Double;
    }
  }

  private getSmooth(attributes: LWOAttributes): boolean {
    if (!attributes.smooth) return true;
    return !attributes.smooth;
  }

  private parseConnections(connections: LWOForm, nodes: Record<string, LWOForm>): MaterialConnections {
    const result = { maps: {} } as MaterialConnections;
    const inputName = connections.inputName as string[];
    const inputNodeName = connections.inputNodeName!;
    const nodeName = connections.nodeName!;
    inputName.forEach((name, index) => {
      if (name === "Material") {
        const node = this.getNodeByRefName(inputNodeName[index], nodes)!;
        result.attributes = node.attributes as MaterialAttributes;
        result.envMap = node.fileName;
        result.name = inputNodeName[index];
      }
    });
    nodeName.forEach((name, index) => {
      if (name === result.name) result.maps[inputName[index]] = this.getNodeByRefName(inputNodeName[index], nodes)!;
    });
    return result;
  }

  private getNodeByRefName(refName: string, nodes: Record<string, LWOForm>): MaterialNode | undefined {
    for (const name in nodes) {
      if (nodes[name].refName === refName) return nodes[name] as MaterialNode;
    }
  }

  private parseTextureNodes(textureNodes: Record<string, MaterialNode>): MaterialParams | undefined {
    const maps: MaterialParams = {};
    for (const name in textureNodes) {
      const node = textureNodes[name];
      const path = node.fileName;
      if (!path) return;
      const texture = this.loadTexture(path);
      if (node.widthWrappingMode !== undefined) texture.wrapS = this.getWrappingType(node.widthWrappingMode)!;
      if (node.heightWrappingMode !== undefined) texture.wrapT = this.getWrappingType(node.heightWrappingMode)!;
      switch (name) {
        case "Color":
          maps.map = texture;
          texture.colorSpace = ColorSpace.SRGB;
          break;
        case "Roughness":
          maps.roughnessMap = texture;
          maps.roughness = 1;
          break;
        case "Specular":
          maps.specularMap = texture;
          texture.colorSpace = ColorSpace.SRGB;
          maps.specular = 0xffffff;
          break;
        case "Luminous":
          maps.emissiveMap = texture;
          texture.colorSpace = ColorSpace.SRGB;
          maps.emissive = 0x808080;
          break;
        case "Luminous Color":
          maps.emissive = 0x808080;
          break;
        case "Metallic":
          maps.metalnessMap = texture;
          maps.metalness = 1;
          break;
        case "Transparency":
        case "Alpha":
          maps.alphaMap = texture;
          maps.transparent = true;
          break;
        case "Normal":
          maps.normalMap = texture;
          if (node.amplitude !== undefined) maps.normalScale = new Vector2(node.amplitude, node.amplitude);
          break;
        case "Bump":
          maps.bumpMap = texture;
          break;
      }
    }
    if (maps.roughnessMap && maps.specularMap) delete maps.specularMap;
    return maps;
  }

  private parseAttributeImageMaps(attributes: MaterialAttributes, maps: MaterialParams): void {
    for (const name in attributes) {
      const attribute = attributes[name] as LWOForm;
      if (attribute.maps) {
        const mapData = attribute.maps[0] as ImageMap;
        const path = this.getTexturePathByIndex(mapData.imageIndex);
        if (!path) return;
        const texture = this.loadTexture(path);
        if (mapData.wrap !== undefined) texture.wrapS = this.getWrappingType(mapData.wrap.w)!;
        if (mapData.wrap !== undefined) texture.wrapT = this.getWrappingType(mapData.wrap.h)!;
        switch (name) {
          case "Color":
            maps.map = texture;
            texture.colorSpace = ColorSpace.SRGB;
            break;
          case "Diffuse":
            maps.aoMap = texture;
            break;
          case "Roughness":
            maps.roughnessMap = texture;
            maps.roughness = 1;
            break;
          case "Specular":
            maps.specularMap = texture;
            texture.colorSpace = ColorSpace.SRGB;
            maps.specular = 0xffffff;
            break;
          case "Luminosity":
            maps.emissiveMap = texture;
            texture.colorSpace = ColorSpace.SRGB;
            maps.emissive = 0x808080;
            break;
          case "Metallic":
            maps.metalnessMap = texture;
            maps.metalness = 1;
            break;
          case "Transparency":
          case "Alpha":
            maps.alphaMap = texture;
            maps.transparent = true;
            break;
          case "Normal":
            maps.normalMap = texture;
            break;
          case "Bump":
            maps.bumpMap = texture;
            break;
        }
      }
    }
  }

  private parseAttributes(attributes: MaterialAttributes, maps: MaterialParams): AttributeParams {
    const params: AttributeParams = {
      color: attributes.Color && !maps.map ? new Color().fromArray(attributes.Color.value) : new Color(),
    };
    if (attributes.Transparency && attributes.Transparency.value !== 0) {
      params.opacity = 1 - attributes.Transparency.value;
      params.transparent = true;
    }
    if (attributes["Bump Height"]) params.bumpScale = attributes["Bump Height"].value * 0.1;
    this.parsePhysicalAttributes(params, attributes);
    this.parseStandardAttributes(params, attributes, maps);
    this.parsePhongAttributes(params, attributes, maps);
    return params;
  }

  private parsePhysicalAttributes(params: AttributeParams, attributes: MaterialAttributes): void {
    if (attributes.Clearcoat && attributes.Clearcoat.value > 0) {
      params.clearcoat = attributes.Clearcoat.value;
      if (attributes["Clearcoat Gloss"]) params.clearcoatRoughness = 0.5 * (1 - attributes["Clearcoat Gloss"].value);
    }
  }

  private parseStandardAttributes(params: AttributeParams, attributes: MaterialAttributes, maps: MaterialParams): void {
    if (attributes.Luminous) {
      params.emissiveIntensity = attributes.Luminous.value;
      if (attributes["Luminous Color"] && !maps.emissive)
        params.emissive = new Color().fromArray(attributes["Luminous Color"].value);
      else params.emissive = new Color(0x808080);
    }
    if (attributes.Roughness && !maps.roughnessMap) params.roughness = attributes.Roughness.value;
    if (attributes.Metallic && !maps.metalnessMap) params.metalness = attributes.Metallic.value;
  }

  private parsePhongAttributes(params: AttributeParams, attributes: MaterialAttributes, maps: MaterialParams): void {
    if (attributes["Refraction Index"]) params.refractionRatio = 0.98 / attributes["Refraction Index"].value;
    if (attributes.Diffuse) params.color.multiplyScalar(attributes.Diffuse.value);
    if (attributes.Reflection) {
      params.reflectivity = attributes.Reflection.value;
      params.combine = Combine.Add;
    }
    if (attributes.Luminosity) {
      params.emissiveIntensity = attributes.Luminosity.value;
      if (!maps.emissiveMap && !maps.map) params.emissive = params.color;
      else params.emissive = new Color(0x808080);
    }
    if (!attributes.Roughness && attributes.Specular && !maps.specularMap) {
      if (attributes["Color Highlight"]) {
        params.specular = new Color()
          .setScalar(attributes.Specular.value)
          .lerp(params.color.clone().multiplyScalar(attributes.Specular.value), attributes["Color Highlight"].value);
      } else params.specular = new Color().setScalar(attributes.Specular.value);
    }
    if (params.specular && attributes.Glossiness)
      params.shininess = 7 + Math.pow(2, attributes.Glossiness.value * 12 + 2);
  }

  private parseEnvMap(connections: MaterialConnections, maps: MaterialParams, attributes: AttributeParams): void {
    if (connections.envMap) {
      const envMap = this.loadTexture(connections.envMap);
      if (attributes.transparent && attributes.opacity! < 0.999) {
        envMap.mapping = Mapping.EquirectangularRefraction;
        if (attributes.reflectivity !== undefined) {
          delete attributes.reflectivity;
          delete attributes.combine;
        }
        if (attributes.metalness !== undefined) attributes.metalness = 1;
        attributes.opacity = 1;
      } else envMap.mapping = Mapping.EquirectangularReflection;
      maps.envMap = envMap;
    }
  }

  private getTexturePathByIndex(index: number): string {
    let fileName = "";
    if (!this.tree.textures) return fileName;
    this.tree.textures.forEach((texture) => {
      if (texture.index === index) fileName = texture.fileName!;
    });
    return fileName;
  }

  private loadTexture(path: string): Texture {
    return this.textureLoader.load(path, undefined, undefined, () => {
      console.warn(
        "LWOLoader: non-standard resource hierarchy. Use `resourcePath` parameter to specify root content directory.",
      );
    });
  }

  private getWrappingType(num: number): Wrapping | undefined {
    switch (num) {
      case 0:
        console.warn('LWOLoader: "Reset" texture wrapping type is not supported in three.js');
        return Wrapping.ClampToEdge;
      case 1:
        return Wrapping.Repeat;
      case 2:
        return Wrapping.MirroredRepeat;
      case 3:
        return Wrapping.ClampToEdge;
    }
  }

  private getMaterialType(
    nodeData: MaterialAttributes,
  ): typeof MeshPhysicalMaterial | typeof MeshStandardMaterial | typeof MeshPhongMaterial {
    if (nodeData.Clearcoat && nodeData.Clearcoat.value > 0) return MeshPhysicalMaterial;
    if (nodeData.Roughness) return MeshStandardMaterial;
    return MeshPhongMaterial;
  }
}
