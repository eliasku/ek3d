import { Line3 } from "../../math/Line3";
import { Plane } from "../../math/Plane";
import { Triangle } from "../../math/Triangle";
import { Vector3 } from "../../math/Vector3";
import { Ray } from "../../math/Ray";
import { Object3D } from "../../core/Object3D";
import { BufferGeometry } from "../../core/BufferGeometry";
import { GLBufferAttribute } from "../../core/GLBufferAttribute";

const Visible = 0;
const Deleted = 1;

const _v1 = new Vector3();
const _line3 = new Line3();
const _plane = new Plane();
const _closestPoint = new Vector3();
const _triangle = new Triangle();

export class ConvexHull {
  tolerance: number;
  faces: Face[];
  newFaces: Face[];
  assigned: VertexList;
  unassigned: VertexList;
  vertices: VertexNode[];

  constructor() {
    this.tolerance = -1;

    this.faces = []; // the generated faces of the convex hull
    this.newFaces = []; // this array holds the faces that are generated within a single iteration

    // the vertex lists work as follows:
    //
    // let 'a' and 'b' be 'Face' instances
    // let 'v' be points wrapped as instance of 'Vertex'
    //
    //     [v, v, ..., v, v, v, ...]
    //      ^             ^
    //      |             |
    //  a.outside     b.outside
    //
    this.assigned = new VertexList();
    this.unassigned = new VertexList();

    this.vertices = []; // vertices of the hull (internal representation of given geometry data)
  }

  setFromPoints(points: Vector3[]) {
    // The algorithm needs at least four points.

    if (points.length >= 4) {
      this.makeEmpty();

      for (let i = 0, l = points.length; i < l; i++) {
        this.vertices.push(new VertexNode(points[i]));
      }

      this._compute();
    }

    return this;
  }

  setFromObject(object: Object3D) {
    const points: Vector3[] = [];

    object.updateMatrixWorld(true);

    object.traverse(function (node) {
      const geometry = (node as Object3D & { geometry?: BufferGeometry }).geometry;

      if (geometry !== undefined) {
        const attribute = geometry.attributes.position;

        if (attribute !== undefined) {
          if (attribute instanceof GLBufferAttribute) {
            throw new Error("ConvexHull requires CPU-accessible position attributes");
          }
          for (let i = 0, l = attribute.count; i < l; i++) {
            const point = new Vector3();

            point.fromBufferAttribute(attribute, i).applyMatrix4(node.matrixWorld);

            points.push(point);
          }
        }
      }
    });

    return this.setFromPoints(points);
  }

  containsPoint(point: Vector3) {
    const faces = this.faces;

    for (let i = 0, l = faces.length; i < l; i++) {
      const face = faces[i];

      // compute signed distance and check on what half space the point lies

      if (face.distanceToPoint(point) > this.tolerance) return false;
    }

    return true;
  }

  intersectRay(ray: Ray, target: Vector3) {
    // based on "Fast Ray-Convex Polyhedron Intersection" by Eric Haines, GRAPHICS GEMS II

    const faces = this.faces;

    let tNear = -Infinity;
    let tFar = Infinity;

    for (let i = 0, l = faces.length; i < l; i++) {
      const face = faces[i];

      // interpret faces as planes for the further computation

      const vN = face.distanceToPoint(ray.origin);
      const vD = face.normal.dot(ray.direction);

      // if the origin is on the positive side of a plane (so the plane can "see" the origin) and
      // the ray is turned away or parallel to the plane, there is no intersection

      if (vN > 0 && vD >= 0) return null;

      // compute the distance from the ray’s origin to the intersection with the plane

      const t = vD !== 0 ? -vN / vD : 0;

      // only proceed if the distance is positive. a negative distance means the intersection point
      // lies "behind" the origin

      if (t <= 0) continue;

      // now categorized plane as front-facing or back-facing

      if (vD > 0) {
        // plane faces away from the ray, so this plane is a back-face

        tFar = Math.min(t, tFar);
      } else {
        // front-face

        tNear = Math.max(t, tNear);
      }

      if (tNear > tFar) {
        // if tNear ever is greater than tFar, the ray must miss the convex hull

        return null;
      }
    }

    // evaluate intersection point

    // always try tNear first since its the closer intersection point

    if (tNear !== -Infinity) {
      ray.at(tNear, target);
    } else {
      ray.at(tFar, target);
    }

    return target;
  }

  intersectsRay(ray: Ray) {
    return this.intersectRay(ray, _v1) !== null;
  }

  makeEmpty() {
    this.faces = [];
    this.vertices = [];

    return this;
  }

