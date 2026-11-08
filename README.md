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

Math value types and `UniformsGroup` clone to their declared class, not the receiver's
runtime subclass. `Triangle` keeps polymorphic cloning for the maintained
`ExtendedTriangle` subclass. Inheritance-based engine types retain subtype-preserving clones.

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
It does not include the full Three.js addon catalog.
WebGPU, TSL, WebXR and StereoCamera are not included.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, commands, API details and checks.

Production builds use `@eliasku/ts-mangle/vite-plugin`, temporarily linked to
`file:../ts-mangle`. Build that checkout before building ek3d. Property mangling is disabled.
Development and unit tests use the original classes; verify optimized behavior with
`npm run build` and `npm run preview`.
Classes that need runtime prototypes can opt out with class-level `@class-crasher-ignore` JSDoc.
Math classes remain extracted; their method calls need concrete receiver types.
The optimized build is not release-ready: remaining dynamic dispatch and the full
example/browser/device matrix still need verification.

Run `npm run docs:llms` to generate [llms.txt](public/llms.txt) and
[llms-full.txt](public/llms-full.txt) from this README and the maintained source.
The first file lists the modules. The second includes their full TypeScript source and comments.

This is a non-commercial project. Example assets have their own licenses.
Non-commercial use does not give you permission to share those assets.
Read the [asset notices](public/examples/README.md) before publishing them.
