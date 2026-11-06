# Three.js synchronization report

Date: 2026-11-07. The maintained WebGL implementation is synchronized with the fetched upstream `dev` HEAD.

## Revision

- Previous baseline: `56344393df8f47e725c4e706b61e248b23d3496d`.
- New baseline: [`2c916de7ad5a7995e345509fbcf8ee5ae161c05c`](https://github.com/mrdoob/three.js/commit/2c916de7ad5a7995e345509fbcf8ee5ae161c05c).
- Upstream commit: `Editor: Update libs (#35296)`, dated `2026-11-06T20:20:46+01:00`.
- Update command: `git -C upstream/three.js pull --ff-only origin dev`.
- Range: 87 commits. Native `REVISION` advances from `187dev` to `188dev`.
- No local edits were made inside the upstream checkout.

## Diff and filtering

| Diff                   | Files | Added lines | Removed lines |
| ---------------------- | ----: | ----------: | ------------: |
| Complete upstream diff |   586 |       36535 |         19920 |
| Filtered upstream diff |    43 |         341 |           178 |

Saved local artifacts:

- [Complete binary-capable diff](.local/upstream-sync/2026-11-07/raw.diff).
- [Filtered diff](.local/upstream-sync/2026-11-07/filtered.diff).
- [Changed-file list](.local/upstream-sync/2026-11-07/changed-files.txt).
- [Per-file scope and exclusion reasons](.local/upstream-sync/2026-11-07/scope.json).
- [Browser results](.local/upstream-sync/2026-11-07/browser-evidence.json).

The complete diff uses `git diff --binary` between the two revisions. The filtered patch retains 42 complete files and the applicable `BatchedMesh.copy()` hunk. It parses with `git apply --stat`; it is an upstream reference patch, not a patch to apply directly to maintained TypeScript. Another 542 files are excluded, and one deleted upstream page is retained natively.

Excluded changes:

- WebGPU, TSL/node graphs, shared WebGPU renderer infrastructure, WebXR and WebGL fallback backend code.
- New meshlet, visibility-buffer and ray-traced radiosity pipelines and their WebGPU pages.
- Generated upstream builds/documentation, editor, manual/site, gallery metadata/screenshots, vendor bundles, CI and upstream-only tests/tooling. Native source documentation and regression tests are maintained separately.
- `Mesh.count` and `Sprite.count`, which serve WebGPU instancing; node-specific `LightShadow` fields.
- `BatchedMesh` merged draws and previous-frame matrix storage, whose consumers are the excluded WebGPU/TSL backend. Its recursive-copy fix was already native.

Upstream replaces `webgl_loader_vdb.html` with a WebGPU page. The approved native WebGL VDB page, loader, local resources and provenance are preserved.

## Applied changes

| Area                   | Native adaptation                                                                                                                                                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Animation and geometry | Apply additive quaternion rotation to cubic-spline values and both tangents. Generate a finite perpendicular tangent for degenerate UVs.                                                                                                                                                                 |
| Copy contracts         | Respect recursive-copy arguments for DirectionalLight, LightProbe and RectAreaLight. Copy ShaderMaterial linewidth. SunLight and BatchedMesh already had the applicable behavior.                                                                                                                        |
| Probe grids            | Use cell-centered samples, including one-cell grids; support multiple baked grids, deterministic priority and per-fragment volume selection. Keep uniforms in render-state-local arrays for nested rendering. Update shader cache keys, all affected material descriptors, CSM and three probe examples. |
| Depth and shadows      | Disable logarithmic depth when reversed depth is active. Place Sky at the correct far plane. Use per-sample cube-face depth correction for point-light PCF shadows. All affected descriptors use the shared shadow chunk.                                                                                |
| Texture copying        | Use source dimensions for VideoFrame and mip copies. Recognize compressed array destinations and preserve array depth so the corrected 3D compressed upload path is reachable.                                                                                                                           |
| Lines and controls     | Reuse same-sized fat-line geometry and distance buffers. Preserve inherited/custom cursor behavior in OrbitControls.                                                                                                                                                                                     |
| Loaders and exporters  | Correct VRML camera Z coordinates, support multiple Collada polygon records, apply glTF sheen intensity without mutating caller color, and preserve anisotropy UV channels/transforms.                                                                                                                   |
| Resource ownership     | Deep-copy LUT colors. Dispose omitted GTAO, SSAO, SSR and bloom resources without disposing caller-owned G-buffer textures.                                                                                                                                                                              |
| Other addons           | Preserve LDraw building-step metadata. Keep MarchingCubes' internal vertex counter private; consumers use `geometry.drawRange.count`.                                                                                                                                                                    |
| Documentation          | Update Object3D event caveats, Texture update-range limits, addon examples and shader reference links. Refresh generated native LLM documentation.                                                                                                                                                       |

Native integration also corrected embedded shader strings that would otherwise retain the old single-grid selection. A browser regression caught this before completion. No backend aliases, compatibility exports, runtime dependencies or second Three.js runtime were introduced.

Five new browser fixtures are registered in the existing smoke runner. The package checker now reads npm 12's name-keyed `npm pack --json` result using `Object.values`, which also accepts the earlier array form.

## Inventory and documented baseline

`CONTRIBUTING.md`, `.local/PLAN.md` and both migration JSON files now identify the new synchronization HEAD. The original inventory extraction remains pinned to `e06d724a29df5b44c6ad878207974eb09ed7e0d9`; its historical records were not relabeled as a fresh extraction.

| Current upstream inventory | Total | Native ports | Excluded |
| -------------------------- | ----: | -----------: | -------: |
| Addon modules              |   501 |          285 |      216 |
| HTML pages                 |   622 |          329 |      293 |

There are no pending approved ports. The retained native VDB page brings the native upstream-derived page total to 330.

New excluded modules are `RayTracedRadiosity`, `MeshletDrawingPipeline`, `VisibilityBufferDrawingPipeline` and `MeshletGeometryUtils`. Upstream removes the already-excluded `VXGIIrradiance`, `RecurrentDenoiseNode` and `TemporalReprojectNode`. New WebGPU color-grading, VDB, instance-material and meshlet pages remain excluded. Removed WebGPU rasterizer/proxy pages do not affect native pages. Detailed additions/removals are recorded in `examples/migration-scope.json`.

## Verification

- `npm run typecheck`: passed.
- Targeted behavior suite: 23 files, 108 tests passed. Coverage includes animation, geometry, light/material copies, batching, fat lines, LUTs, VRML, LDraw, Collada, marching cubes/landing, controls, glTF export, postprocessing, probe grids, depth capabilities and package contracts.
- Formatting and warning-free lint: passed for all 66 touched TypeScript files.
- `npm run docs:llms`: generated documentation for 739 modules.
- `npm run build`: passed, including all example entrypoints.
- `npm run package:check -- --browser-tool`: passed installed-source/export checks, strict consumer types, production build and dependency isolation; temporary consumer removed successfully.
- Standard builtin Chromium: seven targeted browser fixtures passed in the repository and installed development. They exercise probe selection across five material families, nested rendering and one-cell baking; VideoFrame and compressed-array copies; cursor ownership; real XML/glTF contracts; postprocessing resource ownership; normal/reversed Sky depth and shadow lifecycle; physical-material rendering and context restoration. All rendering fixtures returned GL error 0.
- All three changed probe pages visibly rendered in repository development and installed production. The two-volume page also rendered in installed development. The repository GI toggle worked. Installed Sponza was observed after 270 animation frames to cover its progressive bake. The exercised examples had no console errors or uncaught exceptions.
- Sky regression before the fix: the foreground pixel was white with reversed and logarithmic depth both active. After the fix: the foreground pixel is red, reversed depth is active and logarithmic depth is disabled. The normal-depth case also passes.
- Temporary smoke HTML and shader experiments were removed. Verification servers and browser tabs were closed.

## Limits

`npm run style:check` still fails on pre-existing JSDoc code fences. The 16 remaining diagnostics in touched files match the original baseline; this sync introduces no new source-convention violations. A clean repository-wide `npm run verify` result is not claimed.

The full browser/device matrix, unrelated pages/tests, complete exporter/codec matrix and all example interactions were not rerun. Existing large-bundle and Vite+/Vitest peer-resolution warnings remain visible. Existing asset publication restrictions remain unchanged. This is a source synchronization, not a package release.

Pre-existing user changes to `.eslintignore`, `.lsp.json`, `.zed/settings.json`, `package.json` and `package-lock.json` were left untouched.
