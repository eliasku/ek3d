export function WebGLProperties() {
  let properties = new WeakMap<any, any>();
  function has(object?: any) {
    return properties.has(object);
  }
  function get(object?: any) {
    let map = properties.get(object);
    if (map === undefined) {
      map = {};
      properties.set(object, map);
    }
    return map;
  }
  function remove(object?: any) {
    properties.delete(object);
  }
  function update(object?: any, key?: any, value?: any) {
    properties.get(object)[key] = value;
  }
  function dispose() {
    properties = new WeakMap();
  }
  return {
    has: has,
    get: get,
    remove: remove,
    update: update,
    dispose: dispose,
  };
}
