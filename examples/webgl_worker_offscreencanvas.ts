/// <reference types="vite/client" />
import OffscreenWorker from "ek3d/addons/offscreen/offscreen?worker";
import { initJank } from "ek3d/addons/offscreen/jank";
import { initScene } from "ek3d/addons/offscreen/scene";
import type { OffscreenScene } from "ek3d/addons/offscreen/scene";

const left = document.querySelector<HTMLCanvasElement>("#onscreen");
const right = document.querySelector<HTMLCanvasElement>("#offscreen");
const button = document.querySelector<HTMLDivElement>("#button");
const result = document.querySelector<HTMLElement>("#result");
if (!left || !right || !button || !result) throw new Error("Missing worker comparison elements");
const onscreen: HTMLCanvasElement = left;
const offscreen: HTMLCanvasElement = right;
onscreen.dataset.state = "loading";
offscreen.dataset.state = "loading";
let disposed = false;
let scene: OffscreenScene | null = null;
let worker: Worker | null = null;
let port: MessagePort | null = null;
const disposeJank = initJank(button, result);
function fail(canvas: HTMLCanvasElement, error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(error);
  console.error(error);
}
try {
  scene = initScene(
    onscreen,
    onscreen.clientWidth,
    onscreen.clientHeight,
    devicePixelRatio,
    (frames) => {
      onscreen.dataset.frames = String(frames);
      onscreen.dataset.state = "rendered";
    },
    (error) => fail(onscreen, error),
  );
} catch (error) {
  fail(onscreen, error);
}
try {
  if (!("transferControlToOffscreen" in offscreen)) throw new Error("OffscreenCanvas is not supported");
  const surface = offscreen.transferControlToOffscreen();
  worker = new OffscreenWorker();
  const channel = new MessageChannel();
  port = channel.port1;
  port.onmessage = (
    event: MessageEvent<{ type: "frame"; frames: number } | { type: "error"; error: string } | { type: "disposed" }>,
  ) => {
    if (event.data.type === "disposed") {
      worker?.terminate();
      port?.close();
      return;
    }
    if (disposed) return;
    if (event.data.type === "error") fail(offscreen, event.data.error);
    else {
      offscreen.dataset.frames = String(event.data.frames);
      offscreen.dataset.state = "rendered";
    }
  };
  worker.onerror = (event) => fail(offscreen, event.message);
  worker.postMessage(
    {
      canvas: surface,
      width: offscreen.clientWidth,
      height: offscreen.clientHeight,
      pixelRatio: devicePixelRatio,
      port: channel.port2,
    },
    [surface, channel.port2],
  );
} catch (error) {
  fail(offscreen, error);
  worker?.terminate();
  worker = null;
  port?.close();
  port = null;
}
function resize(): void {
  scene?.resize(onscreen.clientWidth, onscreen.clientHeight, devicePixelRatio);
  port?.postMessage({
    type: "resize",
    width: offscreen.clientWidth,
    height: offscreen.clientHeight,
    pixelRatio: devicePixelRatio,
  });
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  disposeJank();
  scene?.dispose();
  port?.postMessage({ type: "dispose" });
  if (worker) {
    const activeWorker = worker;
    setTimeout(() => activeWorker.terminate(), 1000);
  }
  onscreen.dataset.state = "disposed";
  offscreen.dataset.state = "disposed";
});
