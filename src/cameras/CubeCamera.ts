import type { WebGLCubeRenderTarget } from "../renderers/WebGLCubeRenderTarget";
import type { WebGLRenderer } from "../renderers/WebGLRenderer";
import { CoordinateSystem } from "../constants";
import { Object3D } from "../core/Object3D";
import { PerspectiveCamera } from "./PerspectiveCamera";
const fov = -90; // negative fov is not an error
const aspect = 1;
/**
 * A special type of camera that is positioned in 3D space to render its surroundings into a
 * cube render target. The render target can then be used as an environment map for rendering
 * realtime reflections in your scene.
 *
 * ```ts
 * import { BoxGeometry } from 'ek3d/geometries/BoxGeometry';
 * import { CubeCamera } from 'ek3d/cameras/CubeCamera';
 * import { TextureFilter } from 'ek3d/constants';
 * import { Mesh } from 'ek3d/objects/Mesh';
 * import { MeshLambertMaterial } from 'ek3d/materials/MeshLambertMaterial';
 * import { PerspectiveCamera } from 'ek3d/cameras/PerspectiveCamera';
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { WebGLCubeRenderTarget } from 'ek3d/renderers/WebGLCubeRenderTarget';
 * import { WebGLRenderer } from 'ek3d/renderers/WebGLRenderer';
 * import { lambertShader } from 'ek3d/renderers/shaders/LambertShader';
 *
 * const scene = new Scene();
 * const renderer = new WebGLRenderer( { shaders: { MeshLambertMaterial: lambertShader } } );
 * const camera = new PerspectiveCamera( 45, 1, 0.1, 1000 );
 * camera.position.z = 10;
 * const carGeometry = new BoxGeometry( 2, 1, 4 );
 *
 * // Create cube render target
 * const cubeRenderTarget = new WebGLCubeRenderTarget( 256, { generateMipmaps: true, minFilter: TextureFilter.LinearMipmapLinear } );
 *
 * // Create cube camera
 * const cubeCamera = new CubeCamera( 1, 100000, cubeRenderTarget );
 * scene.add( cubeCamera );
 *
 * // Create car
 * const chromeMaterial = new MeshLambertMaterial( { color: 0xffffff, envMap: cubeRenderTarget.texture } );
 * const car = new Mesh( carGeometry, chromeMaterial );
 * scene.add( car );
 *
 * // Update the render target cube
 * car.visible = false;
 * cubeCamera.position.copy( car.position );
 * cubeCamera.update( renderer, scene );
 *
 * // Render the scene
 * car.visible = true;
 * renderer.render( scene, camera );
 * ```
 *
 */
export class CubeCamera extends Object3D<PerspectiveCamera> {
  renderTarget: WebGLCubeRenderTarget;
  coordinateSystem: CoordinateSystem | null;
  activeMipmapLevel: number;

