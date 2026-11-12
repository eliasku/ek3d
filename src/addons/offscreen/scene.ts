import { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import { IcosahedronGeometry } from "../../geometries/IcosahedronGeometry";
import { ImageBitmapLoader } from "../../loaders/ImageBitmapLoader";
import { MeshMatcapMaterial } from "../../materials/MeshMatcapMaterial";
import { Color } from "../../math/Color";
import { Group } from "../../objects/Group";
import { Mesh } from "../../objects/Mesh";
import { WebGLRenderer } from "../../renderers/WebGLRenderer";
import { matcapShader } from "../../renderers/shaders/MatcapShader";
import { Fog } from "../../scenes/Fog";
import { Scene } from "../../scenes/Scene";
import { Texture } from "../../textures/Texture";

export interface OffscreenScene {
  resize(width: number, height: number, pixelRatio: number): void;
  dispose(): void;
}

/** Starts the same matcap scene on a regular or transferred canvas. */
export class MatcapScene implements OffscreenScene {
  private camera: PerspectiveCamera;
  private scene: Scene;
  private group: Group;
  private renderer: WebGLRenderer;
  private disposed: boolean;
  private frames: number;
  private bitmap: ImageBitmap | null;
  private texture: Texture | null;
  private geometry: IcosahedronGeometry | null;
  private materials: MeshMatcapMaterial[];
  private seed: number;

  constructor(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    width: number,
    height: number,
    pixelRatio: number,
    private onFrame: (frames: number) => void,
    private onError: (error: unknown) => void,
  ) {
    this.camera = new PerspectiveCamera(40, width / height, 1, 1000);
    this.camera.position.z = 200;
    this.scene = new Scene();
    this.scene.fog = new Fog(0x444466, 100, 400);
    this.scene.background = new Color(0x444466);
    this.group = new Group();
    this.scene.add(this.group);
    this.renderer = new WebGLRenderer({ canvas, antialias: true, shaders: { MeshMatcapMaterial: matcapShader } });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.disposed = false;
    this.frames = 0;
    this.bitmap = null;
    this.texture = null;
    this.geometry = null;
    this.materials = [];
    this.seed = 1;
    this.resize = this.resize.bind(this);
    this.dispose = this.dispose.bind(this);
    this.animate = this.animate.bind(this);
    const loader = new ImageBitmapLoader();
    loader.setOptions({ imageOrientation: "flipY" });
    loader.load(
      "/examples/textures/matcaps/matcap-porcelain-white.jpg",
      this.loaded.bind(this),
      undefined,
      this.failed.bind(this),
    );
  }

  private random(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  private loaded(image: ImageBitmap) {
    if (this.disposed) {
      image.close();
      return;
    }
    this.bitmap = image;
    this.texture = new Texture(image);
    this.texture.needsUpdate = true;
    this.geometry = new IcosahedronGeometry(5, 8);
    this.materials = [0xaa24df, 0x605d90, 0xe04a3f, 0xe30456].map(
      (color) => new MeshMatcapMaterial({ color, matcap: this.texture }),
    );
    for (let i = 0; i < 100; i++) {
      const mesh = new Mesh(this.geometry, this.materials[i % this.materials.length]);
      mesh.position.set(this.random() * 200 - 100, this.random() * 200 - 100, this.random() * 200 - 100);
      mesh.scale.setScalar(this.random() + 1);
      this.group.add(mesh);
    }
    this.renderer.setAnimationLoop(this.animate);
  }

  private animate() {
    this.group.rotation.y = -Date.now() / 4000;
    this.renderer.render(this.scene, this.camera);
    this.onFrame.call(undefined, ++this.frames);
  }

  private failed(error: unknown) {
    if (!this.disposed) this.onError.call(undefined, error);
  }

  resize(newWidth: number, newHeight: number, ratio: number) {
    this.camera.aspect = newWidth / newHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(newWidth, newHeight, false);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.geometry?.dispose();
    for (const material of this.materials) material.dispose();
    this.texture?.dispose();
    this.bitmap?.close();
    this.renderer.dispose();
  }
}
