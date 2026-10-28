import { GL } from "ek3d/GL";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function wheel(element: HTMLElement, deltaY: number, init: WheelEventInit = {}): boolean {
  return element.dispatchEvent(
    new WheelEvent("wheel", {
      deltaY,
      clientX: 40,
      clientY: 30,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );
}

function key(target: EventTarget, code: string, init: KeyboardEventInit = {}): boolean {
  return target.dispatchEvent(
    new KeyboardEvent("keydown", { code, key: code, bubbles: true, cancelable: true, ...init }),
  );
}

/**
 * Exercises OrbitControls against real DOM events and a real WebGL canvas.
 *
 * Pointer capture requires a genuinely active browser pointer, so pointer and touch drags
 * belong to the browser-driven page checks rather than to synthetic events here.
 * Keyboard events target a detached element so the page's own controls cannot observe them.
 */
export function verifyOrbitControls() {
  const canvas = document.createElement("canvas");
  const keyElement = document.createElement("div");
  const orthoElement = document.createElement("div");
  document.body.appendChild(canvas);
  document.body.appendChild(orthoElement);

  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    preserveDrawingBuffer: true,
    shaders: { MeshBasicMaterial: basicShader },
  });
  renderer.setSize(200, 120);
  const gl = renderer.getContext();

  const scene = new Scene();
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial({ color: 0xff8800 });
  const mesh = new Mesh(geometry, material);
  scene.add(mesh);

  const camera = new PerspectiveCamera(60, 200 / 120, 1, 1000);
  camera.position.set(0, 0, 20);
  const controls = new OrbitControls(camera, canvas);
  const ortho = new OrthographicCamera(8, -8, 5, -5, 0.1, 100);
  ortho.position.set(0, 0, 10);
  const orthoControls = new OrbitControls(ortho, orthoElement);

  let starts = 0;
  let ends = 0;
  let changes = 0;
  controls.addEventListener("start", () => starts++);
  controls.addEventListener("end", () => ends++);
  controls.addEventListener("change", () => changes++);

  try {
    check(canvas.clientHeight === 120 && canvas.clientWidth === 200, "Orbit canvas must have a layout size");
    check(canvas.style.touchAction === "none", "Connecting must disable touch scrolling");

    renderer.render(scene, camera);

    // Perspective wheel zoom reaches the camera and emits the interaction lifecycle.
    const beforeWheel = camera.position.clone();
    const allowed = wheel(canvas, -120);
    check(!allowed, "Wheel zoom must prevent the default page scroll");
    check(camera.position.distanceTo(beforeWheel) > 1e-6, "Wheel zoom must move the perspective camera");
    check(camera.position.length() < beforeWheel.length(), "Wheel up must dolly in");
    check(starts === 1 && ends === 1 && changes >= 1, "Wheel zoom must emit start/end/change");

    // The same wheel handler respects the enabled flags.
    controls.enableZoom = false;
    const beforeDisabled = camera.position.clone();
    wheel(canvas, -120);
    check(camera.position.distanceTo(beforeDisabled) === 0, "Disabled zoom must not move the camera");
    controls.enableZoom = true;

    // Keyboard panning requires an explicit key listener target.
    const keysBefore = camera.position.clone();
    check(key(keyElement, "ArrowUp"), "Unlistened keys must not be consumed");
    controls.listenToKeyEvents(keyElement);
    const handled = key(keyElement, "ArrowUp");
    check(!handled, "Arrow key panning must prevent the default page scroll");
    check(camera.position.distanceTo(keysBefore) > 1e-6, "Arrow key panning must move the camera");
    controls.stopListenToKeyEvents();
    const afterStop = camera.position.clone();
    key(keyElement, "ArrowUp");
    check(camera.position.distanceTo(afterStop) === 0, "Stopped key listeners must not move the camera");

    // Disconnect removes DOM listeners; reconnect installs them again.
    controls.disconnect();
    check(canvas.style.touchAction === "", "Disconnecting must restore touch scrolling");
    const afterDisconnect = camera.position.clone();
    wheel(canvas, -120);
    check(key(keyElement, "ArrowUp"), "Disconnected key listeners must not consume keys");
    check(camera.position.distanceTo(afterDisconnect) === 0, "Disconnected controls must not react to wheel input");

    controls.connect(canvas);
    wheel(canvas, -120);
    check(camera.position.distanceTo(afterDisconnect) > 1e-6, "Reconnected controls must zoom again");

    // Programmatic math: clamps, saved state and reset.
    controls.minDistance = 5;
    controls.maxDistance = 25;
    controls.dollyIn(10000);
    check(Math.abs(controls.getDistance() - 25) < 1e-6, "Dolly in must clamp to maxDistance");
    controls.dollyOut(10000);
    check(Math.abs(controls.getDistance() - 5) < 1e-6, "Dolly out must clamp to minDistance");

    controls.saveState();
    const savedPosition = camera.position.clone();
    controls.rotateLeft(0.5);
    controls.update();
    check(camera.position.distanceTo(savedPosition) > 1e-6, "Rotation must move the camera");
    controls.reset();
    check(camera.position.distanceTo(savedPosition) < 1e-6, "Reset must restore the saved camera position");
    check(controls.state === -1, "Reset must clear the interaction state");

    // Damping requires repeated updates before it settles.
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    const azimuthStart = controls.getAzimuthalAngle();
    controls.rotateLeft(Math.PI / 2);
    controls.update();
    const damped = controls.getAzimuthalAngle();
    const dampedStep = damped - azimuthStart;
    check(dampedStep < 0 && dampedStep > -Math.PI / 2, "Damping must apply a partial rotation");
    for (let i = 0; i < 300; i++) controls.update();
    check(
      Math.abs(controls.getAzimuthalAngle() - (azimuthStart - Math.PI / 2)) < 1e-5,
      "Damping must converge to the target angle",
    );
    controls.enableDamping = false;

    // Orthographic wheel zoom changes the camera zoom instead of its distance.
    orthoControls.minZoom = 0.5;
    orthoControls.maxZoom = 4;
    const orthoStart = ortho.zoom;
    wheel(orthoElement, -120);
    check(ortho.zoom > orthoStart, "Orthographic wheel up must increase zoom");
    wheel(orthoElement, 12000);
    check(Math.abs(ortho.zoom - 0.5) < 1e-6, "Orthographic zoom must clamp to minZoom");
    wheel(orthoElement, -12000);
    check(Math.abs(ortho.zoom - 4) < 1e-6, "Orthographic zoom must clamp to maxZoom");

    // Disposal removes every listener: later input has no effect.
    controls.listenToKeyEvents(keyElement);
    controls.dispose();
    const afterDispose = camera.position.clone();
    wheel(canvas, -120);
    check(key(keyElement, "ArrowUp"), "Disposed key listeners must not consume keys");
    check(camera.position.distanceTo(afterDispose) === 0, "Disposed controls must not react to DOM input");
    check(canvas.style.touchAction === "", "Disposal must restore touch scrolling");

    renderer.render(scene, camera);
    const glError = gl.getError();
    check(glError === GL.NO_ERROR, "Orbit controls rendering produced a WebGL error");

    return { glError: 0, starts, ends, changes, damped };
  } finally {
    controls.dispose();
    orthoControls.dispose();
    mesh.geometry.dispose();
    material.dispose();
    renderer.dispose();
    canvas.remove();
    orthoElement.remove();
  }
}
