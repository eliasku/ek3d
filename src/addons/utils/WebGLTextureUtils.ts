import { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import { ColorSpace } from "../../constants";
import { PlaneGeometry } from "../../geometries/PlaneGeometry";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { Mesh } from "../../objects/Mesh";
import { WebGLRenderer } from "../../renderers/WebGLRenderer";
import { Scene } from "../../scenes/Scene";
import { CanvasTexture } from "../../textures/CanvasTexture";
import type { CompressedTexture } from "../../textures/CompressedTexture";

/** Draw a compressed texture into a canvas-backed, uncompressed texture. */
export function decompress(
  texture: CompressedTexture,
  maxTextureSize = Infinity,
  renderer: WebGLRenderer | null = null,
): CanvasTexture {
  const image = texture.image;
  if (Array.isArray(image) || image.width === undefined || image.height === undefined) {
    throw new Error("WebGLTextureUtils: Expected a two-dimensional compressed texture.");
  }
  const width = Math.min(image.width, maxTextureSize);
  const height = Math.min(image.height, maxTextureSize);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("WebGLTextureUtils: Unable to create a 2D canvas context.");

  const geometry = new PlaneGeometry(2, 2, 1, 1);
  const material = new ShaderMaterial({
    uniforms: { blitTexture: { value: texture } },
    defines: { IS_SRGB: texture.colorSpace === ColorSpace.SRGB },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0., .999999); }`,
    fragmentShader: `uniform sampler2D blitTexture;
      varying vec2 vUv;
      void main() {
        #ifdef IS_SRGB
          gl_FragColor = sRGBTransferOETF(texture2D(blitTexture, vUv));
        #else
          gl_FragColor = texture2D(blitTexture, vUv);
        #endif
      }`,
  });
  const quad = new Mesh(geometry, material);
  quad.frustumCulled = false;
  const scene = new Scene();
  scene.add(quad);
  const ownRenderer = renderer === null;
  const activeRenderer = renderer ?? new WebGLRenderer({ antialias: false });
  try {
    activeRenderer.setSize(width, height);
    activeRenderer.clear();
    activeRenderer.render(scene, new PerspectiveCamera());
    context.drawImage(activeRenderer.domElement, 0, 0, width, height);
    const result = new CanvasTexture(canvas);
    result.minFilter = texture.minFilter;
    result.magFilter = texture.magFilter;
    result.wrapS = texture.wrapS;
    result.wrapT = texture.wrapT;
    result.colorSpace = texture.colorSpace;
    result.name = texture.name;
    return result;
  } finally {
    geometry.dispose();
    material.dispose();
    if (ownRenderer) {
      activeRenderer.forceContextLoss();
      activeRenderer.dispose();
    }
  }
}
