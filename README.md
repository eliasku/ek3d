# ek3d

[Live examples](https://ek3d.netlify.app/examples/examples.html)

ek3d is a TypeScript port of Three.js for canvas games and interactive 3D.
It uses WebGL and has no runtime dependency on Three.js.

Import each class or function from its own module. There is no root `ek3d` import.
The package contains TypeScript source, so use a bundler that supports TypeScript.
Pass shaders and other required subsystems to the renderer explicitly.
This keeps dependencies visible. It does not guarantee a smaller bundle.

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

Run `npm run docs:llms` to generate [llms.txt](public/llms.txt) and
[llms-full.txt](public/llms-full.txt) from this README and the maintained source.
The first file lists the modules. The second includes their full TypeScript source and comments.

This is a non-commercial project. Example assets have their own licenses.
Non-commercial use does not give you permission to share those assets.
Read the [asset notices](public/examples/README.md) before publishing them.
