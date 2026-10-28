import {
  EXRExporter,
  ZIP_COMPRESSION,
  ZIPS_COMPRESSION,
  RLE_COMPRESSION,
  PIZ_COMPRESSION,
  NO_COMPRESSION,
} from "ek3d/addons/exporters/EXRExporter";
import { FloatType, HalfFloatType } from "ek3d/constants";
import { startHDRExporterExample } from "./exporter-hdr";
import { loadExporterRuntime } from "./exporter-runtime";

loadExporterRuntime<{ zlibSync(data: Uint8Array): Uint8Array }>("/examples/libs/fflate.module.js", ["zlibSync"])
  .then((runtime) => {
    const exporter = new EXRExporter(runtime);
    const options = (type: string, compression: string) => ({
      type: type === "HalfFloatType" ? HalfFloatType : FloatType,
      compression: (
        {
          ZIP: ZIP_COMPRESSION,
          ZIPS: ZIPS_COMPRESSION,
          RLE: RLE_COMPRESSION,
          PIZ: PIZ_COMPRESSION,
          NONE: NO_COMPRESSION,
        } as Record<string, number>
      )[compression],
    });
    startHDRExporterExample({
      extension: "exr",
      mime: "image/x-exr",
      environment: "san_giuseppe_bridge_2k.hdr",
      texture: (texture, type, compression) => exporter.parse(texture, options(type, compression)),
      target: (renderer, target, type, compression) => exporter.parse(renderer, target, options(type, compression)),
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
