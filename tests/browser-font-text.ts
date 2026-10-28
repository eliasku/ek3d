import { GL } from "ek3d/GL";
import { FontLoader } from "ek3d/addons/loaders/FontLoader";
import { TextGeometry } from "ek3d/addons/geometries/TextGeometry";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { Scene } from "ek3d/scenes/Scene";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function verifyFontText() {
  const checks: string[] = [];
  const url = new URL("../examples/fonts/helvetiker_regular.typeface.json", import.meta.url).href;
  const manager = new LoadingManager();
  const failures: string[] = [];
  manager.onError = (failed) => failures.push(failed);
  const font = await new FontLoader(manager).loadAsync(url);
  const resources: Array<{ dispose(): void }> = [];
  try {
    check(font.isFont && font.data.familyName === "Helvetiker", "local typeface JSON must load");
    checks.push("local font load");

    const shapes = font.generateShapes("B", 70);
    check(shapes.length === 1 && shapes[0].holes.length === 2, "font outline holes must survive shape conversion");
    const fallback = font.generateShapes("😀", 70);
    const question = font.generateShapes("?", 70);
    const fallbackPoints = fallback[0].getPoints(2).map((p) => [p.x, p.y]);
    const questionPoints = question[0].getPoints(2).map((p) => [p.x, p.y]);
    check(JSON.stringify(fallbackPoints) === JSON.stringify(questionPoints), "missing glyph must use the ? fallback");
    checks.push("glyph holes and ? fallback");

    const geometry = new TextGeometry("B", { font, size: 70, depth: 20, curveSegments: 4, bevelEnabled: false });
    resources.push(geometry);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    check(box !== null, "text geometry must compute a bounding box");
    check(Math.abs(box.min.z) < 1e-6 && Math.abs(box.max.z - 20) < 1e-6, "extrusion depth must bound the geometry");
    check(box.max.x > box.min.x && box.max.y > box.min.y, "glyph outline must span both axes");
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    check(position instanceof BufferAttribute && position.count > 0 && position.count % 3 === 0, "whole triangles");
    check(uv instanceof BufferAttribute && uv.count === position.count, "one UV pair per vertex");
    check(geometry.groups.length === 2, "extrusion must group top and side faces");

    const lines = new TextGeometry("B\nB", { font, size: 70, depth: 20, curveSegments: 4, bevelEnabled: false });
    resources.push(lines);
    lines.computeBoundingBox();
    check(
      lines.boundingBox !== null && lines.boundingBox.min.y < box.min.y - 50,
      "newlines must advance down by the font line height",
    );
    const rtl = new TextGeometry("BO", { font, size: 70, depth: 20, curveSegments: 4, direction: "rtl" });
    resources.push(rtl);
    const ltr = new TextGeometry("BO", { font, size: 70, depth: 20, curveSegments: 4, direction: "ltr" });
    resources.push(ltr);
    rtl.computeBoundingBox();
    ltr.computeBoundingBox();
    const rtlPosition = rtl.getAttribute("position");
    const ltrPosition = ltr.getAttribute("position");
    check(
      rtl.boundingBox !== null &&
        ltr.boundingBox !== null &&
        Math.abs(rtl.boundingBox.max.x - ltr.boundingBox.max.x) < 70 &&
        rtlPosition instanceof BufferAttribute &&
        ltrPosition instanceof BufferAttribute &&
        rtlPosition.array.some((value, index) => value !== ltrPosition.array[index]),
      "right-to-left must reverse glyph placement without changing the text run",
    );
    checks.push("bounding box, depth, groups, newline and direction layout");

    const renderer = new WebGLRenderer({
      preserveDrawingBuffer: true,
      shaders: { MeshBasicMaterial: basicShader },
    });
    resources.push(renderer);
    const material = new MeshBasicMaterial({ color: 0xffffff });
    resources.push(material);
    const gl = renderer.getContext();
    const scene = new Scene();
    // One-pixel margin around the glyph bounds, matched to the readback viewport below.
    const viewport = 64;
    const left = box.min.x - 1;
    const right = box.max.x + 1;
    const bottom = box.min.y - 1;
    const top = box.max.y + 1;
    const camera = new OrthographicCamera(left, right, top, bottom, 0.1, 100);
    camera.position.z = 50;
    scene.add(new Mesh(geometry, material));

    renderer.setSize(viewport, viewport);
    renderer.render(scene, camera);
    const pixels = new Uint8Array(viewport * viewport * 4);
    gl.readPixels(0, 0, viewport, viewport, GL.RGBA, GL.UNSIGNED_BYTE, pixels);
    const sample = (x: number, y: number) => {
      const px = Math.min(viewport - 1, Math.max(0, Math.floor(((x - left) / (right - left)) * viewport)));
      const py = Math.min(viewport - 1, Math.max(0, Math.floor(((y - bottom) / (top - bottom)) * viewport)));
      return pixels[(py * viewport + px) * 4];
    };
    // Each counter must stay black; a filled hole or missing top triangles would paint it white.
    for (const hole of shapes[0].holes) {
      const holePoints = hole.getPoints(8);
      const xs = holePoints.map((point) => point.x);
      const ys = holePoints.map((point) => point.y);
      const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
      const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
      check(sample(centerX, centerY) <= 2, `hole at ${centerX.toFixed(1)},${centerY.toFixed(1)} must stay empty`);
    }
    // The left stem of "B" must be painted by the extruded front face.
    const stem = sample(box.min.x + (box.max.x - box.min.x) * 0.08, (box.min.y + box.max.y) / 2);
    check(stem > 200, `glyph stem must be filled, sampled ${stem}`);
    const glError = gl.getError();
    check(glError === GL.NO_ERROR, "text rendering must not raise a WebGL error");
    checks.push("hole interiors stay empty while glyph faces render");

    const corruptURL = "data:application/json,%7Bbroken";
    const corruptFailures: string[] = [];
    const corruptManager = new LoadingManager();
    corruptManager.onError = (failed) => corruptFailures.push(failed);
    const corrupted = await new FontLoader(corruptManager).loadAsync(corruptURL).then(
      () => "resolved",
      (error: unknown) => (error instanceof SyntaxError ? "syntax" : String(error)),
    );
    check(corrupted === "syntax", "corrupted typeface JSON must reject");
    check(corruptFailures.length === 1, "corrupted typeface JSON must report through the loading manager");
    checks.push("corrupted JSON rejection");

    return { glError, checks };
  } finally {
    for (const resource of resources.reverse()) resource.dispose();
  }
}
