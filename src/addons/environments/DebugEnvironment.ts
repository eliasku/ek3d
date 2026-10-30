import type { Material } from "../../materials/Material";
import { Side } from "../../constants";
import { BoxGeometry } from "../../geometries/BoxGeometry";
import { PointLight } from "../../lights/PointLight";
import { MeshLambertMaterial } from "../../materials/MeshLambertMaterial";
import { MeshStandardMaterial } from "../../materials/MeshStandardMaterial";
import { Mesh } from "../../objects/Mesh";
import { Scene } from "../../scenes/Scene";

/** Simple debug room for generating image-based lighting. */
export class DebugEnvironment extends Scene {
  constructor() {
    super();
    const geometry = new BoxGeometry();
    geometry.deleteAttribute("uv");
    const room = new Mesh(geometry, new MeshStandardMaterial({ metalness: 0, side: Side.Back }));
    room.scale.setScalar(10);
    this.add(room, new PointLight(0xffffff, 50, 0, 2));
    const light1 = new Mesh(
      geometry,
      new MeshLambertMaterial({ color: 0xff0000, emissive: 0xffffff, emissiveIntensity: 10 }),
    );
    light1.position.set(-5, 2, 0);
    light1.scale.set(0.1, 1, 1);
    const light2 = new Mesh(
      geometry,
      new MeshLambertMaterial({ color: 0x00ff00, emissive: 0xffffff, emissiveIntensity: 10 }),
    );
    light2.position.set(0, 5, 0);
    light2.scale.set(1, 0.1, 1);
    const light3 = new Mesh(
      geometry,
      new MeshLambertMaterial({ color: 0x0000ff, emissive: 0xffffff, emissiveIntensity: 10 }),
    );
    light3.position.set(2, 1, 5);
    light3.scale.set(1.5, 2, 0.1);
    this.add(light1, light2, light3);
  }

  dispose(): void {
    const resources = new Set<{ dispose(): void }>();
    this.traverse((object) => {
      if (object instanceof Mesh) {
        resources.add(object.geometry);
        const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) resources.add(material);
      }
      if (object instanceof PointLight) resources.add(object);
    });
    for (const resource of resources) resource.dispose();
  }
}