  // private

  _addVertexToFace(vertex: VertexNode, face: Face) {
    vertex.face = face;

    if (face.outside === null) {
      this.assigned.append(vertex);
    } else {
      this.assigned.insertBefore(face.outside, vertex);
    }

    face.outside = vertex;

    return this;
  }

  _removeVertexFromFace(vertex: VertexNode, face: Face) {
    if (vertex === face.outside) {
      // fix face.outside link

      if (vertex.next !== null && vertex.next.face === face) {
        // face has at least 2 outside vertices, move the 'outside' reference

        face.outside = vertex.next;
      } else {
        // vertex was the only outside vertex that face had

        face.outside = null;
      }
    }

    this.assigned.remove(vertex);

    return this;
  }

  _removeAllVerticesFromFace(face: Face) {
    if (face.outside !== null) {
      // reference to the first and last vertex of this face

      const start = face.outside;
      let end = face.outside;

      while (end.next !== null && end.next.face === face) {
        end = end.next;
      }

      this.assigned.removeSubList(start, end);

      // fix references

      start.prev = end.next = null;
      face.outside = null;

      return start;
    }
  }

  _deleteFaceVertices(face: Face, absorbingFace?: Face) {
    const faceVertices = this._removeAllVerticesFromFace(face);

    if (faceVertices !== undefined) {
      if (absorbingFace === undefined) {
        // mark the vertices to be reassigned to some other face

        this.unassigned.appendChain(faceVertices);
      } else {
        // if there's an absorbing face try to assign as many vertices as possible to it

        let vertex: VertexNode | null = faceVertices;

        do {
          // we need to buffer the subsequent vertex at this point because the 'vertex.next' reference
          // will be changed by upcoming method calls

          const nextVertex: VertexNode | null = vertex.next;

          const distance = absorbingFace.distanceToPoint(vertex.point);

          // check if 'vertex' is able to see 'absorbingFace'

          if (distance > this.tolerance) {
            this._addVertexToFace(vertex, absorbingFace);
          } else {
            this.unassigned.append(vertex);
          }

          // now assign next vertex

          vertex = nextVertex;
        } while (vertex !== null);
      }
    }

    return this;
  }

  _resolveUnassignedPoints(newFaces: Face[]) {
    if (this.unassigned.isEmpty() === false) {
      let vertex: VertexNode | null = this.unassigned.first()!;

      do {
        // buffer 'next' reference, see ._deleteFaceVertices()

        const nextVertex: VertexNode | null = vertex.next;

        let maxDistance = this.tolerance;

        let maxFace = null;

        for (let i = 0; i < newFaces.length; i++) {
          const face = newFaces[i];

          if (face.mark === Visible) {
            const distance = face.distanceToPoint(vertex.point);

            if (distance > maxDistance) {
              maxDistance = distance;
              maxFace = face;
            }

            if (maxDistance > 1000 * this.tolerance) break;
          }
        }

        // 'maxFace' can be null e.g. if there are identical vertices

        if (maxFace !== null) {
          this._addVertexToFace(vertex, maxFace);
        }

        vertex = nextVertex;
      } while (vertex !== null);
    }

    return this;
  }

  _computeExtremes() {
    const min = new Vector3();
    const max = new Vector3();

    const minVertices: VertexNode[] = [];
    const maxVertices: VertexNode[] = [];

    // initially assume that the first vertex is the min/max

    for (let i = 0; i < 3; i++) {
      minVertices[i] = maxVertices[i] = this.vertices[0];
    }

    min.copy(this.vertices[0].point);
    max.copy(this.vertices[0].point);

    // compute the min/max vertex on all six directions

    for (let i = 0, l = this.vertices.length; i < l; i++) {
      const vertex = this.vertices[i];
      const point = vertex.point;

      // update the min coordinates

      for (let j = 0; j < 3; j++) {
        if (point.getComponent(j) < min.getComponent(j)) {
          min.setComponent(j, point.getComponent(j));
          minVertices[j] = vertex;
        }
      }

      // update the max coordinates

      for (let j = 0; j < 3; j++) {
        if (point.getComponent(j) > max.getComponent(j)) {
          max.setComponent(j, point.getComponent(j));
          maxVertices[j] = vertex;
        }
      }
    }

    // use min/max vectors to compute an optimal epsilon

    this.tolerance =
      3 *
      Number.EPSILON *
      (Math.max(Math.abs(min.x), Math.abs(max.x)) +
        Math.max(Math.abs(min.y), Math.abs(max.y)) +
        Math.max(Math.abs(min.z), Math.abs(max.z)));

    return { min: minVertices, max: maxVertices };
  }

