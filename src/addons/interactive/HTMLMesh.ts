import { CanvasTexture } from "../../textures/CanvasTexture";
import { PlaneGeometry } from "../../geometries/PlaneGeometry";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { Color } from "../../math/Color";
import { Mesh } from "../../objects/Mesh";
import { Vector2 } from "../../math/Vector2";
import { TextureFilter, ColorSpace } from "../../constants";

interface Clip {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Pointer event forwarded to an {@link HTMLMesh} by an interactive group: `data` holds the
 * intersection UV with the y axis pointing up (texture rows run top-down).
 */
export interface HTMLCanvasPointerEvent {
  type: string;
  data?: Vector2;
}

/** One strokeable border edge of a box: the style triple plus the line segment, as upstream draws it. */
interface BorderEdge {
  width: string;
  style: string;
  color: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

/** The computed-style subset `drawText` needs; a `CSSStyleDeclaration` satisfies it structurally. */
interface TextStyle {
  color: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  textTransform?: string;
}

/** Canvases are reused between renders because a resized canvas allocation is expensive. */
const canvases = new WeakMap<HTMLElement, HTMLCanvasElement>();

function createClipper(context: CanvasRenderingContext2D): { add(clip: Clip): void; remove(): void } {
  const clips: Clip[] = [];
  let isClipping = false;

  function doClip(): void {
    if (isClipping) {
      isClipping = false;
      context.restore();
    }

    if (clips.length === 0) return;

    let minX = -Infinity,
      minY = -Infinity;
    let maxX = Infinity,
      maxY = Infinity;

    for (const clip of clips) {
      minX = Math.max(minX, clip.x);
      minY = Math.max(minY, clip.y);
      maxX = Math.min(maxX, clip.x + clip.width);
      maxY = Math.min(maxY, clip.y + clip.height);
    }

    context.save();
    context.beginPath();
    context.rect(minX, minY, maxX - minX, maxY - minY);
    context.clip();

    isClipping = true;
  }

  return {
    add(clip: Clip): void {
      clips.push(clip);
      doClip();
    },
    remove(): void {
      clips.pop();
      doClip();
    },
  };
}

/**
 * Rasterizes a DOM subtree into a reusable canvas with the 2D API: boxes, borders, text, images,
 * canvases, scrolling clips and native form controls. Only what the DOM actually paints is drawn.
 */
function html2canvas(element: HTMLElement): HTMLCanvasElement {
  const range = document.createRange();
  const color = new Color();

  function drawText(style: TextStyle, x: number, y: number, string: string): void {
    if (string !== "") {
      if (style.textTransform === "uppercase") string = string.toUpperCase();

      context.font = style.fontWeight + " " + style.fontSize + " " + style.fontFamily;
      context.textBaseline = "top";
      context.fillStyle = style.color;
      context.fillText(string, x, y + parseFloat(style.fontSize) * 0.1);
    }
  }

  function buildRectPath(x: number, y: number, w: number, h: number, r: number): void {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;

    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawBorder(edge: BorderEdge): void {
    if (
      edge.width !== "0px" &&
      edge.style !== "none" &&
      edge.color !== "transparent" &&
      edge.color !== "rgba(0, 0, 0, 0)"
    ) {
      context.strokeStyle = edge.color;
      context.lineWidth = parseFloat(edge.width);
      context.beginPath();
      context.moveTo(edge.x, edge.y);
      context.lineTo(edge.x + edge.dx, edge.y + edge.dy);
      context.stroke();
    }
  }

  function borderEdges(style: CSSStyleDeclaration, x: number, y: number, width: number, height: number): BorderEdge[] {
    return [
      {
        width: style.borderTopWidth,
        style: style.borderTopStyle,
        color: style.borderTopColor,
        x,
        y,
        dx: width,
        dy: 0,
      },
      {
        width: style.borderLeftWidth,
        style: style.borderLeftStyle,
        color: style.borderLeftColor,
        x,
        y,
        dx: 0,
        dy: height,
      },
      {
        width: style.borderBottomWidth,
        style: style.borderBottomStyle,
        color: style.borderBottomColor,
        x,
        y: y + height,
        dx: width,
        dy: 0,
      },
      {
        width: style.borderRightWidth,
        style: style.borderRightStyle,
        color: style.borderRightColor,
        x: x + width,
        y,
        dx: 0,
        dy: height,
      },
    ];
  }

  function drawElement(element: Node, inheritedStyle: CSSStyleDeclaration): void {
    // Do not render invisible elements, comments and scripts.
    if (
      element.nodeType === Node.COMMENT_NODE ||
      element.nodeName === "SCRIPT" ||
      ((element instanceof HTMLElement || element instanceof SVGElement) && element.style.display === "none")
    ) {
      return;
    }

    let style = inheritedStyle;

    let x = 0,
      y = 0,
      width = 0,
      height = 0;

    if (element.nodeType === Node.TEXT_NODE) {
      // text
      range.selectNode(element);

      const rect = range.getBoundingClientRect();

      x = rect.left - offset.left - 0.5;
      y = rect.top - offset.top - 0.5;
      width = rect.width;
      height = rect.height;

      drawText(style, x, y, element.nodeValue?.trim() ?? "");
    } else if (element instanceof HTMLCanvasElement) {
      // Canvas element
      const rect = element.getBoundingClientRect();
      x = rect.left - offset.left - 0.5;
      y = rect.top - offset.top - 0.5;
      const canvasWidth = rect.width;
      const canvasHeight = rect.height;
      context.drawImage(element, x, y, canvasWidth, canvasHeight);
    } else if (element instanceof HTMLImageElement) {
      const rect = element.getBoundingClientRect();

      x = rect.left - offset.left - 0.5;
      y = rect.top - offset.top - 0.5;
      width = rect.width;
      height = rect.height;

      context.drawImage(element, x, y, width, height);
    } else {
      if (!(element instanceof Element)) return;

      const rect = element.getBoundingClientRect();

      x = rect.left - offset.left - 0.5;
      y = rect.top - offset.top - 0.5;
      width = rect.width;
      height = rect.height;

      style = window.getComputedStyle(element);

      // Get the border of the element used for fill and border

      buildRectPath(x, y, width, height, parseFloat(style.borderRadius));

      const backgroundColor = style.backgroundColor;

      if (backgroundColor !== "transparent" && backgroundColor !== "rgba(0, 0, 0, 0)") {
        context.fillStyle = backgroundColor;
        context.fill();
      }

      // If all the borders match then stroke the round rectangle

      const edges = borderEdges(style, x, y, width, height);
      const [first] = edges;
      const match = edges.every(
        (edge) => edge.width === first.width && edge.color === first.color && edge.style === first.style,
      );

      if (match === true) {
        // They all match so stroke the rectangle from before allows for border-radius

        const borderWidth = parseFloat(style.borderTopWidth);

        if (
          style.borderTopWidth !== "0px" &&
          style.borderTopStyle !== "none" &&
          style.borderTopColor !== "transparent" &&
          style.borderTopColor !== "rgba(0, 0, 0, 0)"
        ) {
          context.strokeStyle = style.borderTopColor;
          context.lineWidth = borderWidth;
          context.stroke();
        }
      } else {
        // Otherwise draw individual borders

        for (const edge of edges) drawBorder(edge);
      }

      if (element instanceof HTMLInputElement) {
        let accentColor = style.accentColor;

        if (accentColor === "" || accentColor === "auto") accentColor = style.color;

        color.set(accentColor);

        const luminance = Math.sqrt(0.299 * color.r ** 2 + 0.587 * color.g ** 2 + 0.114 * color.b ** 2);
        const accentTextColor = luminance < 0.5 ? "white" : "#111111";

        if (element.type === "radio") {
          buildRectPath(x, y, width, height, height);

          context.fillStyle = "white";
          context.strokeStyle = accentColor;
          context.lineWidth = 1;
          context.fill();
          context.stroke();

          if (element.checked) {
            buildRectPath(x + 2, y + 2, width - 4, height - 4, height);

            context.fillStyle = accentColor;
            context.strokeStyle = accentTextColor;
            context.lineWidth = 2;
            context.fill();
            context.stroke();
          }
        }

        if (element.type === "checkbox") {
          buildRectPath(x, y, width, height, 2);

          context.fillStyle = element.checked ? accentColor : "white";
          context.strokeStyle = element.checked ? accentTextColor : accentColor;
          context.lineWidth = 1;
          context.stroke();
          context.fill();

          if (element.checked) {
            const currentTextAlign = context.textAlign;

            context.textAlign = "center";

            const properties = {
              color: accentTextColor,
              fontFamily: style.fontFamily,
              fontSize: height + "px",
              fontWeight: "bold",
            };

            drawText(properties, x + width / 2, y, "✔");

            context.textAlign = currentTextAlign;
          }
        }

        if (element.type === "range") {
          const min = parseFloat(element.min);
          const max = parseFloat(element.max);
          const value = parseFloat(element.value);
          const position = ((value - min) / (max - min)) * (width - height);

          buildRectPath(x, y + height / 4, width, height / 2, height / 4);
          context.fillStyle = accentTextColor;
          context.strokeStyle = accentColor;
          context.lineWidth = 1;
          context.fill();
          context.stroke();

          buildRectPath(x, y + height / 4, position + height / 2, height / 2, height / 4);
          context.fillStyle = accentColor;
          context.fill();

          buildRectPath(x + position, y, height, height, height / 2);
          context.fillStyle = accentColor;
          context.fill();
        }

        if (
          element.type === "color" ||
          element.type === "text" ||
          element.type === "number" ||
          element.type === "email" ||
          element.type === "password"
        ) {
          clipper.add({ x: x, y: y, width: width, height: height });

          const displayValue = element.type === "password" ? "*".repeat(element.value.length) : element.value;

          drawText(style, x + parseInt(style.paddingLeft), y + parseInt(style.paddingTop), displayValue);

          clipper.remove();
        }
      }
    }

    const isClipping = style.overflow === "auto" || style.overflow === "hidden";

    if (isClipping) clipper.add({ x: x, y: y, width: width, height: height });

    for (let i = 0; i < element.childNodes.length; i++) {
      drawElement(element.childNodes[i], style);
    }

    if (isClipping) clipper.remove();
  }

  const offset = element.getBoundingClientRect();

  let canvas = canvases.get(element);

  if (canvas === undefined) {
    canvas = document.createElement("canvas");
    canvases.set(element, canvas);
  }

  canvas.width = offset.width;
  canvas.height = offset.height;

  const contextOrNull = canvas.getContext("2d");
  if (contextOrNull === null) throw new Error("HTMLMesh requires a 2D canvas context to rasterize the DOM element.");
  const context: CanvasRenderingContext2D = contextOrNull;

  const clipper = createClipper(context);

  context.clearRect(0, 0, canvas.width, canvas.height);

  drawElement(element, window.getComputedStyle(element));

  return canvas;
}

/**
 * Replays one bubbling pointer event on the deepest DOM target at normalized coordinates.
 * Dispatching on every ancestor separately would activate label-backed controls twice.
 */
function htmlevent(element: HTMLElement, event: string, x: number, y: number): void {
  const rect = element.getBoundingClientRect();
  x = x * rect.width + rect.left;
  y = y * rect.height + rect.top;

  let target: Element | undefined;
  function traverse(current: Node): void {
    if (!(current instanceof Element)) return;
    const currentRect = current.getBoundingClientRect();
    if (x > currentRect.left && x < currentRect.right && y > currentRect.top && y < currentRect.bottom) {
      target = current;
    }
    for (const child of current.childNodes) traverse(child);
  }
  traverse(element);
  if (target === undefined) return;

  target.dispatchEvent(
    new MouseEvent(event, {
      clientX: x,
      clientY: y,
      view: element.ownerDocument.defaultView,
      bubbles: true,
      cancelable: true,
    }),
  );

  if (!(target instanceof HTMLInputElement) || (event !== "mousedown" && event !== "click")) return;
  if (target.type === "range") {
    const inputRect = target.getBoundingClientRect();
    const min = parseFloat(target.min);
    const max = parseFloat(target.max);
    target.value = String(min + ((max - min) * (x - inputRect.x)) / inputRect.width);
    target.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
  if (target.type === "text" || target.type === "number" || target.type === "email" || target.type === "password")
    target.focus();
}

/**
 * A canvas texture that rasterizes a DOM element with the internal 2D renderer.
 *
 * DOM mutations are observed and coalesced into a single rerender in the next task, because a
 * renderer is not available here. Form control state (`checked`, `value`) is not reported by
 * `MutationObserver`, so `input` and `change` events are observed too.
 *
 * Unrelated to the experimental HTML-in-canvas texture in `src/textures/HTMLTexture`.
 */
class HTMLCanvasTexture extends CanvasTexture {
  /** The DOM element this texture rasterizes. */
  dom: HTMLElement;

  /** Observes attribute, child list and character data mutations. */
  observer: MutationObserver;

  /** Pending rerender timer handle, or `undefined` when no rerender is scheduled. */
  scheduleUpdate: number | undefined;

  /** Bound rerender scheduler shared with the DOM event listeners. */
  _scheduleUpdate: () => void;

  /** Set by `dispose()` so a late timer callback cannot update a disposed texture. */
  _disposed: boolean;

  /**
   * Constructs a new texture for the given element and its initial canvas.
   *
   * @param dom - The DOM element to rasterize.
   * @param canvas - The canvas returned by the initial `html2canvas` render.
   */
  constructor(dom: HTMLElement, canvas: HTMLCanvasElement) {
    super(canvas);

    this.dom = dom;

    this.anisotropy = 16;
    this.colorSpace = ColorSpace.SRGB;
    this.minFilter = TextureFilter.Linear;
    this.magFilter = TextureFilter.Linear;
    this.generateMipmaps = false;

    this.scheduleUpdate = undefined;
    this._disposed = false;

    const scheduleUpdate = (): void => {
      if (this._disposed || this.scheduleUpdate !== undefined) return;

      // Ideally should use xr.requestAnimationFrame, here setTimeout to avoid passing the renderer.
      this.scheduleUpdate = window.setTimeout(() => {
        this.scheduleUpdate = undefined;
        this.update();
      }, 16);
    };

    this.observer = new MutationObserver(scheduleUpdate);
    this._scheduleUpdate = scheduleUpdate;

    dom.addEventListener("input", scheduleUpdate);
    dom.addEventListener("change", scheduleUpdate);

    this.observer.observe(dom, { attributes: true, childList: true, subtree: true, characterData: true });
  }

  /**
   * Forwards a mesh intersection event to the DOM at the intersection UV.
   *
   * @param event - The pointer event with intersection UV data.
   */
  dispatchDOMEvent(event: HTMLCanvasPointerEvent): void {
    if (event.data) {
      htmlevent(this.dom, event.type, event.data.x, event.data.y);
    }
  }

  /**
   * Rasterizes the DOM element again and marks the texture for upload.
   */
  update(): void {
    if (this._disposed) return;

    this.image = html2canvas(this.dom);
    this.needsUpdate = true;
  }

  /**
   * Disconnects the mutation observer, removes the form listeners and cancels a pending rerender.
   */
  override dispose(): void {
    this._disposed = true;

    this.observer.disconnect();
    this.dom.removeEventListener("input", this._scheduleUpdate);
    this.dom.removeEventListener("change", this._scheduleUpdate);

    window.clearTimeout(this.scheduleUpdate);
    this.scheduleUpdate = undefined;

    super.dispose();
  }
}

/**
 * This class can be used to render a DOM element onto a canvas and use it as a texture
 * for a plane mesh.
 *
 * A typical use case for this class is to render the GUI of `lil-gui` as a texture so it
 * is compatible for VR. Pointer events dispatched on the mesh by an interactive group are
 * replayed on the DOM element, so the rendered GUI stays editable in 3D.
 *
 * ```typescript
 * import { GUI } from 'ek3d/addons/libs/lil-gui/GUI';
 * import { HTMLMesh } from 'ek3d/addons/interactive/HTMLMesh';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 *
 * const gui = new GUI({ width: 300 });
 * // Keep the DOM laid out and focusable, but invisible and click-through on the page.
 * gui.domElement.style.opacity = '0';
 * gui.domElement.style.pointerEvents = 'none';
 *
 * const mesh = new HTMLMesh(gui.domElement);
 * scene.add(mesh);
 * ```
 *
 * @augments Mesh
 * @three_import import { HTMLMesh } from 'ek3d/addons/interactive/HTMLMesh';
 * @demo examples/webgl_interactive_htmlmesh.html
 */
export class HTMLMesh extends Mesh<MeshBasicMaterial> {
  /** The texture rasterizing the DOM element; call `texture.update()` for canvas children that paint imperatively. */
  texture: HTMLCanvasTexture;

  /** Bound listener replaying mesh pointer events on the DOM element. */
  _onEvent: (event: HTMLCanvasPointerEvent) => void;

  /**
   * Constructs a new HTML mesh.
   *
   * @param dom - The DOM element to display as a plane mesh. It must be laid out: `display: none`
   * or a missing parent produces an empty, zero-sized raster.
   */
  constructor(dom: HTMLElement) {
    const canvas = html2canvas(dom);
    const texture = new HTMLCanvasTexture(dom, canvas);
    const geometry = new PlaneGeometry(canvas.width * 0.001, canvas.height * 0.001);
    const material = new MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true });

    super(geometry, material);

    this.texture = texture;

    this._onEvent = (event: HTMLCanvasPointerEvent): void => {
      texture.dispatchDOMEvent(event);
    };

    this.addEventListener("mousedown", this._onEvent);
    this.addEventListener("mousemove", this._onEvent);
    this.addEventListener("mouseup", this._onEvent);
    this.addEventListener("click", this._onEvent);
  }

  /**
   * Frees the GPU-related resources allocated by this instance and removes all event listeners.
   * Call this method whenever this instance is no longer used in your app.
   */
  override dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();

    canvases.delete(this.texture.dom);

    this.removeEventListener("mousedown", this._onEvent);
    this.removeEventListener("mousemove", this._onEvent);
    this.removeEventListener("mouseup", this._onEvent);
    this.removeEventListener("click", this._onEvent);

    super.dispose();
  }
}
