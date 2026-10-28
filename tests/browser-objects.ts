import { GL } from "ek3d/GL";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { Line } from "ek3d/objects/Line";
import { LineLoop } from "ek3d/objects/LineLoop";
import { LineSegments } from "ek3d/objects/LineSegments";
import { Points } from "ek3d/objects/Points";
import { Sprite } from "ek3d/objects/Sprite";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { LineDashedMaterial } from "ek3d/materials/LineDashedMaterial";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { SpriteMaterial } from "ek3d/materials/SpriteMaterial";
import { DataTexture } from "ek3d/textures/DataTexture";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { dashedShader } from "ek3d/renderers/shaders/DashedShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { spriteShader } from "ek3d/renderers/shaders/SpriteShader";
import { ColorSpace, TextureFilter } from "ek3d/constants";

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function verifyObjectRendering() {
  const shaders = {
    LineBasicMaterial: basicShader,
    LineDashedMaterial: dashedShader,
    PointsMaterial: pointsShader,
    SpriteMaterial: spriteShader,
  };
  const renderer = new WebGLRenderer({ preserveDrawingBuffer: true, antialias: false, shaders });
  const scene = new Scene();
  const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
  camera.position.z = 5;
  const perspective = new PerspectiveCamera(90, 1, 0.1, 100);
  const square = new BufferGeometry().setAttribute(
    "position",
    new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3),
  );
  const dashGeometry = new BufferGeometry().setAttribute(
    "position",
    new Float32BufferAttribute([-1.5, 0, 0, 1.5, 0, 0], 3),
  );
  const pointPosition = new Float32BufferAttribute([0, 0, 0], 3);
  const pointGeometry = new BufferGeometry().setAttribute("position", pointPosition);
  const basic = new LineBasicMaterial({ color: 0xffffff });
  const dashed = new LineDashedMaterial({ color: 0xffffff, dashSize: 0.5, gapSize: 0.5 });
  const pointMaterial = new PointsMaterial({ color: 0xffffff, size: 8, sizeAttenuation: false });
  const spriteMaterial = new SpriteMaterial({ color: 0xffffff });
  const line = new Line(square, basic);
  const loop = new LineLoop(square, basic);
  const segments = new LineSegments(square, basic);
  const dash = new Line(dashGeometry, dashed).computeLineDistances();
  const points = new Points(pointGeometry, pointMaterial);
  const sprite = new Sprite(spriteMaterial);
  const objects = [line, loop, segments, dash, points, sprite];
  const geometries = [square, dashGeometry, pointGeometry, sprite.geometry];
  const materials = [basic, dashed, pointMaterial, spriteMaterial];
  const mapData = new Uint8Array([255, 0, 0, 255]);
  const alphaData = new Uint8Array([255, 128, 255, 255]);
  const map = new DataTexture(mapData, 1, 1);
  const alphaMap = new DataTexture(alphaData, 1, 1);
  for (const texture of [map, alphaMap]) {
    texture.minFilter = texture.magFilter = TextureFilter.Nearest;
    texture.needsUpdate = true;
  }
  const gl = renderer.getContext();
  const draw = (object: (typeof objects)[number], view: OrthographicCamera | PerspectiveCamera = camera) => {
    scene.clear();
    scene.add(object);
    renderer.render(scene, view);
    const pixels = new Uint8Array(64 * 64 * 4);
    gl.readPixels(0, 0, 64, 64, GL.RGBA, GL.UNSIGNED_BYTE, pixels);
    check(gl.getError() === GL.NO_ERROR, `${object.type} produced a GL error`);
    return pixels;
  };
  const lit = (pixels: Uint8Array, x: number, y: number) => {
    const offset = (y * 64 + x) * 4;
    return pixels[offset] + pixels[offset + 1] + pixels[offset + 2] > 20;
  };
  // A one-pixel line can land on either side of an integer framebuffer coordinate.
  const nearLine = (pixels: Uint8Array, x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) if (lit(pixels, x + dx, y + dy)) return true;
    }
    return false;
  };
  const coverage = (pixels: Uint8Array) => {
    let count = 0,
      minX = 64,
      maxX = -1,
      minY = 64,
      maxY = -1;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        if (!lit(pixels, x, y)) continue;
        count++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    return { count, minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  };
  const color = (pixels: Uint8Array, expected: number[], label: string, x = 32, y = 32) => {
    const actual = pixels.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 3);
    check(
      actual.every((value, i) => Math.abs(value - expected[i]) <= 1),
      `${label}: ${actual.join(",")} != ${expected.join(",")}`,
    );
  };
  const same = (actual: Uint8Array, expected: Uint8Array, label: string) =>
    check(
      actual.every((value, i) => value === expected[i]),
      label,
    );
  const buffer = (attribute = "position") => {
    const program = gl.getParameter(GL.CURRENT_PROGRAM) as WebGLProgram;
    const location = gl.getAttribLocation(program, attribute);
    check(location >= 0, `Missing active ${attribute} attribute`);
    const handle = gl.getVertexAttrib(location, GL.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING) as WebGLBuffer;
    check(gl.isBuffer(handle), `Missing GPU ${attribute} buffer`);
    return handle;
  };
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(64, 64);
    renderer.outputColorSpace = ColorSpace.LinearSRGB;
    renderer.setClearColor(0x000000, 1);
    for (const object of [points, sprite]) {
      renderer.shaders = {};
      let rejected = false;
      try {
        draw(object);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("No explicit shader selected")) throw error;
        rejected = true;
      }
      check(rejected, `${object.type} unexpectedly selected an implicit shader`);
      renderer.shaders = shaders;
      check(coverage(draw(object)).count > 0, `${object.type} did not recover after descriptor selection`);
    }

    const edges = [
      [32, 16],
      [48, 32],
      [32, 48],
      [16, 32],
    ];
    const modes = [
      { object: line, expected: [true, true, true, false], count: 3 },
      { object: loop, expected: [true, true, true, true], count: 4 },
      { object: segments, expected: [true, false, true, false], count: 2 },
    ];
    for (const { object, expected, count } of modes) {
      const pixels = draw(object);
      check(renderer.info.render.lines === count && renderer.info.render.calls === 1, `${object.type} draw count`);
      check(
        edges.every(([x, y], i) => nearLine(pixels, x, y) === expected[i]),
        `${object.type} connectivity`,
      );
    }
    square.setDrawRange(2, 2);
    const ranged = draw(segments);
    check(
      renderer.info.render.lines === 1 && nearLine(ranged, 32, 48) && !nearLine(ranged, 32, 16),
      "Segment draw-range start/count",
    );
    square.setDrawRange(0, Infinity);
    let pixels = draw(dash);
    check(
      nearLine(pixels, 12, 32) && !nearLine(pixels, 18, 32) && nearLine(pixels, 28, 32),
      "Dashed line did not produce alternating gaps",
    );
    const distances = dashGeometry.getAttribute("lineDistance") as Float32BufferAttribute;
    distances.setX(1, 6);
    distances.needsUpdate = true;
    pixels = draw(dash);
    check(nearLine(pixels, 18, 32) && !nearLine(pixels, 22, 32), "Dashed distance buffer update did not move gaps");
    dashed.scale = 0.5;
    check(!nearLine(draw(dash), 18, 32), "Dashed scale uniform update");
    dashed.scale = 1;

    const smallPoint = coverage(draw(points));
    check(smallPoint.width === 8 && smallPoint.height === 8 && renderer.info.render.points === 1, "Fixed Points size");
    pointMaterial.size = 16;
    const largePoint = coverage(draw(points));
    check(largePoint.width === 16 && largePoint.count === 4 * smallPoint.count, "Points size uniform update");
    pointMaterial.size = 8;
    points.position.z = -2;
    const fixedNear = coverage(draw(points, perspective));
    points.position.z = -4;
    check(coverage(draw(points, perspective)).count === fixedNear.count, "Non-attenuated Points changed with depth");
    pointMaterial.sizeAttenuation = true;
    pointMaterial.size = 0.5;
    pointMaterial.needsUpdate = true;
    points.position.z = -2;
    const attenuatedNear = coverage(draw(points, perspective));
    points.position.z = -4;
    const attenuatedFar = coverage(draw(points, perspective));
    check(attenuatedNear.width === 8 && attenuatedFar.width === 4, "Perspective Points size attenuation");
    points.position.z = 0;
    pointMaterial.sizeAttenuation = false;
    pointMaterial.size = 16;
    pointMaterial.needsUpdate = true;
    pointPosition.setX(0, 0.75);
    pointPosition.needsUpdate = true;
    pointGeometry.computeBoundingSphere();
    pixels = draw(points);
    check(!lit(pixels, 32, 32) && lit(pixels, 44, 32), "Points position buffer update");
    pointPosition.setX(0, 0);
    pointPosition.needsUpdate = true;
    pointGeometry.computeBoundingSphere();

    sprite.scale.set(2, 1, 1);
    const horizontal = coverage(draw(sprite));
    check(horizontal.width === 32 && horizontal.height === 16, "Sprite scale");
    spriteMaterial.rotation = Math.PI / 2;
    const vertical = coverage(draw(sprite));
    check(vertical.width === 16 && vertical.height === 32, "Sprite material rotation");
    spriteMaterial.rotation = 0;
    sprite.center.set(0, 0);
    const anchored = coverage(draw(sprite));
    check(anchored.minX === 32 && anchored.minY === 32 && anchored.width === 32, "Sprite center anchor");
    sprite.center.set(0.5, 0.5);
    perspective.position.set(0, 0, 3);
    perspective.lookAt(0, 0, 0);
    const front = draw(sprite, perspective);
    perspective.position.set(3, 0, 0);
    perspective.lookAt(0, 0, 0);
    same(draw(sprite, perspective), front, "Sprite did not remain camera-facing after orbit");
    perspective.position.set(0, 0, 6);
    perspective.lookAt(0, 0, 0);
    const distantSprite = coverage(draw(sprite, perspective));
    check(
      distantSprite.count > 0 && coverage(front).count > 3 * distantSprite.count,
      "Perspective Sprite size attenuation",
    );
    spriteMaterial.sizeAttenuation = false;
    spriteMaterial.needsUpdate = true;
    perspective.position.set(0, 0, 3);
    perspective.lookAt(0, 0, 0);
    const fixedSprite = coverage(draw(sprite, perspective));
    perspective.position.z = 6;
    check(coverage(draw(sprite, perspective)).count === fixedSprite.count, "Non-attenuated Sprite changed with depth");
    spriteMaterial.sizeAttenuation = true;
    spriteMaterial.needsUpdate = true;

    for (const object of [points, sprite]) {
      const material = object === points ? pointMaterial : spriteMaterial;
      mapData.set([255, 0, 0, 255]);
      map.needsUpdate = true;
      material.map = map;
      material.alphaMap = null;
      material.transparent = true;
      material.opacity = 1;
      material.needsUpdate = true;
      color(draw(object), [255, 0, 0], `${object.type} color map`);
      mapData.set([0, 255, 0, 255]);
      map.needsUpdate = true;
      color(draw(object), [0, 255, 0], `${object.type} texture upload update`);
      alphaData[1] = 128;
      alphaMap.needsUpdate = true;
      material.alphaMap = alphaMap;
      material.needsUpdate = true;
      color(draw(object), [0, 128, 0], `${object.type} alpha-map green channel`);
      material.opacity = 0.5;
      color(draw(object), [0, 64, 0], `${object.type} transparency update`);
      material.opacity = 1;
      material.alphaTest = 0.1;
      alphaData[1] = 0;
      alphaMap.needsUpdate = true;
      check(coverage(draw(object)).count === 0, `${object.type} alpha-map discard`);
      alphaData[1] = 255;
      alphaMap.needsUpdate = true;
      color(draw(object), [0, 255, 0], `${object.type} alpha-map update recovery`);
    }

    for (const object of objects) {
      object.position.x = 100;
      const culledPixels = draw(object);
      const culledCalls = renderer.info.render.calls;
      check(coverage(culledPixels).count === 0 && culledCalls === 0, `${object.type} frustum culling`);
      object.frustumCulled = false;
      draw(object);
      check(renderer.info.render.calls === 1, `${object.type} frustum-culling opt-out`);
      object.frustumCulled = true;
      object.position.x = 0;
      object.geometry.setDrawRange(0, 0);
      check(coverage(draw(object)).count === 0, `${object.type} empty draw range`);
      object.geometry.setDrawRange(0, Infinity);
      check(coverage(draw(object)).count > 0, `${object.type} draw-range recovery`);
    }

    const snapshots = objects.map((object) => draw(object));
    const allocation = () => {
      const buffers = new Set<WebGLBuffer>();
      for (const object of objects) {
        draw(object);
        buffers.add(buffer());
        if (object === dash) buffers.add(buffer("lineDistance"));
        if (object === sprite) {
          const index = gl.getParameter(GL.ELEMENT_ARRAY_BUFFER_BINDING) as WebGLBuffer;
          check(gl.isBuffer(index), "Sprite has no GPU index buffer");
          buffers.add(index);
        }
      }
      const textures: WebGLTexture[] = [map, alphaMap].map(
        (texture) => renderer.properties.get(texture).__webglTexture,
      );
      check(
        textures.every((handle) => gl.isTexture(handle)),
        "Missing Points/Sprite GPU textures",
      );
      return { buffers, textures };
    };
    const original = allocation();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    map.dispose();
    alphaMap.dispose();
    check(
      [...original.buffers].every((handle) => !gl.isBuffer(handle)),
      "Geometry disposal retained GPU buffers",
    );
    check(
      original.textures.every((handle) => !gl.isTexture(handle)),
      "Texture disposal retained GPU textures",
    );
    check(
      renderer.info.memory.geometries === 0 &&
        renderer.info.memory.textures === 0 &&
        renderer.info.programs?.length === 0,
      "Object disposal retained resource accounting",
    );
    objects.forEach((object, i) => same(draw(object), snapshots[i], `${object.type} disposal/reallocation pixels`));
    const reallocated = allocation();
    check(
      [...reallocated.buffers].every((handle) => !original.buffers.has(handle)),
      "Disposed buffer handle reused",
    );
    check(
      reallocated.textures.every((handle, i) => handle !== original.textures[i]),
      "Disposed texture handle reused",
    );

    const extension = gl.getExtension("WEBGL_lose_context");
    check(extension !== null, "Object restoration requires WEBGL_lose_context");
    // ES2022 does not provide Promise.withResolvers.
    const contextEvent = (name: string, action: () => void) =>
      new Promise<void>((resolve, reject) => {
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          renderer.domElement.removeEventListener(name, done);
          reject(new Error(`Timed out waiting for ${name}`));
        }, 10000);
        renderer.domElement.addEventListener(name, done, { once: true });
        action();
      });
    await contextEvent("webglcontextlost", () => extension.loseContext());
    check(gl.isContextLost(), "Object fixture did not lose the actual context");
    await contextEvent("webglcontextrestored", () => setTimeout(() => extension.restoreContext(), 0));
    objects.forEach((object, i) => same(draw(object), snapshots[i], `${object.type} context restore pixels`));
    const restored = allocation();
    check(
      [...restored.buffers].every((handle) => !reallocated.buffers.has(handle)),
      "Context restore reused stale buffers",
    );
    check(
      restored.textures.every((handle, i) => handle !== reallocated.textures[i]),
      "Context restore reused stale textures",
    );
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    map.dispose();
    alphaMap.dispose();
    check(
      [...restored.buffers].every((handle) => !gl.isBuffer(handle)),
      "Restored geometry disposal leaked buffers",
    );
    check(
      restored.textures.every((handle) => !gl.isTexture(handle)),
      "Restored texture disposal leaked textures",
    );
    check(
      renderer.info.memory.geometries === 0 &&
        renderer.info.memory.textures === 0 &&
        renderer.info.programs?.length === 0,
      "Restored object disposal retained resource accounting",
    );
    const glError = gl.getError();
    check(glError === GL.NO_ERROR, "Object lifecycle produced a GL error");
    return {
      explicitDescriptors: ["PointsMaterial", "SpriteMaterial"],
      lineModes: ["LINE_STRIP", "LINE_LOOP", "LINES"],
      dashed: { gaps: true, distanceUpload: true, scaleUpdate: true },
      points: { size: true, attenuation: true, positionUpload: true, maps: true, transparency: true },
      sprite: { cameraFacing: true, center: true, rotation: true, attenuation: true, maps: true, transparency: true },
      frustumCulling: true,
      drawRanges: true,
      gpuDisposal: true,
      gpuReallocation: true,
      contextRestored: true,
      glError,
    };
  } finally {
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    map.dispose();
    alphaMap.dispose();
    renderer.dispose();
  }
}
