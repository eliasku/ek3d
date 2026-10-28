import { KTX2Exporter } from "ek3d/addons/exporters/KTX2Exporter";
import type { KTX2Writer } from "ek3d/addons/exporters/KTX2Exporter";
import { startHDRExporterExample } from "./exporter-hdr";
import { loadExporterRuntime } from "./exporter-runtime";

loadExporterRuntime<KTX2Writer>("/examples/libs/ktx-parse.module.js", ["write", "createDefaultContainer"])
  .then((runtime) => {
    const exporter = new KTX2Exporter(runtime);
    startHDRExporterExample({
      extension: "ktx2",
      mime: "image/ktx2",
      environment: "venice_sunset_1k.hdr",
      texture: (texture) => exporter.parse(texture),
      target: (renderer, target) => exporter.parse(renderer, target),
    });
  })
  .catch((error: unknown) => {
    const canvas = document.querySelector<HTMLCanvasElement>("#scene");
    if (canvas) {
      canvas.dataset.state = "error";
      canvas.dataset.error = error instanceof Error ? error.message : String(error);
    }
    console.error(error);
  });
