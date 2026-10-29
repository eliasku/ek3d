import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, firefox, webkit } from "playwright";
import type { Browser, Page } from "playwright";
import { createServer, preview } from "vite-plus";
import type { PreviewServer, ViteDevServer } from "vite-plus";

export type BrowserName = "chromium" | "firefox" | "webkit";
const chromiumArgs = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
// Firefox's Linux headless path may disable WebGL; use the supplied display (including Xvfb) when available.
const firefoxHeadless = !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;

export function launchBrowser(name: BrowserName): Promise<Browser> {
  return { chromium, firefox, webkit }[name].launch({
    headless: name === "firefox" ? firefoxHeadless : true,
    ...(name === "chromium" ? { args: chromiumArgs } : {}),
  });
}

const lifecycles = [
  ["browser.ts", "verifyRenderingBoundaries"],
  ["browser-core.ts", "verifyRendererDisposal"],
  ["browser.ts", "verifyTextureLifecycle"],
  ["browser.ts", "verifyLambertLighting"],
  ["browser.ts", "verifyBackgroundLifecycle"],
  ["browser.ts", "verifyEnvironmentLifecycle"],
  ["browser-shadow.ts", "verifyShadowLifecycle"],
  ["browser-output.ts", "verifyOutputLifecycle"],
  ["browser.ts", "verifyBufferLifecycle"],
  ["browser-core.ts", "verifyFogRendering"],
  ["browser-core.ts", "verifyUniformGroups"],
  ["browser-objects.ts", "verifyObjectRendering"],
  ["browser-instancing.ts", "verifyInstancingRendering"],
  ["browser-batching.ts", "verifyBatchingRendering"],
  ["browser-deformation.ts", "verifyDeformationRendering"],
  ["browser-lights.ts", "verifyLightRendering"],
  ["browser-materials.ts", "verifyMaterialRendering"],
  ["browser-textures.ts", "runTextureChecks"],
  ["browser-loaders.ts", "checkLoaders"],
  ["browser-object-loaders.ts", "objectLoaderBrowserChecks"],
  ["browser-targets.ts", "verifyLayeredTargets"],
  ["browser-addon-shaders.ts", "verifyAddonShaders"],
  ["browser-postprocessing.ts", "verifyPostprocessing"],
  ["browser-orbit-controls.ts", "verifyOrbitControls"],
  ["browser-font-text.ts", "verifyFontText"],
  ["browser-lil-gui.ts", "verifyLilGui"],
  ["browser-htmlmesh.ts", "verifyHtmlMesh"],
  ["browser-shaders.ts", "verifyCustomShaders"],
  ["browser-helpers.ts", "verifyHelpers"],
] as const;

type Failure = { check: string; error: string };

export interface BrowserReport {
  checks: string[];
  failures: Failure[];
}

