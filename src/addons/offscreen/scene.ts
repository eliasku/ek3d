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
export function initScene(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  width: number,
  height: number,
  pixelRatio: number,
  onFrame: (frames: number) => void,
  onError: (error: unknown) => void,
): OffscreenScene {
  const camera = new PerspectiveCamera(40, width / height, 1, 1000);
  camera.position.z = 200;
  const scene = new Scene();
  scene.fog = new Fog(0x444466, 100, 400);
  scene.background = new Color(0x444466);
  const group = new Group();
  scene.add(group);
  const renderer = new WebGLRenderer({ canvas, antialias: true, shaders: { MeshMatcapMaterial: matcapShader } });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  let disposed = false;
  let frames = 0;
  let bitmap: ImageBitmap | null = null;
  let texture: Texture | null = null;
  let geometry: IcosahedronGeometry | null = null;
  let materials: MeshMatcapMaterial[] = [];
  let seed = 1;
  function random(): number {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }
  const loader = new ImageBitmapLoader();
  loader.setOptions({ imageOrientation: "flipY" });
  loader.load(
    "/examples/textures/matcaps/matcap-porcelain-white.jpg",
    (image) => {
      if (disposed) {
        image.close();
        return;
      }
      bitmap = image;
      texture = new Texture(image);
      texture.needsUpdate = true;
      geometry = new IcosahedronGeometry(5, 8);
      materials = [0xaa24df, 0x605d90, 0xe04a3f, 0xe30456].map(
        (color) => new MeshMatcapMaterial({ color, matcap: texture }),
      );
      for (let i = 0; i < 100; i++) {
        const mesh = new Mesh(geometry, materials[i % materials.length]);
        mesh.position.set(random() * 200 - 100, random() * 200 - 100, random() * 200 - 100);
        mesh.scale.setScalar(random() + 1);
        group.add(mesh);
      }
      renderer.setAnimationLoop(() => {
        group.rotation.y = -Date.now() / 4000;
        renderer.render(scene, camera);
        onFrame(++frames);
      });
    },
    undefined,
    (error) => {
      if (!disposed) onError(error);
    },
  );
  return {
    resize(newWidth, newHeight, ratio) {
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(ratio);
      renderer.setSize(newWidth, newHeight, false);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      geometry?.dispose();
      for (const material of materials) material.dispose();
      texture?.dispose();
      bitmap?.close();
      renderer.dispose();
    },
  };
}
