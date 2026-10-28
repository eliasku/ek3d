import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import {
  LinearFilter,
  NearestFilter,
  NearestMipmapNearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import { Texture } from "ek3d/textures/Texture";
import { disposeObject } from "./dispose-object";

export function textureFilterComparison(manualMipmaps: boolean): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#scene");
  if (!canvas) throw new Error("Missing texture comparison canvas");
  const camera = new PerspectiveCamera(35, window.innerWidth / window.innerHeight, 1, 5000);
  camera.position.z = 1500;
  const scenes = [new Scene(), new Scene()];
  for (const scene of scenes) {
    scene.background = new Color(0x000000);
    scene.fog = new Fog(0x000000, 1500, 4000);
  }
  function mipmap(size: number, color: string): HTMLCanvasElement {
    const image = document.createElement("canvas");
    image.width = image.height = size;
    const context = image.getContext("2d");
    if (!context) throw new Error("Unable to create checkerboard texture");
    context.fillStyle = "#444";
    context.fillRect(0, 0, size, size);
    context.fillStyle = color;
    context.fillRect(0, 0, size / 2, size / 2);
    context.fillRect(size / 2, size / 2, size / 2, size / 2);
    return image;
  }
  const floorTexture = new CanvasTexture(mipmap(128, manualMipmaps ? "#f00" : "#fff"));
  if (manualMipmaps) {
    floorTexture.mipmaps = [
      floorTexture.image,
      ...["#0f0", "#00f", "#400", "#040", "#004", "#044", "#404"].map((color, index) => mipmap(64 >> index, color)),
    ];
  }
  floorTexture.colorSpace = SRGBColorSpace;
  floorTexture.repeat.set(1000, 1000);
  floorTexture.wrapS = floorTexture.wrapT = RepeatWrapping;
  const nearestFloor = floorTexture.clone();
  nearestFloor.magFilter = NearestFilter;
  nearestFloor.minFilter = manualMipmaps ? NearestMipmapNearestFilter : NearestFilter;
  if (!manualMipmaps) nearestFloor.generateMipmaps = false;
  const floors = [floorTexture, nearestFloor].map((texture, index) => {
    const mesh = new Mesh(
      new PlaneGeometry(100, 100),
      new MeshBasicMaterial({ map: texture, color: index ? 0xffccaa : 0xffffff }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(1000);
    return mesh;
  });
  const nearestPainting = new Texture();
  nearestPainting.colorSpace = SRGBColorSpace;
  nearestPainting.minFilter = nearestPainting.magFilter = NearestFilter;
  let disposed = false;
  let loaded = false;
  let frames = 0;
  canvas.dataset.state = "loading";
  const painting = new TextureLoader().load(
    "/examples/textures/758px-Canestra_di_frutta_(Caravaggio).jpg",
    (texture) => {
      if (disposed) return;
      const image = texture.image as HTMLImageElement;
      nearestPainting.image = image;
      nearestPainting.needsUpdate = true;
      scenes.forEach((scene, index) => {
        const geometry = new PlaneGeometry(100, 100);
        const picture = new Mesh(
          geometry,
          new MeshBasicMaterial({ map: index ? nearestPainting : painting, color: index ? 0xffccaa : 0xffffff }),
        );
        picture.scale.set(image.width / 100, image.height / 100, 1);
        const frame = new Mesh(geometry, new MeshBasicMaterial({ color: 0x000000 }));
        frame.position.z = -10;
        frame.scale.set((1.1 * image.width) / 100, (1.1 * image.height) / 100, 1);
        const shadow = new Mesh(geometry, new MeshBasicMaterial({ color: 0x000000, opacity: 0.75, transparent: true }));
        shadow.position.set(0, (-1.1 * image.height) / 2, (-1.1 * image.height) / 2);
        shadow.rotation.x = -Math.PI / 2;
        shadow.scale.set((1.1 * image.width) / 100, (1.1 * image.height) / 100, 1);
        floors[index].position.y = (-1.117 * image.height) / 2;
        scene.add(floors[index], picture, frame, shadow);
      });
      loaded = true;
    },
    undefined,
    (error) => {
      if (disposed) return;
      canvas.dataset.state = "error";
      canvas.dataset.error = String(error);
      console.error(error);
    },
  );
  painting.colorSpace = SRGBColorSpace;
  painting.minFilter = painting.magFilter = LinearFilter;
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    shaders: { MeshBasicMaterial: basicShader },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.autoClear = false;
  let mouseX = 0,
    mouseY = 0;
  function mousemove(event: MouseEvent): void {
    mouseX = event.clientX - window.innerWidth / 2;
    mouseY = event.clientY - window.innerHeight / 2;
  }
  function resize(): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  document.addEventListener("mousemove", mousemove);
  window.addEventListener("resize", resize);
  renderer.setAnimationLoop(() => {
    camera.position.x += (mouseX - camera.position.x) * 0.05;
    camera.position.y += (-(mouseY - 200) - camera.position.y) * 0.05;
    camera.lookAt(scenes[0].position);
    const width = window.innerWidth,
      height = window.innerHeight;
    renderer.clear();
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, width / 2 - 2, height);
    renderer.render(scenes[0], camera);
    renderer.setScissor(width / 2, 0, width / 2 - 2, height);
    renderer.render(scenes[1], camera);
    renderer.setScissorTest(false);
    canvas.dataset.frames = String(++frames);
    if (loaded) canvas.dataset.state = "rendered";
  });
  window.addEventListener("pagehide", (event) => {
    if (event.persisted || disposed) return;
    disposed = true;
    document.removeEventListener("mousemove", mousemove);
    window.removeEventListener("resize", resize);
    renderer.setAnimationLoop(null);
    if (!loaded) {
      for (let i = 0; i < scenes.length; i++) scenes[i].add(floors[i]);
      painting.dispose();
      nearestPainting.dispose();
    }
    for (const scene of scenes) disposeObject(scene);
    renderer.dispose();
  });
}
