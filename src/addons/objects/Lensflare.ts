import type { Camera } from "../../cameras/Camera";
import type { Object3D } from "../../core/Object3D";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import { AdditiveBlending, UnsignedByteType } from "../../constants";
import { BufferGeometry } from "../../core/BufferGeometry";
import { InterleavedBuffer } from "../../core/InterleavedBuffer";
import { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { RawShaderMaterial } from "../../materials/RawShaderMaterial";
import { Box2 } from "../../math/Box2";
import { Color } from "../../math/Color";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import { Vector4 } from "../../math/Vector4";
import { Mesh } from "../../objects/Mesh";
import { FramebufferTexture } from "../../textures/FramebufferTexture";
import type { Texture } from "../../textures/Texture";

/** A flare texture, pixel size, normalized distance from the light and color. */
export class LensflareElement {
  static Shader: {
    name: string;
    uniforms: Record<string, { value: null }>;
    vertexShader: string;
    fragmentShader: string;
  } = {
    name: "LensflareElementShader",
    uniforms: {
      map: { value: null },
      occlusionMap: { value: null },
      color: { value: null },
      scale: { value: null },
      screenPosition: { value: null },
    },
    vertexShader: /* glsl */ `
        precision highp float;
        uniform vec3 screenPosition;
        uniform vec2 scale;
        uniform sampler2D occlusionMap;
        attribute vec3 position;
        attribute vec2 uv;
        varying vec2 vUV;
        varying float vVisibility;
        void main() {
          vUV = uv;
          vec2 pos = position.xy;
          vec4 visibility = texture2D( occlusionMap, vec2( 0.1, 0.1 ) );
          visibility += texture2D( occlusionMap, vec2( 0.5, 0.1 ) );
          visibility += texture2D( occlusionMap, vec2( 0.9, 0.1 ) );
          visibility += texture2D( occlusionMap, vec2( 0.9, 0.5 ) );
          visibility += texture2D( occlusionMap, vec2( 0.9, 0.9 ) );
          visibility += texture2D( occlusionMap, vec2( 0.5, 0.9 ) );
          visibility += texture2D( occlusionMap, vec2( 0.1, 0.9 ) );
          visibility += texture2D( occlusionMap, vec2( 0.1, 0.5 ) );
          visibility += texture2D( occlusionMap, vec2( 0.5, 0.5 ) );
          vVisibility = visibility.r / 9.0;
          vVisibility *= 1.0 - visibility.g / 9.0;
          vVisibility *= visibility.b / 9.0;
          gl_Position = vec4( ( pos * scale + screenPosition.xy ).xy, screenPosition.z, 1.0 );
        }`,
    fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D map;
        uniform vec3 color;
        varying vec2 vUV;
        varying float vVisibility;
        void main() {
          vec4 texture = texture2D( map, vUV );
          texture.a *= vVisibility;
          gl_FragColor = texture;
          gl_FragColor.rgb *= color;
        }`,
  };
  texture: Texture;
  size: number;
  distance: number;
  color: Color;

  constructor(texture: Texture, size = 1, distance = 0, color = new Color(0xffffff)) {
    this.texture = texture;
    this.size = size;
    this.distance = distance;
    this.color = color;
  }
}

/** A WebGL lens flare that tracks its world position and is occluded by scene depth.
 * Dispose the instance when finished; its element textures are also disposed.
 */
export class Lensflare extends Mesh<MeshBasicMaterial> {
  static Geometry: BufferGeometry = (() => {
    const geometry = new BufferGeometry();
    const buffer = new InterleavedBuffer(
      new Float32Array([-1, -1, 0, 0, 0, 1, -1, 0, 1, 0, 1, 1, 0, 1, 1, -1, 1, 0, 0, 1]),
      5,
    );
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.setAttribute("position", new InterleavedBufferAttribute(buffer, 3, 0, false));
    geometry.setAttribute("uv", new InterleavedBufferAttribute(buffer, 2, 3, false));
    return geometry;
  })();
  readonly isLensflare: boolean = true;
  addElement: (element: LensflareElement) => void;
  dispose: () => void;

  constructor() {
    super(Lensflare.Geometry, new MeshBasicMaterial({ opacity: 0, transparent: true }));
    this.type = "Lensflare";
    this.frustumCulled = false;
    this.renderOrder = Infinity;
    const positionScreen = new Vector3(),
      positionView = new Vector3();
    const tempMap = new FramebufferTexture(16, 16),
      occlusionMap = new FramebufferTexture(16, 16);
    let currentType: number = UnsignedByteType;
    const geometry = Lensflare.Geometry;
    const material1a = new RawShaderMaterial({
      uniforms: { scale: { value: null }, screenPosition: { value: null } },
      vertexShader: /* glsl */ `
        precision highp float;
        uniform vec3 screenPosition;
        uniform vec2 scale;
        attribute vec3 position;
        void main() { gl_Position = vec4( position.xy * scale + screenPosition.xy, screenPosition.z, 1.0 ); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        void main() { gl_FragColor = vec4( 1.0, 0.0, 1.0, 1.0 ); }`,
      depthTest: true,
      depthWrite: false,
      transparent: false,
    });
    const material1b = new RawShaderMaterial({
      uniforms: { map: { value: tempMap }, scale: { value: null }, screenPosition: { value: null } },
      vertexShader: /* glsl */ `
        precision highp float;
        uniform vec3 screenPosition;
        uniform vec2 scale;
        attribute vec3 position;
        attribute vec2 uv;
        varying vec2 vUV;
        void main() { vUV = uv; gl_Position = vec4( position.xy * scale + screenPosition.xy, screenPosition.z, 1.0 ); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D map;
        varying vec2 vUV;
        void main() { gl_FragColor = texture2D( map, vUV ); }`,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });
    const mesh1 = new Mesh(geometry, material1a);
    const elements: LensflareElement[] = [];
    const shader = LensflareElement.Shader;
    const elementColor = new Color(0xffffff),
      elementScale = new Vector2(),
      elementPosition = new Vector3();
    const material2 = new RawShaderMaterial({
      name: shader.name,
      uniforms: {
        map: { value: null },
        occlusionMap: { value: occlusionMap },
        color: { value: elementColor },
        scale: { value: elementScale },
        screenPosition: { value: elementPosition },
      },
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const mesh2 = new Mesh(geometry, material2);
    this.addElement = (element: LensflareElement): void => {
      elements.push(element);
    };
    const scale = new Vector2(),
      screenPositionPixels = new Vector2(),
      validArea = new Box2(),
      viewport = new Vector4();
    this.onBeforeRender = (renderer: WebGLRenderer, _scene: Object3D, camera: Camera): void => {
      renderer.getCurrentViewport(viewport);
      const renderTarget = renderer.getRenderTarget();
      const type = renderTarget !== null ? renderTarget.texture.type : UnsignedByteType;
      if (currentType !== type) {
        tempMap.dispose();
        occlusionMap.dispose();
        tempMap.type = occlusionMap.type = type;
        currentType = type;
      }
      const invAspect = viewport.w / viewport.z;
      const halfWidth = viewport.z / 2,
        halfHeight = viewport.w / 2;
      let size = 16 / viewport.w;
      scale.set(size * invAspect, size);
      validArea.min.set(viewport.x, viewport.y);
      validArea.max.set(viewport.x + viewport.z - 16, viewport.y + viewport.w - 16);
      positionView.setFromMatrixPosition(this.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      if (positionView.z > 0) return;
      positionScreen.copy(positionView).applyMatrix4(camera.projectionMatrix);
      screenPositionPixels.set(
        viewport.x + positionScreen.x * halfWidth + halfWidth - 8,
        viewport.y + positionScreen.y * halfHeight + halfHeight - 8,
      );
      if (!validArea.containsPoint(screenPositionPixels)) return;
      renderer.copyFramebufferToTexture(tempMap, screenPositionPixels);
      material1a.uniforms.scale.value = scale;
      material1a.uniforms.screenPosition.value = positionScreen;
      renderer.renderBufferDirect(camera, null, geometry, material1a, mesh1, null);
      renderer.copyFramebufferToTexture(occlusionMap, screenPositionPixels);
      material1b.uniforms.scale.value = scale;
      material1b.uniforms.screenPosition.value = positionScreen;
      renderer.renderBufferDirect(camera, null, geometry, material1b, mesh1, null);
      const vecX = -positionScreen.x * 2,
        vecY = -positionScreen.y * 2;
      for (const element of elements) {
        elementColor.copy(element.color);
        material2.uniforms.map.value = element.texture;
        elementPosition.x = positionScreen.x + vecX * element.distance;
        elementPosition.y = positionScreen.y + vecY * element.distance;
        size = element.size / viewport.w;
        elementScale.set(size * invAspect, size);
        material2.uniformsNeedUpdate = true;
        renderer.renderBufferDirect(camera, null, geometry, material2, mesh2, null);
      }
    };
    this.dispose = (): void => {
      material1a.dispose();
      material1b.dispose();
      material2.dispose();
      this.material.dispose();
      tempMap.dispose();
      occlusionMap.dispose();
      for (const element of elements) element.texture.dispose();
    };
  }
}
