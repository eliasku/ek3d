import { GL } from "ek3d/GL";
import { HTMLMesh } from "ek3d/addons/interactive/HTMLMesh";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Raycaster } from "ek3d/core/Raycaster";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Scene } from "ek3d/scenes/Scene";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("HTMLMesh raster canvas has no 2D context");
  return context;
}

function countOpaque(image: ImageData): number {
  let opaque = 0;
  for (let i = 3; i < image.data.length; i += 4) if (image.data[i] > 0) opaque++;
  return opaque;
}

function pixelAt(image: ImageData, x: number, y: number): number[] {
  const offset = (Math.round(y) * image.width + Math.round(x)) * 4;
  return Array.from(image.data.subarray(offset, offset + 4));
}

/** Serializes a rectangle of the raster so two renders of the same region can be compared. */
function region(image: ImageData, left: number, top: number, width: number, height: number): string {
  const startX = Math.max(0, Math.round(left));
  const startY = Math.max(0, Math.round(top));
  const endX = Math.min(image.width, Math.round(left + width));
  const endY = Math.min(image.height, Math.round(top + height));
  const bytes: number[] = [];
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const offset = (y * image.width + x) * 4;
      bytes.push(image.data[offset], image.data[offset + 1], image.data[offset + 2], image.data[offset + 3]);
    }
  }
  return bytes.join(",");
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * Verifies HTMLMesh in a real DOM: rasterized widget pixels, mesh→DOM pointer replay through a
 * raycast, form state and mutation rerendering, and disposal of the observer plus timers.
 *
 * The container uses `opacity: 0` rather than `visibility: hidden` so the rasterized widgets stay
 * focusable and can be exercised like the real page.
 */
