import { BufferGeometry } from "../../core/BufferGeometry";
import { Float32BufferAttribute } from "../../core/BufferAttribute";
import { Line } from "../../objects/Line";
import { LineBasicMaterial } from "../../materials/LineBasicMaterial";
import { Object3D } from "../../core/Object3D";
import { Points } from "../../objects/Points";
import { PointsMaterial } from "../../materials/PointsMaterial";
import type { AnimationClip } from "../../animation/AnimationClip";
import type { KeyframeTrack } from "../../animation/KeyframeTrack";
import type { Color } from "../../math/Color";

export class AnimationPathHelper extends Object3D {
  isAnimationPathHelper: boolean;
  root: Object3D;
  clip: AnimationClip;
  object: Object3D;
  divisions: number;
  _track: KeyframeTrack | null;
  line: Line<LineBasicMaterial> | null = null;
  points: Points | null = null;

  constructor(
    root: Object3D,
    clip: AnimationClip,
    object: Object3D,
    options: {
      color?: number | string | Color;
      markerColor?: number | string | Color;
      divisions?: number;
      showMarkers?: boolean;
      markerSize?: number;
    } = {},
  ) {
    super();

    const { color = 0x00ff00, markerColor = 0xff0000, divisions = 100, showMarkers = true, markerSize = 5 } = options;

    this.isAnimationPathHelper = true;

    this.type = "AnimationPathHelper";

    this.root = root;

    this.clip = clip;

    this.object = object;

    this.divisions = divisions;

    this._track = this._findTrackForObject(object);

    if (this._track === null) {
      console.warn("AnimationPathHelper: No position track found for object", object.name);
      return;
    }

    // Create line for path
    const lineGeometry = new BufferGeometry();
    const lineMaterial = new LineBasicMaterial({
      color: color,
      toneMapped: false,
    });

    this.line = new Line<LineBasicMaterial>(lineGeometry, lineMaterial);
    this.add(this.line);

    // Create points for keyframe markers
    if (showMarkers) {
      const pointsGeometry = new BufferGeometry();
      const pointsMaterial = new PointsMaterial({
        color: markerColor,
        size: markerSize,
        sizeAttenuation: false,
        toneMapped: false,
      });

      this.points = new Points(pointsGeometry, pointsMaterial);
      this.add(this.points);
    } else {
      this.points = null;
    }

    // Sync matrix with object's parent
    this.matrixAutoUpdate = false;

    this._updateGeometry();
  }

  _findTrackForObject(object: Object3D) {
    const targetName = object.uuid + ".position";

    for (const track of this.clip.tracks) {
      if (track.name === targetName && track.getValueSize() === 3) {
        return track;
      }
    }

    return null;
  }

  _sampleTrack() {
    const track = this._track!;
    const interpolant = track.createInterpolant();
    const duration = this.clip.duration;
    const positions: number[] = [];

    for (let i = 0; i <= this.divisions; i++) {
      const t = (i / this.divisions) * duration;
      const result = interpolant.evaluate(t) as Float32Array;
      positions.push(result[0], result[1], result[2]);
    }

    return new Float32Array(positions);
  }

  _updateGeometry() {
    if (this._track === null) return;

    // Update line geometry
    const sampledPositions = this._sampleTrack();
    this.line!.geometry.setAttribute("position", new Float32BufferAttribute(sampledPositions, 3));
    this.line!.geometry.computeBoundingSphere();

    // Update keyframe markers
    if (this.points !== null) {
      this.points.geometry.setAttribute(
        "position",
        new Float32BufferAttribute(new Float32Array(this._track.values as Float32Array), 3),
      );
      this.points.geometry.computeBoundingSphere();
    }
  }

  updateMatrixWorld(force?: boolean) {
    // Position the helper at the object's parent so the path appears in correct local space
    if (this.object && this.object.parent) {
      this.object.parent.updateWorldMatrix(true, false);
      this.matrix.copy(this.object.parent.matrixWorld);
    } else {
      this.matrix.identity();
    }

    this.matrixWorld.copy(this.matrix);

    // Update children
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].updateMatrixWorld(force);
    }
  }

  setColor(color: number | string | Color) {
    if (this.line) this.line.material.color.set(color);
  }

  setMarkerColor(color: number | string | Color) {
    if (this.points) (this.points.material as PointsMaterial).color.set(color);
  }

  dispose() {
    if (this.line) {
      this.line!.geometry.dispose();
      this.line.material.dispose();
    }

    if (this.points) {
      this.points.geometry.dispose();
      (this.points.material as PointsMaterial).dispose();
    }
  }
}