  _computeInitialHull() {
    const vertices = this.vertices;
    const extremes = this._computeExtremes();
    const min = extremes.min;
    const max = extremes.max;

    // 1. Find the two vertices 'v0' and 'v1' with the greatest 1d separation
    // (max.x - min.x)
    // (max.y - min.y)
    // (max.z - min.z)

    let maxDistance = 0;
    let index = 0;

    for (let i = 0; i < 3; i++) {
      const distance = max[i].point.getComponent(i) - min[i].point.getComponent(i);

      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }

    const v0 = min[index];
    const v1 = max[index];
    let v2!: VertexNode;
    let v3!: VertexNode;

    // 2. The next vertex 'v2' is the one farthest to the line formed by 'v0' and 'v1'

    maxDistance = 0;
    _line3.set(v0.point, v1.point);

    for (let i = 0, l = this.vertices.length; i < l; i++) {
      const vertex = vertices[i];

      if (vertex !== v0 && vertex !== v1) {
        _line3.closestPointToPoint(vertex.point, true, _closestPoint);

        const distance = _closestPoint.distanceToSquared(vertex.point);

        if (distance > maxDistance) {
          maxDistance = distance;
          v2 = vertex;
        }
      }
    }

    // 3. The next vertex 'v3' is the one farthest to the plane 'v0', 'v1', 'v2'

    maxDistance = -1;
    _plane.setFromCoplanarPoints(v0.point, v1.point, v2.point);

    for (let i = 0, l = this.vertices.length; i < l; i++) {
      const vertex = vertices[i];

      if (vertex !== v0 && vertex !== v1 && vertex !== v2) {
        const distance = Math.abs(_plane.distanceToPoint(vertex.point));

        if (distance > maxDistance) {
          maxDistance = distance;
          v3 = vertex;
        }
      }
    }

    const faces: Face[] = [];

    if (_plane.distanceToPoint(v3.point) < 0) {
      // the face is not able to see the point so 'plane.normal' is pointing outside the tetrahedron

      faces.push(Face.create(v0, v1, v2), Face.create(v3, v1, v0), Face.create(v3, v2, v1), Face.create(v3, v0, v2));

      // set the twin edge

      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3;

        // join face[ i ] i > 0, with the first face

        faces[i + 1].getEdge(2).setTwin(faces[0].getEdge(j));

        // join face[ i ] with face[ i + 1 ], 1 <= i <= 3

        faces[i + 1].getEdge(1).setTwin(faces[j + 1].getEdge(0));
      }
    } else {
      // the face is able to see the point so 'plane.normal' is pointing inside the tetrahedron

      faces.push(Face.create(v0, v2, v1), Face.create(v3, v0, v1), Face.create(v3, v1, v2), Face.create(v3, v2, v0));

      // set the twin edge

      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3;

        // join face[ i ] i > 0, with the first face

        faces[i + 1].getEdge(2).setTwin(faces[0].getEdge((3 - i) % 3));

        // join face[ i ] with face[ i + 1 ]

        faces[i + 1].getEdge(0).setTwin(faces[j + 1].getEdge(1));
      }
    }

    // the initial hull is the tetrahedron

    for (let i = 0; i < 4; i++) {
      this.faces.push(faces[i]);
    }

    // initial assignment of vertices to the faces of the tetrahedron

    for (let i = 0, l = vertices.length; i < l; i++) {
      const vertex = vertices[i];

      if (vertex !== v0 && vertex !== v1 && vertex !== v2 && vertex !== v3) {
        maxDistance = this.tolerance;
        let maxFace = null;

        for (let j = 0; j < 4; j++) {
          const distance = this.faces[j].distanceToPoint(vertex.point);

          if (distance > maxDistance) {
            maxDistance = distance;
            maxFace = this.faces[j];
          }
        }

        if (maxFace !== null) {
          this._addVertexToFace(vertex, maxFace);
        }
      }
    }

    return this;
  }

  _reindexFaces() {
    const activeFaces: Face[] = [];

    for (let i = 0; i < this.faces.length; i++) {
      const face = this.faces[i];

      if (face.mark === Visible) {
        activeFaces.push(face);
      }
    }

    this.faces = activeFaces;

    return this;
  }

  _nextVertexToAdd() {
    // if the 'assigned' list of vertices is empty, no vertices are left. return with 'undefined'

    if (this.assigned.isEmpty() === false) {
      let eyeVertex,
        maxDistance = 0;

      // grab the first available face and start with the first visible vertex of that face

      const eyeFace = this.assigned.first()!.face;
      let vertex: VertexNode | null = eyeFace.outside!;

      // now calculate the farthest vertex that face can see

      do {
        const distance = eyeFace.distanceToPoint(vertex.point);

        if (distance > maxDistance) {
          maxDistance = distance;
          eyeVertex = vertex;
        }

        vertex = vertex.next;
      } while (vertex !== null && vertex.face === eyeFace);

      return eyeVertex;
    }
  }

  _computeHorizon(eyePoint: Vector3, crossEdge: HalfEdge | null, face: Face, horizon: HalfEdge[]) {
    // moves face's vertices to the 'unassigned' vertex list

    this._deleteFaceVertices(face);

    face.mark = Deleted;

    let edge;

    if (crossEdge === null) {
      edge = crossEdge = face.getEdge(0);
    } else {
      // start from the next edge since 'crossEdge' was already analyzed
      // (actually 'crossEdge.twin' was the edge who called this method recursively)

      edge = crossEdge.next;
    }

    do {
      const twinEdge = edge.twin;
      const oppositeFace = twinEdge.face;

      if (oppositeFace.mark === Visible) {
        if (oppositeFace.distanceToPoint(eyePoint) > this.tolerance) {
          // the opposite face can see the vertex, so proceed with next edge

          this._computeHorizon(eyePoint, twinEdge, oppositeFace, horizon);
        } else {
          // the opposite face can't see the vertex, so this edge is part of the horizon

          horizon.push(edge);
        }
      }

      edge = edge.next;
    } while (edge !== crossEdge);

    return this;
  }

  _addAdjoiningFace(eyeVertex: VertexNode, horizonEdge: HalfEdge) {
    // all the half edges are created in ccw order thus the face is always pointing outside the hull

    const face = Face.create(eyeVertex, horizonEdge.tail()!, horizonEdge.head());

    this.faces.push(face);

    // join face.getEdge( - 1 ) with the horizon's opposite edge face.getEdge( - 1 ) = face.getEdge( 2 )

    face.getEdge(-1).setTwin(horizonEdge.twin);

    return face.getEdge(0); // the half edge whose vertex is the eyeVertex
  }

  _addNewFaces(eyeVertex: VertexNode, horizon: HalfEdge[]) {
    this.newFaces = [];

    let firstSideEdge = null;
    let previousSideEdge = null;

    for (let i = 0; i < horizon.length; i++) {
      const horizonEdge = horizon[i];

      // returns the right side edge

      const sideEdge = this._addAdjoiningFace(eyeVertex, horizonEdge);

      if (firstSideEdge === null) {
        firstSideEdge = sideEdge;
      } else {
        // joins face.getEdge( 1 ) with previousFace.getEdge( 0 )

        sideEdge.next.setTwin(previousSideEdge!);
      }

      this.newFaces.push(sideEdge.face);
      previousSideEdge = sideEdge;
    }

    // perform final join of new faces

    firstSideEdge!.next.setTwin(previousSideEdge!);

    return this;
  }

  _addVertexToHull(eyeVertex: VertexNode) {
    const horizon: HalfEdge[] = [];

    this.unassigned.clear();

    // remove 'eyeVertex' from 'eyeVertex.face' so that it can't be added to the 'unassigned' vertex list

    this._removeVertexFromFace(eyeVertex, eyeVertex.face);

    this._computeHorizon(eyeVertex.point, null, eyeVertex.face, horizon);

    this._addNewFaces(eyeVertex, horizon);

    // reassign 'unassigned' vertices to the new faces

    this._resolveUnassignedPoints(this.newFaces);

    return this;
  }

  _cleanup() {
    this.assigned.clear();
    this.unassigned.clear();
    this.newFaces = [];

    return this;
  }

  _compute() {
    let vertex;

    this._computeInitialHull();

    // add all available vertices gradually to the hull

    while ((vertex = this._nextVertexToAdd()) !== undefined) {
      this._addVertexToHull(vertex);
    }

    this._reindexFaces();

    this._cleanup();

    return this;
  }
}

