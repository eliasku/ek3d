import { InstancedInterleavedBuffer } from "../../core/InstancedInterleavedBuffer";
import { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";
import { Vector3 } from "../../math/Vector3";
import { Vector4 } from "../../math/Vector4";
import { Mesh } from "../../objects/Mesh";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import { LineMaterial } from "./LineMaterial";
import { LineSegmentsGeometry } from "./LineSegmentsGeometry";

const start = new Vector3();
const end = new Vector3();
const viewport = new Vector4();

export class Wireframe extends Mesh<LineMaterial> {
  isWireframe: boolean = true;

  constructor(geometry = new LineSegmentsGeometry(), material = new LineMaterial({ color: Math.random() * 0xffffff })) {
    super(geometry, material);
    this.type = "Wireframe";
  }

  computeLineDistances(): this {
    const geometry = this.geometry as LineSegmentsGeometry;
    const instanceStart = geometry.attributes.instanceStart as InterleavedBufferAttribute;
    const instanceEnd = geometry.attributes.instanceEnd as InterleavedBufferAttribute;
    const distances = new Float32Array(instanceStart.count * 2);
    for (let i = 0, j = 0; i < instanceStart.count; i++, j += 2) {
      start.fromBufferAttribute(instanceStart, i);
      end.fromBufferAttribute(instanceEnd, i);
      distances[j] = j === 0 ? 0 : distances[j - 1];
      distances[j + 1] = distances[j] + start.distanceTo(end);
    }
    const data = new InstancedInterleavedBuffer(distances, 2, 1);
    geometry.setAttribute("instanceDistanceStart", new InterleavedBufferAttribute(data, 1, 0));
    geometry.setAttribute("instanceDistanceEnd", new InterleavedBufferAttribute(data, 1, 1));
    return this;
  }

  onBeforeRender(renderer: WebGLRenderer): void {
    renderer.getViewport(viewport);
    this.material.resolution.set(viewport.z, viewport.w);
  }
}
