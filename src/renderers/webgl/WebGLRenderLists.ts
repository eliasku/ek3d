function painterSortStable(a?: any, b?: any) {
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
function reversePainterSortStable(a?: any, b?: any) {
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
export function WebGLRenderList() {
  const renderItems: any[] = [];
  let renderItemsIndex = 0;
  const opaque: any[] = [];
  const transmissive: any[] = [];
  const transparent: any[] = [];
  function init() {
    renderItemsIndex = 0;
    opaque.length = 0;
    transmissive.length = 0;
    transparent.length = 0;
  }
  function materialVariant(object?: any) {
    let variant = 0;
    if (object.isInstancedMesh) variant += 2;
    if (object.isSkinnedMesh) variant += 1;
    return variant;
  }
  function getNextRenderItem(object?: any, geometry?: any, material?: any, groupOrder?: any, z?: any, group?: any) {
    let renderItem = renderItems[renderItemsIndex];
    if (renderItem === undefined) {
      renderItem = {
        id: object.id,
        object: object,
        geometry: geometry,
        material: material,
        materialVariant: materialVariant(object),
        groupOrder: groupOrder,
        renderOrder: object.renderOrder,
        z: z,
        group: group,
      };
      renderItems[renderItemsIndex] = renderItem;
    } else {
      renderItem.id = object.id;
      renderItem.object = object;
      renderItem.geometry = geometry;
      renderItem.material = material;
      renderItem.materialVariant = materialVariant(object);
      renderItem.groupOrder = groupOrder;
      renderItem.renderOrder = object.renderOrder;
      renderItem.z = z;
      renderItem.group = group;
    }
    renderItemsIndex++;
    return renderItem;
  }
  function push(object?: any, geometry?: any, material?: any, groupOrder?: any, z?: any, group?: any, camera?: any) {
    // with a reversed depth buffer the projected z is inverted
    if (camera.reversedDepth === true) z = -z;
    const renderItem = getNextRenderItem(object, geometry, material, groupOrder, z, group);
    if (material.transmission > 0.0) {
      transmissive.push(renderItem);
    } else if (material.transparent === true) {
      transparent.push(renderItem);
    } else {
      opaque.push(renderItem);
    }
  }
  function unshift(object?: any, geometry?: any, material?: any, groupOrder?: any, z?: any, group?: any) {
    const renderItem = getNextRenderItem(object, geometry, material, groupOrder, z, group);
    if (material.transmission > 0.0) {
      transmissive.unshift(renderItem);
    } else if (material.transparent === true) {
      transparent.unshift(renderItem);
    } else {
      opaque.unshift(renderItem);
    }
  }
  function sort(customOpaqueSort?: any, customTransparentSort?: any) {
    if (opaque.length > 1) opaque.sort(customOpaqueSort || painterSortStable);
    if (transmissive.length > 1) transmissive.sort(customTransparentSort || reversePainterSortStable);
    if (transparent.length > 1) transparent.sort(customTransparentSort || reversePainterSortStable);
  }
  function finish() {
    // Clear references from inactive renderItems in the list
    for (let i = renderItemsIndex, il = renderItems.length; i < il; i++) {
      const renderItem = renderItems[i];
      if (renderItem.id === null) break;
      renderItem.id = null;
      renderItem.object = null;
      renderItem.geometry = null;
      renderItem.material = null;
      renderItem.group = null;
    }
  }
  return {
    opaque: opaque,
    transmissive: transmissive,
    transparent: transparent,
    init: init,
    push: push,
    unshift: unshift,
    finish: finish,
    sort: sort,
  };
}
export function WebGLRenderLists() {
  let lists = new WeakMap<any, any>();
  function get(scene?: any, renderCallDepth?: any) {
    const listArray = lists.get(scene);
    let list: any;
    if (listArray === undefined) {
      list = new (WebGLRenderList as any)();
      lists.set(scene, [list]);
    } else {
      if (renderCallDepth >= listArray.length) {
        list = new (WebGLRenderList as any)();
        listArray.push(list);
      } else {
        list = listArray[renderCallDepth];
      }
    }
    return list;
  }
  function dispose() {
    lists = new WeakMap();
  }
  return {
    get: get,
    dispose: dispose,
  };
}