export class Face {
  normal: Vector3;
  midpoint: Vector3;
  area: number;
  constant: number;
  outside: VertexNode | null;
  mark: number;
  edge: HalfEdge;

  constructor() {
    this.normal = new Vector3();

    this.midpoint = new Vector3();

    this.area = 0;

    this.constant = 0;

    this.outside = null; // reference to a vertex in a vertex list this face can see
    this.mark = Visible;

    this.edge = null!;
  }

  static create(a: VertexNode, b: VertexNode, c: VertexNode) {
    const face = new Face();

    const e0 = new HalfEdge(a, face);
    const e1 = new HalfEdge(b, face);
    const e2 = new HalfEdge(c, face);

    // join edges

    e0.next = e2.prev = e1;
    e1.next = e0.prev = e2;
    e2.next = e1.prev = e0;

    // main half edge reference

    face.edge = e0;

    return face.compute();
  }

  getEdge(i: number) {
    let edge = this.edge;

    while (i > 0) {
      edge = edge.next;
      i--;
    }

    while (i < 0) {
      edge = edge.prev;
      i++;
    }

    return edge;
  }

  compute() {
    const a = this.edge.tail();
    const b = this.edge.head();
    const c = this.edge.next.head();

    _triangle.set(a!.point, b.point, c.point);

    _triangle.getNormal(this.normal);
    _triangle.getMidpoint(this.midpoint);
    this.area = _triangle.getArea();

    this.constant = this.normal.dot(this.midpoint);

    return this;
  }

