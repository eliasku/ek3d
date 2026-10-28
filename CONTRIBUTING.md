# Contributing to ek3d

Repository workflow, implementation details, API contracts and verification requirements. For a short introduction and usage example, see [README.md](README.md).

## Name and upstream baseline

The library and npm package are named `ek3d`. The npmjs name is already reserved with an empty `0.0.1` release; that release does not contain this implementation. The local development version remains `0.1.0`, unpublished. The practical WebGL implementation plan is complete and has been retired; release verification remains a separate gate. The owner manually transfers the finished contents to a public repository without Git history. Do not publish the package as part of this work.

The ported Three.js snapshot is pinned to:

- Repository: [https://github.com/mrdoob/three.js/](https://github.com/mrdoob/three.js/)
- Branch at the snapshot: `dev`
- Commit: [`e06d724a29df5b44c6ad878207974eb09ed7e0d9`](https://github.com/mrdoob/three.js/commit/e06d724a29df5b44c6ad878207974eb09ed7e0d9)
- Commit date: `Mon Oct 26 23:41:02 2026 +0100`

Use this immutable commit as the baseline for future upstream diffs and ek3d updates, not the moving `dev` tip.

The library is distributed as uncompiled TypeScript source: `exports` maps package subpaths to `src/**/*.ts`, so consumers compile it with their own bundler and no generated output is checked in. LLM documentation generation through `upstream/three.js/utils/llms/build.js` is deferred.

This is a non-commercial project. Its MIT code license does not replace third-party asset
licenses. Keep attribution and asset-specific terms; resolve missing redistribution permissions
before publishing assets, including on a free public website.

## Project focus

- **WebGL for canvas games, mobile web rendering and lightweight 3D interactions.** XR applications and adopting the newest graphics API are not targets.
- **No WebXR or WebGPU backend**, disabled manager or compatibility shim. Session/controller lifecycles, native XR types, backend-specific branches and their examples are outside the package.
- **No `StereoCamera` or stereo example/picking mode.** Stereoscopic applications are excluded; ordinary perspective, orthographic, array and cube cameras remain. The former `ek3d/cameras/StereoCamera` import is intentionally removed without a compatibility shim.
- **Keep the code relevant to the application:** raw TypeScript, direct imports from defining modules and explicit subsystems. Functional coverage and correctness take priority over recurring bundle-size comparisons.

**WebGL-only cutover (D.0):** the earlier WebXR implementation and shared WebGPU-only APIs have been removed. This intentionally breaks clients of `createXR`, `renderer.xr`, XR module subpaths and WebGPU-only members. Ordinary WebGL, reversed-depth math and external GPU-resource ownership remain. The checked-in upstream reference is unchanged.

## Run

Node `^22.18.0 || ^24.11.0 || >=26.0.0`; upstream source must be present at `upstream/three.js/src` for differential behavior tests, not for building or regenerating the maintained source.

```sh
npm ci
npm run check
npm test
npm run dev
```

`/examples/webgl_loader_xyz.html` loads and rotates the local 201-point helix using
`ek3d/addons/loaders/XYZLoader` and explicit `PointsMaterial` shader composition.
The loader supports XYZ and XYZRGB rows, converting byte sRGB colors to working-space colors.
Comments and unsupported row widths are ignored, matching upstream. Use a consistent row layout
within each file; mixed colored/uncolored rows retain upstream's unequal attribute counts.
The page handles resize, load errors and late responses after disposal. Data attribution and
the LGPL license are retained in `examples/public/examples/`.

`/examples/webgl_loader_gcode.html` loads three local toolpaths with
`ek3d/addons/loaders/GCodeLoader`, explicit `LineBasicMaterial` shader composition,
OrbitControls and a lil-gui asset selector. The loader preserves upstream linear moves,
absolute/relative positioning, extrusion overrides, position resets and `splitLayer`.
Arc and unsupported commands are ignored. Switching assets rejects stale responses;
page disposal releases model geometries, shared materials and controls.

`/examples/webgl_loader_obj.html` loads the local male02 OBJ with its MTL materials and textures.
Import `MTLLoader` from `ek3d/addons/loaders/MTLLoader`, then pass its material creator to
`OBJLoader.setMaterials()`. Texture handlers use the same loading manager and must return a texture.
MTL preserves Phong colors, map transforms, bump/displacement options and transparency precedence.

`/examples/webgl_loader_imagebitmap.html` compares three image uploads with three flipped bitmap
uploads. Bitmaps close after GPU upload; disposal cancels scheduled loads and closes unused bitmaps.
It uses `Texture` with `needsUpdate` instead of the canvas-only `CanvasTexture` TypeScript contract.

`BVHLoader` and `MDDLoader` expose typed skeleton/clip and morph-target/clip results from their
canonical addon loader paths. `/examples/webgl_loader_bvh.html` plays the local pirouette with a
skeleton helper; `/examples/webgl_loader_mdd.html` plays four cube morph targets. Both use the
existing animation mixer, preserve back/forward-cache restores and release playback on disposal.

`PCDLoader`, `TDSLoader` and `VOXLoader` have local examples at `/examples/webgl_loader_pcd.html`,
`/examples/webgl_loader_3ds.html` and `/examples/webgl_loader_vox.html`. PCD supports ASCII, binary
and LZF-compressed clouds; its GUI selects all four local samples. TDS preserves Phong materials,
texture maps and mesh transforms. VOX exposes chunk data, scene graphs, greedy meshes and 3D textures.

`DDSLoader`, `KTXLoader`, `PVRLoader` and `TGALoader` have corresponding
`webgl_loader_texture_{dds,ktx,pvrtc,tga}` pages. Native compressed formats are capability-gated:
unsupported maps are skipped with a visible explanation, not substituted. Malformed compressed
data rejects `loadAsync()` and reaches `load()` error callbacks. TGA supports indexed, RGB and
greyscale images, RLE and all four image origins.

The glTF loader pages now include anisotropy, AVIF, GPU instancing, iridescence and material variants.
HDR and UltraHDR texture pages expose exposure and format controls; the KTX2 page compares 18 local
textures, labels unsupported GPU formats and injects the local ZSTD decoder for the HDR sample.
All vendor runtimes remain example resources, not package runtime dependencies.

`TTFLoader` takes a consumer-supplied opentype-compatible parser in its constructor.
`/examples/webgl_loader_ttf.html` loads the local KenPixel font and supports text entry and drag
rotation. `/examples/webgl_geometry_text_shapes.html` draws filled glyphs and contour/hole outlines.
The example-only opentype runtime and font notices are served locally.

`LUT3dlLoader`, `LUTCubeLoader` and `LUTImageLoader` produce `Data3DTexture` lookup tables from
3DL, Cube and image-strip data. `/examples/webgl_postprocessing_3dlut.html` compares nine local LUTs
with enable, selection and intensity controls. The loaders retain upstream LUT domain semantics;
the pass does not add input-domain remapping.

The `webgl_buffergeometry` examples now include indexed triangles, morphing lines, indexed Koch
curves, separate/interleaved point attributes, integer shader attributes and attribute-free GLSL
vertices. `/examples/webgl_geometry_cube.html` uses the local crate texture. These pages keep
upstream geometry sizes, explicit shader composition, resize and page-disposal handling.

`AMFLoader` and `ThreeMFLoader` use a consumer-provided `setZipRuntime({ unzipSync })` decoder.
The canonical 3MF import is `ek3d/addons/loaders/3MFLoader`, exporting `ThreeMFLoader`.
The AMF page loads the local rook; the 3MF pages provide seven selectable Consortium samples
and the textured truck. Shared model resources use the existing deduplicating disposal helper.

`MD2Loader` produces geometry with named morph clips. `MD2Character`, `MD2CharacterComplex`
and `MorphBlendMesh` preserve weapon synchronization, playback and movement/animation blending.
The two MD2 pages load local Ratamahatta and Ogro assets; the control page uses `Gyroscope`
camera following and `SunLight` cascaded shadows. Model and LUT redistribution permissions
remain a publication prerequisite, recorded in the asset README.

`HDRCubeTextureLoader` loads six RGBE faces and forwards face parse errors through the loader
error callback and loading manager. `TIFFLoader` takes a consumer-supplied `TIFFRuntime` in its
constructor. The TIFF and HDR environment examples use local UTIF and texture resources.
The cube reflection/refraction pages retain the upstream models and environment maps.
Humus cubemap notices require written approval for commercial distribution; review these
asset terms before publication.

The bulk example set also covers custom and instanced BufferGeometry attributes, draw ranges,
interactive mesh/line/point picking, voxel painting, geometry helpers and morph-target animation.
`webgl_points_waves` updates point positions and sizes in a custom shader. These pages retain
upstream controls and scene sizes, with explicit renderer composition and page-disposal handling.
Comprehensive example interactions and the browser/device matrix are checked in a combined pass;
per-batch verification records its exact exercised subset in `.local/PLAN.md`.

The next bulk batch adds 52 pages: texture filtering/transforms and drawing, blend modes and
material maps, dynamic cubemaps, custom point/line attributes, sprites, array/logarithmic cameras,
clipping and stencil caps, multiple viewports, render targets/readback, procedural shaders,
sky and panoramas. `GeometryUtils` provides Hilbert 2D/3D and Gosper curves at its canonical
`ek3d/addons/utils/GeometryUtils` path. Pages use canonical imports and explicit renderer composition.
Assets remain local with adjacent notices. Runtime coverage is recorded per exercised subset,
not implied by a successful typecheck or build.

Custom `ShaderMaterial` instances keep their own shaders; do not register a built-in shader
under the `ShaderMaterial` key. Supply their `#include` dependencies through `shaderChunks`.
The RTT and float-readback pages explicitly supply `colorspace_fragment`; the keyframe page
keeps the Sky and PMREM shaders separate from its standard-material shader.

The following bulk batch adds 53 pages for animation blending, convex/teapot/decal geometry,
splines, lighting and probes, shadow techniques, advanced postprocessing, volume/array textures,
uniform buffers and performance comparisons. `NRRDLoader` takes an optional `NRRDGzipDecoder`
as its second constructor argument; inject `{ gunzipSync }` for gzip data. `Volume` and
`VolumeSlice` retain CPU slicing and repaint controls. `SVGStroke` exposes the extracted SVG
stroke tessellator without claiming a complete `SVGLoader` port. Geometry, probe, shadow and
sorting helpers use their defining addon paths. Godrays remains pending because its upstream
third-party effects need a separate runtime integration. Full-page interactions remain deferred
to the combined verification pass; `.local/PLAN.md` records the exercised subset.

The next batch adds fat lines and raycasting, curve/edge/tessellation modifiers, PMREM comparisons,
portals, progressive GI, GPU picking, physical materials, video, molecular geometry, UV previews,
wide-gamut output, procedural surfaces and GPU simulations. Addons keep their defining import paths,
including `ek3d/addons/lines/Line2`, `ek3d/addons/modifiers/CurveModifier` and
`ek3d/addons/misc/GPUComputationRenderer`. `VTKLoader` accepts `{ unzlibSync }` as its second
constructor argument for compressed XML. `PDBLoader` returns atom/bond geometry and atom metadata;
its canvas example omits the excluded CSS label renderer. `UVsDebug` draws triangle UV contours,
face numbers and vertex labels. `WebGL` exposes WebGL 2 and drawing-buffer color-space probes;
these do not establish display hardware gamut. Video examples surface permission/playback errors
and release media tracks on disposal. Lensflare disposal also releases its element textures,
matching upstream; do not reuse those textures after disposal.

The main `webgl_loader_gltf` catalog remains pending: its live Khronos catalog and referenced
models require a licensed local snapshot. Existing local glTF examples remain available.

The next loader batch adds `/examples/webgl_loader_3dm.html`, `webgl_loader_ifc.html`,
`webgl_loader_vdb.html`, `webgl_modifier_subdivision.html` and `webgl_morphtargets_webcam.html`.
`Rhino3dmLoader` uses `setLibraryPath()` for consumer-owned rhino3dm JavaScript/WASM;
`setZlibDecoder()` supplies compressed EXR decoding for embedded environments.
`LWOLoader` and its LWO2/LWO3 parser chain need no vendor runtime.
The package-owned `VDBLoader` port takes an optional `{ unzlibSync }` runtime as its
second constructor argument; `setGridNames()` selects grids before dense texture creation.
Its supported value types and compression follow three-vdb-loader 0.3.0, not every OpenVDB file.
The package-owned `LoopSubdivision` port uses the canonical
`ek3d/addons/modifiers/LoopSubdivision` path and preserves three-subdivide 1.1.5's options.
IFC and webcam pages load local web-ifc and MediaPipe resources without package dependencies.
Webcam tracking requires a secure context, camera permission and a supported GPU delegate.
Asset notices and unresolved publication rights are recorded in the adjacent asset README.

The remaining standalone addon batch includes lofts, animation paths, texture/view helpers,
outline rendering, morph playback, tube painting, coaster geometry, color/scene utilities,
UV unwrapping and MaterialX archive/interface parsing. `InteractiveGroup` supports browser
pointer/mouse interaction only; XR controllers remain excluded. `ViewHelper` uses WebGL.
`unwrapUVs(root, potpack, options)` and `readMtlxArchive(buffer, zipRuntime)` take caller-owned
runtimes. MaterialX parsing and validation do not install the excluded TSL material backend.
`RectAreaLightUniformsLib.init()` returns LTC inputs for the renderer's `ltcTextures` option;
it does not register global uniforms. Packed geometry requires consumer shader decoding.
`SceneOptimizer.toBatchedMesh()` destructively replaces compatible static meshes; source
resources still used by surviving meshes are retained. Instancing conversion remains
unsupported, matching the pinned upstream API.

`/examples/webgl_postprocessing_godrays.html` uses the maintained `GodraysPass`, adapted from
three-good-godrays 0.12.0 to the native composer and WebGL shadow layouts. The pass requires
a rendered shadow-casting light and a scene depth texture on its input target, or one supplied
with `setDepthTexture()`. The separate `postprocessing` package is not a dependency.
The retained vendor license is in `GodraysShaders.ts`; example-model publication rights
remain unresolved.

`/examples/webgl_raycaster_bvh.html` uses the maintained three-mesh-bvh 0.9.10 raycaster
closure and the existing local bunny model. Import `MeshBVH` from
`ek3d/addons/math/bvh/core/MeshBVH` and `BVHHelper` from
`ek3d/addons/math/bvh/objects/BVHHelper`. Direct `raycastObject3D()` integration needs no
prototype patch or second runtime. Optional extension methods and local structural types
live in `ek3d/addons/math/bvh/utils/ExtensionUtilities`.

Open the URL printed by Vite. `/` is the English project landing page: a fullscreen, animated metallic torus knot with a short introduction, a link to `/examples/examples.html`, and a "Star on GitHub" CTA linking to [eliasku/ek3d](https://github.com/eliasku/ek3d) in a new tab. Its entrypoint is `examples/landing.ts`. A `MeshStandardMaterial` reflects a `RoomEnvironment`, baked once through `PMREMGenerator`; neutral tone mapping preserves highlight detail. The model and room are generated locally, with no external assets or runtime dependencies. The layout adapts to narrow screens. Capture resources are released after baking; navigation releases the model, environment target and DFG lookup texture while preserving back/forward-cache restores.

`/feature-testbed/` is the internal feature self-testing stand. It runs `feature-testbed/main.ts`: a combined scene with camera/hierarchy, a reflective sphere, textured cylinder, normalized interleaved Lambert capsule, and an alternate set with a curved tube, beveled extrusion and flat shape with real holes. **O** replaces those meshes with a line strip, dashed loop, box edges, textured points and a translucent camera-facing sprite. **M** shows three colored instanced boxes. **H** shows a batched sphere/cylinder and a distance-selected sphere/box LOD. These paths include independent transforms, picking and directional/point/spot shadows. Ambient fill and a projected spot cookie can be toggled independently. All sets support fog, environment/background, HDR output and animation. Use the controls shown on the canvas; resizing updates both camera projections and the renderer. Rendering failures remain visible and are rethrown, not replaced with a mock or software scene.

Controls: drag to orbit, wheel to zoom (and switch LOD), **click** an object to select it (wireframe for ordinary meshes/LOD, white tint for lines/points/sprites or the selected instance; click empty space to clear), **G** to switch primitives/curve geometries, **O** to toggle lines/points/sprites, **M** to toggle instanced boxes, **H** to toggle batching/LOD and return to the previous set, **J** to hide/show the first batched instance, **X** to delete/recreate the second, **R** to advance instance/batch transforms even while paused, **C** to switch perspective/orthographic cameras, **F** to cycle off/linear/exponential fog, **N** to change the beacon's uniform-block tint, **I** to update the normalized interleaved capsule position buffer, **Space** to pause/resume, **L** to cycle directional/point/spot light, **A** to toggle ambient fill, **K** to toggle the spot cookie (visible in spot mode), **S** to toggle received shadows, **B** to toggle background blur, **E** to toggle background/basic reflection, **U** to update texture pixels, **T** to cycle tone mapping, and **+ / −** to change exposure.

**P** shows Phong, Normal, Matcap, Toon, Standard and Physical spheres over a ShadowMaterial receiver, and returns to the previous object set. **V** toggles ordinary lighting, **Y** independently toggles IBL, **Q** cycles off/probe/area/both, and **D** toggles material maps. Picking works in both cameras; shadows, texture updates and HDR controls remain active. The DFG and LTC textures are real fitted upstream data, not placeholder lighting.

**W** shows a skinned cylinder and a morph sphere driven by an `AnimationMixer`, and returns to the previous object set. **[ / ]** seek backward/forward by 0.25 seconds, **Z** restarts the clip, and **Space** pauses playback. Deformation updates picking bounds and directional/point/spot shadows; both camera projections remain available.

**1** loads a bundled local PNG onto the cylinder, then toggles it against the original texture. **2** loads deliberately corrupt JSON; **3** requests a missing resource. The canvas reports errors without destroying the working scene; manager completion and byte/item progress remain observable. No external CDN is used. `feature-testbed/assets.ts` owns its manager and loaded texture, aborts pending file requests and releases resources during scene disposal.

**4** cycles off/array layers/3D slices, displaying two independently rendered texture slices. **5** toggles axes, grid, bounds, camera, light and skeleton helpers; use **W** to observe animated bones and **C** to inspect the perspective camera from the orthographic view. **6** toggles animated custom GLSL rings. **7 / 8** deliberately trigger compile/link failures, capture driver logs, repair the shader and restore the scene. The HUD reports recovery; `data-shader-log` retains the actual logs.

The canvas help panel starts with compact controls, scene state and asset status. Click its title or press **?** to switch between compact and full help; this also works while paused without selecting objects underneath. The testbed is split into `feature-testbed/main.ts` (lifecycle, controls and animation), `feature-testbed/renderer.ts` (renderer/shader setup), `feature-testbed/scene.ts` (objects, materials, textures and lights), `feature-testbed/assets.ts` (local loading and resource ownership), and `feature-testbed/hud.ts` (help drawing and title hit testing).

The feature testbed checks currently implemented functionality, not full upstream coverage. `FontLoader` is available as an addon; `GLTFLoader`, other format-specific addon loaders, codecs, decoders and transcoding workers remain pending. Third-party runtime will be supplied explicitly by consumers rather than bundled into the source-first package.

### Addon shader examples

Maintained addon code lives in `src/addons/`, under the same TypeScript and dependency rules as core. Import defining modules such as `ek3d/addons/shaders/CopyShader`; no `Addons` aggregator or `three/addons/*` compatibility path exists. The first migration iteration contains 48 shader modules (58 exported shader definitions). `DepthLimitedBlurShader`, `GTAOShader`, `PoissonDenoiseShader` and `SubsurfaceScatteringShader` remain deferred with their executable helpers.

HTML examples live in `examples/` with adjacent TypeScript entrypoints. Open `/examples/webgl_shaders.html` for a four-panel comparison: copy and grayscale above, green tint and half exposure below. It uses generated local texture data, no CDN or vendor runtime. Both this page and `/feature-testbed/` are production build entries and are copied into the isolated package consumer.

Shader chunks are imported directly and composed once when the module loads; no implicit renderer chunk registry is required. Use `RawShaderMaterial` for `OutputShader`, and supply integer `RINGS` and `SAMPLES` defines for `BokehShader2`. Frei-Chen moves uniform-dependent initialization into `main` and avoids the GLSL3 reserved word `sample`. Triangle blur preserves its public `texture` uniform while resolving texture sampling before that name shadows the GLSL3 builtin.

`tests/browser-addon-shaders.ts` checks actual pixels, opacity/alpha, luminance, tint, exposure, cloned-uniform isolation, flat-field Frei-Chen response and zero-radius triangle blur. These are standard-browser checks during porting; the remaining release browser/device matrix is a separate gate.

### Orbit controls and text geometry

`/examples/misc_controls_orbit.html` ports the upstream 500-cone scene, damping, fog and lighting. Drag with the left mouse button to orbit, right mouse button to pan, wheel to zoom, or use arrow keys. Touch supports one-finger orbit and two-finger zoom/pan. The camera's distance and polar limits remain active.

Import `OrbitControls` from `ek3d/addons/controls/OrbitControls`. Its generic camera parameter retains the concrete perspective or orthographic camera type without redeclaring inherited fields. The base `Controls` is available from `ek3d/extras/Controls`; it has real shared state and `connect` logic, with abstract `disconnect`, `dispose` and `update` methods. Call `update()` each frame for damping or auto-rotation, and `dispose()` when the consumer releases the controls. The feature testbed retains its own original interaction code.

`/examples/webgl_geometry_text.html` preserves the upstream text scene, mirrored text, floor, lighting, fog, drag-to-spin and editable text. Type to replace the initial text; Backspace deletes. **F1** changes color, **F2** cycles the five font families, **F3** switches regular/bold, and **F4** toggles bevel. These replace the vendor GUI, not its features. Non-editing keys do not clear the initial text; stale asynchronous font responses do not override the current selection.

The ten fonts in `examples/fonts/` are byte-identical upstream assets and are excluded from formatting. Their licenses and attribution live in `examples/public/font-licenses/`, which Vite copies to `dist/font-licenses/`. The isolated installed-package consumer uses the same public directory and all ten explicit asset URLs.

`FontLoader` and `Font` are defined in `ek3d/addons/loaders/FontLoader`. `loadAsync()` returns a typed font; malformed JSON rejects through the error callback and loading manager. Shapes preserve glyph holes, advance widths, newlines, Unicode character splitting, `ltr`/`rtl`/`tb` directions and the `?` fallback. A missing glyph with no fallback throws rather than fabricating geometry.

`TextGeometry` is defined in `ek3d/addons/geometries/TextGeometry` and uses the existing extrusion options. It preserves the upstream options mutation and geometry generation. Serialization retains an upstream limitation: the geometry does not retain source text. Before calling `TextGeometry.fromJSON(json)`, the consumer must add `json.options.text`; the serialized options must also contain the font. A serialized extrusion path requires an explicit curve factory as the third argument, rather than an implicit registry.

`tests/browser-orbit-controls.ts` checks wheel/key lifecycle, bounds, reset, damping, reconnect and disposal without fake pointer capture. Real drag and touch checks use the standard browser tool on the page. `tests/browser-font-text.ts` checks local loading, geometry layout, actual empty hole/filled stem pixels and JSON errors; Node tests cover additional deterministic camera and geometry boundaries.

### Interaction controls set

Iteration eight ports the remaining small controls and their pages. Import them from their defining modules: `ek3d/addons/controls/MapControls` (bird's-eye camera sharing the OrbitControls implementation with world-space panning and pan/rotate button presets), `ek3d/addons/controls/DragControls` (drag'n'drop of scene objects with hover cursor, plane-based dragging and `transformGroup` selection), `ek3d/addons/controls/PointerLockControls` (first-person look via the Pointer Lock API, `moveForward`/`moveRight`, pitch clamping) and `ek3d/addons/controls/TransformControls` (object translate/rotate/scale gizmos with `getHelper()` to add to the scene).

`TransformControls` is not generic: it transforms an arbitrary `Object3D` and owns a separate `camera` property assignable at runtime (the upstream camera-swap keyboard hook). Mirrored state (mode, space, axis, snaps, size, visibility toggles) propagates to the internal gizmo and plane through syncing accessors installed in the constructor, firing `<prop>-changed` and `change` events. The gizmo caches highlight state lazily on each material (`_color`/`_opacity`), exactly like upstream.

Pages: `/examples/misc_controls_map.html` (keys **1**/**2** toggle `zoomToCursor` and `screenSpacePanning`), `/examples/misc_controls_drag.html` (Shift+click groups, **Digit1** switches touch pan/rotate), `/examples/misc_controls_pointerlock.html` (click to lock; WASD/arrows/Space), `/examples/misc_controls_transform.html` (q/w/e/r, Shift snaps, x/y/z visibility, space disables, Escape resets, **C** swaps perspective/orthographic, ±size). The vendor GUI is replaced with keyboard hooks, not dropped features; the transform page loads `examples/public/examples/textures/crate.gif`.

`tests/controls.test.ts` covers MapControls presets and no-element no-op panning, PointerLockControls movement and disabled behavior, DragControls state wiring without fake dispatches, and TransformControls attach/detach/mirror/reset boundaries. Real pointer capture, hover cursors, axis picking and dragging are verified through the standard browser tool on the pages during porting.

### Arcball, Trackball, Fly, FirstPerson controls and OBJ/HDR loaders

Iteration nine completes the controls set. `ek3d/addons/controls/TrackballControls` orbits without keeping the camera's `up` vector (keys A/S/D switch rotate/zoom/pan, `handleResize()` feeds screen metrics, `multiTouchRoll` reads two-finger twist). `ek3d/addons/controls/ArcballControls` implements the virtual trackball FSA with default mouse actions (CTRL+drag or right-drag pan, left-drag rotate, wheel zoom, Shift+wheel FOV vertigo), pointer-count input states for touch, double-tap focus animations, z-rotate, `copyState()`/`pasteState()` through the clipboard, `setStateFromJSON()` for programmatic round-trips, and `setCamera()` for runtime camera swaps. `ek3d/addons/controls/FlyControls` maps WASD/R/F/QE plus arrow keys to movement and roll with an optional `dragToLook` mode; its upstream demo page is a WebGPU page and stays excluded, so the module ships without a page here. `ek3d/addons/controls/FirstPersonControls` is the damped variant: velocity lerps toward the key/pointer target, `heightSpeed` scales forward speed with altitude, and `constrainVertical` remaps the look bounds.

The arcball page loads its model and environment through the ported `ek3d/addons/loaders/OBJLoader` and `ek3d/addons/loaders/HDRLoader`. OBJLoader parses `v/vn/vt/f/l/p` records, smooth-shading groups, vertex colors and multi-material groups; the returned `OBJGroup` carries `materialLibraries`. HDRLoader decodes RGBE (RLE and flat) into half-float or float data textures; both loaders were differentially verified against upstream across the repository's OBJ models and all twelve `.hdr` fixtures.

Pages: `/examples/misc_controls_trackball.html` and `/examples/misc_controls_arcball.html` expose the same toggles through the ported lil-gui panel (camera swap, `multiTouchRoll`, focus/grid/cursor zoom/near-far adjust, scale factor, gizmo visibility, copy/paste/reset state). `/examples/webgl_geometry_terrain.html` and `/examples/webgl_geometry_minecraft.html` (first-person flight with drag look and WASD). `/examples/misc_controls_fly.html` re-creates the earth fly-through that upstream renders with WebGPU: same scene and controls, `EffectComposer` + `FilmPass` instead of the TSL film node.

`tests/interaction-controls.test.ts` covers Fly movement and roll, FirstPerson damped convergence and latitude clamping, Trackball orbit radius preservation and reset, Arcball JSON state round-trips and the upstream seven mouse actions, plus OBJ parsing and an HDR payload check. Model-to-model identity runs in the differential Node harness; interactive dragging runs in the standard browser tool on the pages.

### lil-gui and Stats

The vendored utility libraries live in `src/addons/libs/` as real maintained TypeScript. `ek3d/addons/libs/lil-gui/GUI` is the lil-gui panel (0.21+ DOM contract: `.lil-gui`, `controller/name/widget` rows, body classes `lil-gui-dragging`/`lil-gui-vertical`); its default stylesheet is injected once per page unless `injectStyles: false`. Controllers read `object[property]` dynamically — pass any object with the property you want to tweak (a camera, a material, a plain params object). `ek3d/addons/libs/Stats` replaces the closure-based stats.js with a `Stats`/`StatsPanel` class pair; append `stats.dom` yourself and call `update()` per frame.

Pages wire the real GUI instead of keyboard replacements: `/examples/misc_controls_trackball.html` (use-orthographic and multi-touch-roll checkboxes), `/examples/misc_controls_arcball.html` (Choose Camera dropdown plus the twenty-row Arcball parameters/Animations folders with copy/paste/reset buttons), `/examples/webgl_tonemapping.html` (Tone Mapping folder with the eight modes and an exposure slider that hides when mapping is off, Background folder with blurriness/intensity), and `/examples/webgl_materials_envmaps_groundprojected.html` (Grounded checkbox that swaps the skybox for the flat equirect background). `tests/browser-lil-gui.ts` (`verifyLilGui` in the browser smoke) checks widget interactions — checkbox, function button, select, number text input with snapping and clamping, slider drag mapping, string input, four color formats, save/load round-trip, onChange plumbing and destroy — in a real DOM.

### Draco and UltraHDR loaders, Sky family and the demo browser

`ek3d/addons/loaders/DRACOLoader` decodes standalone `.drc` files and glTF `KHR_draco_mesh_compression` payloads with a worker pool over the vendored WASM runtime under `/libs/draco/`. Use `dracoLoader.setDecoderPath(DRACO_GLTF_CONFIG)` when wiring a glTF loader. Decoded `bunny.drc` output matches the upstream loader byte-for-byte. `ek3d/addons/loaders/UltraHDRLoader` reads Ultra HDR JPEGs (XMP + ISO 21496-1 metadata, MPF container, gain-map recovery) into half/float data textures; pair it with `EquirectangularReflectionMapping` for environment use. `ek3d/addons/objects/Sky` is the Preetham skydome with cloud and sun-disc uniforms; `ek3d/addons/objects/GroundedSkybox` projects an envmap onto the ground plane.

`tonemapping_pars_fragment.glsl` exports a `{ get(), set(replacement) }` accessor so pages can swap tonemapping functions at runtime (the tonemapping example injects the Uncharted2 curve for the `Custom` mode this way). `PMREMGenerator.fromScene` accepts any `Object3D`, so a `Sky` mesh can be PMREMed directly.

Pages: `/examples/webgl_loader_draco.html` (bunny), `/examples/webgl_animation_keyframes.html` (LittlestTokyo through Sky-PMREM environment), `/examples/webgl_loader_gltf_transmission.html` (Ultra HDR envmap + dish model), `/examples/webgl_tonemapping.html` (lil-gui mode/exposure/background control), `/examples/webgl_materials_envmaps_groundprojected.html` (ferrari with grounded skybox). Model and texture paths inside pages are absolute (`/examples/...`) because relative paths resolve through the dev server's HTML fallback.

`/examples/examples.html` is the in-app demo browser: a filterable list of every ported demo on the left, the selected demo rendered in an iframe on the right, hash sync (`#demo-name`), arrow-key navigation, and a lil-gui panel in the sidebar with resolution scale and reload.

Resolution scale keeps the iframe centered and fitted to its container. At 2, its viewport has twice the width and height; at 0.5, half. This scales the entire example, including its UI, rather than changing renderer pixel ratio alone. Browser controls stay outside the iframe and do not cover example controls.

### STL and PLY loaders

Import `STLLoader` from `ek3d/addons/loaders/STLLoader` or `PLYLoader` from `ek3d/addons/loaders/PLYLoader`. Both support `parse()` for ASCII strings or binary `ArrayBuffer` data, and `load()`/`loadAsync()` through a loading manager without an external decoder.

STL preserves non-indexed facets, normals, groups for multiple ASCII solids and Magics binary vertex colors/alpha. PLY preserves ASCII, little- and big-endian binary input, vertex and face colors/UVs, triangle/quad faces, property-name remapping and custom attributes.

The corresponding `/examples/webgl_loader_stl.html` and `/examples/webgl_loader_ply.html` pages use local upstream models, animated cameras, fog, directional shadows and Stats. Model provenance is recorded in `examples/public/examples/README.md`. Parser regression tests use synthetic data and require no network.

### Collada, SVG, VRML, lighting, workers and audio

`ColladaLoader` exposes parsed libraries, scene animations and kinematics. Its four local
examples cover static scenes, robot joints, skinning and KMZ archives. Configure KMZ with
`new KMZLoader(manager).setZipRuntime({ unzipSync })`; the ZIP implementation stays outside
the package. `SVGLoader` provides paths, styles, gradients, fill/stroke materials and stroke
tessellation. `VRMLLoader` takes a consumer-supplied Chevrotain-compatible runtime as its
first constructor argument. Its example loads the licensed runtime locally.

`CCDIKSolver` supports constrained bone-chain solving and a disposable helper.
`CSM.setupMaterial()` injects cascaded directional shadows into explicitly composed material
descriptors without a global shader registry. Update CSM before rendering and release its
lights and material hooks when finished. `new ProgressiveLightMap(renderer, potpack, resolution?)`
takes an explicit atlas packer; callers retain ownership of scene objects and source materials.

`Capsule`, `Octree` and `OctreeHelper` support the local FPS collision example.
The OffscreenCanvas comparison uses the same scene on the main thread and a module worker;
Vite resolves the worker through the installed package. Worker animation requires worker
`requestAnimationFrame`. Priority loading, random UV shaders and the watch example use
the existing loader and postprocessing APIs with local resources.

Core audio modules live at `ek3d/audio/{AudioContext,AudioListener,Audio,PositionalAudio,AudioAnalyser}`;
audio buffers load through `ek3d/loaders/AudioLoader`. The four `webaudio_*` pages start
playback from a user gesture. `AudioContext.setContext(context)` supplies a caller-owned native
context; neither sources nor listeners close it automatically. Release source/filter nodes
and close an owned context explicitly. `PositionalAudioHelper` lives at its canonical addon path.
AudioLoader copies encoded data before decoding so cached buffers are not detached, and keeps
the loading manager active until decoding finishes.

Asset notices are in `examples/public/examples/README.md` and adjacent files. Code/package
checks and a minimal changed-path browser check do not establish the deferred combined
interaction, lifecycle or device matrix recorded in `.local/PLAN.md`.

## Development tooling

The project pins Vite+ **1.4.0**. npm and the committed lockfile remain the installation contract; a global `vp` install is not required. The direct `vite` dependency and root `overrides` map Vite to `@voidzero-dev/vite-plus-core@1.4.0` in the current configuration.

Use `./node_modules/.bin/vp toolchain` to inspect the actual bundled engines. Reassess the dependency layout when upgrading Vite+, rather than assuming that different releases require identical aliases or overrides.

- `npm run check` runs `format:check`, `style:check`, `lint` and `typecheck` without rewriting files. `vp lint --deny-warnings` enforces the zero-warning policy across maintained TypeScript, including `src/**`.
- `npm test` runs the behavioral and architectural tests through Vitest in Node.
- `npm run verify` adds the feature testbed and maintained examples' production build to those checks and Node tests. Real-browser and installed-package checks remain explicit commands below.
- `npm run format` includes maintained `src/` alongside tests, examples, scripts and configuration. Only `upstream/`, `dist/` and the lockfile are excluded.
- `npm run style:check` applies AST-based source conventions to project-owned TypeScript, including `src/`: imports first, inline exports, explicitly typed fields without `declare`, no class/interface merges, no redundant typed JSDoc tags, and TypeScript JSDoc fences.
- Source lint is type-aware and configured in `vite.config.ts`; only the read-only `upstream/` baseline and `dist/` are ignored. Intentional receiver-preserving dispatch, constructor/statistics closures and signed-zero arithmetic have narrowly scoped inline exceptions with reasons. Do not replace them with blanket rule overrides or allocate bound callbacks just to satisfy lint. Strict types, package-graph, behavioral and browser checks remain required.

`typescript@7.0.2` is the primary compiler and native language server. `typescript6` aliases `typescript@6.0.2` for the stable JavaScript Compiler API used by AST-based package checks and graph analysis; it remains required after removal of the converter. Typecheck commands use the primary package's explicit CLI path rather than depending on two packages competing for the `tsc` bin link.

Maintained scripts are TypeScript executed by `tsx`. One root `tsconfig.json` checks the port, example, consumer/browser contracts, scripts, Node tests and build config under the same strict settings. Imported upstream JavaScript is allowed for differential tests, but is not itself checked or modified. `tsx` executes code without type checking.

Vite builds the default `index.html` entry. Development dependency scanning uses that page and the browser fixtures explicitly; it does not crawl the vendored upstream example pages. The library still packages raw TypeScript with canonical subpath exports: no library bundling or declaration emit was added.

OMP's `.lsp.json` configures Oxlint/Oxfmt as linter servers alongside the automatically detected native TypeScript server. Zed selects the native TypeScript language server and Oxc extensions, with their configuration pointing to `vite.config.ts`. `.editorconfig` shares two-space indentation, LF and a 120-column formatting width.

## Import from defining modules

```ts
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";

const renderer = new WebGLRenderer({
  shaders: { MeshBasicMaterial: basicShader },
});
const scene = new Scene();
const camera = new PerspectiveCamera(50, 4 / 3, 0.1, 100);
camera.position.z = 3;
scene.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial({ color: 0xff8833 })));
renderer.setSize(640, 480);
document.body.append(renderer.domElement);
renderer.render(scene, camera);
```

The package contains raw `src/**/*.ts`. `exports` maps `ek3d/*` directly to `src/*.ts`; the package root is intentionally unavailable. There are no root entry points, barrels, declaration-only facades or runtime upstream bridges. A module may export multiple declarations, but every declaration is imported from its defining module. Internal paths are extensionless too. Use a TypeScript-capable bundler with `moduleResolution: "bundler"`; Vite 8 resolves the package exports without aliases. Plain Node ESM does not resolve these extensionless source imports unaided.

For TypeScript 7 with an ES2022 target, include `ES2025.Float16` alongside `ES2022`, `DOM` and `DOM.Iterable` in `lib` (or use ES2025/ESNext declarations). The native Float16 attribute path is runtime-feature-detected, but its name must be typed when checking raw source. Browser consumers need no ambient Node types. A minimal consumer configuration, matching the relevant settings of this repository's root `tsconfig.json`, is:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "ES2025.Float16", "DOM", "DOM.Iterable"]
  }
}
```

Omit `baseUrl` and `paths`; keep the package's `exports` as the only subpath mapping, and do not add a mapping for the bare package name.

`Mesh` requires both geometry and material. Missing built-in shader selections throw rather than implicitly importing a registry. Shader selections belong to each renderer, not a global registration table.

## Buffers, math and picking

The core now includes `InterleavedBuffer`, `InterleavedBufferAttribute`, `InstancedBufferAttribute`, `InstancedInterleavedBuffer`, `InstancedBufferGeometry`, `GLBufferAttribute` and `Raycaster`. Each comes from its corresponding `ek3d/core/<Name>` module. `Box2`, `Line3`, `Matrix2`, `Spherical` and `Cylindrical` similarly have defining paths under `ek3d/math/`.

Interleaved attributes share one typed-array buffer and select components using `itemSize` and `offset`; stride and update ranges count array elements, not bytes. Set `normalized: true` for integer-to-float conversion. After writing components, add ranges to the shared buffer and set the attribute's or buffer's `needsUpdate = true`. Recompute geometry bounds after changing positions. The example packs normalized signed-16-bit positions and normals together and updates only position ranges.

`geometry.clone()` preserves shared interleaved storage within the clone without sharing mutable arrays with the source. For manual cloning use one `InterleavedBufferCloneData` object across related attributes: `attribute.clone(data)` retains interleaving; `attribute.clone()` deliberately returns a de-interleaved `BufferAttribute`. `InterleavedBuffer.clone(data)` requires that metadata owner. Serialization similarly uses `InterleavedBufferSerializationData`; both types are defined in `ek3d/core/InterleavedBuffer`. Different typed-array views retain their own ranges; identical views share the cloned/serialized buffer.

Instanced attributes retain `meshPerAttribute` divisors; `InstancedBufferGeometry.instanceCount` controls drawing. Custom shaders supply their attribute semantics; CPU bounds and picking do not automatically reproduce custom vertex displacement. `InstancedMesh` provides the matrix/color/picking path described below. `GLBufferAttribute` wraps a real VBO, not CPU data: CPU bounds, raycasting and geometry clone/serialization are not provided for native-only positions. Preserve upstream ownership: disposing a rendered geometry deletes its attached VBO, unlike caller-owned `ExternalTexture` handles. The application must recreate native VBOs after context loss.

```ts
import { Raycaster } from "ek3d/core/Raycaster";
import type { Intersection } from "ek3d/core/Raycaster";
import { Vector2 } from "ek3d/math/Vector2";

const picker = new Raycaster();
const hits: Intersection[] = [];
const pointer = new Vector2();
const canvas = renderer.domElement;
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Pointer picking needs an HTML canvas");
canvas.addEventListener("pointerup", (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((event.clientY - rect.top) / rect.height) * 2);
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  picker.setFromCamera(pointer, camera);
  hits.length = 0;
  picker.intersectObject(scene, true, hits);
});
```

Hits are sorted nearest first and carry typed object/point/distance plus optional face/UV/normal fields. Clear a reused target array before each query. Near/far clipping, layers, recursive traversal and `raycast() === false` propagation retain upstream behavior. The renderer has no runtime dependency on `Raycaster`; XR-controller picking is deliberately absent.

## Instanced meshes

Import `InstancedMesh` from `ek3d/objects/InstancedMesh` and construct it with explicit `(geometry, material, count)` inputs. Instances share geometry and material (or material groups); the constructor allocates matrix capacity, while `mesh.count` selects the active prefix. Keep the count within that capacity; increasing capacity requires a new mesh. Basic/Lambert and depth/distance shadow descriptors remain explicit renderer inputs, with no instancing registry or implicit material.

`setMatrixAt(index, matrix)` and `setColorAt(index, color)` return the mesh; `getMatrixAt` and `getColorAt` fill and return caller-owned targets. Colors are allocated lazily and default to white. After changes set `instanceMatrix.needsUpdate` or `instanceColor.needsUpdate`; update ranges count scalar components (16 per matrix, three per color). `Matrix4` and `Color` array conversion accepts numeric typed arrays without copying into temporary number arrays.

Call `computeBoundingBox()` and `computeBoundingSphere()` after changing transforms or the active count when cached bounds must change. The initial sphere is computed on demand for culling/picking; subsequent matrix writes do not invalidate it automatically. Ray hits identify the original mesh and `instanceId`, retain world transforms, near/far and layers, and respect geometry groups/draw ranges. Picking is geometric, not shader/alpha-aware.

Clone/copy preserve the subtype and independent instance matrix/color buffers and bounds, but share geometry/material resources. `setMorphAt`/`getMorphAt` preserve upstream texture-row storage and require a Mesh with initialized numeric `morphTargetInfluences`; mark `morphTexture.needsUpdate` after changes. Morph texture clones share their data source, and instance picking ignores per-instance morph weights, as upstream does.

Call `mesh.dispose()` to release its instance GPU buffers/VAOs and owned morph texture; dispose shared geometry and materials separately when all users are finished. Renderer disposal and context loss detach instance listeners and release the manager's resources. Subsequent rendering reallocates buffers after object disposal or context restoration.

## Animation, morph targets and skinning

Import `AnimationClip`, `KeyframeTrack`, `AnimationMixer`, `AnimationAction`, `PropertyBinding`, `PropertyMixer` and `AnimationObjectGroup` directly from their defining `ek3d/animation/<Name>` modules. Number, vector, quaternion, color, boolean and string tracks live under `ek3d/animation/tracks/<Name>KeyframeTrack`. Interpolants have defining paths under `ek3d/math/interpolants/`; the base is `ek3d/math/Interpolant`. `AnimationUtils` exports local functions, not a namespace class or re-export registry.

Create a clip from property-path tracks, call `mixer.clipAction(clip).play()`, then `mixer.update(deltaSeconds)`. Action controls preserve loop/finish events, repetitions, pause, weighting, fading, crossfading and time warping. `mixer.setTime(seconds)` seeks; `action.reset().play()` restarts an action. Stop actions before `uncacheAction`, `uncacheClip` or `uncacheRoot`; uncaching releases bindings, not the scene's geometry, materials or textures. `AnimationObjectGroup` shares compatible property tracks across objects; it is not GPU instancing.

`Bone`, `Skeleton` and `SkinnedMesh` have defining imports under `ek3d/objects/`. Construct `SkinnedMesh(geometry, material)` explicitly, provide four-component `skinIndex`/`skinWeight` attributes, attach the bones and call `bind(skeleton)`. Update world matrices before CPU deformation queries; recompute skinned bounds as the pose changes. `getVertexPosition` includes morph and skin deformation; `applyBoneTransform` also accepts a `Vector4` direction with `w = 0`. Attached and detached bind modes retain upstream semantics.

Set geometry morph attributes before first rendering, then change `mesh.morphTargetInfluences` to animate them. Absolute targets and relative deltas retain upstream semantics. Replacing uploaded morph attribute data requires disposing/recreating its geometry resources; an attribute's `needsUpdate` alone does not rebuild the packed morph texture. Geometry bounds cover the upstream morph envelope; skinned bounds require explicit pose updates. Built-in shader descriptors and depth/distance shadow factories remain explicit renderer inputs.

Mesh clone/copy shares geometry, material and skeleton; it does not remap a cloned bone hierarchy into a new skeleton. Skeleton clone shares bones and inverse matrices while allocating its own matrix storage. Dispose the skeleton's bone texture with `skeleton.dispose()` only when all sharing meshes are finished; dispose geometry/materials separately. Previous-frame velocity bone buffers belong to the excluded backend and are not exposed. Core ObjectLoader reconstructs bone references and skeletons; addon skeleton utilities remain outside the package.

## Batched meshes and LOD

Import `BatchedMesh` from `ek3d/objects/BatchedMesh`. Its constructor takes `(maxInstanceCount, maxVertexCount, maxIndexCount, material)` with explicit material; pass `undefined` for the third argument to use the upstream `maxVertexCount * 2` index capacity. Use the existing explicit Basic/Lambert and depth/distance descriptors; no separate batching registry is needed.

`addGeometry` copies compatible CPU-readable geometries into owned packed buffers; indexed and non-indexed geometries cannot be mixed in one batch. Required attributes must agree on item size and normalization. Reserve vertex/index space when adding a geometry if `setGeometryAt` will later replace it with a larger one. `addInstance(geometryId)` returns an ID used by matrix/color/visibility methods and `Intersection.batchId`. Matrix and color setters mark their textures for upload automatically; `Color` supplies RGB, `Vector4` supplies RGBA.

`deleteInstance` frees an instance ID; `deleteGeometry` also removes instances using that geometry. IDs can be reused, so don't retain deleted IDs as stable application identities. `optimize()` compacts geometry storage without renumbering live IDs. `setInstanceCount` and `setGeometrySize` resize capacities, preserving retained data and rejecting reductions that would discard live ranges. Recompute aggregate bounds after geometry/instance changes. Per-object culling and opaque/transparent sorting remain configurable, including a caller-supplied sort function; WebGL uses native multi-draw when available and the existing draw-loop fallback otherwise.

Batch clone/copy own independent packed geometry and matrix/color/indirect texture data while sharing material. The implementation fixes upstream's shared-`TextureSource` clone aliasing, releases replaced owned resources during copy, and marks all resized textures for upload so capacity changes do not make live instances disappear. `dispose()` is terminal for a batch: it releases its geometry and internal textures, not source geometries or materials. Remove it from rendering and dispose it once; create a new batch for later use. Context restoration retains live batches through the renderer's resource recreation.

Import `LOD` from `ek3d/objects/LOD`. `addLevel(object, distance, hysteresis)` keeps distance-ordered levels; `removeLevel(distance)` detaches a level without disposing its resources. Renderer updates select one visible level using world-space camera distance divided by camera zoom, with hysteresis based on the previously visible level. Set `autoUpdate = false` for manual `update(camera)`. Clone/JSON preserve level objects, distances and hysteresis; dispose their geometries/materials according to application ownership.

LOD raycasting preserves upstream behavior: it chooses by ray-origin distance, not camera zoom, and delegates to that level's object. Use `raycaster.intersectObject(lod, false)` to avoid additionally traversing hidden children; traverse a selected level yourself if it is a group. Batched/LOD picking is geometric, not shader- or alpha-aware. ObjectLoader reconstruction requires the corresponding explicit object constructors.

## Lines, points and sprites

`Line`, `LineLoop`, `LineSegments`, `Points` and `Sprite` have defining imports under `ek3d/objects/<Name>`. Lines and Points require explicit `(geometry, material)` arguments; Sprite requires `(material)` and uses the upstream shared internal quad. No default material or global registration is imported. Clone/copy retain the runtime subtype; object clones share geometry and materials while owning their transform, center, morph influences and child state.

Materials likewise come from `ek3d/materials/<Name>`. Select their descriptors explicitly in `WebGLRenderer({ shaders: { ... } })`:

| Material             | Descriptor     | Defining shader module                |
| -------------------- | -------------- | ------------------------------------- |
| `LineBasicMaterial`  | `basicShader`  | `ek3d/renderers/shaders/BasicShader`  |
| `LineDashedMaterial` | `dashedShader` | `ek3d/renderers/shaders/DashedShader` |
| `PointsMaterial`     | `pointsShader` | `ek3d/renderers/shaders/PointsShader` |
| `SpriteMaterial`     | `spriteShader` | `ek3d/renderers/shaders/SpriteShader` |

Line draws a connected strip, LineLoop closes it and LineSegments draws independent pairs. For dashed lines, call `computeLineDistances()` on non-indexed geometry; indexed geometry retains upstream warning behavior. Recompute distances after position changes. `dashSize`, `gapSize` and `scale` control the pattern. WebGL line width is implementation-dependent, usually limited to one pixel; these are not addon wide lines.

Points supports pixel size, perspective `sizeAttenuation`, color/alpha maps and vertex updates. Sprite remains camera-facing; `center` sets its anchor and `material.rotation` rotates its quad. Both retain transparency, alpha-test and fog paths. Set attribute/texture `needsUpdate` after CPU changes and recompute geometry bounds when positions move.

`Raycaster.params.Line.threshold` and `.Points.threshold` control geometric picking tolerance. Sprite picking needs `raycaster.camera`, normally set by `setFromCamera()`. Hits retain near/far, layers, draw ranges, vertex/segment indices and Sprite UVs. Picking does not sample texture alpha or dashed gaps. Preserve upstream transform/threshold and Sprite bounding-sphere semantics rather than assuming pixel-perfect hit testing.

Dispose owned geometry, materials and textures separately; material disposal does not release shared textures. Sprite instances share one quad, so coordinate its disposal with all users. GPU buffers/textures are reallocated on later rendering and after context restoration.

## Ordinary geometries

Import each class from its defining `ek3d/geometries/<Name>` module:

- `BoxGeometry`, `PlaneGeometry`, `SphereGeometry`, `CircleGeometry`, `RingGeometry`.
- `CylinderGeometry`, `ConeGeometry`, `CapsuleGeometry`, `TorusGeometry`, `TorusKnotGeometry`, `LatheGeometry`.
- `PolyhedronGeometry`, `TetrahedronGeometry`, `OctahedronGeometry`, `IcosahedronGeometry`, `DodecahedronGeometry`.
- `EdgesGeometry`, `WireframeGeometry` for CPU edge extraction, rendered with `LineSegments`.

Constructor parameters, segment handling, partial sweeps, normals, UVs, caps and material groups retain the pinned upstream algorithms. This snapshot includes the fifth `CapsuleGeometry` argument (`heightSegments`) and sixth/seventh `TorusGeometry` arguments (`thetaStart`, `thetaLength`). Lathe profiles accept numeric `{ x, y }` points, including `Vector2`, `Vector3` and parsed JSON objects.

`parameters` records construction inputs; editing it does not rebuild vertex buffers. `clone()` and `copy()` preserve the concrete geometry type and independently copy buffers and computed bounds, but the parameter bag is shallow-copied: profile/vertex/index arrays and source geometries remain shared, matching upstream. Fields absent from subclasses are optional on the base parameter contracts (`CylinderGeometry.radiusTop/radiusBottom`, `PolyhedronGeometry.vertices/indices`); Cone and platonic-solid parameter bags expose only their own fields.

Untransformed parametric geometries support `toJSON()` and their defining class's `fromJSON(data)`. ObjectLoader takes explicit geometry factories; `BufferGeometryLoader` restores serialized buffer geometry without a parametric registry. Edges/Wireframe have no `fromJSON` factory and require a source geometry with CPU-readable positions for extraction; native-only VBO attributes are not supported there. Dispose each geometry when no longer needed.

The shared example renders sphere/cylinder/capsule meshes with reflection, texture, lighting, shadows and picking. CPU differential checks cover all ordinary families; this is not a claim of every geometry/material/GPU combination.

## Curves, paths and shapes

`ek3d/extras/core/<Name>` provides `Curve`, `CurvePath`, `Path`, `Shape` and `ShapePath`. `ek3d/extras/curves/<Name>` provides `ArcCurve`, `EllipseCurve`, `LineCurve`/`LineCurve3`, `QuadraticBezierCurve`/`QuadraticBezierCurve3`, `CubicBezierCurve`/`CubicBezierCurve3`, `SplineCurve` and `CatmullRomCurve3`. Interpolation functions live in `extras/core/Interpolations`; `ShapeUtils` and `Earcut` retain their defining modules under `extras/`.

`ek3d/extras/lib/earcut` is the typed port of [Mapbox Earcut 3.2.4](https://github.com/mapbox/earcut/tree/v3.2.4), with named exports `earcut`, `deviation`, `flatten` and `refine`; there is no default export. Flat coordinates and hole offsets accept array-like numeric inputs. `refine(triangles, coordinates, dimensions?)` improves interior diagonals in place and is optional; `Earcut.triangulate` does not invoke it.

`Curve<Vector2>` and `Curve<Vector3>` keep sampled points, tangents and targets dimension-specific. `CurvePath<Vector2>`/`CurvePath<Vector3>` also expose the upstream nullable point result for empty paths or out-of-range sampling. Change control points, then call `updateArcLengths()` on the changed curve and each containing path. Use nonempty 3D curves for Frenet frames, tubes and path extrusion; the port does not replace upstream behavior on invalid or degenerate inputs.

`TubeGeometry`, `ShapeGeometry` and `ExtrudeGeometry` use canonical `ek3d/geometries/<Name>` imports. They preserve normals, UVs, material groups, contour winding, hole coverage, closed-tube seams and bevel/path extrusion. Shape and extrusion triangulation uses Earcut 3.2.4, so triangle order and degenerate triangle counts can differ from the pinned Three.js snapshot. `ExtrudeGeometryOptions` is defined in `geometries/ExtrudeGeometry`, including numeric bevel/step/depth settings, a 3D `extrudePath` and typed top/wall `UVGenerator` callbacks. Path extrusion disables bevels, as upstream does.

`ShapePath.toShapes()` uses this snapshot's `userData.style.fillRule` (`nonzero` by default, or `evenodd`), including nested holes/islands and reversed winding. `Path` and `Shape` clones independently copy curves/control points/holes; geometry clones independently copy buffers but shallow-copy construction inputs. Dispose geometries independently of their materials.

There is no `extras/curves/Curves` aggregate or implicit curve registry. Named curves retain `fromJSON(json)`. Composite reconstruction takes a caller-owned `createCurve(json)` callback returning an already-deserialized curve:

- `CurvePath`/`Path`/`Shape`: `fromJSON(json, createCurve)`, forwarded through nested paths and holes.
- `TubeGeometry.fromJSON(data, createCurve3D)`.
- `ShapeGeometry.fromJSON(data, shapesByUUID)`.
- `ExtrudeGeometry.fromJSON(data, shapesByUUID, createCurve3D)`.

`CurveJSON` and `CurveFactory<T>` are defined in `extras/core/Curve`. Factories select only the supported types and throw for unknown ones; their errors propagate. Custom curves and nested curve paths can use the same explicit dispatch. For a shape made from lines and ellipses, the decoder can be:

```ts
import type { CurveFactory } from "ek3d/extras/core/Curve";
import type { Vector2 } from "ek3d/math/Vector2";
import { LineCurve } from "ek3d/extras/curves/LineCurve";
import { EllipseCurve } from "ek3d/extras/curves/EllipseCurve";

const createCurve: CurveFactory<Vector2> = (json) => {
  switch (json.type) {
    case "LineCurve":
      return new LineCurve().fromJSON(json);
    case "EllipseCurve":
      return new EllipseCurve().fromJSON(json);
    default:
      throw new Error(`Unsupported curve: ${json.type}`);
  }
};
```

Pass this callback to `new Shape().fromJSON(shapeJSON, createCurve)`, then supply the restored shapes keyed by UUID to geometry factories. Preserve upstream serialization limits: transformed geometry buffers are not reconstructed by parametric factories, custom UV callback functions do not survive JSON encoding, and `ExtrudeGeometry.fromJSON` replaces a serialized `data.options.extrudePath` with the decoded curve. Clone parsed data first if it must remain reusable. ObjectLoader accepts the same callback as `factories.createCurve`; bind additional curve arguments in the selected geometry's `fromJSON` closure.

## Fog, time and uniforms

`ek3d/scenes/Fog` and `ek3d/scenes/FogExp2` implement linear and exponential-squared fog. Assign either to `scene.fog`, or `null` to disable it. Colors accept `Color`, numeric hex or CSS color strings; `near`/`far` and `density` stay numeric. Basic and Lambert shaders already include the required fog paths. Set `material.fog = false` and `material.needsUpdate = true` to opt out. Clones own independent colors, while fog names follow upstream clone behavior (not copied); scene JSON retains the original name and parameters.

`ek3d/core/Timer` provides `update(timestamp?)`, stable-per-step `getDelta()`/`getElapsed()` in seconds, `setTimescale()` and `reset()`. Connect once to a document for Page Visibility handling; call `disconnect()` before connecting another document and `dispose()` when done. The example updates its Timer every animation frame, including paused frames, and caps simulation steps at 50 ms. `ek3d/core/Clock` retains the deprecated upstream auto-start/stop/restart API and warning; use Timer for new code.

`ek3d/core/Uniform` preserves the value type as `Uniform<T>`. Its clone calls the value's `clone()` when present; plain arrays and typed arrays remain shared, and nullish values cannot be cloned by this upstream implementation. `ek3d/core/UniformsGroup` supports `add`/`remove` of individual uniforms or uniform arrays, names, usage, copy/clone and disposal. Set `uniform.type` to `int` or `uint` for integer scalar storage; the default is float. This extra storage hint is not copied by upstream `Uniform.clone()` and must be assigned to integer clones explicitly.

Use `ShaderMaterial.uniformsGroups` or `RawShaderMaterial.uniformsGroups` with matching GLSL 3 `layout(std140)` block names and member order. Values update on subsequent renders; after changing a group's layout, dispose its old GPU allocation before rendering it again. Texture samplers cannot be UBO members. Group disposal releases its buffers, not its values; material disposal does not dispose shared groups. Renderer disposal/context loss now detaches group listeners before releasing or rebuilding GPU storage.

Browser regressions cover ordinary uniforms together with shared UBOs across ShaderMaterial/RawShaderMaterial programs, scalar/vec3/mat3 alignment, both array representations, int/uint storage, value updates, GPU deletion/reallocation and context restoration. General custom-shader compile/link diagnostics and structured/array uniforms are covered under [Layered targets, helpers and custom shaders](#layered-targets-helpers-and-custom-shaders).

## Local data textures

```ts
import { DataTexture } from "ek3d/textures/DataTexture";
import { RGBAFormat, UnsignedByteType, SRGBColorSpace } from "ek3d/constants";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";

const pixels = new Uint8Array([255, 64, 32, 255, 32, 192, 64, 255, 64, 96, 255, 255, 224, 176, 32, 255]);
const map = new DataTexture(pixels, 2, 2, RGBAFormat, UnsignedByteType);
map.colorSpace = SRGBColorSpace;
map.needsUpdate = true;
const material = new MeshBasicMaterial({ map });
```

Use the same explicit `basicShader` selection as above. `DataTexture` reuses the existing `Texture` and `TextureSource`; it adds no loader, network request or shader family. Its constructor checks typed-array data and numeric dimensions/formats; its inherited image accessor has a typed `{ data, width, height }` contract without emitting a shadowing field. These are TypeScript checks, not new runtime validation.

The image contract is exported from the same module as canonical `type` imports: `import type { DataTextureImage, DataTextureImageData } from "ek3d/textures/DataTexture"`. `DataTextureImageData` is the union of supported typed arrays including `null`; `DataTextureImage` is `{ data, width, height }`. `ek3d/loaders/DataTextureLoader` uses both in its `DataTextureData` parsed contract, so loaders and texture code share one type source instead of redeclaring the union.

After changing pixel data, set `map.needsUpdate = true` before rendering. UV changes use `offset`, `repeat`, `center` and `rotation`; the renderer updates the matrix automatically unless `matrixAutoUpdate` is disabled. `clone()` preserves the concrete texture type and shares the upstream data source, while UV vectors remain independent. Call `map.dispose()` when no longer needed; materials do not dispose their textures. Dimensions, format and type must not change after first use: dispose and create a new texture instead.

The GPU-verified path is 2D RGBA/UnsignedByte data, sRGB and nearest filtering. Other pixel formats/types, filtering modes and mipmaps retain upstream code but have not been GPU-verified in this slice.

## Canvas, video, framebuffer and compressed textures

Import `CanvasTexture`, `VideoTexture`, `VideoFrameTexture`, `FramebufferTexture`, `CompressedTexture`, `CompressedArrayTexture` and `CompressedCubeTexture` directly from `ek3d/textures/<Name>`.

`CanvasTexture(canvas)` requests its initial upload; subsequent drawing needs `texture.needsUpdate = true`. `VideoTexture(video)` schedules uploads through video-frame callbacks where available and retains the upstream ready-state fallback. `VideoFrameTexture()` accepts caller-created frames through `setFrame(frame)`. These APIs require the actual browser capabilities: WebCodecs, media capture and video-frame callbacks were exercised in the standard development browser, not promised for every browser/device.

Use `renderer.copyFramebufferToTexture(texture)` with a `FramebufferTexture(width, height)` to capture rendered pixels. Compressed textures take caller-supplied mip levels; compressed array updates can select layers with `addLayerUpdate(layer)`. Compressed cube inputs contain six faces with dimensions and mip levels. Compression formats require the corresponding GPU extension; there is no built-in decoder or transcoder. S3TC/DXT1 2D, array-layer and cube uploads were exercised, not every compressed format.

Tag color data explicitly with `SRGBColorSpace`; data maps remain untagged. Canvas sRGB decoding, nearest/linear filtering, repeated UVs, generated mipmaps and explicit compressed mip levels have browser checks. Video/frame textures retain their upstream no-generated-mipmap defaults.

`dispose()` releases GPU resources, not the canvas, video stream, compressed byte arrays or `VideoFrame`. The application stops media tracks and closes frames/bitmaps only after their consumers finish. Video disposal cancels its frame callback; create a new VideoTexture to resume automatic updates. Preserve upstream sharing rules when cloning. In particular, upstream `CompressedCubeTexture.clone()` throws because its constructor requires faces; copy into an explicitly constructed cube instead.

## Core loaders and explicit resource ownership

`Loader`, `LoadingManager`, `Cache`, `LoaderUtils`, `FileLoader`, `ImageLoader`, `ImageBitmapLoader`, `TextureLoader`, `CubeTextureLoader`, `DataTextureLoader`, `CompressedTextureLoader`, `BufferGeometryLoader`, `MaterialLoader`, `ObjectLoader` and `AnimationLoader` have defining imports under `ek3d/loaders/<Name>`.

Each default loader owns a new `LoadingManager`; pass the same manager explicitly to share progress, cache and in-flight requests. There is no `DefaultLoadingManager` singleton or global mutable Cache. `manager.cache.enabled` defaults to `false`; enable it deliberately, then remove entries or call `manager.cache.clear()` when finished. Clearing a cache does not dispose textures or close shared ImageBitmaps. A manager's `abort()` aborts participating file/bitmap fetches and resets its controller for reuse; image elements retain the upstream browser loading contract.

Paths, URL modifiers, request headers, credentials, response types, streaming progress, handlers and manager completion retain upstream semantics. `FileLoader.loadAsync()` returns `unknown`: JSON still needs application validation before use. `DataTextureLoader` and `CompressedTextureLoader` are format-independent bases; supply a concrete `parse()` implementation. They do not decode DDS/KTX/GLTF by themselves.

`BufferGeometryLoader` restores serialized attributes, shared interleaved buffers, instanced divisors/counts, morphs, groups and UUIDs. `AnimationLoader` restores clip/track JSON. Material and object construction is selected per loader, not registered globally:

```ts
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { ObjectLoader } from "ek3d/loaders/ObjectLoader";
import { Scene } from "ek3d/scenes/Scene";
import { Mesh } from "ek3d/objects/Mesh";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";

const manager = new LoadingManager();
const loader = new ObjectLoader(manager, {
  objects: { Scene, Mesh },
  materials: { MeshBasicMaterial },
  geometries: { BoxGeometry },
});
const scene = await loader.loadAsync("scene.json");
```

Include every serialized object type, including shadow cameras and bones, in `objects`. Parametric geometry entries implement `fromJSON(data, shapes)`; use closures for Tube/Extrude's additional curve arguments and `createCurve` for shape paths. `new MaterialLoader(manager, { MeshBasicMaterial })` similarly accepts only chosen constructors. Unknown or unselected types throw; `registerMaterial`/`registerGeometry` are absent.

ObjectLoader preserves shared geometry/material/texture references, source UUIDs, skeleton bone references and animation bindings. `parse(json, onLoad?, onError?)` returns the object immediately while external images finish; use the callback or `parseAsync()` before consuming loaded images. Image decode errors reach the error callback rather than reporting success. Dispose loaded geometry, materials, textures and skeletons according to their sharing; the loader does not become their lifetime owner. Core serialization retains upstream format limits and is not a GLTF/addon loader.

## Lambert lighting

Select the second shader family explicitly, using the same renderer/scene setup:

```ts
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";

const renderer = new WebGLRenderer({
  shaders: { MeshLambertMaterial: lambertShader },
});
const material = new MeshLambertMaterial({ color: 0xffaa66, emissive: 0x110000 });
const light = new HemisphereLight(0x88bbff, 0x552211, 2);
light.position.set(0.5, 1, 1);
scene.add(light, new Mesh(new BoxGeometry(), material));
renderer.render(scene, camera);
```

Supply both `MeshBasicMaterial: basicShader` and `MeshLambertMaterial: lambertShader` when a renderer uses both families. No registration or global shader table is involved. Diffuse/emissive colors, emissive intensity and light colors/intensity update on the next render; normal attributes require `needsUpdate` after editing their data. Clones retain their concrete material/light type and independently copy mutable colors, normal scale and transforms.

The hemisphere path verifies Lambert diffuse/emissive, sky/ground irradiance and inverse-transpose normals under nonuniform scale. `HemisphereLight` cannot cast shadows; directional/point/spot lighting and shadows are covered below. Normal/bump/displacement maps and Lambert texture/environment maps are not GPU-verified here. Lambert `scene.environment` lighting requires a DFG provider; that lighting path is not part of the environment-conversion slice below.

## Ambient and spot lights

Import `AmbientLight`, `SpotLight` and `SpotLightShadow` from their defining `ek3d/lights/<Name>` modules. They use the existing explicit Lambert descriptor; no shader registry or extra factory is needed for illumination. `AmbientLight(color?, intensity?)` contributes uniform additive irradiance, does not cast shadows and does not change unlit Basic materials.

`SpotLight(color?, intensity?, distance?, angle?, penumbra?, decay?)` retains upstream cone and distance attenuation. Angles are radians; `penumbra` selects the softened fraction of the cone. `distance = 0` removes the range cutoff, while `decay` still applies. `power` is an accessor linked to `intensity` by `power = Math.PI * intensity`. Add `light.target` to the scene when moving it; illumination follows the light and target's world positions. The upstream initial light position is `(0, 1, 0)`, not the origin.

Assign a texture to `spot.map` for a projected cookie, or `null` to remove it. The pinned WebGL shader multiplies the light by texture **RGB and ignores alpha**; black RGB masks the light. Cookie projection also works with `castShadow = false` and allocates no shadow target. The port corrects the conflicting upstream JSDoc without changing this shader behavior. Update texture data with `needsUpdate`; replacing/removing a cookie does not dispose it.

`spot.shadow.camera` is a `PerspectiveCamera`. `shadow.focus` scales twice the cone angle into its FOV; `shadow.aspect` multiplies the map width/height ratio. Nonzero `spot.distance` sets camera far; zero retains its current far value. Light/target transforms and these projection inputs update through `shadow.updateMatrices(spot)` or rendering. Shadow rendering requires the explicit factory/depth descriptor described below.

Clone/copy own independent colors, targets and shadow cameras/settings but share the cookie texture; cloned shadows do not share GPU targets. `spot.dispose()` releases shadow targets, not the caller-owned cookie or target object. ObjectLoader requires explicit light and shadow-camera constructors to restore those types.

## Materials, probes and physical lighting

Import each material from `ek3d/materials/<Name>`, and select its defining descriptor explicitly:

| Material               | Descriptor       | Defining shader module                  |
| ---------------------- | ---------------- | --------------------------------------- |
| `MeshPhongMaterial`    | `phongShader`    | `ek3d/renderers/shaders/PhongShader`    |
| `MeshNormalMaterial`   | `normalShader`   | `ek3d/renderers/shaders/NormalShader`   |
| `MeshMatcapMaterial`   | `matcapShader`   | `ek3d/renderers/shaders/MatcapShader`   |
| `MeshToonMaterial`     | `toonShader`     | `ek3d/renderers/shaders/ToonShader`     |
| `ShadowMaterial`       | `shadowShader`   | `ek3d/renderers/shaders/ShadowShader`   |
| `MeshStandardMaterial` | `standardShader` | `ek3d/renderers/shaders/StandardShader` |
| `MeshPhysicalMaterial` | `physicalShader` | `ek3d/renderers/shaders/PhysicalShader` |

Phong provides specular highlights and `shininess`; Normal visualizes view-space normals without lighting. Matcap samples a view-aligned material capture texture. Toon uses `gradientMap` for quantized diffuse lighting; use nearest filtering for discrete steps. ShadowMaterial is transparent outside received shadows and scales shadow alpha by `opacity`; it still needs the explicit shadow factory and depth/distance descriptors.

Standard and Physical use the actual upstream metallic-roughness BRDF. Supply DFG even for direct lighting without an environment: it also compensates multi-scattering energy. `scene.environment` supplies IBL, while a material's `envMap` overrides it; conversion requires `createEnvironments`. DFG/LTC factories allocate independent caller-owned textures and data, without global registration or a singleton:

```ts
import { MeshPhysicalMaterial } from "ek3d/materials/MeshPhysicalMaterial";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { RectAreaLight } from "ek3d/lights/RectAreaLight";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";

const dfg = createDFGLUT();
const ltcTextures = createLTCTextures();
const renderer = new WebGLRenderer({
  shaders: { MeshPhysicalMaterial: physicalShader },
  getDFGLUT: () => dfg,
  ltcTextures,
  createEnvironments: WebGLEnvironments,
});
const material = new MeshPhysicalMaterial({
  color: "#d8e8ff",
  roughness: 0.25,
  metalness: 0.1,
  clearcoat: 1,
  clearcoatRoughness: 0.1,
});
const area = new RectAreaLight(0xffffff, 5, 3, 2);
area.position.set(0, 3, 4);
area.lookAt(0, 0, 0);
const geometry = new SphereGeometry();
scene.add(area, new Mesh(geometry, material));
renderer.render(scene, camera);
// At application teardown, after these resources are no longer rendered:
material.dispose();
geometry.dispose();
area.dispose();
dfg.dispose();
for (const texture of Object.values(ltcTextures)) texture.dispose();
renderer.dispose();
```

`RectAreaLight` illuminates Standard/Physical only and does not cast shadows. Width/height and orientation define its emitting rectangle; `power = intensity * width * height * Math.PI`. The renderer selects float LTC textures when float-linear filtering is available, otherwise half-float LTC textures. Both real paths are covered by the browser fixture.

`LightProbe` comes from `ek3d/lights/LightProbe`; pass `SphericalHarmonics3` from `ek3d/math/SphericalHarmonics3`, or fill its nine `Vector3` coefficients. The probe supplies diffuse irradiance, scaled by intensity, not positional illumination or shadows. SH provides radiance/irradiance evaluation, basis, blending and array serialization. Probe construction retains the supplied SH object; cloning owns independent coefficients.

PBR pixel checks cover roughness/metalness, color/alpha/AO/light/emissive maps, normal/bump/displacement maps, environment intensity, and all Physical feature families: clearcoat and its normals/roughness, sheen, iridescence/IOR/thickness, anisotropy/direction, diffuse roughness, retroreflection, specular intensity/color, transmission/thickness/attenuation/IOR/dispersion and their maps. These are selected deterministic scenarios, not every combination with skinning, instancing, shadows or custom shaders; further combinations require separate verification.

New material parameter types select actual constructor/accessor fields, accept color inputs and nullable textures, and reject unrelated material features. `WebGLShaderDescriptor` is defined in `ek3d/renderers/WebGLRenderer`; `getDFGLUT` must synchronously return a texture and `ltcTextures` uses the four-texture `LTCTextures` contract from its defining factory module. Physical feature setters retain upstream program-version transitions. Set `material.needsUpdate = true` after adding/removing maps or changing shader-affecting flags. Material clones own colors/vectors but share textures; material disposal releases programs, not application-owned maps/LUTs.

## Textured backgrounds

Add the factory to the renderer options; keep choosing foreground material shaders explicitly. Using the scene, camera and sRGB `map` from the examples above:

```ts
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";

const renderer = new WebGLRenderer({
  createBackground: WebGLBackground,
  shaders: { MeshBasicMaterial: basicShader },
});
scene.background = map;
scene.backgroundIntensity = 0.5;
renderer.render(scene, camera);
```

`WebGLBackground` includes the full upstream 2D/cube implementation, `PlaneGeometry`, `ShaderMaterial` and direct background shader descriptors. The renderer imports none of them at runtime unless the consumer selects the factory. Its six arguments and `WebGLBackgroundSystem` result have concrete contracts; missing lifecycle methods and invalid arguments are rejected by consumer type checks.

2D backgrounds use the texture's UV matrix, including `matrixAutoUpdate`; intensity does not affect foreground materials. Native `CubeTexture` backgrounds need no converter and use `scene.backgroundRotation`. Equirectangular conversion and blurred cube backgrounds require the explicitly supplied `WebGLEnvironments` factory below. Blurriness on a UV-mapped 2D texture has no effect, matching upstream. No loader, network asset or global shader registration is needed.

Set `scene.background = null` before releasing its texture, then call `texture.dispose()`; renderer disposal releases background-owned geometry/materials and GPU caches. Context loss clears the old background, texture and geometry caches before rebuilding them, without discarding CPU image/geometry data. This fixes a reproduced upstream 0.186.0 issue where stale disposal listeners caused `GL_INVALID_OPERATION` after context restoration.

Verified background paths include local RGBA/UnsignedByte sRGB 2D textures with nearest filtering, native cube backgrounds made from six solid data-texture faces, and the converted/PMREM backgrounds below. Tests cover UV updates, intensity, color/null transitions, foreground isolation, cube rotation, resource deletion/reallocation, nested render/compile failures and actual context loss/restoration.

## Environment conversion and PMREM

Select the environment implementation separately from textured backgrounds and material shaders:

```ts
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { DataTexture } from "ek3d/textures/DataTexture";
import { EquirectangularReflectionMapping, SRGBColorSpace } from "ek3d/constants";

const renderer = new WebGLRenderer({
  createEnvironments: WebGLEnvironments,
  createBackground: WebGLBackground,
  shaders: { MeshBasicMaterial: basicShader },
});
const environment = new DataTexture(new Uint8Array([255, 64, 32, 255, 32, 80, 240, 255]), 2, 1);
environment.mapping = EquirectangularReflectionMapping;
environment.colorSpace = SRGBColorSpace;
environment.needsUpdate = true;
material.envMap = environment; // MeshBasicMaterial from the scene setup
scene.background = environment;
scene.backgroundBlurriness = 0.65;
renderer.render(scene, camera);
```

The full dependency closure adds `WebGLEnvironments`, `WebGLCubeRenderTarget`, `CubeCamera` and `PMREMGenerator`. The factory takes a concrete `WebGLRenderer` and returns `get(texture, usePMREM?)` plus `dispose()`. `get` accepts `Texture | null | undefined` and returns `Texture | null`; incomplete source images return `null` until ready. Native textures and prepared PMREMs pass through where conversion is unnecessary. Reflection/refraction mappings share the cube cache.

The basic material uses an unfiltered converted cube; background blur selects a separate GGX-prefiltered PMREM. No DFG is needed for either path. Physical lighting, including Lambert `scene.environment` with PMREM, still requires an explicitly supplied DFG provider and is not claimed as supported here.

Source texture disposal invalidates both caches and deletes their GPU render targets. After editing an ordinary source image, call `environment.dispose()`, then set `needsUpdate = true` to reconvert; `needsUpdate` alone does not invalidate upstream's environment cache. Render-target sources use `texture.needsPMREMUpdate = true` to refresh their cached PMREM in place. Detach sources from materials/backgrounds before final disposal. The provider owns its converted textures and keeps a reusable PMREM working target until provider/renderer disposal.

Direct imports of `PMREMGenerator` expose `fromEquirectangular`, `fromCubemap`, `fromScene`, shader precompilation and disposal. Returned render targets belong to the caller: dispose them separately from the generator. `fromScene` retains upstream Gaussian blur and capture options. `CubeCamera` needs no XR subsystem; `WebGLCubeRenderTarget` has a typed cube-texture accessor and render-target options without new runtime fields.

The port restores render-target/face/mip, target viewport, mipmap, filter and scene clear/background state when upload or capture callbacks throw, releasing newly owned temporary outputs. Provider disposal tracks source lifetimes weakly and also covers render-target PMREM updates. Context loss disposes environments before replacing caches; renderer disposal releases PMREM materials before clearing their program properties. These lifecycle fixes address reproduced upstream failures without changing filtering or rendering algorithms.

GPU verification covers local 128×64 RGBA/UnsignedByte sRGB equirectangular inputs, reflection/refraction, cube render-target updates, HalfFloat/linear-sRGB PMREM mipmaps and constant-color `fromScene` Gaussian blur. HDR photographic/compressed inputs and DFG-backed lighting are not verified.

## Shadow maps

Select the shadow factory independently of material shaders:

```ts
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { distanceShader } from "ek3d/renderers/shaders/DistanceShader";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";

const renderer = new WebGLRenderer({
  createShadowMap: WebGLShadowMap,
  shaders: {
    MeshLambertMaterial: lambertShader,
    MeshDepthMaterial: depthShader,
    MeshDistanceMaterial: distanceShader,
  },
});
renderer.shadowMap!.enabled = true;
const light = new DirectionalLight("white", Math.PI);
light.position.set(3, 5, 4);
light.castShadow = true;
light.shadow.mapSize.set(512, 512);
scene.add(light, light.target);
```

Set `castShadow = true` on the caster and `receiveShadow = true` on the Lambert receiver, then render with the earlier scene/camera setup. `DirectionalLight` and `SpotLight` use the depth shader; `PointLight` uses the distance shader and six cube faces. Select only the built-in shaders the scene needs. `customDepthMaterial`/`customDistanceMaterial` remain available; a custom `ShaderMaterial` supplies its own GLSL instead of requiring a built-in descriptor.

`createShadowMap` has concrete renderer, object-update and maximum-texture-size arguments and returns `WebGLShadowMapSystem`. Without the factory, `renderer.shadowMap` is `null`; shadow-casting lights are rejected in both `render` and `compile`. With the factory, shadows default to disabled, matching upstream. Ordinary `compile` prepares visible materials; shadow materials are compiled when the shadow pass actually draws them. Missing built-in descriptors throw on use, without importing defaults.

`BasicShadowMap` and `PCFShadowMap` support directional, point and spot lights; VSM retains its upstream directional/spot blur passes and does not support point lights. `PCFSoftShadowMap` retains upstream's warning and PCF fallback. `shadow.intensity`, bias, normal bias, radius, map size, camera and update flags retain their upstream meaning. With `renderer.shadowMap.autoUpdate = false`, set its `needsUpdate = true` for a new pass; if the light's own `shadow.autoUpdate` is also false, set that shadow's `needsUpdate` too.

Light-owned shadow targets are released by `light.dispose()` or `light.shadow.dispose()`. Remove the light from the scene before final disposal; materials and geometries remain caller-owned. The shadow system releases its internal depth/distance/VSM materials, fullscreen geometry, cached material variants and listeners on renderer disposal. The renderer releases all remaining GPU programs even when a caller's material outlives it. Failed callbacks restore render-target/face/mip and clipping phase. Context loss clears old GPU caches and marks frozen shadows dirty for one refill while preserving both `autoUpdate` flags and clear color/alpha. Per-shadow map-type tracking prevents incompatible samplers when a light returns after being absent during a mode change. These changes fix reproduced upstream lifecycle failures without changing shadow rendering algorithms.

GPU verification covers directional/spot Basic/PCF/VSM and point Basic/PCF cube shadows, custom depth/distance materials, `alphaToCoverage`-selected cache variants, one-shot updates, disposal/reallocation, nested failures and frozen context restoration. The integrated scene also checks received spot shadows from instanced and batched casters. Shadow alpha/displacement maps, skinning, reversed-depth GPU shadows, MSAA and the PCFSoft compatibility fallback are not GPU-verified.

## HDR output

Select output independently of the material shaders, using the earlier material, scene and camera:

```ts
import { WebGLOutput } from "ek3d/renderers/webgl/WebGLOutput";
import { HalfFloatType, ACESFilmicToneMapping } from "ek3d/constants";

const renderer = new WebGLRenderer({
  createOutput: WebGLOutput,
  outputBufferType: HalfFloatType,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
material.color.setRGB(4, 1, 0.25);
renderer.render(scene, camera);
```

`WebGLOutput` preserves the upstream scene target, fullscreen triangle, tone-mapping/color-space shader and lazy effect buffers. Its dependency closure adds only `WebGLOutput` and `RawShaderMaterial` to the packaged implementation graph; other dependencies were already ported. Embedded GLSL imports its defining chunks directly. The renderer has only type imports of the factory, whose six arguments and `WebGLOutputSystem` result are concrete.

Use `HalfFloatType` or `FloatType` for HDR. Without `createOutput`, requesting HDR throws before context creation or listener registration. Merely supplying the factory with the default `UnsignedByteType` does not activate it. With no effects and `NoToneMapping`, rendering bypasses the HDR pass and ignores exposure, matching upstream. Tone mapping occurs after the HDR scene render; `renderer.outputColorSpace` selects the final transfer. Ordinary offscreen render targets bypass output.

No postprocessing addon or effect is imported or installed automatically. `renderer.setEffects(effects)` accepts explicit `WebGLOutputEffect[]`; `null` or `[]` removes them. Calling it without an HDR output buffer throws. The structural effect contract includes `render(renderer, writeBuffer, readBuffer, deltaTime?)`, optional `enabled`/`needsSwap`, `isRenderPass`/`isOutputPass`, `setSize`, `needsDepthTexture` and `setDepthTexture`. Effects ping-pong between single-sampled HalfFloat buffers; a leading RenderPass supplies the scene itself. Effect objects and their own resources remain caller-owned. This ports the protocol, not the addons implementing it.

`setSize`, `setPixelRatio` and `setDrawingBufferSize` resize the output buffers and notify effects in physical pixels. Failed scene/effect callbacks and nested render/compile calls restore tone mapping and target/face/mip; `WebGLOutputSystem.restore(renderer)` aborts a manually begun transaction. Output-owned resources are released before renderer caches on disposal and context loss. Context restoration reuses the CPU output/effect configuration and allocates fresh GPU resources. These changes fix reproduced upstream output-program disposal, failed-transaction and physical-resize bugs without changing tone-mapping algorithms.

GPU verification covers HalfFloat production output, Float HDR readback, None/Linear/Reinhard/ACES/AgX/Neutral, exposure, linear/sRGB output, explicit local copy/RenderPass/depth effects, resizing, failure recovery, disposal/reallocation and actual context restoration. MSAA, stencil-depth effects, Cineon/custom tone mapping, addon effects and HDR display presentation are not GPU-verified. This is HDR intermediate rendering to an ordinary canvas, not a claim of HDR monitor support.

## WebGL-only API

`renderer.setAnimationLoop(callback)` uses window `requestAnimationFrame`; its callback receives a timestamp, not an XR frame. Pass `null` to stop it. Renderer disposal cancels the loop. Context restoration preserves ordinary rendering without creating another backend.

`WebGPUCoordinateSystem` and WebGPU-only geometry, object, material and light members are not exported. WebGL projection/frustum and shadow matrices retain normal and reversed-depth behavior. External render-target textures remain caller-owned: disposing their target releases its framebuffer, not the supplied GPU textures.

## Maintaining the source

`src/` is directly maintained TypeScript. The repeat-conversion scripts, regeneration commands and generated-file ownership lock have been removed; do not recreate or use an upstream-to-source overwrite workflow.

For an upstream update, compare against the immutable commit recorded above, identify the affected module/caller graph, and adapt the relevant changes directly in `src/`. Keep `upstream/three.js/` read-only for provenance and differential behavior tests. Preserve numerical algorithms, rendering behavior, resource ownership, error handling and canonical import paths. Retain type, behavioral, dependency-boundary, installed-package and browser checks.

All imports come before declarations; declarations export inline. Every class field, including static fields, has an explicit TypeScript type. Do not use `declare` fields, class/interface declaration merging or fake/no-op implementations to satisfy types. Preserve constructor initialization order, inherited state and prototype methods/accessors; do not blindly replace erased declarations with emitted fields or definite-assignment assertions. Express meaningful JSDoc types in TypeScript before removing redundant annotations, retaining descriptions. Useful JSDoc examples must be valid TypeScript using supported APIs and canonical `ek3d/*` imports, with `typescript` fences.

The source-style cutover makes `Loader`, `DataTextureLoader` and `CompressedTextureLoader` abstract: instantiate a concrete loader, implementing the required loading/parsing contract rather than relying on an empty base method. Subtype-specific material traits are described separately by `MaterialProperties`; texture and render-target accessors retain their concrete image/attachment types without declaration merging.

Reflection is not byte-for-byte identical to the upstream JavaScript: ordinary optional fields can now exist as own `undefined` properties, and readonly math flags/shared prototype defaults use accessors. Do not use upstream `Object.keys()` or property-descriptor snapshots as the serialization contract; use the documented serialization methods. Immutable IDs, transform descriptors, inherited initialization and physical-material setters have behavioral regression coverage.

Shared constants remain in `constants.ts`; related declarations are not split arbitrarily. Uniform groups are local named declarations, not an aggregate namespace. Material descriptors come from selected upstream definitions, including Physical's separately assigned descriptor, preserving inline uniforms. Basic/Lambert's shared GLSL chunks keep direct defining-module imports; unique includes are expanded in the maintained shader sources. Physical reuses Standard's identical shader strings while owning its extended uniforms; VSM imports its defining GLSL module directly. Shader strings are composed once at module initialization, not per frame. DFG data comes from the pinned core source; only LTC texture data/initialization was ported from `upstream/three.js/examples/jsm/lights/RectAreaLightTexturesLib.js`, not the addon registry or its runtime imports. The renderer imports no descriptor, LUT data or material shader registry. Runtime cycles are checked independently of type-only cycles.

## Layered targets, helpers and custom shaders

Import `WebGLArrayRenderTarget` and `WebGL3DRenderTarget` from their defining `ek3d/renderers/<Name>` paths. Both accept `(width, height, depth, options)` and expose their concrete DataArrayTexture/Data3DTexture through the inherited texture accessor. `setRenderTarget(target, layer)` selects an array layer or volume slice. The existing optional face argument of synchronous/async `readRenderTargetPixels` also selects a layer; invalid layer indices throw before changing framebuffer state. Readback restores the active target, cube face and mip level.

`setSize(width, height, depth)` invalidates changed GPU storage while retaining the CPU attachment; omitted depth resets to one, as upstream. Clone/copy create independent color attachment storage and preserve depth-owner semantics. The layered WebGL targets use a **shared 2D depth attachment**, not independent depth per layer: clear depth when beginning an independent slice. Layered MSAA/multiview and per-layer depth textures are not promised. `ek3d/core/RenderTarget3D` is the backend-neutral volume/MRT container; use the WebGL-specific class with WebGLRenderer.

All 13 core helpers are available from `ek3d/helpers/<Name>`: Arrow, Axes, Box3, Box, Camera, DirectionalLight, Grid, HemisphereLight, Plane, PointLight, PolarGrid, Skeleton and SpotLight helpers. Their materials are explicitly constructed; configure `LineBasicMaterial: basicShader` and `MeshBasicMaterial: basicShader` on the renderer. No registration occurs. Helpers own their display resources, not the inspected objects/lights/skeletons. Preserve upstream limitations: some helpers require constructor inputs and cannot be cloned through zero-argument construction; ArrowHelper shares module-local geometry.

ShaderMaterial and RawShaderMaterial support GLSL 1/3, structured uniforms, scalar/vector/matrix arrays and 2D/cube/3D/array samplers. Per-uniform `needsUpdate: false` disables that uniform's upload; material `uniformsNeedUpdate` forces the material update path without recompiling. Explicit `shaderChunks` resolve nested includes; a missing include throws before allocating a GPU program. `renderer.debug.onShaderError(gl, program, vertexShader, fragmentShader)` exposes compile/link status and driver logs. After changing shader source, set `material.needsUpdate = true` to replace a failed program. Diagnostics do not make invalid GLSL render successfully.

## Boundaries of this iteration

The completed iteration delivers practical WebGL coverage, not a drop-in port of the entire upstream library. It contains ordinary and curve/shape geometries, interleaved/instanced buffers, mesh/line/point/sprite rendering and picking, InstancedMesh/BatchedMesh/LOD, skeletal/morph animation, fog, time/uniform contracts, data/canvas/video/compressed textures, core loaders, unlit/Lambert/Phong/Normal/Matcap/Toon/Shadow/Standard/Physical materials, hemisphere/ambient/directional/point/spot/probe/area lighting, SH math, real DFG/LTC inputs, textured backgrounds, environment conversion/PMREM, directional/point/spot shadows, HDR/output, layered/3D render targets, core helpers and custom shader diagnostics. WebXR, WebGPU and `StereoCamera` are deliberate non-goals. The addon catalog is not shipped merely because its LTC data is used.

`createBackground`, `createEnvironments`, `createShadowMap` and `createOutput` have typed opt-in implementations. Supply `createDFGLUT()` through the explicit `getDFGLUT` callback, and `createLTCTextures()` through `ltcTextures` when needed. Missing textured-background support, required environment conversion, shadow support, HDR output, DFG or LTC lighting support fails explicitly; textures requiring no conversion pass through unchanged. Module-local caches and upstream class defaults remain; no `THREE` global, devtools registration or mutable lighting registry is created.

## Upstream coverage boundaries

The inventory is compared with the pinned `upstream/three.js/src`, not inferred from the example. Beyond the excluded backend/stereo families and intentionally replaced aggregators/shader-source paths, seven upstream defining modules are absent: `textures/HTMLTexture`, `audio/Audio`, `audio/AudioAnalyser`, `audio/AudioContext`, `audio/AudioListener`, `audio/PositionalAudio` and `loaders/AudioLoader`. Defining-module coverage is not proof of full API parity or every renderer combination.

- `textures/HTMLTexture` remains unported: it relies on experimental DOM-to-canvas `requestPaint`/`onpaint` behavior. CanvasTexture does not promise that contract.
- `extras/Controls` and addon `OrbitControls` are ported; the rest of the controls catalog remains pending. The feature testbed's local orbit interaction is separate from the standalone OrbitControls example.
- Audio, including `AudioLoader`, is outside this canvas-rendering scope. Only the explicitly listed addons are included: shader modules, OrbitControls, FontLoader and TextGeometry; other loaders, helpers, geometries, postprocessing, codecs and transcoders remain pending.
- `StereoCamera`, XR, WebGPU/common/node/TSL backends, node materials/loaders, WebGPU lights and `ClippingGroup` are intentionally excluded. The `webgl-fallback` directory is the WebGPU renderer's backend, not the standalone WebGL renderer.
- Upstream `Three*`, `Geometries`, `Materials`, `Curves`, `ShaderLib` and `ShaderChunk` aggregators are intentionally not public paths. Ported GLSL lives in explicit descriptors/shared chunks; an absent original shader filename does not mean its GLSL was omitted.
- Compressed-format and experimental media support is limited to capabilities actually exercised. Full browser/device coverage and additional combinations of shadows, deformation, maps, targets and custom shaders remain release verification requirements, not unfinished module-porting steps.

## Verification

During porting, run browser verification **only in the standard available browser through the `browser` tool**: the shared example, GPU/lifecycle fixtures and installed-package consumer. Do not launch extra engines or separate Playwright browsers for each slice. Keep type, behavioral and package checks; defer the complete cross-browser matrix below until the whole package version is ready for release. A single-browser pass does not close that release gate.

```sh
npm run verify
npm run package:check -- --browser-tool
# Open the printed dev/production URLs through browser; press Enter afterward.
# Full browser matrix before releasing the whole package version:
npm run package:check
npm run browser:smoke -- --browser chromium
npm run browser:smoke -- --browser firefox
npm run browser:smoke -- --browser webkit
# Inspect the same production example manually:
npm run preview -- --port 4173
```

For the pre-release matrix, install the needed browser engines with `npx playwright install --with-deps chromium firefox webkit`. `browser:smoke` expects the single production build from `verify` or `npm run build`; no benchmark build or generated report is needed.

Node tests cover differential matrix/geometry/camera behavior, normal/reversed-depth rays and projection, frustum and shadow matrices, normalized attributes, shared-buffer clone/serialization, instanced divisors, picking traversal/clipping, math boundaries, scene transforms, texture/material contracts, canonical exports and package boundaries. Consumer types cover the supported public APIs and rejected calls under strict TypeScript, including compilation without ambient Node types. Localized `any` annotations remain in dynamic WebGL caches and marker-based dispatch; `strict` alone is not a claim of complete semantic typing.

Geometry regressions additionally cover partial arcs/caps and segment clamping, flat/subdivided polyhedra, constructor JSON round-trips, independent clone/copy buffers and bounds, edge thresholds/degenerate faces, wireframe deduplication and ray hits versus holes. Curve/shape checks compare sampling, tangents, length-cache invalidation, recursive factory decoding and errors, fill rules/nested contours, open/closed tube frames, bevel/path extrusion, near-coincident vertices and custom UV generation with upstream.

The maintained browser scenarios exercise the integrated dev/production scene: picking, both cameras, geometry/object/material/animation modes, lights/shadows, loading, fog, uniforms, resize, layers/slices, helpers and shader error recovery. There are 22 focused development fixtures: 20 GPU/lifecycle checks and two loader checks. During porting, invoke them through `browser`, for example `await (await import('/tests/browser-shaders.ts')).verifyCustomShaders()` in the served page; the pre-release `browser:smoke` command runs the same fixtures:

- Rendering boundaries: missing shader/factory errors, recovery pixels and render-stack cleanup, RAF stop/restart, disposal, context restoration and caller-owned external textures.
- Textures: sRGB sampling, `needsUpdate`, UV changes, GPU deletion and reallocation.
- Lambert: analytical lighting, independent uniforms, transformed normals and material disposal/recompile.
- Backgrounds: 2D/cube transforms, clear state, failure recovery, nested rendering and context restoration.
- Environments: conversion/cache reuse, PMREM, source/provider disposal, failed upload/capture recovery and context restoration.
- Shadows: visible occlusion, directional/point modes, custom depth/distance materials, update/disposal transitions and context restoration.
- Output: HDR readback, tone mapping, local effects/depth, resize, failed transactions, GPU disposal and context restoration.
- Buffers: normalized/interleaved upload, instanced divisors/counts, overlapping partial-update ranges, native VBO rendering and actual GPU buffer deletion.
- Fog: analytical linear/exponential pixels, live color/range/density changes, Basic/Lambert opt-out and restoration.
- Uniform groups: std140 layout, shared shader programs, regular/UBO updates, actual buffer deletion/reallocation and context restoration without stale disposal handlers.
- Scene objects: line topology and dashed gaps/distance updates, Points size/attenuation and Sprite camera-facing/center/rotation, maps/transparency, culling/draw ranges, missing-descriptor recovery, GPU deletion/reallocation and context restoration.
- Instancing: matrix/color uploads and partial updates, zero/active counts, recomputed bounds/culling, instanced attribute divisors/capacity/draw ranges, shared geometry with ordinary meshes, directional/point shadow movement, real buffer/VAO deletion/reallocation, renderer disposal with live instances and context restoration without stale listeners.
- Batching/LOD: indexed/nonindexed ranges, matrix/color uploads, visibility, replacement/deletion/reuse/compaction, capacity changes, culling, opaque/transparent/custom sorting, native multi-draw and real-context draw-loop fallback, directional/point shadow movement, near/far/zoom/hysteresis/manual LOD, real buffer/texture/VAO deletion/reallocation and context restoration.
- Morph/skinning: absolute/relative/fractional position, normal and color targets (including standalone normal/color paths), per-instance weights/upload invalidation, hierarchical bone updates and bind-pose recovery, combined morph/skin deformation, bounds/culling, moving directional depth and point distance shadows, bone/morph texture deletion/reallocation and context restoration.
- Ambient/spot lights: analytical irradiance, cone/penumbra/range/decay, target movement, map-only cookies and RGB/alpha semantics, mixed shadow/map ordering, missing-factory/depth recovery, Basic/PCF/VSM occlusion, shadow camera/resize and one-shot updates, caller-owned cookies, GPU deletion/reallocation and frozen context restoration.
- Materials/PBR: analytical Normal/Matcap/Toon/probe pixels, Phong specular and Shadow alpha, area direction/size/intensity with float and half LTC, real DFG/IBL, Standard/Physical maps and physical features, same-class/cross-renderer uniform isolation, missing-input recovery, actual program/texture deletion/recreation, caller-owned LUTs and context restoration.
- Layered targets: independent array layers/volume slices, texture sampling, shared depth, sync/async selected-layer readback, target/face/mip restoration, resize, GPU deletion/reallocation and context restoration.
- Custom shaders: GLSL 1/3 ShaderMaterial/RawShaderMaterial, nested explicit includes and missing-include allocation safety, structured/array uniforms, sampler rebinding, upload caching, program ownership, actual compile/link logs and repaired rendering.
- Core helpers: pixels from all 13 helpers, visibility, bounds/camera/light/skeleton updates and native buffer deletion/recreation.

These are correctness checks, not separate user-facing examples or performance benchmarks. Helpers used only by lifecycle checks live under `tests/`.

`package:check` creates a real `npm pack` archive, installs it in an OS temporary directory with the lockfile-pinned toolchain and removes the directory afterward. The consumer uses no aliases, upstream dependency or workspace symlinks. It verifies raw sources and exports, compiles browser-only consumer contracts, builds the same example and checks dependency isolation. During porting, `--browser-tool` starts dev/production servers without launching a browser, prints their URLs and waits for Enter after you exercise the scene and lifecycle fixtures through `browser`. Browser results must be recorded separately; this mode does not claim an automated browser pass. Without the flag, the pre-release command runs its Chromium smoke automatically. Nothing is published.

Browser verification results go to command output, not a persistent report directory. Chromium automation uses SwiftShader; that is not mobile/hardware acceptance. Desktop WebKit is not Safari-on-device acceptance. Browser capability failures remain failures, not skipped successes.

## Maintained scripts

| Script                     | Purpose                                           |
| -------------------------- | ------------------------------------------------- |
| `scripts/module-graph.ts`  | AST parsing and runtime dependency/cycle analysis |
| `scripts/check-style.ts`   | Project-owned TypeScript source-convention checks |
| `scripts/check-package.ts` | Isolated source-first package consumer            |
| `scripts/browser-smoke.ts` | Integrated example and GPU lifecycle verification |

Bundle-size comparisons are not a recurring development or acceptance step; dependency isolation and runtime behavior still matter. Maintain `src/` directly and compare changes against the pinned upstream baseline.

Actual Safari/Apple devices, mobile GPUs, HDR display presentation and hosted CI execution require separate evidence. Completing the implementation plan does not establish these results or full upstream parity.

## Priority addons: HDR/EXR, FBX, geometry and planar surfaces

Use defining-module imports: `ek3d/addons/loaders/EXRLoader`, `FBXLoader` and `HDRLoader`,
`ek3d/addons/math/MeshSurfaceSampler`, `ek3d/addons/modifiers/SimplifyModifier`,
`ek3d/addons/objects/Reflector`, `Refractor`, `Water`, `Water2`, and
`ek3d/addons/interactive/HTMLMesh`. `Water2` retains the upstream export name `Water`.
RGBE files use `HDRLoader`; the deprecated upstream `RGBELoader` alias is intentionally absent.
`WaterMesh`/`Water2Mesh` require excluded WebGPU/TSL APIs and are not compatibility aliases for the WebGL objects.

EXR and binary FBX parsing remain synchronous. Supply a runtime with
`unzlibSync(data: Uint8Array): Uint8Array` through `loader.setZlibDecoder(runtime)` before parsing
zlib-compressed blocks. Formats that do not need zlib work without it. The examples fetch
`/examples/libs/fflate.module.js`, import the downloaded source through a temporary Blob URL,
revoke that URL and inject the module. fflate 0.8.3 and its MIT notice are local example assets,
not package-source imports or npm runtime dependencies.

`EXRLoader` preserves compression, part selection, output format and half/float decoding.
Its parsed `header` is structured metadata; `HDRLoader.parse().header` remains a string.
`DataTextureData.header` therefore accepts either a string or a metadata record.
FBX includes ASCII/binary geometry, skinning, morphs, animation, cameras/lights and NURBS curves;
`NURBSCurve` and its math utilities are available at their defining addon paths.

`SimplifyModifier.modify(geometry, count)` stays asynchronous and requires
`setSimplifier(runtime)` with a `MeshoptSimplifierLike` runtime. Its local example loads
the licensed meshoptimizer asset explicitly. It returns a new compact geometry; the caller
still owns the input and must dispose both according to their lifetimes.

Reflector/Refractor and water objects own offscreen targets and their effect materials,
not caller-supplied geometry or texture inputs. Water2 also owns normal maps it loads by default,
but never disposes maps supplied in options. Dispose owned addon resources separately from
the scene's geometry/maps. Failed offscreen renders restore visibility, target and shadow state.
`HTMLMesh` uses its own CanvasTexture-based DOM rasterizer, not the experimental
`ek3d/textures/HTMLTexture` API. It forwards one bubbling event to the DOM target, so label-backed
controls activate once; its WebGL example raycasts pointer UVs without WebXR.

New pages appear in `/examples/examples.html`. Each uses local resources, resize handling
and pagehide cleanup. Unexercised codec/device combinations are listed in the coverage
sections above; the full release browser matrix remains a separate gate.

## USD, photometry, physics and sculpting addons

`USDLoader` supports USDA, USDC and USDZ through its defining addon path.
Inject `setZipRuntime({ unzipSync })` for USDZ archives; standalone layers need no ZIP runtime.
The deprecated `USDZLoader` alias is intentionally absent. The local USDZ example uses
the same external fflate runtime as the other archive examples.

`IESLoader` produces normalized red-channel photometric textures in half-float, float or byte form.
External tilt files remain unsupported. `JXLLoader` requires native JPEG XL decoding and HDR
Canvas2D support (`srgb-linear`, float16 storage/readback and `globalHDRHeadroom`); it has no LDR fallback.

`AmmoPhysics` takes an initialized consumer-provided Ammo runtime. Its `dispose()` stops simulation
and releases owned Bullet objects, not mesh geometry or materials. Six Ammo pages use the local
licensed JS/WASM runtime.

`LightProbeGridWebGL` bakes a WebGL spherical-harmonic atlas; `LightProbeGridHelperWebGL`
visualizes its probes. `LightProbeGridUtils` replaces SunLight captures with equivalent
directional lights. Import each from its defining lighting/helper module. The three probe
pages include a complete local Sponza payload; its CRYENGINE license is not CC0.

`Sculptor`, `SculptorMesh`, `SculptorTools` and `SculptorUtils` retain the SculptGL MIT notice
in their source headers. The sculpt page includes GLB export through `GLTFExporter`.

`AnimationClipCreator`, `BoxLineGeometry`, `ColorEnvironment` and `ColorConverter` use their
canonical defining-module paths. Rotation clips preserve upstream track values (0–360),
which are interpreted as radians by Object3D rotation tracks.

`webgl_materials_envmaps_fasthdr` loads eight local prefiltered, compressed HDR environments.
The textures retain the PMREM mip chain and use the existing Basis/ZSTD runtimes.
The adjacent asset README credits the CC0 Poly Haven photographs.

## Gaussian splat data and exporters

`SPLATLoader`, `KSPLATLoader`, `GaussianSplatPLYLoader` and `SPZLoader` produce ordinary
`BufferGeometry` with centers, covariance, colors and optional packed spherical harmonics.
They do not install a splat renderer. The upstream GaussianSplat renderer and its glTF
extension require the excluded WebGPU/TSL backend and are not provided.

`SPZLoader.setGzipRuntime({ gunzipSync })` supplies decoding for versions 1–3.
`setZSTDRuntime({ decode, init? })` supplies version 4 decoding. The consumer owns both
runtimes. Higher-order spherical harmonics are capped at degree 3, as upstream.

Import exporters from their defining `ek3d/addons/exporters/*Exporter` modules.
OBJ, PLY and STL preserve their text/binary geometry contracts. `DRACOExporter` takes an
initialized encoder module in its constructor; its example loads the local licensed
Google Draco encoder rather than relying on a global or package runtime dependency.
`WebGLTextureUtils.decompress` converts compressed textures to canvas-backed textures
for export without importing another Three.js runtime.

`EXRExporter` takes `{ zlibSync }`; `parse(texture, options)` and
`parse(renderer, target, options)` preserve no compression, RLE, ZIPS, ZIP and PIZ.
`KTX2Exporter` takes the typed `KTX2Writer` runtime and writes uncompressed byte,
half-float or float 2D/3D textures and WebGL render targets.
`USDZExporter` takes `{ zipSync }` and returns an aligned archive from `parseAsync`.

`GLTFExporter` supports callback-based `parse` and promise-based `parseAsync`, JSON/GLB,
animations and registered extension plugins. Both glTF and USDZ exporters accept
`setTextureUtils({ decompress })` for compressed texture inputs. Examples supply
`WebGLTextureUtils`; codec implementations remain outside package sources.
The G-code page loads the local Polyslice 26.4.0 browser runtime and injects native engine
constructors. It does not set a global Three.js namespace or bundle another engine.
Printer, filament, infill and geometry controls retain the upstream behavior.
Generated G-code requires review and printer-specific validation before physical use.

## CSG, batch LOD and Jolt

Import CSG `Brush`, `Evaluator` and operation constants from their defining
`ek3d/addons/math/csg/core/*` modules. The three-bvh-csg 0.0.18 port uses the existing
native mesh BVH and a local constrained-triangulation closure. Brush geometry and
materials remain caller-owned; dispose generated result geometry separately.

`EnhancedBatchedMesh` lives at `ek3d/addons/objects/EnhancedBatchedMesh`.
It adds instance BVH culling/raycasting and shared-vertex geometry LODs without
patching global mesh prototypes. Geometry edits invalidate affected triangle BVHs;
call `computeBoundsTree()` again to restore acceleration. `SimplifyGeometryLOD`
functions take a consumer-provided meshoptimizer simplifier; the example serves
the licensed 1.1.1 runtime locally and retains 500,000 instances and five LODs.

`JoltPhysics(initializedRuntime)` lives at `ek3d/addons/physics/JoltPhysics`.
It supports boxes, spheres and icosahedra, scene physics metadata and instanced meshes.
Positive mass selects a dynamic body, as upstream; the magnitude does not override
Jolt's shape-derived mass. Position resets clear velocity and rotation without
destroying the body. `setMeshVelocity()` is implemented, not the upstream no-op.
`dispose()` stops the timer and releases owned bodies and the world, not mesh
geometry, materials or the caller's runtime.

## Rapier physics

`RapierPhysics(initializedRuntime)` lives at `ek3d/addons/physics/RapierPhysics`.
Supply an initialized Rapier 0.21.0-compatible runtime; the package never downloads it.
The adapter supports primitive and triangle-mesh colliders, heightfields, instanced meshes,
scene physics metadata, velocity changes and impulses. Instance synchronization preserves
rotation and scale. `removeMesh()` removes fixed and dynamic bodies; `dispose()` stops the
timer and frees the owned world, not caller geometry, materials or the runtime.
The returned `world` and `RAPIER` expose joint, character and vehicle controller access.
`step(delta?)` advances and synchronizes the simulation; an internal 60 Hz timer runs by default.

Import `RapierHelper` from `ek3d/addons/helpers/RapierHelper`; call `update()` before rendering
and `dispose()` when finished. It owns its debug geometry and material, not the physics world.
Six pages cover basic shapes, instancing, joints, terrain, character and vehicle controllers.
They share the local Apache-2.0 JS/WASM runtime and the existing grid texture.
