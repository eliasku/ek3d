import { MD2Loader, type MD2Geometry } from "../loaders/MD2Loader";
import type { AnimationAction } from "../../animation/AnimationAction";
import { AnimationMixer } from "../../animation/AnimationMixer";
import { ColorSpace, Mapping } from "../../constants";
import type { BufferAttribute } from "../../core/BufferAttribute";
import { Object3D } from "../../core/Object3D";
import { TextureLoader } from "../../loaders/TextureLoader";
import { MeshLambertMaterial } from "../../materials/MeshLambertMaterial";
import { Box3 } from "../../math/Box3";
import { Mesh } from "../../objects/Mesh";
import type { Texture } from "../../textures/Texture";

export interface MD2CharacterConfig {
  baseUrl: string;
  body: string;
  skins: string[];
  weapons: [string, string][];
}

export type MD2CharacterMesh = Mesh<MeshLambertMaterial> & {
  geometry: MD2Geometry;
  materialTexture: MeshLambertMaterial;
  materialWireframe: MeshLambertMaterial;
  activeAction: AnimationAction | null;
  clipOffset: number;
};

function createPart(geometry: MD2Geometry, skin: Texture | undefined): MD2CharacterMesh {
  const materialTexture = new MeshLambertMaterial({ color: 0xffffff, wireframe: false, map: skin });
  const mesh = Object.assign(new Mesh(geometry, materialTexture), {
    materialTexture,
    materialWireframe: new MeshLambertMaterial({ color: 0xffaa00, wireframe: true }),
    activeAction: null as AnimationAction | null,
    clipOffset: 0,
  }) as MD2CharacterMesh;
  mesh.rotation.y = -Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Manages a body, skins, weapons and their synchronized MD2 animations. */
export class MD2Character {
  scale: number = 1;
  animationFPS: number = 6;
  root: Object3D = new Object3D();
  meshBody: MD2CharacterMesh | null = null;
  meshWeapon: MD2CharacterMesh | null = null;
  skinsBody: Texture[] = [];
  skinsWeapon: Texture[] = [];
  weapons: MD2CharacterMesh[] = [];
  activeAnimationClipName: string | null = null;
  activeClipName: string | null = null;
  mixer: AnimationMixer | null = null;
  onLoadComplete: () => void = () => {};
  onError: (error: unknown) => void = () => {};
  loadCounter: number = 0;
  private generation: number = 0;
  private disposed: boolean = false;

  loadParts(config: MD2CharacterConfig): void {
    this.dispose();
    this.disposed = false;
    const generation = this.generation;
    let failed = false;
    const current = (): boolean => !this.disposed && this.generation === generation;
    const complete = (): void => {
      if (!current() || failed) return;
      if (--this.loadCounter === 0) this.onLoadComplete();
    };
    const error = (reason: unknown): void => {
      if (!current() || failed) return;
      failed = true;
      this.onError(reason);
    };
    this.loadCounter = config.weapons.length * 2 + config.skins.length + 1;
    const textureLoader = new TextureLoader();
    const loadTextures = (names: string[]): Texture[] =>
      names.map((name) => {
        const texture = textureLoader.load(config.baseUrl + "skins/" + name, complete, undefined, error);
        texture.mapping = Mapping.UV;
        texture.name = name;
        texture.colorSpace = ColorSpace.SRGB;
        return texture;
      });
    this.skinsBody = loadTextures(config.skins);
    this.skinsWeapon = loadTextures(config.weapons.map((weapon) => weapon[1]));
    const loader = new MD2Loader();
    loader.load(
      config.baseUrl + config.body,
      (geometry) => {
        if (!current() || failed) {
          geometry.dispose();
          return;
        }
        const bounds = new Box3().setFromBufferAttribute(geometry.attributes.position as BufferAttribute);
        this.root.position.y = -this.scale * bounds.min.y;
        const mesh = createPart(geometry, this.skinsBody[0]);
        mesh.scale.setScalar(this.scale);
        this.root.add(mesh);
        this.meshBody = mesh;
        this.activeAnimationClipName = geometry.animations[0]?.name ?? null;
        this.mixer = new AnimationMixer(mesh);
        complete();
      },
      undefined,
      error,
    );
    config.weapons.forEach(([name], index) => {
      loader.load(
        config.baseUrl + name,
        (geometry) => {
          if (!current() || failed) {
            geometry.dispose();
            return;
          }
          const mesh = createPart(geometry, this.skinsWeapon[index]);
          mesh.scale.setScalar(this.scale);
          mesh.visible = false;
          mesh.name = name;
          this.root.add(mesh);
          this.weapons[index] = mesh;
          this.meshWeapon = mesh;
          complete();
        },
        undefined,
        error,
      );
    });
  }

  setPlaybackRate(rate: number): void {
    if (this.mixer) this.mixer.timeScale = rate !== 0 ? 1 / rate : 0;
  }

  setWireframe(enabled: boolean): void {
    if (this.meshBody)
      this.meshBody.material = enabled ? this.meshBody.materialWireframe : this.meshBody.materialTexture;
    if (this.meshWeapon)
      this.meshWeapon.material = enabled ? this.meshWeapon.materialWireframe : this.meshWeapon.materialTexture;
  }

  setSkin(index: number): void {
    if (this.meshBody && !this.meshBody.material.wireframe) this.meshBody.material.map = this.skinsBody[index];
  }

  setWeapon(index: number): void {
    for (const weapon of this.weapons) if (weapon) weapon.visible = false;
    const weapon = this.weapons[index];
    if (weapon) {
      weapon.visible = true;
      this.meshWeapon = weapon;
      this.syncWeaponAnimation();
    }
  }

  setAnimation(clipName: string): void {
    if (this.meshBody && this.mixer) {
      this.meshBody.activeAction?.stop();
      this.meshBody.activeAction = this.mixer.clipAction(clipName, this.meshBody)?.play() ?? null;
    }
    this.activeClipName = clipName;
    this.syncWeaponAnimation();
  }

  syncWeaponAnimation(): void {
    if (!this.meshWeapon || !this.mixer || !this.activeClipName) return;
    this.meshWeapon.activeAction?.stop();
    const action = this.mixer.clipAction(this.activeClipName, this.meshWeapon);
    this.meshWeapon.activeAction =
      action && this.meshBody?.activeAction ? action.syncWith(this.meshBody.activeAction).play() : null;
  }

  update(delta: number): void {
    this.mixer?.update(delta);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.mixer?.stopAllAction();
    const parts = [this.meshBody, ...this.weapons];
    for (const part of parts) {
      if (!part) continue;
      this.mixer?.uncacheRoot(part);
      this.root.remove(part);
      part.geometry.dispose();
      part.materialTexture.dispose();
      part.materialWireframe.dispose();
    }
    for (const texture of [...this.skinsBody, ...this.skinsWeapon]) texture.dispose();
    this.meshBody = null;
    this.meshWeapon = null;
    this.mixer = null;
    this.weapons = [];
    this.skinsBody = [];
    this.skinsWeapon = [];
    this.activeClipName = null;
    this.activeAnimationClipName = null;
    this.loadCounter = 0;
  }
}
