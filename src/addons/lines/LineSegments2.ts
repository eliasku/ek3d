import type { Camera } from "../../cameras/Camera";
import { OrthographicCamera } from "../../cameras/OrthographicCamera";
import { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import { InstancedInterleavedBuffer } from "../../core/InstancedInterleavedBuffer";
import { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";
import type { Intersection, Raycaster } from "../../core/Raycaster";
import { Box3 } from "../../math/Box3";
import { Line3 } from "../../math/Line3";
import { lerp } from "../../math/MathUtils";
import { Matrix4 } from "../../math/Matrix4";
import { Sphere } from "../../math/Sphere";
import { Vector3 } from "../../math/Vector3";
import { Vector4 } from "../../math/Vector4";
import { Mesh } from "../../objects/Mesh";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import { LineMaterial } from "./LineMaterial";
import { LineSegmentsGeometry } from "./LineSegmentsGeometry";

const start = new Vector3();
const end = new Vector3();
const start4 = new Vector4();
const end4 = new Vector4();
const origin4 = new Vector4();
const origin3 = new Vector3();
const modelView = new Matrix4();
const segment = new Line3();
const closest = new Vector3();
const box = new Box3();
const sphere = new Sphere();
const clipToWorld = new Vector4();
const viewport = new Vector4();

type ProjectionCamera = PerspectiveCamera | OrthographicCamera;

function halfWidth(camera: Camera, distance: number, width: number, resolution: { x: number; y: number }): number {
  clipToWorld.set(0, 0, -distance, 1).applyMatrix4(camera.projectionMatrix);
  clipToWorld.multiplyScalar(1 / clipToWorld.w);
  clipToWorld.x = width / resolution.x;
  clipToWorld.y = width / resolution.y;
  clipToWorld.applyMatrix4(camera.projectionMatrixInverse);
  clipToWorld.multiplyScalar(1 / clipToWorld.w);
  return Math.abs(Math.max(clipToWorld.x, clipToWorld.y));
}

export class LineSegments2 extends Mesh<LineMaterial> {
  isLineSegments2: boolean = true;

  constructor(geometry = new LineSegmentsGeometry(), material = new LineMaterial({ color: Math.random() * 0xffffff })) {
    super(geometry, material);
    this.type = "LineSegments2";
  }

  computeLineDistances(): this {
    const geometry = this.geometry as LineSegmentsGeometry;
    const instanceStart = geometry.attributes.instanceStart as InterleavedBufferAttribute;
    const instanceEnd = geometry.attributes.instanceEnd as InterleavedBufferAttribute;
    const distances = new Float32Array(2 * instanceStart.count);
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

  raycast(raycaster: Raycaster, intersects: Intersection[]): void {
    const material = this.material;
    const camera = raycaster.camera;
    const worldUnits = material.worldUnits;
    if (!worldUnits && !(camera instanceof PerspectiveCamera || camera instanceof OrthographicCamera)) {
      console.error(
        'LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.',
      );
      return;
    }
    if (!worldUnits && (material.resolution.x === 0 || material.resolution.y === 0)) return;
    const projectionCamera = camera as ProjectionCamera;
    const width = material.linewidth + (raycaster.params.Line2?.threshold || 0);
    const geometry = this.geometry as LineSegmentsGeometry;
    const ray = raycaster.ray;
    if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
    sphere.copy(geometry.boundingSphere!).applyMatrix4(this.matrixWorld);
    sphere.radius += worldUnits
      ? width * 0.5
      : halfWidth(
          projectionCamera,
          Math.max(projectionCamera.near, sphere.distanceToPoint(ray.origin)),
          width,
          material.resolution,
        );
    if (!ray.intersectsSphere(sphere)) return;
    if (geometry.boundingBox === null) geometry.computeBoundingBox();
    box.copy(geometry.boundingBox!).applyMatrix4(this.matrixWorld);
    box.expandByScalar(
      worldUnits
        ? width * 0.5
        : halfWidth(
            projectionCamera,
            Math.max(projectionCamera.near, box.distanceToPoint(ray.origin)),
            width,
            material.resolution,
          ),
    );
    if (!ray.intersectsBox(box)) return;

    const instanceStart = geometry.attributes.instanceStart as InterleavedBufferAttribute;
    const instanceEnd = geometry.attributes.instanceEnd as InterleavedBufferAttribute;
    const count = Math.min(geometry.instanceCount, instanceStart.count);
    if (!worldUnits) {
      ray.at(1, origin3);
      origin4
        .set(origin3.x, origin3.y, origin3.z, 1)
        .applyMatrix4(projectionCamera.matrixWorldInverse)
        .applyMatrix4(projectionCamera.projectionMatrix);
      origin4.multiplyScalar(1 / origin4.w);
      origin3.set((origin4.x * material.resolution.x) / 2, (origin4.y * material.resolution.y) / 2, 0);
      modelView.multiplyMatrices(projectionCamera.matrixWorldInverse, this.matrixWorld);
    }
    for (let i = 0; i < count; i++) {
      if (!worldUnits) {
        start4.fromBufferAttribute(instanceStart, i);
        start4.w = 1;
        end4.fromBufferAttribute(instanceEnd, i);
        end4.w = 1;
        start4.applyMatrix4(modelView);
        end4.applyMatrix4(modelView);
        const near = -projectionCamera.near;
        if (start4.z > near && end4.z > near) continue;
        if (start4.z > near) start4.lerp(end4, (start4.z - near) / (start4.z - end4.z));
        else if (end4.z > near) end4.lerp(start4, (end4.z - near) / (end4.z - start4.z));
        start4.applyMatrix4(projectionCamera.projectionMatrix);
        end4.applyMatrix4(projectionCamera.projectionMatrix);
        start4.multiplyScalar(1 / start4.w);
        end4.multiplyScalar(1 / end4.w);
        segment.start.set((start4.x * material.resolution.x) / 2, (start4.y * material.resolution.y) / 2, 0);
        segment.end.set((end4.x * material.resolution.x) / 2, (end4.y * material.resolution.y) / 2, 0);
        const t = segment.closestPointToPointParameter(origin3, true);
        segment.at(t, closest);
        const z = lerp(start4.z, end4.z, t);
        if (!(z >= -1 && z <= 1) || origin3.distanceTo(closest) >= width * 0.5) continue;
      }
      segment.start.fromBufferAttribute(instanceStart, i).applyMatrix4(this.matrixWorld);
      segment.end.fromBufferAttribute(instanceEnd, i).applyMatrix4(this.matrixWorld);
      const point = new Vector3();
      const pointOnLine = new Vector3();
      ray.distanceSqToSegment(segment.start, segment.end, point, pointOnLine);
      if (worldUnits && point.distanceTo(pointOnLine) >= width * 0.5) continue;
      intersects.push({
        point,
        pointOnLine,
        distance: ray.origin.distanceTo(point),
        object: this,
        face: null,
        faceIndex: i,
      });
    }
  }

  onBeforeRender(renderer: WebGLRenderer): void {
    renderer.getViewport(viewport);
    this.material.resolution.set(viewport.z, viewport.w);
  }
}
