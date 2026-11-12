export class WebGLProperties {
  private properties: WeakMap<object, Record<string, any>> = new WeakMap();

  constructor() {
    this.has = this.has.bind(this);
    this.get = this.get.bind(this);
    this.remove = this.remove.bind(this);
    this.update = this.update.bind(this);
    this.dispose = this.dispose.bind(this);
  }

  has(object: object): boolean {
    return this.properties.has(object);
  }

  get<T extends object = Record<string, any>>(object: object): T {
    let map = this.properties.get(object);
    if (map === undefined) {
      map = {};
      this.properties.set(object, map);
    }
    return map as T;
  }

  remove(object: object): void {
    this.properties.delete(object);
  }

  update(object: object, key: string, value: unknown): void {
    this.properties.get(object)![key] = value;
  }

  dispose(): void {
    this.properties = new WeakMap();
  }
}
