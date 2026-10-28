import { initScene } from "./scene";
import type { OffscreenScene } from "./scene";

interface StartMessage {
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  pixelRatio: number;
  port: MessagePort;
}

type Command = { type: "resize"; width: number; height: number; pixelRatio: number } | { type: "dispose" };

self.addEventListener("message", (event: MessageEvent<StartMessage>) => {
  const { canvas, width, height, pixelRatio, port } = event.data;
  let scene: OffscreenScene | null = null;
  port.onmessage = (message: MessageEvent<Command>) => {
    const command = message.data;
    if (command.type === "dispose") {
      scene?.dispose();
      port.postMessage({ type: "disposed" });
      port.close();
      self.close();
    } else {
      scene?.resize(command.width, command.height, command.pixelRatio);
    }
  };
  try {
    scene = initScene(
      canvas,
      width,
      height,
      pixelRatio,
      (frames) => port.postMessage({ type: "frame", frames }),
      (error) => port.postMessage({ type: "error", error: String(error) }),
    );
  } catch (error) {
    port.postMessage({ type: "error", error: String(error) });
  }
});
