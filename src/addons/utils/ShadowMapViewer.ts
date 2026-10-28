import { OrthographicCamera } from "../../cameras/OrthographicCamera";
import { DoubleSide } from "../../constants";
import { PlaneGeometry } from "../../geometries/PlaneGeometry";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { Mesh } from "../../objects/Mesh";
import { Scene } from "../../scenes/Scene";
import { CanvasTexture } from "../../textures/CanvasTexture";
import type { DirectionalLight } from "../../lights/DirectionalLight";
import type { SpotLight } from "../../lights/SpotLight";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";

/** Displays a directional or spot light's shadow map as an overlay. */
export class ShadowMapViewer {
  enabled: boolean = true;
  size: { width: number; height: number; set(width: number, height: number): void };
  position: { x: number; y: number; set(x: number, y: number): void };
  private camera: OrthographicCamera;
  private scene: Scene;
  private mesh: Mesh<ShaderMaterial>;
  private label: Mesh<MeshBasicMaterial> | null = null;
  private light: DirectionalLight | SpotLight;

  constructor(light: DirectionalLight | SpotLight) {
    this.light = light;
    this.camera = new OrthographicCamera(
      -window.innerWidth / 2,
      window.innerWidth / 2,
      window.innerHeight / 2,
      -window.innerHeight / 2,
      1,
      10,
    );
    this.camera.position.z = 2;
    this.scene = new Scene();
    this.mesh = new Mesh<ShaderMaterial>(
      new PlaneGeometry(256, 256),
      new ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, opacity: { value: 1 } },
        vertexShader: `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float opacity;
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() {
  float depth = texture2D(tDiffuse, vUv).r;
#ifdef USE_REVERSED_DEPTH_BUFFER
  gl_FragColor = vec4(vec3(depth), opacity);
#else
  gl_FragColor = vec4(vec3(1.0 - depth), opacity);
#endif
}`,
      }),
    );
    this.scene.add(this.mesh);
    if (light.name) {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to create shadow map label canvas");
      context.font = "Bold 20px Arial";
      canvas.width = context.measureText(light.name).width;
      canvas.height = 25;
      context.font = "Bold 20px Arial";
      context.fillStyle = "rgba( 255, 0, 0, 1 )";
      context.fillText(light.name, 0, 20);
      this.label = new Mesh<MeshBasicMaterial>(
        new PlaneGeometry(canvas.width, canvas.height),
        new MeshBasicMaterial({ map: new CanvasTexture(canvas), side: DoubleSide, transparent: true }),
      );
      this.scene.add(this.label);
    }
    this.position = {
      x: 10,
      y: 10,
      set: (x, y) => {
        this.position.x = x;
        this.position.y = y;
        this.mesh.position.set(
          -window.innerWidth / 2 + this.size.width / 2 + x,
          window.innerHeight / 2 - this.size.height / 2 - y,
          0,
        );
        if (this.label)
          this.label.position.set(this.mesh.position.x, this.mesh.position.y - this.size.height / 2 + 12.5, 0);
      },
    };
    this.size = {
      width: 256,
      height: 256,
      set: (width, height) => {
        this.size.width = width;
        this.size.height = height;
        this.mesh.scale.set(width / 256, height / 256, 1);
        this.position.set(this.position.x, this.position.y);
      },
    };
    this.update();
  }

  render(renderer: WebGLRenderer): void {
    if (!this.enabled) return;
    this.mesh.material.uniforms.tDiffuse.value = this.light.shadow.map!.texture;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    try {
      renderer.clearDepth();
      renderer.render(this.scene, this.camera);
    } finally {
      renderer.autoClear = autoClear;
    }
  }

  updateForWindowResize(): void {
    if (!this.enabled) return;
    this.camera.left = -window.innerWidth / 2;
    this.camera.right = window.innerWidth / 2;
    this.camera.top = window.innerHeight / 2;
    this.camera.bottom = -window.innerHeight / 2;
    this.camera.updateProjectionMatrix();
    this.update();
  }

  update(): void {
    this.position.set(this.position.x, this.position.y);
    this.size.set(this.size.width, this.size.height);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    if (this.label) {
      this.label.geometry.dispose();
      this.label.material.map?.dispose();
      this.label.material.dispose();
    }
  }
}
