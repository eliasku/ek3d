import type { Camera } from "../../cameras/Camera";
import type { BufferGeometry } from "../../core/BufferGeometry";
import type { Object3D } from "../../core/Object3D";
import type { Material, MaterialProperties } from "../../materials/Material";
import type { InstancedMesh } from "../../objects/InstancedMesh";
import type { SkinnedMesh } from "../../objects/SkinnedMesh";

export interface WebGLRenderItem {
  id: number;
  object: Object3D;
  geometry: BufferGeometry;
  material: Material;
  materialVariant: number;
  groupOrder: number;
  renderOrder: number;
  z: number;
  group: BufferGeometry["groups"][number] | null;
}

interface PooledRenderItem extends Omit<WebGLRenderItem, "id" | "object" | "geometry" | "material"> {
  id: number | null;
  object: Object3D | null;
  geometry: BufferGeometry | null;
  material: Material | null;
}

type RenderItemSort = (a: WebGLRenderItem, b: WebGLRenderItem) => number;

function painterSortStable(a: WebGLRenderItem, b: WebGLRenderItem) {
  if (a.groupOrder !== b.groupOrder) {
    return a.groupOrder - b.groupOrder;
  } else if (a.renderOrder !== b.renderOrder) {
    return a.renderOrder - b.renderOrder;
  } else if (a.material.id !== b.material.id) {
    return a.material.id - b.material.id;
  } else if (a.materialVariant !== b.materialVariant) {
    return a.materialVariant - b.materialVariant;
  } else if (a.z !== b.z) {
    return a.z - b.z;
  } else {
    return a.id - b.id;
  }
}
function reversePainterSortStable(a: WebGLRenderItem, b: WebGLRenderItem) {
  if (a.groupOrder !== b.groupOrder) {
    return a.groupOrder - b.groupOrder;
  } else if (a.renderOrder !== b.renderOrder) {
    return a.renderOrder - b.renderOrder;
  } else if (a.z !== b.z) {
    return b.z - a.z;
  } else {
    return a.id - b.id;
  }
}
export class WebGLRenderList {
  private readonly renderItems: PooledRenderItem[] = [];
  private renderItemsIndex: number = 0;
  private readonly opaqueItems: WebGLRenderList["opaque"] = [];
  private readonly transmissiveItems: WebGLRenderList["transmissive"] = [];
  private readonly transparentItems: WebGLRenderList["transparent"] = [];
  opaque: WebGLRenderItem[] = this.opaqueItems;
  transmissive: WebGLRenderItem[] = this.transmissiveItems;
  transparent: WebGLRenderItem[] = this.transparentItems;

  constructor() {
    this.init = this.init.bind(this);
    this.push = this.push.bind(this);
    this.unshift = this.unshift.bind(this);
    this.finish = this.finish.bind(this);
    this.sort = this.sort.bind(this);
  }

  init() {
    this.renderItemsIndex = 0;
    this.opaqueItems.length = 0;
    this.transmissiveItems.length = 0;
    this.transparentItems.length = 0;
  }

  private materialVariant(object: Object3D) {
    let variant = 0;
    if ((object as InstancedMesh).isInstancedMesh) variant += 2;
    if ((object as SkinnedMesh).isSkinnedMesh) variant += 1;
    return variant;
  }

  private getNextRenderItem(
    object: Object3D,
    geometry: BufferGeometry,
    material: Material,
    groupOrder: number,
    z: number,
    group: BufferGeometry["groups"][number] | null,
  ) {
    let renderItem = this.renderItems[this.renderItemsIndex];
    if (renderItem === undefined) {
      renderItem = {
        id: object.id,
        object: object,
        geometry: geometry,
        material: material,
        materialVariant: this.materialVariant(object),
        groupOrder: groupOrder,
        renderOrder: object.renderOrder,
        z: z,
        group: group,
      };
      this.renderItems[this.renderItemsIndex] = renderItem;
    } else {
      renderItem.id = object.id;
      renderItem.object = object;
      renderItem.geometry = geometry;
      renderItem.material = material;
      renderItem.materialVariant = this.materialVariant(object);
      renderItem.groupOrder = groupOrder;
      renderItem.renderOrder = object.renderOrder;
      renderItem.z = z;
      renderItem.group = group;
    }
    this.renderItemsIndex++;
    return renderItem as WebGLRenderItem;
  }

  push(
    object: Object3D,
    geometry: BufferGeometry,
    material: Material & MaterialProperties,
    groupOrder: number,
    z: number,
    group: BufferGeometry["groups"][number] | null,
    camera: Camera,
  ) {
    // with a reversed depth buffer the projected z is inverted
    if (camera.reversedDepth === true) z = -z;
    const renderItem = this.getNextRenderItem(object, geometry, material, groupOrder, z, group);
    if (material.transmission! > 0.0) {
      this.transmissiveItems.push(renderItem);
    } else if (material.transparent === true) {
      this.transparentItems.push(renderItem);
    } else {
      this.opaqueItems.push(renderItem);
    }
  }

  unshift(
    object: Object3D,
    geometry: BufferGeometry,
    material: Material & MaterialProperties,
    groupOrder: number,
    z: number,
    group: BufferGeometry["groups"][number] | null,
  ) {
    const renderItem = this.getNextRenderItem(object, geometry, material, groupOrder, z, group);
    if (material.transmission! > 0.0) {
      this.transmissiveItems.unshift(renderItem);
    } else if (material.transparent === true) {
      this.transparentItems.unshift(renderItem);
    } else {
      this.opaqueItems.unshift(renderItem);
    }
  }

  sort(customOpaqueSort?: RenderItemSort | null, customTransparentSort?: RenderItemSort | null) {
    if (this.opaqueItems.length > 1) this.opaqueItems.sort(customOpaqueSort || painterSortStable);
    if (this.transmissiveItems.length > 1)
      this.transmissiveItems.sort(customTransparentSort || reversePainterSortStable);
    if (this.transparentItems.length > 1) this.transparentItems.sort(customTransparentSort || reversePainterSortStable);
  }

  finish() {
    // Clear references from inactive renderItems in the list
    for (let i = this.renderItemsIndex, il = this.renderItems.length; i < il; i++) {
      const renderItem = this.renderItems[i];
      if (renderItem.id === null) break;
      renderItem.id = null;
      renderItem.object = null;
      renderItem.geometry = null;
      renderItem.material = null;
      renderItem.group = null;
    }
  }
}
export class WebGLRenderLists {
  private lists: WeakMap<object, WebGLRenderList[]> = new WeakMap();

  constructor() {
    this.get = this.get.bind(this);
    this.dispose = this.dispose.bind(this);
  }

  get(scene: object, renderCallDepth: number) {
    const listArray = this.lists.get(scene);
    let list: WebGLRenderList;
    if (listArray === undefined) {
      list = new WebGLRenderList();
      this.lists.set(scene, [list]);
    } else {
      if (renderCallDepth >= listArray.length) {
        list = new WebGLRenderList();
        listArray.push(list);
      } else {
        list = listArray[renderCallDepth];
      }
    }
    return list;
  }

  dispose() {
    this.lists = new WeakMap();
  }
}