function observe(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" ||
      (message.type() === "warning" &&
        /shader|webgl.*(?:error|invalid|failed)|GL_INVALID|GL_OUT_OF_MEMORY/i.test(message.text()))
    ) {
      errors.push(message.text());
    }
  });
  page.on("requestfailed", (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`);
  });
  return errors;
}

async function framebuffer(page: Page) {
  const frame = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#scene");
    const gl = canvas?.getContext("webgl2");
    if (!canvas || !gl) throw new Error("Scene did not create a real WebGL 2 canvas");
    if (canvas.dataset.state !== "rendered") throw new Error(canvas.dataset.error ?? "Scene is not rendered");
    if (gl.isContextLost()) throw new Error("Scene lost its WebGL context");
    gl.finish();
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    const previous = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous);
    if (gl.getError() !== gl.NO_ERROR) throw new Error("Framebuffer read failed");
    let varied = false;
    for (let i = 4; i < pixels.length; i += 4) {
      if (pixels[i] !== pixels[0] || pixels[i + 1] !== pixels[1] || pixels[i + 2] !== pixels[2]) {
        varied = true;
        break;
      }
    }
    // Read actual WebGL pixels, excluding the separate canvas overlay.
    let binary = "";
    for (let offset = 0; offset < pixels.length; offset += 8192)
      binary += String.fromCharCode(...pixels.subarray(offset, offset + 8192));
    return { width: canvas.width, height: canvas.height, varied, rgba: btoa(binary) };
  });
  const bytes = Buffer.from(frame.rgba, "base64");
  assert.equal(bytes.length, frame.width * frame.height * 4);
  assert(frame.varied, "Example framebuffer is uniform");
  return { width: frame.width, height: frame.height, hash: createHash("sha256").update(bytes).digest("hex") };
}

async function verifyExample(page: Page, baseURL: string) {
  await page.goto(new URL("testbed/index.html", baseURL).href, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector<HTMLCanvasElement>("#scene")?.dataset.state !== undefined);
  await framebuffer(page);
  await page.keyboard.press("Space");
  assert.equal(await page.locator("#scene").getAttribute("data-paused"), "true");
  const helpPixel = () =>
    page.evaluate(() => {
      const overlay = document.querySelector<HTMLCanvasElement>("#overlay")!;
      return overlay.getContext("2d")!.getImageData(20, 100, 1, 1).data[3];
    });
  assert.equal(await helpPixel(), 0, "Help should start compact");
  const beforeHelp = await framebuffer(page);
  await page.mouse.click(100, 25);
  assert.ok((await helpPixel()) > 0, "Clicking the help title should expand it");
  assert.equal((await framebuffer(page)).hash, beforeHelp.hash, "Help click changed the scene");
  await page.keyboard.press("?");
  assert.equal(await helpPixel(), 0, "The help shortcut should collapse it while paused");
  let previous = await framebuffer(page);
  // Give a mistakenly running animation time to change pixels; no timing is measured or asserted.
  await page.waitForTimeout(100);
  assert.equal((await framebuffer(page)).hash, previous.hash, "Paused animation changed the rendered scene");
  for (const projection of ["perspective", "orthographic"]) {
    assert.equal(await page.locator("#scene").getAttribute("data-camera"), projection);
    const unselected = await framebuffer(page);
    await page.mouse.click(480, 340);
    assert.equal(await page.locator("#scene").getAttribute("data-selected"), "Cylinder");
    assert.notEqual((await framebuffer(page)).hash, unselected.hash, "Picking did not visibly select the object");
    await page.mouse.click(950, 10);
    assert.equal(await page.locator("#scene").getAttribute("data-selected"), "");
    assert.equal((await framebuffer(page)).hash, unselected.hash, "Clearing selection did not restore the scene");
    await page.keyboard.press("a");
    assert.equal(await page.locator("#scene").getAttribute("data-ambient"), "true");
    assert.notEqual((await framebuffer(page)).hash, unselected.hash, `${projection}: ambient fill is invisible`);
    await page.keyboard.press("a");
    assert.equal((await framebuffer(page)).hash, unselected.hash, `${projection}: ambient fill did not turn off`);
    for (const light of ["point", "spot", "directional"]) {
      const before = await framebuffer(page);
      await page.keyboard.press("l");
      assert.equal(await page.locator("#scene").getAttribute("data-light"), light);
      const lit = await framebuffer(page);
      assert.notEqual(lit.hash, before.hash, `${projection}: ${light} switch is invisible`);
      if (light === "spot") {
        await page.keyboard.press("k");
        assert.equal(await page.locator("#scene").getAttribute("data-cookie"), "true");
        assert.notEqual((await framebuffer(page)).hash, lit.hash, `${projection}: spot cookie is invisible`);
        await page.keyboard.press("k");
        assert.equal(await page.locator("#scene").getAttribute("data-cookie"), "false");
        assert.equal((await framebuffer(page)).hash, lit.hash, `${projection}: spot cookie did not detach`);
        await page.keyboard.press("s");
        assert.notEqual((await framebuffer(page)).hash, lit.hash, `${projection}: spot shadows are invisible`);
        await page.keyboard.press("s");
        assert.equal((await framebuffer(page)).hash, lit.hash, `${projection}: spot shadows did not restore`);
      }
    }
    assert.equal((await framebuffer(page)).hash, unselected.hash, `${projection}: light cycle did not restore`);
    await page.keyboard.press("c");
    assert.notEqual((await framebuffer(page)).hash, unselected.hash, "Camera switch did not change rendered pixels");
  }
  const clear = await framebuffer(page);
  for (const fog of ["linear", "exp2", "off"]) {
    await page.keyboard.press("f");
    assert.equal(await page.locator("#scene").getAttribute("data-fog"), fog);
    const fogged = await framebuffer(page);
    if (fog === "off") assert.equal(fogged.hash, clear.hash, "Removing fog did not restore the scene");
    else assert.notEqual(fogged.hash, clear.hash, `${fog} fog is invisible`);
  }
  await page.keyboard.press("n");
  assert.notEqual((await framebuffer(page)).hash, clear.hash, "Uniform group update is invisible");
  await page.keyboard.press("n");
  assert.equal((await framebuffer(page)).hash, clear.hash, "Uniform group restore changed the scene");
  previous = await framebuffer(page);

  for (const key of ["i", "i", "s", "s", "b", "b", "e", "e", "u", "u", "t", "t", "t", "t", "t", "=", "-"]) {
    await page.keyboard.press(key);
    const current = await framebuffer(page);
    assert.notEqual(current.hash, previous.hash, `Control ${key} did not change rendered pixels`);
    previous = current;
  }
  const primitives = previous;
  await page.keyboard.press("g");
  assert.equal(await page.locator("#scene").getAttribute("data-geometries"), "curves");
  assert.notEqual((await framebuffer(page)).hash, primitives.hash, "Curve geometries did not replace the primitives");
  for (const [projection, holeX, holeY] of [
    ["perspective", 627, 395],
    ["orthographic", 612, 391],
  ] as const) {
    assert.equal(await page.locator("#scene").getAttribute("data-camera"), projection);
    const unselected = await framebuffer(page);
    for (const [name, x, y] of [
      ["Tube", 350, 297],
      ["Extrude", 480, 305],
      ["Shape", 575, 380],
    ] as const) {
      await page.mouse.click(x, y);
      assert.equal(await page.locator("#scene").getAttribute("data-selected"), name, `${projection}: picking ${name}`);
      assert.notEqual((await framebuffer(page)).hash, unselected.hash, `${projection}: ${name} selection is invisible`);
      await page.mouse.click(950, 10);
      assert.equal(await page.locator("#scene").getAttribute("data-selected"), "");
      assert.equal((await framebuffer(page)).hash, unselected.hash, `${projection}: clearing ${name} selection`);
    }
    for (const [name, x, y] of [
      ["Extrude", 480, 340],
      ["Shape", holeX, holeY],
    ] as const) {
      await page.mouse.click(x, y);
      assert.equal(
        await page.locator("#scene").getAttribute("data-selected"),
        "",
        `${projection}: ${name} hole was filled`,
      );
      assert.equal((await framebuffer(page)).hash, unselected.hash, `${projection}: picking a hole changed the scene`);
    }
    previous = unselected;
    for (const key of ["l", "l", "l", "s", "s"]) {
      await page.keyboard.press(key);
      const current = await framebuffer(page);
      assert.notEqual(current.hash, previous.hash, `${projection}: curve geometry control ${key} is invisible`);
      previous = current;
    }
    await page.keyboard.press("c");
    assert.notEqual((await framebuffer(page)).hash, previous.hash, "Curve geometry camera switch is invisible");
  }
  await page.mouse.click(575, 380);
  assert.equal(await page.locator("#scene").getAttribute("data-selected"), "Shape");
  await page.keyboard.press("g");
  assert.equal(await page.locator("#scene").getAttribute("data-geometries"), "primitives");
  assert.equal(
    await page.locator("#scene").getAttribute("data-selected"),
    "",
    "Geometry switch retained a hidden selection",
  );
  previous = await framebuffer(page);
  assert.equal(previous.hash, primitives.hash, "Returning to primitives did not restore the original scene");
  await page.keyboard.press("o");
  assert.equal(await page.locator("#scene").getAttribute("data-geometries"), "objects");
  assert.notEqual((await framebuffer(page)).hash, primitives.hash, "Line/point/sprite mode is invisible");
  for (const [projection, positions] of [
    [
      "perspective",
      [
        [306, 281],
        [385, 281],
        [429, 320],
        [584, 380],
        [704, 422],
      ],
    ],
    [
      "orthographic",
      [
        [289, 273],
        [384, 280],
        [432, 322],
        [576, 378],
        [671, 414],
      ],
    ],
  ] as const) {
    assert.equal(await page.locator("#scene").getAttribute("data-camera"), projection);
    const unselected = await framebuffer(page);
    for (const [i, name] of ["Line", "LineLoop", "LineSegments", "Points", "Sprite"].entries()) {
      await page.mouse.click(positions[i][0], positions[i][1]);
      assert.equal(await page.locator("#scene").getAttribute("data-selected"), name, `${projection}: picking ${name}`);
      assert.notEqual((await framebuffer(page)).hash, unselected.hash, `${projection}: ${name} selection is invisible`);
      await page.mouse.click(950, 10);
      assert.equal(await page.locator("#scene").getAttribute("data-selected"), "");
      assert.equal((await framebuffer(page)).hash, unselected.hash, `${projection}: clearing ${name}`);
    }
    await page.keyboard.press("f");
    assert.notEqual((await framebuffer(page)).hash, unselected.hash, `${projection}: object fog is invisible`);
    await page.keyboard.press("f");
    await page.keyboard.press("f");
    assert.equal((await framebuffer(page)).hash, unselected.hash);
    await page.keyboard.press("c");
  }
  await page.keyboard.press("o");
  assert.equal(await page.locator("#scene").getAttribute("data-geometries"), "primitives");
  assert.equal((await framebuffer(page)).hash, primitives.hash, "Leaving object mode did not restore the scene");
  await page.mouse.click(480, 340);
  assert.equal(await page.locator("#scene").getAttribute("data-selected"), "Cylinder");
  await page.keyboard.press("m");
  assert.equal(await page.locator("#scene").getAttribute("data-geometries"), "instances");
  assert.equal(await page.locator("#scene").getAttribute("data-selected"), "", "Entering instances retained selection");
  assert.equal(await page.locator("#scene").getAttribute("data-instance-id"), "");
  assert.notEqual((await framebuffer(page)).hash, primitives.hash, "Instanced boxes did not replace the primitives");
  async function clickInstance(id: number) {
    const position = await page.locator("#scene").getAttribute(`data-instance${id}`);
    assert(position, `Instance ${id} has no projected canvas position`);
    const [x, y] = position.split(",").map(Number);
    const bounds = await page.locator("#scene").boundingBox();
    assert(bounds);
    assert(Number.isFinite(x) && Number.isFinite(y) && x > 0 && x < bounds.width && y > 0 && y < bounds.height);
    await page.mouse.click(bounds.x + x, bounds.y + y);
    assert.equal(await page.locator("#scene").getAttribute("data-selected"), "Instances");
    assert.equal(await page.locator("#scene").getAttribute("data-instance-id"), String(id));
  }
  for (const projection of ["perspective", "orthographic"]) {
    assert.equal(await page.locator("#scene").getAttribute("data-camera"), projection);
    const unselected = await framebuffer(page);
    let highlighted = unselected.hash;
    for (let id = 0; id < 3; id++) {
      await clickInstance(id);
      const current = await framebuffer(page);
      assert.notEqual(current.hash, unselected.hash, `${projection}: instance ${id} highlight is invisible`);
      assert.notEqual(
        current.hash,
        highlighted,
        `${projection}: selecting another instance did not move the highlight`,
      );
      highlighted = current.hash;
    }
    await page.mouse.click(950, 10);
    assert.equal(await page.locator("#scene").getAttribute("data-selected"), "");
    assert.equal(await page.locator("#scene").getAttribute("data-instance-id"), "");
    assert.equal((await framebuffer(page)).hash, unselected.hash, `${projection}: instance colors were not restored`);
    for (const light of ["directional", "point", "spot"]) {
      assert.equal(await page.locator("#scene").getAttribute("data-light"), light);
      const shadowed = await framebuffer(page);
      await page.keyboard.press("s");
      assert.equal(await page.locator("#scene").getAttribute("data-shadows"), "false");
      assert.notEqual(
        (await framebuffer(page)).hash,
        shadowed.hash,
        `${projection}: ${light} instance shadows missing`,
      );
      await page.keyboard.press("s");
      assert.equal(await page.locator("#scene").getAttribute("data-shadows"), "true");
      assert.equal((await framebuffer(page)).hash, shadowed.hash, `${projection}: ${light} shadows were not restored`);
      await page.keyboard.press("l");
      assert.notEqual((await framebuffer(page)).hash, shadowed.hash, `${projection}: instance lighting did not change`);
    }
    await page.keyboard.press("c");
    assert.notEqual((await framebuffer(page)).hash, unselected.hash, "Instance camera switch is invisible");
  }
  const beforeStep = await framebuffer(page);
  const versionBeforeStep = Number(await page.locator("#scene").getAttribute("data-instance-version"));
  await page.keyboard.press("r");
  assert.equal(Number(await page.locator("#scene").getAttribute("data-instance-version")), versionBeforeStep + 1);
  assert.notEqual((await framebuffer(page)).hash, beforeStep.hash, "Instance matrix upload is invisible");
  for (const projection of ["perspective", "orthographic"]) {
    assert.equal(await page.locator("#scene").getAttribute("data-camera"), projection);
    for (let id = 0; id < 3; id++) await clickInstance(id);
    await page.mouse.click(950, 10);
    await page.keyboard.press("c");
  }
  const beforeAnimation = await framebuffer(page);
  const versionBeforeAnimation = Number(await page.locator("#scene").getAttribute("data-instance-version"));
  await page.keyboard.press("Space");
  await page.waitForFunction(
    (version) => Number(document.querySelector<HTMLCanvasElement>("#scene")?.dataset.instanceVersion) > version + 4,
    versionBeforeAnimation,
  );
  await page.keyboard.press("Space");
  assert.equal(await page.locator("#scene").getAttribute("data-paused"), "true");
  const animated = await framebuffer(page);
  assert.notEqual(animated.hash, beforeAnimation.hash, "Animated instance matrices did not change rendered pixels");
  await page.waitForTimeout(100);
  assert.equal((await framebuffer(page)).hash, animated.hash, "Paused instances continued moving");
  await clickInstance(1);
  await page.keyboard.press("m");
  assert.equal(await page.locator("#scene").getAttribute("data-geometries"), "primitives");
  assert.equal(await page.locator("#scene").getAttribute("data-selected"), "", "Leaving instances retained selection");
  assert.equal(await page.locator("#scene").getAttribute("data-instance-id"), "");
  assert.equal(await page.locator("#scene").getAttribute("data-instance0"), null, "Hidden instance positions remain");
  assert.equal((await framebuffer(page)).hash, primitives.hash, "Leaving instances did not restore the prior scene");
  for (const [key, mode] of [
    ["g", "curves"],
    ["o", "objects"],
  ] as const) {
    await page.keyboard.press(key);
    const priorMode = await framebuffer(page);
    await page.keyboard.press("m");
    assert.equal(await page.locator("#scene").getAttribute("data-geometries"), "instances");
    await clickInstance(0);
    await page.keyboard.press("m");
    assert.equal(await page.locator("#scene").getAttribute("data-geometries"), mode);
    assert.equal(await page.locator("#scene").getAttribute("data-instance-id"), "");
    assert.equal((await framebuffer(page)).hash, priorMode.hash, `Instances did not restore ${mode} mode`);
    await page.keyboard.press(key);
    assert.equal(await page.locator("#scene").getAttribute("data-geometries"), "primitives");
    assert.equal((await framebuffer(page)).hash, primitives.hash);
  }
  await page.keyboard.press("h");
  assert.equal(await page.locator("#scene").getAttribute("data-geometries"), "batching");
  assert.notEqual((await framebuffer(page)).hash, primitives.hash, "Batch/LOD mode is invisible");
  async function projectedPosition(attribute: string) {
    const position = await page.locator("#scene").getAttribute(attribute);
    assert(position, `Missing projected ${attribute}`);
    const [x, y] = position.split(",").map(Number);
    const bounds = await page.locator("#scene").boundingBox();
    assert(bounds);
    assert(Number.isFinite(x) && Number.isFinite(y) && x > 0 && x < bounds.width && y > 0 && y < bounds.height);
    return { x: bounds.x + x, y: bounds.y + y };
  }
  async function clickBatch(id: number) {
    const { x, y } = await projectedPosition(`data-batch${id}`);
    await page.mouse.click(x, y);
    assert.equal(await page.locator("#scene").getAttribute("data-selected"), "BatchedMesh");
    assert.equal(await page.locator("#scene").getAttribute("data-batch-id"), String(id));
  }
  for (const projection of ["perspective", "orthographic"]) {
    assert.equal(await page.locator("#scene").getAttribute("data-camera"), projection);
    const unselected = await framebuffer(page);
    let highlighted = unselected.hash;
    for (const id of [0, 1]) {
      await clickBatch(id);
      const current = await framebuffer(page);
      assert.notEqual(current.hash, unselected.hash, `${projection}: batch ${id} selection is invisible`);
      assert.notEqual(current.hash, highlighted, `${projection}: batch selection did not move`);
      highlighted = current.hash;
    }
    const lodPosition = await projectedPosition("data-lod-position");
    await page.mouse.click(lodPosition.x, lodPosition.y);
    assert.equal(await page.locator("#scene").getAttribute("data-selected"), "LOD");
    assert.equal(await page.locator("#scene").getAttribute("data-batch-id"), "");
    assert.notEqual((await framebuffer(page)).hash, unselected.hash, `${projection}: LOD selection is invisible`);
    await page.mouse.click(950, 10);
    assert.equal(await page.locator("#scene").getAttribute("data-selected"), "");
    assert.equal((await framebuffer(page)).hash, unselected.hash, `${projection}: clearing batch/LOD selection`);
    for (const [key, id, attribute, absent, present] of [
      ["j", 0, "data-batch-visible", "false", "true"],
      ["x", 1, "data-batch-count", "1", "2"],
    ] as const) {
      const position = await projectedPosition(`data-batch${id}`);
      await clickBatch(id);
      await page.keyboard.press(key);
      assert.equal(await page.locator("#scene").getAttribute(attribute), absent);
      assert.equal(await page.locator("#scene").getAttribute(`data-batch${id}`), null);
      assert.equal(await page.locator("#scene").getAttribute("data-selected"), "");
      assert.equal(await page.locator("#scene").getAttribute("data-batch-id"), "");
      const removed = await framebuffer(page);
      assert.notEqual(removed.hash, unselected.hash, `${projection}: ${key} did not remove rendered batch`);
      await page.mouse.click(position.x, position.y);
      assert.equal(
        await page.locator("#scene").getAttribute("data-selected"),
        "",
        `${projection}: removed batch picked`,
      );
      assert.equal((await framebuffer(page)).hash, removed.hash, "Picking removed batch changed pixels");
      await page.keyboard.press(key);
      assert.equal(await page.locator("#scene").getAttribute(attribute), present);
      assert.equal((await framebuffer(page)).hash, unselected.hash, `${projection}: batch restore changed pixels`);
      await clickBatch(id);
      await page.mouse.click(950, 10);
    }
    for (const light of ["directional", "point", "spot"]) {
      assert.equal(await page.locator("#scene").getAttribute("data-light"), light);
      const shadowed = await framebuffer(page);
      await page.keyboard.press("s");
      assert.notEqual((await framebuffer(page)).hash, shadowed.hash, `${projection}: ${light} batch shadows missing`);
      await page.keyboard.press("s");
      assert.equal((await framebuffer(page)).hash, shadowed.hash, `${projection}: batch shadows not restored`);
      await page.keyboard.press("l");
      assert.notEqual((await framebuffer(page)).hash, shadowed.hash, `${projection}: batch lighting is invisible`);
    }
    const phase = Number(await page.locator("#scene").getAttribute("data-batch-phase"));
    const beforeStep = await framebuffer(page);
    await page.keyboard.press("r");
    assert.equal(Number(await page.locator("#scene").getAttribute("data-batch-phase")), phase + 0.5);
    assert.notEqual((await framebuffer(page)).hash, beforeStep.hash, `${projection}: batch matrix update is invisible`);
    for (const id of [0, 1]) await clickBatch(id);
    await page.mouse.click(950, 10);
    await page.mouse.move(480, 340);
    await page.mouse.wheel(0, 700);
    await page.waitForFunction(() => document.querySelector<HTMLCanvasElement>("#scene")?.dataset.lodLevel === "1");
    const distant = await framebuffer(page);
    const farPosition = await projectedPosition("data-lod-position");
    await page.mouse.click(farPosition.x, farPosition.y);
    assert.equal(await page.locator("#scene").getAttribute("data-selected"), "LOD", `${projection}: far LOD picking`);
    await page.mouse.click(950, 10);
    await page.mouse.move(480, 340);
    await page.mouse.wheel(0, -1200);
    await page.waitForFunction(() => document.querySelector<HTMLCanvasElement>("#scene")?.dataset.lodLevel === "0");
    assert.notEqual((await framebuffer(page)).hash, distant.hash, `${projection}: LOD zoom change is invisible`);
    const nearPosition = await projectedPosition("data-lod-position");
    await page.mouse.click(nearPosition.x, nearPosition.y);
    assert.equal(await page.locator("#scene").getAttribute("data-selected"), "LOD", `${projection}: near LOD picking`);
    await page.mouse.click(950, 10);
    await page.mouse.move(480, 340);
    const beforeRestore = await page.locator("#scene").getAttribute("data-frame");
    await page.mouse.wheel(0, 500);
    await page.waitForFunction(
      (frame) => document.querySelector<HTMLCanvasElement>("#scene")?.dataset.frame !== frame,
      beforeRestore,
    );
    await page.keyboard.press("c");
  }
  await clickBatch(1);
  await page.keyboard.press("h");
  assert.equal(await page.locator("#scene").getAttribute("data-geometries"), "primitives");
  assert.equal(await page.locator("#scene").getAttribute("data-selected"), "");
  assert.equal(await page.locator("#scene").getAttribute("data-batch-id"), "");
  assert.equal(await page.locator("#scene").getAttribute("data-batch0"), null);
  assert.equal(await page.locator("#scene").getAttribute("data-lod-position"), null);
  assert.equal((await framebuffer(page)).hash, primitives.hash, "Leaving batching did not restore primitives");
  await page.keyboard.press("m");
  const priorInstances = await framebuffer(page);
  await page.keyboard.press("h");
  await clickBatch(0);
  await page.keyboard.press("h");
  assert.equal(await page.locator("#scene").getAttribute("data-geometries"), "instances");
  assert.equal(await page.locator("#scene").getAttribute("data-batch-id"), "");
  assert.equal((await framebuffer(page)).hash, priorInstances.hash, "Batching did not restore instance mode");
  await page.keyboard.press("m");
  const beforeMaterials = await framebuffer(page);
  await page.keyboard.press("p");
  assert.equal(await page.locator("#scene").getAttribute("data-material-mode"), "true");
  assert.notEqual((await framebuffer(page)).hash, beforeMaterials.hash, "Material comparison is invisible");
  for (const projection of ["perspective", "orthographic"]) {
    assert.equal(await page.locator("#scene").getAttribute("data-camera"), projection);
    const unselected = await framebuffer(page);
    for (const [id, name] of ["Phong", "Normal", "Matcap", "Toon", "Standard", "Physical", "Shadow"].entries()) {
      const position = await projectedPosition(`data-material${id}`);
      await page.mouse.click(position.x, position.y);
      assert.equal(await page.locator("#scene").getAttribute("data-selected"), name, `${projection}: ${name} picking`);
      assert.notEqual((await framebuffer(page)).hash, unselected.hash, `${projection}: ${name} selection is invisible`);
      await page.mouse.click(950, 10);
      assert.equal((await framebuffer(page)).hash, unselected.hash, `${projection}: material selection did not clear`);
    }
    for (const [key, attribute] of [
      ["v", "data-material-lighting"],
      ["y", "data-material-ibl"],
      ["d", "data-material-maps"],
    ] as const) {
      await page.keyboard.press(key);
      assert.equal(await page.locator("#scene").getAttribute(attribute), "false");
      assert.notEqual(
        (await framebuffer(page)).hash,
        unselected.hash,
        `${projection}: material control ${key} is invisible`,
      );
      await page.keyboard.press(key);
      assert.equal(await page.locator("#scene").getAttribute(attribute), "true");
      assert.equal(
        (await framebuffer(page)).hash,
        unselected.hash,
        `${projection}: ${key} did not restore lighting/maps`,
      );
    }
    let lighting = unselected;
    for (const state of ["probe", "area", "both", "off"]) {
      await page.keyboard.press("q");
      assert.equal(await page.locator("#scene").getAttribute("data-material-extra-lights"), state);
      const frame = await framebuffer(page);
      assert.notEqual(frame.hash, lighting.hash, `${projection}: ${state} lighting is invisible`);
      lighting = frame;
    }
    assert.equal(lighting.hash, unselected.hash, "Extra lighting cycle changed the restored scene");
    for (const key of ["s", "u", "e"]) {
      await page.keyboard.press(key);
      assert.notEqual(
        (await framebuffer(page)).hash,
        unselected.hash,
        `${projection}: material control ${key} is invisible`,
      );
      await page.keyboard.press(key);
      assert.equal(
        (await framebuffer(page)).hash,
        unselected.hash,
        `${projection}: material control ${key} did not restore`,
      );
    }
    await page.keyboard.press("c");
  }
  await page.keyboard.press("p");
  assert.equal(await page.locator("#scene").getAttribute("data-material-mode"), "false");
  assert.equal((await framebuffer(page)).hash, beforeMaterials.hash, "Material comparison did not restore prior mode");
  for (const [key, mode] of [
    ["g", "curves"],
    ["o", "objects"],
    ["m", "instances"],
    ["h", "batching"],
  ] as const) {
    await page.keyboard.press(key);
    const prior = await framebuffer(page);
    await page.keyboard.press("p");
    await page.keyboard.press("p");
    assert.equal(await page.locator("#scene").getAttribute("data-geometries"), mode);
    assert.equal((await framebuffer(page)).hash, prior.hash, `Material comparison did not restore ${mode}`);
    await page.keyboard.press(key);
  }
  const beforeDeformation = await framebuffer(page);
  await page.keyboard.press("w");
  assert.equal(await page.locator("#scene").getAttribute("data-geometries"), "animation");
  assert.equal(await page.locator("#scene").getAttribute("data-selected"), "");
  await page.keyboard.press("z");
  for (const projection of ["perspective", "orthographic"]) {
    assert.equal(await page.locator("#scene").getAttribute("data-camera"), projection);
    const rest = await framebuffer(page);
    assert.equal(await page.locator("#scene").getAttribute("data-animation-time"), "0");
    assert.equal(await page.locator("#scene").getAttribute("data-bone-angle"), "0");
    assert.equal(await page.locator("#scene").getAttribute("data-morph-weight"), "0");
    await page.keyboard.press("]");
    assert.equal(await page.locator("#scene").getAttribute("data-animation-time"), "0.25");
    assert(Math.abs(Number(await page.locator("#scene").getAttribute("data-bone-angle")) - 0.35) < 1e-6);
    assert.equal(await page.locator("#scene").getAttribute("data-morph-weight"), "0.5");
    const deformed = await framebuffer(page);
    assert.notEqual(deformed.hash, rest.hash, `${projection}: mixer-driven deformation is invisible`);
    for (const [attribute, name] of [
      ["data-skinned-position", "Skinned cylinder"],
      ["data-morph-position", "Morph sphere"],
    ]) {
      const { x, y } = await projectedPosition(attribute);
      await page.mouse.click(x, y);
      assert.equal(await page.locator("#scene").getAttribute("data-selected"), name);
      assert.notEqual((await framebuffer(page)).hash, deformed.hash, `${projection}: ${name} selection is invisible`);
      await page.mouse.click(950, 10);
      assert.equal(
        (await framebuffer(page)).hash,
        deformed.hash,
        `${projection}: clearing deformation selection failed`,
      );
    }
    for (const light of ["directional", "point", "spot"]) {
      assert.equal(await page.locator("#scene").getAttribute("data-light"), light);
      const shadowed = await framebuffer(page);
      await page.keyboard.press("s");
      assert.notEqual(
        (await framebuffer(page)).hash,
        shadowed.hash,
        `${projection}: ${light} deformation shadows missing`,
      );
      await page.keyboard.press("s");
      assert.equal((await framebuffer(page)).hash, shadowed.hash, `${projection}: deformation shadows did not restore`);
      await page.keyboard.press("l");
    }
    await page.keyboard.press("[");
    assert.equal((await framebuffer(page)).hash, rest.hash, `${projection}: seeking back did not restore rest pose`);
    await page.keyboard.press("]");
    await page.keyboard.press("z");
    assert.equal((await framebuffer(page)).hash, rest.hash, `${projection}: restart did not restore rest pose`);
    await page.keyboard.press("c");
  }
  const rest = await framebuffer(page);
  await page.keyboard.press("p");
  await page.keyboard.press("p");
  assert.equal(await page.locator("#scene").getAttribute("data-geometries"), "animation");
  assert.equal((await framebuffer(page)).hash, rest.hash, "Material comparison did not restore animation mode");
  await page.keyboard.press("Space");
  await page.waitForFunction(
    () => Number(document.querySelector<HTMLCanvasElement>("#scene")?.dataset.animationTime) > 0.1,
  );
  await page.keyboard.press("Space");
  const mixerTime = await page.locator("#scene").getAttribute("data-animation-time");
  const deformed = await framebuffer(page);
  assert.notEqual(deformed.hash, rest.hash, "AnimationMixer playback did not deform the meshes");
  await page.waitForTimeout(100);
  assert.equal(
    await page.locator("#scene").getAttribute("data-animation-time"),
    mixerTime,
    "Paused mixer kept advancing",
  );
  assert.equal((await framebuffer(page)).hash, deformed.hash, "Paused deformation changed pixels");
  await page.keyboard.press("z");
  assert.equal((await framebuffer(page)).hash, rest.hash, "Playback restart did not restore rest pose");
  await page.keyboard.press("w");
  assert.equal(await page.locator("#scene").getAttribute("data-geometries"), "primitives");
  assert.equal(await page.locator("#scene").getAttribute("data-skinned-position"), null);
  assert.equal(await page.locator("#scene").getAttribute("data-morph-position"), null);
  assert.equal((await framebuffer(page)).hash, beforeDeformation.hash, "Leaving animation did not restore primitives");
  for (const [key, mode] of [
    ["g", "curves"],
    ["o", "objects"],
    ["m", "instances"],
    ["h", "batching"],
  ]) {
    await page.keyboard.press(key);
    const prior = await framebuffer(page);
    await page.keyboard.press("w");
    await page.keyboard.press("w");
    assert.equal(await page.locator("#scene").getAttribute("data-geometries"), mode);
    assert.equal((await framebuffer(page)).hash, prior.hash, `Animation did not restore ${mode}`);
    await page.keyboard.press(key);
  }
  const beforeAsset = await framebuffer(page);
  await page.keyboard.press("1");
  await page.waitForFunction(
    () => document.querySelector<HTMLCanvasElement>("#scene")?.dataset.assetComplete === "true",
  );
  assert.equal(await page.locator("#scene").getAttribute("data-asset-state"), "loaded");
  assert.equal(await page.locator("#scene").getAttribute("data-asset-progress"), "1/1");
  assert.notEqual((await framebuffer(page)).hash, beforeAsset.hash, "Loaded local texture is invisible");
  await page.keyboard.press("1");
  assert.equal((await framebuffer(page)).hash, beforeAsset.hash, "Original texture was not restored");
  await page.keyboard.press("2");
  await page.waitForFunction(
    () => document.querySelector<HTMLCanvasElement>("#scene")?.dataset.assetComplete === "true",
  );
  assert.equal(await page.locator("#scene").getAttribute("data-asset-state"), "error");
  assert.equal(await page.locator("#scene").getAttribute("data-asset-manager-error"), "true");
  assert.ok(Number(await page.locator("#scene").getAttribute("data-asset-bytes")) > 0);
  assert.equal((await framebuffer(page)).hash, beforeAsset.hash, "Failed load changed the scene");
  const withoutTargets = await framebuffer(page);
  for (const mode of ["array layers", "3D slices", "off"]) {
    await page.keyboard.press("4");
    assert.equal(await page.locator("#scene").getAttribute("data-target-mode"), mode);
    const rendered = await framebuffer(page);
    if (mode === "off") assert.equal(rendered.hash, withoutTargets.hash, "Targets did not restore the scene");
    else assert.notEqual(rendered.hash, withoutTargets.hash, `${mode} sampling is invisible`);
  }
  for (const [key, attribute] of [
    ["5", "data-helpers"],
    ["6", "data-custom-shader"],
  ] as const) {
    const before = await framebuffer(page);
    await page.keyboard.press(key);
    assert.equal(await page.locator("#scene").getAttribute(attribute), "true");
    assert.notEqual((await framebuffer(page)).hash, before.hash, `${attribute} is invisible`);
    await page.keyboard.press(key);
    assert.equal(await page.locator("#scene").getAttribute(attribute), "false");
    assert.equal((await framebuffer(page)).hash, before.hash, `${attribute} did not restore the scene`);
  }
  for (const [key, kind] of [
    ["7", "compile"],
    ["8", "link"],
  ] as const) {
    const before = await framebuffer(page);
    await page.keyboard.press(key);
    assert.equal(await page.locator("#scene").getAttribute("data-shader-diagnostic"), kind);
    const diagnostic = JSON.parse((await page.locator("#scene").getAttribute("data-shader-log"))!);
    assert.ok(kind === "compile" ? diagnostic.fragmentLog : diagnostic.programLog);
    assert.equal((await framebuffer(page)).hash, before.hash, `${kind} diagnostic failed to restore rendering`);
  }
  previous = await framebuffer(page);
  await page.mouse.move(400, 350);
  await page.mouse.down();
  await page.mouse.move(470, 380, { steps: 5 });
  await page.mouse.up();
  assert.equal(await page.locator("#scene").getAttribute("data-selected"), "", "Orbit drag must not pick an object");
  let current = await framebuffer(page);
  assert.notEqual(current.hash, previous.hash, "Pointer orbit did not change rendered pixels");
  previous = current;
  const frameBeforeWheel = await page.locator("#scene").getAttribute("data-frame");
  await page.mouse.wheel(0, 180);
  await page.waitForFunction(
    (frame) => document.querySelector<HTMLCanvasElement>("#scene")?.dataset.frame !== frame,
    frameBeforeWheel,
  );
  current = await framebuffer(page);
  assert.notEqual(current.hash, previous.hash, "Wheel zoom did not change rendered pixels");

  await page.setViewportSize({ width: 720, height: 480 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#scene");
    return canvas?.width === 720 && canvas.height === 480;
  });
  current = await framebuffer(page);
  assert.equal(current.width, 720);
  assert.equal(current.height, 480);
  const paused = current.hash;
  const frameBeforeAnimation = Number(await page.locator("#scene").getAttribute("data-frame"));
  await page.keyboard.press("Space");
  await page.waitForFunction(
    (frame) => Number(document.querySelector<HTMLCanvasElement>("#scene")?.dataset.frame) > frame + 4,
    frameBeforeAnimation,
  );
  await page.keyboard.press("Space");
  assert.notEqual((await framebuffer(page)).hash, paused, "Animation did not change rendered pixels");
}

/** Also runs against the isolated installed-package consumer, using its own canonical imports. */
export async function verifyBrowser(
  baseURL: string,
  browser: Browser,
  options: { lifecycles?: boolean } = {},
): Promise<BrowserReport> {
  const report: BrowserReport = { checks: [], failures: [] };
  const context = await browser.newContext({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    const errors = observe(page);
    await verifyExample(page, baseURL);
    assert.deepEqual(errors, [], "Example browser errors");
    report.checks.push(
      "integrated example: primitive/curve geometry rendering, holes, picking, controls, resize, animation",
    );
  } catch (error) {
    report.failures.push({ check: "example", error: String(error) });
  } finally {
    await context.close();
  }
  if (options.lifecycles === false) return report;
  for (const [file, name] of lifecycles) {
    const lifecycleContext = await browser.newContext();
    try {
      const page = await lifecycleContext.newPage();
      const errors = observe(page);
      // Avoid leaving the example's renderer alive during independent resource lifecycle checks.
      await page.route("**/__ek3d_lifecycle.html", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><title>WebGL lifecycle</title><link rel="icon" href="data:,">',
        }),
      );
      await page.goto(new URL("__ek3d_lifecycle.html", baseURL).href);
      const evidence: unknown = await page.evaluate(
        async ({ file, name }) => {
          // A Node-side static import cannot exercise browser module/package resolution.
          const module = await import(/* @vite-ignore */ `/tests/${file}`);
          return await module[name]();
        },
        { file, name },
      );
      if (name === "checkLoaders" || name === "objectLoaderBrowserChecks") {
        assert(evidence && typeof evidence === "object" && "checks" in evidence && Array.isArray(evidence.checks));
      } else {
        assert(
          evidence && typeof evidence === "object" && "glError" in evidence && evidence.glError === 0,
          `${name}: missing clean GL result`,
        );
      }
      assert.deepEqual(errors, [], name);
      report.checks.push(name);
    } catch (error) {
      report.failures.push({ check: `lifecycle:${name}`, error: String(error) });
    } finally {
      await lifecycleContext.close();
    }
  }
  return report;
}

async function main() {
  let name = process.env.EK3D_BROWSER ?? "chromium";
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === "--browser") name = process.argv[++i];
    else throw new Error(`Unknown argument: ${process.argv[i]}`);
  }
  assert(
    name === "chromium" || name === "firefox" || name === "webkit",
    "Use --browser chromium|firefox|webkit or EK3D_BROWSER",
  );
  const root = fileURLToPath(new URL("../", import.meta.url));
  const failures: Failure[] = [];
  let browser: Browser | undefined;
  let dev: ViteDevServer | undefined;
  let built: PreviewServer | undefined;
  try {
    browser = await launchBrowser(name);
    dev = await createServer({
      root,
      configFile: false,
      logLevel: "warn",
      optimizeDeps: { entries: ["index.html", "testbed/index.html", "tests/browser*.ts"] },
      server: { host: "127.0.0.1", port: 0 },
    });
    await dev.listen();
    assert(dev.resolvedUrls?.local[0], "Development server did not expose its URL");
    const development = await verifyBrowser(dev.resolvedUrls.local[0], browser);
    failures.push(...development.failures.map((failure) => ({ ...failure, check: `dev:${failure.check}` })));
    console.log(`Development: ${development.checks.length} checks passed`);
    built = await preview({
      root,
      configFile: false,
      logLevel: "warn",
      build: { outDir: "dist" },
      preview: { host: "127.0.0.1", port: 0 },
    });
    assert(built.resolvedUrls?.local[0], "Production server did not expose its URL");
    const production = await verifyBrowser(built.resolvedUrls.local[0], browser, { lifecycles: false });
    failures.push(...production.failures.map((failure) => ({ ...failure, check: `production:${failure.check}` })));
    console.log(`Production: ${production.checks.length} checks passed`);
  } catch (error) {
    failures.push({ check: "runner", error: String(error) });
  } finally {
    for (const [label, close] of [
      ["browser", () => browser?.close()],
      ["development-server", () => dev?.close()],
      ["production-server", () => built?.close()],
    ] as const) {
      try {
        await close();
      } catch (error) {
        failures.push({ check: `cleanup:${label}`, error: String(error) });
      }
    }
  }
  for (const failure of failures) console.error(`${failure.check}: ${failure.error}`);
  console.log(`${name}: ${failures.length === 0 ? "passed" : "failed"}`);
  if (failures.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
