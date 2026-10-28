# ek3d

[Live Examples](https://ek3d.netlify.app/examples/examples.html)

- **What:** a lightweight, WebGL-focused TypeScript port of Three.js for canvas games and interactive 3D. Lightweight in scope, not a guaranteed bundle-size reduction.
- **Removed:** WebGPU/TSL, WebXR, StereoCamera, barrel exports and implicit subsystem registration. Audio remains outside scope. Addons include WebGL postprocessing, controls, loaders (including EXR/FBX and RGBE via HDRLoader), sampling/simplification, reflection/refraction, water, HTMLMesh, fonts and selected utilities—not the full upstream catalog.
- **Why:** direct module imports and explicit shaders/subsystems keep dependencies visible and avoid pulling unrelated features into your application. No runtime dependency on Three.js.
- **Usage:** raw TypeScript for a TS-capable bundler; import from defining modules, not `ek3d`. This implementation is not yet published—the npm `0.0.1` release is empty.

This is a non-commercial project. Third-party example assets retain their own licenses;
non-commercial use does not grant redistribution rights. See the
[asset notices](examples/public/examples/README.md) before publishing examples or assets.

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

Repository setup, scripts, API details and verification: [CONTRIBUTING.md](CONTRIBUTING.md).
