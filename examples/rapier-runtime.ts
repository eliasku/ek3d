import type { RapierRuntime } from "ek3d/addons/physics/RapierPhysics";
import { loadExporterRuntime } from "./exporter-runtime";

let runtime: Promise<RapierRuntime> | undefined;

/** Loads the locally hosted Rapier 0.21.0 runtime once. */
export function loadRapier(): Promise<RapierRuntime> {
  runtime ??= (async () => {
    const module = await loadExporterRuntime<RapierRuntime & { init(): Promise<void> }>(
      "/examples/libs/rapier/rapier.mjs",
      ["init", "World", "RigidBodyDesc", "ColliderDesc"],
    );
    await module.init();
    return module;
  })();
  return runtime;
}
