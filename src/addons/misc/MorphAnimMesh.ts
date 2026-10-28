import { AnimationClip } from "../../animation/AnimationClip";
import { AnimationMixer } from "../../animation/AnimationMixer";
import type { AnimationAction } from "../../animation/AnimationAction";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Material } from "../../materials/Material";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { Mesh } from "../../objects/Mesh";

export class MorphAnimMesh extends Mesh {
  mixer: AnimationMixer;
  activeAction: AnimationAction | null;

  constructor(
    geometry: BufferGeometry = new BufferGeometry(),
    material: Material | Material[] = new MeshBasicMaterial(),
  ) {
    super(geometry, material);

    this.type = "MorphAnimMesh";

    this.mixer = new AnimationMixer(this);

    this.activeAction = null;
  }

  setDirectionForward() {
    this.mixer.timeScale = 1.0;
  }

  setDirectionBackward() {
    this.mixer.timeScale = -1.0;
  }

  playAnimation(label: string, fps: number) {
    if (this.activeAction) {
      this.activeAction.stop();
      this.activeAction = null;
    }

    const clip = AnimationClip.findByName(this, label);

    if (clip) {
      const action = this.mixer.clipAction(clip);
      action.timeScale = (clip.tracks.length * fps) / clip.duration;
      this.activeAction = action.play();
    } else {
      throw new Error("THREE.MorphAnimMesh: animations[" + label + "] undefined in .playAnimation()");
    }
  }

  updateAnimation(delta: number) {
    this.mixer.update(delta);
  }

  copy(source: this, recursive?: boolean) {
    super.copy(source, recursive);

    this.mixer = new AnimationMixer(this);

    return this;
  }
}
