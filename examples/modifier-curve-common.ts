import { TransformControls } from "ek3d/addons/controls/TransformControls";
import { TextGeometry } from "ek3d/addons/geometries/TextGeometry";
import { FontLoader } from "ek3d/addons/loaders/FontLoader";
import { Stats } from "ek3d/addons/libs/Stats";
import { Flow, InstancedFlow } from "ek3d/addons/modifiers/CurveModifier";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Raycaster } from "ek3d/core/Raycaster";
import { CatmullRomCurve3 } from "ek3d/extras/curves/CatmullRomCurve3";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { LineLoop } from "ek3d/objects/LineLoop";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

export function modifierCurve(instanced: boolean): void {
  const selected = document.querySelector<HTMLCanvasElement>("#scene");
  if (!selected) throw new Error("Missing curve modifier canvas");
  const canvas: HTMLCanvasElement = selected;
  canvas.dataset.state = "loading";
  let disposed = false,
    failed = false,
    frames = 0;
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 1000);
  camera.position.set(2, 2, 4);
  camera.lookAt(scene.position);
  const dfg = createDFGLUT();
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    getDFGLUT: () => dfg,
    shaders: { MeshStandardMaterial: standardShader, MeshBasicMaterial: basicShader, LineBasicMaterial: basicShader },
  });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  const handles: Mesh[] = [];
  const handleGeometry = new BoxGeometry(0.1, 0.1, 0.1);
  const handleMaterial = new MeshBasicMaterial();
  const coordinates = instanced
    ? [
        [
          [1, -0.5, -1],
          [1, -0.5, 1],
          [-1, -0.5, 1],
          [-1, -0.5, -1],
        ],
        [
          [-1, 0.5, -1],
          [-1, 0.5, 1],
          [1, 0.5, 1],
          [1, 0.5, -1],
        ],
      ]
    : [
        [
          [1, 0, -1],
          [1, 0, 1],
          [-1, 0, 1],
          [-1, 0, -1],
        ],
      ];
  const curves = coordinates.map((points) => {
    const vertices = points.map(([x, y, z]) => {
      const handle = new Mesh(handleGeometry, handleMaterial);
      handle.position.set(x, y, z);
      handles.push(handle);
      scene.add(handle);
      return handle.position;
    });
    const curve = new CatmullRomCurve3(vertices, true);
    const line = new LineLoop(
      new BufferGeometry().setFromPoints(curve.getPoints(50)),
      new LineBasicMaterial({ color: 0x00ff00 }),
    );
    scene.add(line);
    return { curve, line };
  });
  const light = new DirectionalLight(0xffaa33, 3);
  light.position.set(-10, 10, 10);
  scene.add(light, new AmbientLight(0x003973, 3));
  const control = new TransformControls(camera, canvas);
  let flow: Flow | InstancedFlow | undefined;
  control.addEventListener("dragging-changed", (event: { value: boolean }) => {
    if (event.value) return;
    curves.forEach(({ curve, line }, i) => {
      line.geometry.setFromPoints(curve.getPoints(50));
      flow?.updateCurve(i, curve);
    });
  });
  const raycaster = new Raycaster(),
    mouse = new Vector2();
  let selecting = false;
  function pointer(event: PointerEvent): void {
    selecting = true;
    mouse.set((event.clientX / innerWidth) * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
  }
  canvas.addEventListener("pointerdown", pointer);
  new FontLoader().load(
    new URL("./fonts/helvetiker_regular.typeface.json", import.meta.url).href,
    (font) => {
      if (disposed) return;
      const geometry = new TextGeometry("Hello three.js!", {
        font,
        size: 0.2,
        depth: 0.05,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.01,
        bevelOffset: 0,
        bevelSegments: 5,
      });
      geometry.rotateX(Math.PI);
      const material = new MeshStandardMaterial({ color: 0x99ffff });
      if (instanced) {
        const instances = new InstancedFlow(8, curves.length, geometry, material);
        flow = instances;
        curves.forEach(({ curve }, i) => instances.updateCurve(i, curve));
        for (let i = 0; i < 8; i++) {
          instances.setCurve(i, i % curves.length);
          instances.moveIndividualAlongCurve(i, i / 8);
          instances.object3D.setColorAt(i, new Color(0xffffff * Math.random()));
        }
      } else {
        flow = new Flow(new Mesh(geometry, material));
        flow.updateCurve(0, curves[0].curve);
      }
      material.dispose();
      scene.add(flow.object3D);
    },
    undefined,
    (error: unknown) => {
      if (disposed) return;
      failed = true;
      canvas.dataset.state = "error";
      canvas.dataset.error = String(error);
      console.error(error);
    },
  );
  const stats = new Stats();
  document.body.appendChild(stats.dom);
  function resize(): void {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener("resize", resize);
  renderer.setAnimationLoop(() => {
    if (selecting) {
      selecting = false;
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObjects(handles, false)[0];
      if (hit) {
        control.attach(hit.object);
        scene.add(control.getHelper());
      }
    }
    flow?.moveAlongCurve(0.001);
    renderer.render(scene, camera);
    stats.update();
    canvas.dataset.frames = String(++frames);
    if (!failed) canvas.dataset.state = flow ? "rendered" : "loading";
  });
  window.addEventListener("pagehide", (event) => {
    if (event.persisted || disposed) return;
    disposed = true;
    window.removeEventListener("resize", resize);
    canvas.removeEventListener("pointerdown", pointer);
    renderer.setAnimationLoop(null);
    scene.remove(control.getHelper());
    control.dispose();
    stats.dom.remove();
    disposeObject(scene);
    flow?.splineTexture.dispose();
    if (flow instanceof InstancedFlow) flow.object3D.dispose();
    dfg.dispose();
    renderer.dispose();
    canvas.dataset.state = "disposed";
  });
}
