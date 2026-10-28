import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { Object3D } from "ek3d/core/Object3D";
import { Mesh } from "ek3d/objects/Mesh";
import { Bone } from "ek3d/objects/Bone";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { PointLight } from "ek3d/lights/PointLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { Vector3 } from "ek3d/math/Vector3";
import { Box3 } from "ek3d/math/Box3";
import { Plane } from "ek3d/math/Plane";
import { ArrowHelper } from "ek3d/helpers/ArrowHelper";
import { AxesHelper } from "ek3d/helpers/AxesHelper";
import { Box3Helper } from "ek3d/helpers/Box3Helper";
import { BoxHelper } from "ek3d/helpers/BoxHelper";
import { CameraHelper } from "ek3d/helpers/CameraHelper";
import { DirectionalLightHelper } from "ek3d/helpers/DirectionalLightHelper";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { HemisphereLightHelper } from "ek3d/helpers/HemisphereLightHelper";
import { PlaneHelper } from "ek3d/helpers/PlaneHelper";
import { PointLightHelper } from "ek3d/helpers/PointLightHelper";
import { PolarGridHelper } from "ek3d/helpers/PolarGridHelper";
import { SkeletonHelper } from "ek3d/helpers/SkeletonHelper";
import { SpotLightHelper } from "ek3d/helpers/SpotLightHelper";

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function verifyHelpers() {
  const renderer = new WebGLRenderer({
    antialias: false,
    preserveDrawingBuffer: true,
    shaders: { LineBasicMaterial: basicShader, MeshBasicMaterial: basicShader },
  });
  const size = 96;
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 1);
  const gl = renderer.getContext();
  const scene = new Scene();
  const camera = new OrthographicCamera(-3, 3, 3, -3, 0.1, 30);
  camera.position.set(5, 4, 7);
  camera.lookAt(0, 0, 0);
  const targetMaterial = new MeshBasicMaterial();
  const target = new Mesh(new BoxGeometry(1, 1.5, 1), targetMaterial);
  const inspectedCamera = new PerspectiveCamera(45, 1, 0.3, 2.5);
  const directional = new DirectionalLight(0xffaa33);
  const point = new PointLight(0xff33cc);
  const hemisphere = new HemisphereLight(0xffffff, 0x33aaff);
  const spot = new SpotLight(0x33ff66, 1, 2, 0.3);
  directional.position.set(0, 1, 0);
  point.position.set(0, 0.3, 0);
  hemisphere.position.set(0, 1, 0);
  spot.position.set(0, 1, 0);
  const root = new Object3D();
  const first = new Bone();
  const second = new Bone();
  const third = new Bone();
  root.add(first);
  first.add(second);
  second.add(third);
  second.position.y = 0.8;
  third.position.set(0.5, 0.8, 0);
  root.updateMatrixWorld(true);
  const bounds = new BoxHelper(target);
  const skeleton = new SkeletonHelper(root);
  const cameraHelper = new CameraHelper(inspectedCamera);
  const arrow = new ArrowHelper(new Vector3(0, 1, 0), new Vector3(), 2);
  const helpers = [
    arrow,
    new AxesHelper(2),
    new GridHelper(4, 8),
    new PolarGridHelper(2, 8, 3, 32),
    bounds,
    new Box3Helper(new Box3(new Vector3(-1, -0.5, -0.5), new Vector3(1, 0.5, 0.5))),
    cameraHelper,
    new DirectionalLightHelper(directional, 0.5),
    new PointLightHelper(point, 0.6),
    new HemisphereLightHelper(hemisphere, 0.7),
    new SpotLightHelper(spot),
    new PlaneHelper(new Plane(new Vector3(0, 0, 1), 0), 2),
    skeleton,
  ];
  const nativeBuffers = new Set<WebGLBuffer>();
  const coverage: Record<string, number> = {};
  const draw = (helper: (typeof helpers)[number]) => {
    scene.clear();
    scene.add(helper);
    if ("update" in helper) helper.update();
    renderer.render(scene, camera);
    const pixels = new Uint8Array(size * size * 4);
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    check(gl.getError() === gl.NO_ERROR, `${helper.type}: WebGL error`);
    return pixels;
  };
  const count = (pixels: Uint8Array) => {
    let value = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 20) value++;
    return value;
  };
  try {
    for (const helper of helpers) {
      const frame = draw(helper);
      coverage[helper.type] = count(frame);
      check(coverage[helper.type] > 5, `${helper.type}: helper produced no visible geometry`);
      const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
      check(gl.getProgramParameter(program, gl.LINK_STATUS), `${helper.type}: program did not link`);
      const location = gl.getAttribLocation(program, "position");
      const buffer = gl.getVertexAttrib(location, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING) as WebGLBuffer;
      check(gl.isBuffer(buffer), `${helper.type}: missing native position buffer`);
      nativeBuffers.add(buffer);
      helper.visible = false;
      check(count(draw(helper)) === 0, `${helper.type}: hidden helper still rendered`);
      helper.visible = true;
      check(count(draw(helper)) === coverage[helper.type], `${helper.type}: visibility did not restore rendering`);
    }
    for (const [helper, change] of [
      [
        bounds,
        () => {
          target.position.x = 1.2;
          target.scale.y = 0.5;
        },
      ],
      [
        skeleton,
        () => {
          first.rotation.z = 0.8;
          root.updateMatrixWorld(true);
        },
      ],
      [
        cameraHelper,
        () => {
          inspectedCamera.fov = 75;
          inspectedCamera.updateProjectionMatrix();
        },
      ],
      [
        arrow,
        () => {
          arrow.setDirection(new Vector3(1, 0, 0));
          arrow.setLength(1.2);
        },
      ],
    ] as const) {
      const before = draw(helper);
      change();
      const after = draw(helper);
      check(
        after.some((value, index) => value !== before[index]),
        `${helper.type}: update did not change pixels`,
      );
      check(count(after) > 5, `${helper.type}: update removed the helper`);
    }
    scene.clear();
    for (const helper of helpers) helper.dispose();
    check(
      [...nativeBuffers].every((buffer) => !gl.isBuffer(buffer)),
      "Helper disposal retained native buffers",
    );
    check(renderer.info.memory.geometries === 0, "Helper disposal retained geometries");
    check(renderer.info.programs?.length === 0, "Helper disposal retained shader programs");
    // Disposed shared arrow geometry must be uploadable again, as in upstream.
    const replacement = new ArrowHelper(new Vector3(0, 1, 0), new Vector3(), 2);
    try {
      check(count(draw(replacement)) > 5, "Arrow recreation after shared geometry disposal failed");
    } finally {
      scene.remove(replacement);
      replacement.dispose();
    }
    check(gl.getError() === gl.NO_ERROR, "Helper lifecycle left a WebGL error");
    return { glError: 0, coverage, nativeBuffers: nativeBuffers.size, updates: 4 };
  } finally {
    scene.clear();
    for (const helper of helpers) helper.dispose();
    target.geometry.dispose();
    targetMaterial.dispose();
    renderer.dispose();
    if (renderer.domElement instanceof HTMLCanvasElement) renderer.domElement.remove();
  }
}
