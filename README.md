# ek3d

[Live examples](https://ek3d.netlify.app/examples/examples.html)

ek3d is a TypeScript port of Three.js for canvas games and interactive 3D.
It uses WebGL and has no runtime dependency on Three.js.

Import each class or function from its own module. There is no root `ek3d` import.
The package contains TypeScript source, so use a bundler that supports TypeScript.
Pass shaders and other required subsystems to the renderer explicitly.
This keeps dependencies visible. It does not guarantee a smaller bundle.

Unlike Three.js, math objects (`Vector2`, `Vector3`, `Vector4`, `Quaternion`,
`Euler` and `Color`) are not iterable. Use `toArray()` or named components instead.

Core `clone()` methods construct their declared class, not the receiver's runtime subclass.
Custom subclasses must override `clone()` with their own constructor to keep their subtype.
Typed child containers and camera-dependent shadows require matching clone return types.

## Basic example

```typescript
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";

const renderer = new WebGLRenderer({ shaders: { MeshBasicMaterial: basicShader } });
const scene = new Scene();
const camera = new PerspectiveCamera(50, 4 / 3, 0.1, 100);
camera.position.z = 3;
scene.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial({ color: 0xff8833 })));
renderer.setSize(640, 480);
document.body.append(renderer.domElement);
renderer.render(scene, camera);
```

## Development and documentation

The port includes controls, loaders, exporters, audio and WebGL postprocessing.
It also includes tools for geometry, animation, water and reflections.
The following upstream features are intentionally excluded:

- WebGPU, TSL, WebXR, StereoCamera and LEGO/LDraw.
- CAD/manufacturing/scientific importers: Rhino 3DM, AMF, 3MF, GCode, PDB, NRRD, VTK, PCD, XYZ and STL; the IFC example/runtime.
- Legacy/interchange model importers: LWO, 3DS/TDS, MD2, MDD, VRML, Collada/KMZ, FBX, OBJ/MTL and USD/USDZ.
- MaterialX utilities and KTX1/PVR, TGA/TIFF, IES and JPEG XL loaders.

Asset loading targets prepared web/game content, with glTF/GLB models and **KTX2/DDS** compressed textures.
Exclusions include format-specific helpers, dependent examples and exclusive resources, without conversion.
Independent exporters and shared rendering utilities remain supported.
Future upstream syncs must preserve these exclusions; the persistent module/page rules are in
[migration-scope.json](examples/migration-scope.json).

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, commands, API details and checks.

Production builds use `@eliasku/ts-mangle/vite-plugin`, temporarily linked to
`file:../ts-mangle`. Build that checkout before building ek3d. Property mangling is disabled:
dynamic WebGL backend calls still erase types and miss renamed properties.
Development and unit tests use the original classes; verify optimized behavior with
`npm run build` and `npm run preview`.
Classes that need runtime prototypes can opt out with class-level `@class-crasher-ignore` JSDoc.
Extracted math method calls need concrete receiver types in implementations, not just overloads.
Narrow math unions with runtime tag guards before concrete calls; do not cast tag probes to a class.
Keep native property descriptors when restoring those types.
Construct stateful subsystem and physics classes with `new`; renderer `create*` options take constructors.
Plain-data factories remain callable functions.
Use concrete constructors and return types in clone methods, without constructor or result assertions.
The class-crashed build still needs the full example/browser/device matrix.

Run `npm run docs:llms` to generate [llms.txt](public/llms.txt) and
[llms-full.txt](public/llms-full.txt) from this README and the maintained source.
The first file lists the modules. The second includes their full TypeScript source and comments.

This is a non-commercial project. Example assets have their own licenses.
Non-commercial use does not give you permission to share those assets.
Read the [asset notices](public/examples/README.md) before publishing them.