  distanceToPoint(point: Vector3) {
    return this.normal.dot(point) - this.constant;
  }
}

export class HalfEdge {
  vertex: VertexNode;
  prev: HalfEdge;
  next: HalfEdge;
  twin: HalfEdge;
  face: Face;

  constructor(vertex: VertexNode, face: Face) {
    this.vertex = vertex;

    this.prev = null!;

    this.next = null!;

    this.twin = null!;

    this.face = face;
  }

  head() {
    return this.vertex;
  }

  tail() {
    return this.prev ? this.prev.vertex : null;
  }

  length() {
    const head = this.head();
    const tail = this.tail();

    if (tail !== null) {
      return tail.point.distanceTo(head.point);
    }

    return -1;
  }

  lengthSquared() {
    const head = this.head();
    const tail = this.tail();

    if (tail !== null) {
      return tail.point.distanceToSquared(head.point);
    }

    return -1;
  }

  setTwin(edge: HalfEdge) {
    this.twin = edge;
    edge.twin = this;

    return this;
  }
}

export class VertexNode {
  point: Vector3;
  prev: VertexNode | null;
  next: VertexNode | null;
  face: Face;

  constructor(point: Vector3) {
    this.point = point;

    this.prev = null!;

    this.next = null!;

    this.face = null!;
  }
}

export class VertexList {
  head: VertexNode | null;
  tail: VertexNode | null;

  constructor() {
    this.head = null;

    this.tail = null;
  }

  first() {
    return this.head;
  }

  last() {
    return this.tail;
  }

  clear() {
    this.head = this.tail = null;

    return this;
  }

  insertBefore(target: VertexNode, vertex: VertexNode) {
    vertex.prev = target.prev;
    vertex.next = target;

    if (vertex.prev === null) {
      this.head = vertex;
    } else {
      vertex.prev.next = vertex;
    }

    target.prev = vertex;

    return this;
  }

  insertAfter(target: VertexNode, vertex: VertexNode) {
    vertex.prev = target;
    vertex.next = target.next;

    if (vertex.next === null) {
      this.tail = vertex;
    } else {
      vertex.next.prev = vertex;
    }

    target.next = vertex;

    return this;
  }

  append(vertex: VertexNode) {
    if (this.head === null) {
      this.head = vertex;
    } else {
      this.tail!.next = vertex;
    }

    vertex.prev = this.tail;
    vertex.next = null; // the tail has no subsequent vertex

    this.tail = vertex;

    return this;
  }

  appendChain(vertex: VertexNode) {
    if (this.head === null) {
      this.head = vertex;
    } else {
      this.tail!.next = vertex;
    }

    vertex.prev = this.tail;

    // ensure that the 'tail' reference points to the last vertex of the chain

    while (vertex.next !== null) {
      vertex = vertex.next;
    }

    this.tail = vertex;

    return this;
  }

  remove(vertex: VertexNode) {
    if (vertex.prev === null) {
      this.head = vertex.next;
    } else {
      vertex.prev.next = vertex.next;
    }

    if (vertex.next === null) {
      this.tail = vertex.prev;
    } else {
      vertex.next.prev = vertex.prev;
    }

    return this;
  }

  removeSubList(a: VertexNode, b: VertexNode) {
    if (a.prev === null) {
      this.head = b.next;
    } else {
      a.prev.next = b.next;
    }

    if (b.next === null) {
      this.tail = a.prev;
    } else {
      b.next.prev = a.prev;
    }

    return this;
  }

  isEmpty() {
    return this.head === null;
  }
}
