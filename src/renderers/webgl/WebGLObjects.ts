export function WebGLObjects(gl?: any, geometries?: any, attributes?: any, bindingStates?: any, info?: any) {
  let updateMap = new WeakMap<any, any>();
  const instancedMeshes = new Set<any>();
  function update(object?: any) {
    const frame = info.render.frame;
    const geometry = object.geometry;
    const buffergeometry = geometries.get(object, geometry);
    // Update once per frame
    if (updateMap.get(buffergeometry) !== frame) {
      geometries.update(buffergeometry);
      updateMap.set(buffergeometry, frame);
    }
    if (object.isInstancedMesh) {
      if (object.hasEventListener("dispose", onInstancedMeshDispose) === false) {
        object.addEventListener("dispose", onInstancedMeshDispose);
        instancedMeshes.add(object);
      }
      if (updateMap.get(object) !== frame) {
        attributes.update(object.instanceMatrix, gl.ARRAY_BUFFER);
        if (object.instanceColor !== null) {
          attributes.update(object.instanceColor, gl.ARRAY_BUFFER);
        }
        updateMap.set(object, frame);
      }
    }
    if (object.isSkinnedMesh) {
      const skeleton = object.skeleton;
      if (updateMap.get(skeleton) !== frame) {
        skeleton.update();
        updateMap.set(skeleton, frame);
      }
    }
    return buffergeometry;
  }
  function dispose() {
    for (const object of instancedMeshes) onInstancedMeshDispose.call(object);
    updateMap = new WeakMap();
  }
  function onInstancedMeshDispose(this: any) {
    instancedMeshes.delete(this);
    updateMap.delete(this);
    this.removeEventListener("dispose", onInstancedMeshDispose);
    bindingStates.releaseStatesOfObject(this);
    attributes.remove(this.instanceMatrix);
    if (this.instanceColor !== null) attributes.remove(this.instanceColor);
  }
  return {
    update: update,
    dispose: dispose,
  };
}