export async function verifyHtmlMesh() {
  const checks: string[] = [];

  const container = document.createElement("div");
  container.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "width:200px",
    "padding:8px",
    "background:#202020",
    "border:2px solid #444444",
    "border-radius:6px",
    "opacity:0",
    "pointer-events:none",
    "font:12px sans-serif",
    "color:#ffffff",
  ].join(";");

  const swatch = document.createElement("div");
  swatch.style.cssText = "width:100%;height:20px;background:#ff0000";
  container.appendChild(swatch);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.style.cssText = "width:16px;height:16px;accent-color:#00aaff";
  const checkboxLabel = document.createElement("label");
  checkboxLabel.appendChild(checkbox);
  container.appendChild(checkboxLabel);

  const text = document.createElement("input");
  text.type = "text";
  text.value = "hello";
  text.style.cssText = "width:120px;height:18px;background:#ffffff;color:#000000";
  let focuses = 0;
  text.addEventListener("focus", () => focuses++);
  container.appendChild(text);

  const range = document.createElement("input");
  range.type = "range";
  range.min = "0";
  range.max = "10";
  range.value = "5";
  range.style.cssText = "width:150px;height:16px";
  container.appendChild(range);

  let clicks = 0;
  let moves = 0;
  const button = document.createElement("button");
  button.textContent = "Click me";
  button.style.cssText = "width:90px;height:22px;background:#cccccc;color:#000000;border:1px solid #888888";
  button.addEventListener("click", () => {
    clicks++;
  });
  button.addEventListener("mousemove", () => {
    moves++;
  });
  container.appendChild(button);

  document.body.appendChild(container);

  const rect = container.getBoundingClientRect();
  check(rect.width > 0 && rect.height > 0, "test container must be laid out");

  // Rasterization.

  const mesh = new HTMLMesh(container);
  let renderer: WebGLRenderer | undefined;
  try {
    const rasterImage = mesh.texture.image;
    check(rasterImage instanceof HTMLCanvasElement, "texture exposes its raster canvas");
    const raster: HTMLCanvasElement = rasterImage;
    // Canvas dimensions are integers, the element rect can be fractional.
    check(Math.abs(raster.width - rect.width) < 1, "raster width follows the element's client width");
    check(Math.abs(raster.height - rect.height) < 1, "raster height follows the element height");

    const initial = getContext(raster).getImageData(0, 0, raster.width, raster.height);
    check(countOpaque(initial) > raster.width * raster.height * 0.5, "the element background is rasterized");
    const swatchRect = swatch.getBoundingClientRect();
    const swatchPixel = pixelAt(initial, swatchRect.left - rect.left + 4, swatchRect.top - rect.top + 4);
    check(swatchPixel[0] > 200 && swatchPixel[1] < 60, `the swatch paints red, got ${swatchPixel.join(",")}`);
    // The outermost pixels hold the stroked border, the padding right after it the panel background.
    const middleRow = Math.round(raster.height / 2);
    const backgroundPixel = pixelAt(initial, 6, middleRow);
    check(
      Math.abs(backgroundPixel[0] - 0x20) < 12 && backgroundPixel[3] > 240,
      `the container background is filled, got ${backgroundPixel.join(",")}`,
    );
    // Edge antialiasing can land the stroke anywhere in the first pixels; any lighter column proves it.
    const borderDrawn = [0, 1, 2, 3].some((column) => pixelAt(initial, column, middleRow)[0] > backgroundPixel[0] + 8);
    check(borderDrawn, "the lighter border is stroked over the container background");

    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    check(bounds !== null, "the plane geometry has a bounding box");
    check(
      Math.abs(bounds.max.x - bounds.min.x - raster.width * 0.001) < 1e-6 &&
        Math.abs(bounds.max.y - bounds.min.y - raster.height * 0.001) < 1e-6,
      "plane size derives from the raster dimensions",
    );
    checks.push("raster");

    // Mesh → DOM pointer replay: real raycast against the plane, then the mesh event path.

    const camera = new PerspectiveCamera(45, 1, 0.1, 10);
    camera.position.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    mesh.updateMatrixWorld(true);

    const raycaster = new Raycaster();
    const planeWidth = bounds.max.x - bounds.min.x;
    const planeHeight = bounds.max.y - bounds.min.y;

    /** Converts a DOM point to a mesh pointer event exactly like an interactive renderer would. */
    function sendToMesh(type: string, domX: number, domY: number): boolean {
      const nx = (domX - rect.left) / rect.width;
      const ny = (domY - rect.top) / rect.height;
      const ndc = new Vector3((nx - 0.5) * planeWidth, (0.5 - ny) * planeHeight, 0).project(camera);

      raycaster.setFromCamera(new Vector2(ndc.x, ndc.y), camera);
      const intersections = raycaster.intersectObject(mesh, false);
      const hit = intersections.length > 0 ? intersections[0] : undefined;
      if (hit === undefined || hit.uv === undefined) return false;

      mesh.dispatchEvent({ type, data: new Vector2(hit.uv.x, 1 - hit.uv.y) });
      return true;
    }

    const buttonRect = button.getBoundingClientRect();
    const buttonX = buttonRect.left + buttonRect.width / 2;
    const buttonY = buttonRect.top + buttonRect.height / 2;
    check(sendToMesh("click", buttonX, buttonY), "raycast reached the HTMLMesh plane");
    check(clicks === 1, "click forwarded through the mesh reached the DOM button");
    sendToMesh("mousemove", buttonX + 4, buttonY);
    check(moves === 1, "mousemove forwarded through the mesh reached the DOM button");
    sendToMesh("mousedown", buttonX, buttonY);
    sendToMesh("mouseup", buttonX, buttonY);
    check(clicks === 1, "mousedown/mouseup do not duplicate the click listener call");

    const checkboxRect = checkbox.getBoundingClientRect();
    check(!checkbox.checked, "checkbox starts unchecked");
    sendToMesh("mousedown", checkboxRect.left + 2, checkboxRect.top + 2);
    sendToMesh("mouseup", checkboxRect.left + 2, checkboxRect.top + 2);
    sendToMesh("click", checkboxRect.left + 2, checkboxRect.top + 2);
    check(checkbox.checked, "mesh pointer replay toggled the checkbox");

    const textRect = text.getBoundingClientRect();
    sendToMesh("mousedown", textRect.left + 4, textRect.top + 4);
    check(focuses > 0, "mesh pointer replay focused the text field");
    text.blur();

    sendToMesh("mousedown", range.getBoundingClientRect().left + 100, range.getBoundingClientRect().top + 4);
    check(Number(range.value) > 5 && Number(range.value) <= 10, "range input followed the pointer position");

    const beforeMiss = clicks;
    raycaster.setFromCamera(new Vector2(3, 3), camera);
    check(raycaster.intersectObject(mesh, false).length === 0, "a pointer outside the plane misses the mesh");
    check(!sendToMesh("click", rect.left - 500, rect.top - 500), "a pointer outside the plane is not forwarded");
    check(clicks === beforeMiss, "a miss forwards no DOM event");
    checks.push("pointer-replay");

    // Form state and DOM mutations schedule a rerender.

    const readRaster = (): ImageData => getContext(raster).getImageData(0, 0, raster.width, raster.height);
    const checkboxRegion = [
      checkboxRect.left - rect.left,
      checkboxRect.top - rect.top,
      checkboxRect.width,
      checkboxRect.height,
    ] as const;

    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(60);
    const uncheckedRaster = readRaster();

    const versionBeforeCheckbox = mesh.texture.version;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(60);
    check(mesh.texture.version > versionBeforeCheckbox, "a change event rerenders the texture");
    const checkedRaster = readRaster();
    check(
      region(uncheckedRaster, ...checkboxRegion) !== region(checkedRaster, ...checkboxRegion),
      "the checked state is rasterized into the checkbox region",
    );
    checks.push("form-rerender");

    const textRegion = [textRect.left - rect.left, textRect.top - rect.top, textRect.width, textRect.height] as const;
    text.value = "a much longer string";
    text.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(60);
    const typedRaster = readRaster();
    check(
      region(typedRaster, ...textRegion) !== region(uncheckedRaster, ...textRegion),
      "the typed form value is rasterized into the text field region",
    );

    const versionBeforeMutation = mesh.texture.version;
    const extra = document.createElement("div");
    extra.style.cssText = "width:100%;height:10px;background:#00ff00";
    container.appendChild(extra);
    await wait(60);
    check(mesh.texture.version > versionBeforeMutation, "a DOM mutation rerenders the texture");
    const mutated = readRaster();
    const extraRect = extra.getBoundingClientRect();
    const extraPixel = pixelAt(mutated, extraRect.left - rect.left + 4, extraRect.top - rect.top + 4);
    check(extraPixel[1] > 200 && extraPixel[0] < 60, `the appended node is painted, got ${extraPixel.join(",")}`);
    checks.push("mutation-rerender");

    // WebGL: the raster is actually drawn on the plane.

    renderer = new WebGLRenderer({ preserveDrawingBuffer: true, shaders: { MeshBasicMaterial: basicShader } });
    renderer.setPixelRatio(1);
    renderer.setSize(256, 256);

    const scene = new Scene();
    scene.add(mesh);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);

    const gl = renderer.getContext();
    const framebuffer = new Uint8Array(256 * 256 * 4);
    gl.readPixels(0, 0, 256, 256, GL.RGBA, GL.UNSIGNED_BYTE, framebuffer);
    let varied = false;
    for (let i = 4; i < framebuffer.length; i += 4) {
      if (
        framebuffer[i] !== framebuffer[0] ||
        framebuffer[i + 1] !== framebuffer[1] ||
        framebuffer[i + 2] !== framebuffer[2]
      ) {
        varied = true;
        break;
      }
    }
    check(varied, "the HTML texture renders varied pixels on the plane");
    checks.push("render");

    // Forced updates stay available for imperatively painted canvas children.

    const versionBeforeUpdate = mesh.texture.version;
    mesh.texture.update();
    check(mesh.texture.version > versionBeforeUpdate, "manual update() re-uploads the texture");
    checks.push("manual-update");

    // Disposal disconnects the observer and cancels a pending rerender.

    extra.remove();
    await wait(60);
    const versionBeforeDispose = mesh.texture.version;

    container.appendChild(extra); // schedules a rerender that must be cancelled
    await wait(5); // the observer microtask runs long before the 16 ms rerender timer
    check(mesh.texture.scheduleUpdate !== undefined, "a mutation scheduled a pending rerender");

    mesh.dispose();
    check(mesh.texture.scheduleUpdate === undefined, "dispose cancels the pending rerender timer");

    await wait(60);
    check(mesh.texture.version === versionBeforeDispose, "no rerender runs after dispose");

    container.appendChild(document.createElement("span"));
    text.value = "after dispose";
    text.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(60);
    check(
      mesh.texture.version === versionBeforeDispose,
      "dispose disconnected the mutation observer and form listeners",
    );

    const clicksBeforeDispose = clicks;
    mesh.dispatchEvent({
      type: "click",
      data: new Vector2((buttonX - rect.left) / rect.width, (buttonY - rect.top) / rect.height),
    });
    check(clicks === clicksBeforeDispose, "dispose removed the mesh-to-DOM event listeners");
    checks.push("dispose");

    const glError = gl.getError();
    check(glError === GL.NO_ERROR, "HTMLMesh rendering produced a WebGL error");

    return { checks, glError };
  } finally {
    mesh.dispose();
    renderer?.dispose();
    container.remove();
  }
}
