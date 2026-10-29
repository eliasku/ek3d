import { Matrix4 } from "../../math/Matrix4";
import { Vector3 } from "../../math/Vector3";
import type { Camera } from "../../cameras/Camera";
import type { Object3D } from "../../core/Object3D";
import type { HTMLTexture } from "../../textures/HTMLTexture";

const _pixelToLocal = new Matrix4();
const _mvp = new Matrix4();
const _viewport = new Matrix4();
const _size = new Vector3();

/** Any renderer exposing the canvas element used to host HTML textures. */
interface RendererLike {
  domElement: HTMLCanvasElement | OffscreenCanvas;
}

/**
 * Manages interaction for 3D objects independently of the scene graph.
 *
 * For objects with an {@link HTMLTexture}, the manager computes CSS `matrix3d`
 * transforms each frame so the underlying HTML elements stay aligned with
 * their meshes. Because the elements are children of the canvas, the browser
 * dispatches pointer events to them natively.
 *
 * ```ts
 * const interactions = new InteractionManager();
 * interactions.connect( renderer, camera );
 *
 * // Objects live anywhere in the scene graph
 * scene.add( mesh );
 *
 * // Register for interaction separately
 * interactions.add( mesh );
 *
 * // In the animation loop
 * interactions.update();
 * ```
 *
 */
export class InteractionManager {
  /**
   * The registered interactive objects.
   */
  objects: Object3D[];

  /**
   * The canvas element.
   *
   * @default null
   */
  element: HTMLCanvasElement | OffscreenCanvas | null;

  /**
   * The camera used for computing the element transforms.
   *
   * @default null
   */
  camera: Camera | null;

  private _cachedCssW: number;
  private _cachedCssH: number;

  constructor() {
    this.objects = [];

    this.element = null;

    this.camera = null;

    this._cachedCssW = -1;
    this._cachedCssH = -1;
  }

  /**
   * Adds one or more objects to the manager.
   *
   * @param objects - The objects to add.
   * @return A reference to this manager.
   */
  add(...objects: Object3D[]): this {
    for (const object of objects) {
      if (this.objects.indexOf(object) === -1) {
        this.objects.push(object);
      }
    }

    return this;
  }

  /**
   * Removes one or more objects from the manager.
   *
   * @param objects - The objects to remove.
   * @return A reference to this manager.
   */
  remove(...objects: Object3D[]): this {
    for (const object of objects) {
      const index = this.objects.indexOf(object);

      if (index !== -1) {
        this.objects.splice(index, 1);
      }
    }

    return this;
  }

  /**
   * Stores the renderer and camera needed for computing element transforms.
   *
   * @param renderer - The WebGL renderer.
   * @param camera - The camera.
   */
  connect(renderer: RendererLike, camera: Camera): void {
    this.camera = camera;
    this.element = renderer.domElement;
  }

  /**
   * Updates the element transforms for all registered objects.
   * Call this once per frame in the animation loop.
   */
  update(): void {
    const canvas = this.element;
    const camera = this.camera;

    if (canvas === null || camera === null) return;

    // Viewport: NDC (-1,1) to canvas CSS pixels, Y flipped.
    // Using CSS pixels (clientWidth/clientHeight) so the resulting matrix
    // can be applied directly as a CSS transform without DPR conversion.

    const cssW = canvas instanceof HTMLCanvasElement ? canvas.clientWidth : 0;
    const cssH = canvas instanceof HTMLCanvasElement ? canvas.clientHeight : 0;

    if (cssW !== this._cachedCssW || cssH !== this._cachedCssH) {
      _viewport.set(cssW / 2, 0, 0, cssW / 2, 0, -cssH / 2, 0, cssH / 2, 0, 0, 1, 0, 0, 0, 0, 1);

      this._cachedCssW = cssW;
      this._cachedCssH = cssH;
    }

    for (const object of this.objects) {
      const holder = object as unknown as { material?: { map?: HTMLTexture } | undefined };
      const texture = holder.material?.map;

      if (!texture || !texture.isHTMLTexture) continue;

      const element = texture.image as HTMLElement | undefined;

      if (!element) continue;

      // Position at canvas origin so the CSS matrix3d maps correctly.
      element.style.position = "absolute";
      element.style.left = "0";
      element.style.top = "0";
      element.style.transformOrigin = "0 0";

      const elemW = element.offsetWidth;
      const elemH = element.offsetHeight;

      // Get mesh dimensions from geometry bounding box

      const holder2 = object as unknown as { geometry: import("../../geometries/BoxGeometry").BoxGeometry };
      const geometry = holder2.geometry;

      if (!geometry.boundingBox) geometry.computeBoundingBox();

      geometry.boundingBox!.getSize(_size);

      // Map element pixel coords (0,0)-(elemW,elemH) to mesh local coords.
      // Front face: top-left at (-sizeX/2, sizeY/2, maxZ), bottom-right at (sizeX/2, -sizeY/2, maxZ).

      _pixelToLocal.set(
        _size.x / elemW,
        0,
        0,
        -_size.x / 2,
        0,
        -_size.y / elemH,
        0,
        _size.y / 2,
        0,
        0,
        1,
        geometry.boundingBox!.max.z,
        0,
        0,
        0,
        1,
      );

      // Model-View-Projection

      _mvp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      _mvp.multiply(object.matrixWorld);
      _mvp.multiply(_pixelToLocal);

      // Apply viewport

      _mvp.premultiply(_viewport);

      // The browser performs the perspective divide (by w) when applying the matrix3d.

      element.style.transform = "matrix3d(" + _mvp.elements.join(",") + ")";
    }
  }

  /**
   * Disconnects this manager, clearing the renderer and camera references.
   */
  disconnect(): void {
    this.camera = null;
    this.element = null;
    this._cachedCssW = -1;
    this._cachedCssH = -1;
  }
}
