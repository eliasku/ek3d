import { ColorSpace, Mapping } from "../../constants";
import type { BufferAttribute } from "../../core/BufferAttribute";
import type { BufferGeometry } from "../../core/BufferGeometry";
import { Object3D } from "../../core/Object3D";
import { TextureLoader } from "../../loaders/TextureLoader";
import { MeshLambertMaterial } from "../../materials/MeshLambertMaterial";
import { Box3 } from "../../math/Box3";
import { clamp } from "../../math/MathUtils";
import type { Texture } from "../../textures/Texture";
import { MD2Loader } from "../loaders/MD2Loader";
import { MorphBlendMesh } from "./MorphBlendMesh";

export interface MD2CharacterControls {
  moveForward: boolean;
  moveBackward: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  crouch?: boolean;
  jump?: boolean;
  attack?: boolean;
}
export interface MD2CharacterAnimations {
  [name: string]: string | undefined;
  move?: string;
  idle?: string;
  jump?: string;
  attack?: string;
  crouchMove?: string;
  crouchIdle?: string;
  crouchAttack?: string;
}
export interface MD2CharacterComplexConfig {
  baseUrl: string;
  body: string;
  skins: string[];
  weapons: (readonly [string, string])[];
  animations: MD2CharacterAnimations;
  walkSpeed: number;
  crouchSpeed: number;
}
export class MD2CharacterComplexPart extends MorphBlendMesh<MeshLambertMaterial> {
  materialTexture: MeshLambertMaterial;
  materialWireframe: MeshLambertMaterial;
  duration: number | undefined;
  baseDuration: number | undefined;
  constructor(geometry: BufferGeometry, skinMap: Texture | undefined) {
    const materialTexture = new MeshLambertMaterial({ color: 0xffffff, wireframe: false, map: skinMap ?? null });
    super(geometry, materialTexture);
    this.materialTexture = materialTexture;
    this.materialWireframe = new MeshLambertMaterial({ color: 0xffaa00, wireframe: true });
    this.rotation.y = -Math.PI / 2;
  }
}

export class MD2CharacterComplex {
  scale: number = 1;
  animationFPS: number = 6;
  transitionFrames: number = 15;
  maxSpeed: number = 275;
  maxReverseSpeed: number = -275;
  frontAcceleration: number = 600;
  backAcceleration: number = 600;
  frontDeceleration: number = 600;
  angularSpeed: number = 2.5;
  root: Object3D = new Object3D();
  meshBody: MD2CharacterComplexPart | null = null;
  meshWeapon: MD2CharacterComplexPart | null = null;
  controls: MD2CharacterControls | null = null;
  skinsBody: Texture[] = [];
  skinsWeapon: Texture[] = [];
  weapons: MD2CharacterComplexPart[] = [];
  currentSkin: number | undefined;
  onLoadComplete: () => void = () => {};
  onError: (error: unknown) => void = () => {};
  meshes: MD2CharacterComplexPart[] = [];
  animations: MD2CharacterAnimations = {};
  loadCounter: number = 0;
  speed: number = 0;
  bodyOrientation: number = 0;
  walkSpeed: number = this.maxSpeed;
  crouchSpeed: number = this.maxSpeed * 0.5;
  activeAnimation: string | null = null;
  oldAnimation: string | null = null;
  blendCounter: number = 0;
  private generation: number = 0;
  private disposed: boolean = false;
  private ownedGeometries: BufferGeometry[] = [];
  private ownedTextures: Texture[] = [];