  /**
   * Constructs a new cube camera.
   *
   * @param near - The camera's near plane.
   * @param far - The camera's far plane.
   * @param renderTarget - The cube render target.
   */
  constructor(near: number, far: number, renderTarget: WebGLCubeRenderTarget) {
    super();
    this.type = "CubeCamera";
    /**
     * A reference to the cube render target.
     *
     */
    this.renderTarget = renderTarget;
    /**
     * The current active coordinate system.
     *
     * @default null
     */
    this.coordinateSystem = null;
    /**
     * The current active mipmap level
     *
     * @default 0
     */
    this.activeMipmapLevel = 0;
    const cameraPX = new PerspectiveCamera(fov, aspect, near, far);
    cameraPX.layers = this.layers;
    this.add(cameraPX);
    const cameraNX = new PerspectiveCamera(fov, aspect, near, far);
    cameraNX.layers = this.layers;
    this.add(cameraNX);
    const cameraPY = new PerspectiveCamera(fov, aspect, near, far);
    cameraPY.layers = this.layers;
    this.add(cameraPY);
    const cameraNY = new PerspectiveCamera(fov, aspect, near, far);
    cameraNY.layers = this.layers;
    this.add(cameraNY);
    const cameraPZ = new PerspectiveCamera(fov, aspect, near, far);
    cameraPZ.layers = this.layers;
    this.add(cameraPZ);
    const cameraNZ = new PerspectiveCamera(fov, aspect, near, far);
    cameraNZ.layers = this.layers;
    this.add(cameraNZ);
  }
  /**
   * Must be called when the coordinate system of the cube camera is changed.
   */
  updateCoordinateSystem() {
    const coordinateSystem = this.coordinateSystem;
    const cameras = this.children.concat();
    const [cameraPX, cameraNX, cameraPY, cameraNY, cameraPZ, cameraNZ] = cameras;
    for (const camera of cameras) this.remove(camera);
    if (coordinateSystem === CoordinateSystem.WebGL) {
      cameraPX.up.set(0, 1, 0);
      cameraPX.lookAt(1, 0, 0);
      cameraNX.up.set(0, 1, 0);
      cameraNX.lookAt(-1, 0, 0);
      cameraPY.up.set(0, 0, -1);
      cameraPY.lookAt(0, 1, 0);
      cameraNY.up.set(0, 0, 1);
      cameraNY.lookAt(0, -1, 0);
      cameraPZ.up.set(0, 1, 0);
      cameraPZ.lookAt(0, 0, 1);
      cameraNZ.up.set(0, 1, 0);
      cameraNZ.lookAt(0, 0, -1);
    } else {
      throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: " + coordinateSystem);
    }
    for (const camera of cameras) {
      this.add(camera);
      camera.updateMatrixWorld();
    }
  }
  /**
   * Calling this method will render the given scene with the given renderer
   * into the cube render target of the camera.
   *
   * @param renderer - The renderer.
   * @param scene - The scene to render.
   */
  update(renderer: WebGLRenderer, scene: Object3D) {
    if (this.parent === null) this.updateMatrixWorld();
    const { renderTarget, activeMipmapLevel } = this;
    if (this.coordinateSystem !== renderer.coordinateSystem) {
      this.coordinateSystem = renderer.coordinateSystem;
      this.updateCoordinateSystem();
    }
    const [cameraPX, cameraNX, cameraPY, cameraNY, cameraPZ, cameraNZ] = this.children;
    const currentRenderTarget = renderer.getRenderTarget();
    const currentActiveCubeFace = renderer.getActiveCubeFace();
    const currentActiveMipmapLevel = renderer.getActiveMipmapLevel();
    const mipmapsAutoUpdate = renderTarget.texture.mipmapsAutoUpdate;
    try {
      renderTarget.texture.mipmapsAutoUpdate = false;
      let reversedDepthBuffer = false;
      if (renderer.isWebGLRenderer === true) {
        reversedDepthBuffer = (renderer as any).state.buffers.depth.getReversed();
      } else {
        reversedDepthBuffer = (renderer as any).reversedDepthBuffer;
      }
      renderer.setRenderTarget(renderTarget, 0, activeMipmapLevel);
      if (reversedDepthBuffer && renderer.autoClear === false) renderer.clearDepth();
      renderer.render(scene, cameraPX);
      renderer.setRenderTarget(renderTarget, 1, activeMipmapLevel);
      if (reversedDepthBuffer && renderer.autoClear === false) renderer.clearDepth();
      renderer.render(scene, cameraNX);
      renderer.setRenderTarget(renderTarget, 2, activeMipmapLevel);
      if (reversedDepthBuffer && renderer.autoClear === false) renderer.clearDepth();
      renderer.render(scene, cameraPY);
      renderer.setRenderTarget(renderTarget, 3, activeMipmapLevel);
      if (reversedDepthBuffer && renderer.autoClear === false) renderer.clearDepth();
      renderer.render(scene, cameraNY);
      renderer.setRenderTarget(renderTarget, 4, activeMipmapLevel);
      if (reversedDepthBuffer && renderer.autoClear === false) renderer.clearDepth();
      renderer.render(scene, cameraPZ);
      renderTarget.texture.mipmapsAutoUpdate = mipmapsAutoUpdate;
      renderer.setRenderTarget(renderTarget, 5, activeMipmapLevel);
      if (reversedDepthBuffer && renderer.autoClear === false) renderer.clearDepth();
      renderer.render(scene, cameraNZ);
    } finally {
      renderTarget.texture.mipmapsAutoUpdate = mipmapsAutoUpdate;
      renderer.setRenderTarget(currentRenderTarget, currentActiveCubeFace, currentActiveMipmapLevel);
    }
    renderTarget.texture.needsPMREMUpdate = true;
  }
}