  enableShadows(enable: boolean): void {
    for (const mesh of this.meshes) {
      mesh.castShadow = enable;
      mesh.receiveShadow = enable;
    }
  }
  setVisible(enable: boolean): void {
    for (const mesh of this.meshes) mesh.visible = enable;
  }
  shareParts(original: MD2CharacterComplex): void {
    if (!original.meshBody) throw new Error("Cannot share parts before the body is loaded");
    this.animations = original.animations;
    this.walkSpeed = original.walkSpeed;
    this.crouchSpeed = original.crouchSpeed;
    this.skinsBody = original.skinsBody;
    this.skinsWeapon = original.skinsWeapon;
    const mesh = this._createPart(original.meshBody.geometry, this.skinsBody[0]);
    mesh.scale.setScalar(this.scale);
    this.root.position.y = original.root.position.y;
    this.root.add(mesh);
    this.meshBody = mesh;
    this.meshes.push(mesh);
    for (let i = 0; i < original.weapons.length; i++) {
      const weapon = this._createPart(original.weapons[i].geometry, this.skinsWeapon[i]);
      weapon.scale.setScalar(this.scale);
      weapon.visible = false;
      weapon.name = original.weapons[i].name;
      this.root.add(weapon);
      this.weapons[i] = weapon;
      this.meshWeapon = weapon;
      this.meshes.push(weapon);
    }
  }
  loadParts(config: MD2CharacterComplexConfig): void {
    if (this.disposed) return;
    this.clearParts();
    const generation = ++this.generation;
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
    this.animations = config.animations;
    this.walkSpeed = config.walkSpeed;
    this.crouchSpeed = config.crouchSpeed;
    this.loadCounter = config.weapons.length * 2 + config.skins.length + 1;
    const textureLoader = new TextureLoader();
    const loadTextures = (names: string[]): Texture[] =>
      names.map((name) => {
        const texture = textureLoader.load(
          config.baseUrl + "skins/" + name,
          (loaded) => {
            if (!current()) {
              loaded.dispose();
              return;
            }
            complete();
          },
          undefined,
          error,
        );
        texture.mapping = Mapping.UV;
        texture.name = name;
        texture.colorSpace = ColorSpace.SRGB;
        this.ownedTextures.push(texture);
        return texture;
      });
    this.skinsBody = loadTextures(config.skins);
    this.skinsWeapon = loadTextures(config.weapons.map((weapon) => weapon[1]));
    const loader = new MD2Loader();
    loader.load(
      config.baseUrl + config.body,
      (geometry) => {
        if (!current()) {
          geometry.dispose();
          return;
        }
        this.ownedGeometries.push(geometry);
        const box = new Box3().setFromBufferAttribute(geometry.attributes.position as BufferAttribute);
        this.root.position.y = -this.scale * box.min.y;
        const mesh = this._createPart(geometry, this.skinsBody[0]);
        mesh.scale.setScalar(this.scale);
        this.root.add(mesh);
        this.meshBody = mesh;
        this.meshes.push(mesh);
        complete();
      },
      undefined,
      error,
    );
    config.weapons.forEach(([name], index) => {
      loader.load(
        config.baseUrl + name,
        (geometry) => {
          if (!current()) {
            geometry.dispose();
            return;
          }
          this.ownedGeometries.push(geometry);
          const mesh = this._createPart(geometry, this.skinsWeapon[index]);
          mesh.scale.setScalar(this.scale);
          mesh.visible = false;
          mesh.name = name;
          this.root.add(mesh);
          this.weapons[index] = mesh;
          this.meshWeapon = mesh;
          this.meshes.push(mesh);
          complete();
        },
        undefined,
        error,
      );
    });
  }
  setPlaybackRate(rate: number): void {
    if (this.meshBody) this.meshBody.duration = (this.meshBody.baseDuration ?? NaN) / rate;
    if (this.meshWeapon) this.meshWeapon.duration = (this.meshWeapon.baseDuration ?? NaN) / rate;
  }
  setWireframe(enabled: boolean): void {
    if (this.meshBody)
      this.meshBody.material = enabled ? this.meshBody.materialWireframe : this.meshBody.materialTexture;
    if (this.meshWeapon)
      this.meshWeapon.material = enabled ? this.meshWeapon.materialWireframe : this.meshWeapon.materialTexture;
  }
  setSkin(index: number): void {
    if (this.meshBody && !this.meshBody.material.wireframe) {
      this.meshBody.material.map = this.skinsBody[index];
      this.currentSkin = index;
    }
  }
  setWeapon(index: number): void {
    for (const weapon of this.weapons) if (weapon) weapon.visible = false;
    const weapon = this.weapons[index];
    if (weapon) {
      weapon.visible = true;
      this.meshWeapon = weapon;
      if (this.activeAnimation) {
        weapon.playAnimation(this.activeAnimation);
        weapon.setAnimationTime(this.activeAnimation, this.meshBody!.getAnimationTime(this.activeAnimation));
      }
    }
  }
  setAnimation(name: string | undefined): void {
    if (name === this.activeAnimation || !name) return;
    if (this.meshBody) {
      this.meshBody.setAnimationWeight(name, 0);
      this.meshBody.playAnimation(name);
      this.oldAnimation = this.activeAnimation;
      this.activeAnimation = name;
      this.blendCounter = this.transitionFrames;
    }
    if (this.meshWeapon) {
      this.meshWeapon.setAnimationWeight(name, 0);
      this.meshWeapon.playAnimation(name);
    }
  }
  update(delta: number): void {
    if (this.controls) {
      this.updateMovementModel(delta);
      this.updateBehaviors();
    }
    this.updateAnimations(delta);
  }
  updateAnimations(delta: number): void {
    let mix = 1;
    if (this.blendCounter > 0) {
      mix = (this.transitionFrames - this.blendCounter) / this.transitionFrames;
      this.blendCounter--;
    }
    if (this.meshBody) {
      this.meshBody.update(delta);
      this.meshBody.setAnimationWeight(this.activeAnimation, mix);
      this.meshBody.setAnimationWeight(this.oldAnimation, 1 - mix);
    }
    if (this.meshWeapon) {
      this.meshWeapon.update(delta);
      this.meshWeapon.setAnimationWeight(this.activeAnimation, mix);
      this.meshWeapon.setAnimationWeight(this.oldAnimation, 1 - mix);
    }
  }
  updateBehaviors(): void {
    const controls = this.controls;
    if (!controls) return;
    const animations = this.animations;
    let move = controls.crouch ? animations.crouchMove : animations.move;
    let idle = controls.crouch ? animations.crouchIdle : animations.idle;
    if (controls.jump) move = idle = animations.jump;
    if (controls.attack) move = idle = controls.crouch ? animations.crouchAttack : animations.attack;
    if (controls.moveForward || controls.moveBackward || controls.moveLeft || controls.moveRight) {
      if (this.activeAnimation !== move) this.setAnimation(move);
    }
    if (
      Math.abs(this.speed) < 0.2 * this.maxSpeed &&
      !(controls.moveLeft || controls.moveRight || controls.moveForward || controls.moveBackward)
    ) {
      if (this.activeAnimation !== idle) this.setAnimation(idle);
    }
    if (controls.moveForward) {
      this.meshBody?.setAnimationDirectionForward(this.activeAnimation);
      this.meshBody?.setAnimationDirectionForward(this.oldAnimation);
      this.meshWeapon?.setAnimationDirectionForward(this.activeAnimation);
      this.meshWeapon?.setAnimationDirectionForward(this.oldAnimation);
    }
    if (controls.moveBackward) {
      this.meshBody?.setAnimationDirectionBackward(this.activeAnimation);
      this.meshBody?.setAnimationDirectionBackward(this.oldAnimation);
      this.meshWeapon?.setAnimationDirectionBackward(this.activeAnimation);
      this.meshWeapon?.setAnimationDirectionBackward(this.oldAnimation);
    }
  }
  updateMovementModel(delta: number): void {
    const controls = this.controls;
    if (!controls) return;
    this.maxSpeed = controls.crouch ? this.crouchSpeed : this.walkSpeed;
    this.maxReverseSpeed = -this.maxSpeed;
    if (controls.moveForward)
      this.speed = clamp(this.speed + delta * this.frontAcceleration, this.maxReverseSpeed, this.maxSpeed);
    if (controls.moveBackward)
      this.speed = clamp(this.speed - delta * this.backAcceleration, this.maxReverseSpeed, this.maxSpeed);
    if (controls.moveLeft) {
      this.bodyOrientation += delta * this.angularSpeed;
      this.speed = clamp(this.speed + delta * this.frontAcceleration, this.maxReverseSpeed, this.maxSpeed);
    }
    if (controls.moveRight) {
      this.bodyOrientation -= delta * this.angularSpeed;
      this.speed = clamp(this.speed + delta * this.frontAcceleration, this.maxReverseSpeed, this.maxSpeed);
    }
    if (!(controls.moveForward || controls.moveBackward)) {
      if (this.speed > 0) {
        const k = this.speed / this.maxSpeed;
        this.speed = clamp(
          this.speed - (k === 1 ? 1 : 1 - Math.pow(2, -10 * k)) * delta * this.frontDeceleration,
          0,
          this.maxSpeed,
        );
      } else {
        const k = this.speed / this.maxReverseSpeed;
        this.speed = clamp(
          this.speed + (k === 1 ? 1 : 1 - Math.pow(2, -10 * k)) * delta * this.backAcceleration,
          this.maxReverseSpeed,
          0,
        );
      }
    }
    const forwardDelta = this.speed * delta;
    this.root.position.x += Math.sin(this.bodyOrientation) * forwardDelta;
    this.root.position.z += Math.cos(this.bodyOrientation) * forwardDelta;
    this.root.rotation.y = this.bodyOrientation;
  }
  _createPart(geometry: BufferGeometry, skinMap: Texture | undefined): MD2CharacterComplexPart {
    const mesh = new MD2CharacterComplexPart(geometry, skinMap);
    mesh.autoCreateAnimations(this.animationFPS);
    return mesh;
  }
  private clearParts(): void {
    for (const mesh of this.meshes) {
      this.root.remove(mesh);
      mesh.materialTexture.dispose();
      mesh.materialWireframe.dispose();
    }
    for (const geometry of this.ownedGeometries) geometry.dispose();
    for (const texture of this.ownedTextures) texture.dispose();
    this.meshes = [];
    this.weapons = [];
    this.skinsBody = [];
    this.skinsWeapon = [];
    this.meshBody = null;
    this.meshWeapon = null;
    this.ownedGeometries = [];
    this.ownedTextures = [];
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.clearParts();
  }
}
