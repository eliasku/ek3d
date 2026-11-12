import { GL } from "ek3d/GL";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { Scene } from "ek3d/scenes/Scene";
import { Vector3 } from "ek3d/math/Vector3";
import type { Camera } from "ek3d/cameras/Camera";
import type { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { GLSL, Side } from "ek3d/constants";

export class CustomShaders {
  mesh: Mesh;
  private object: Mesh;
  private geometry: PlaneGeometry = new PlaneGeometry(1.6, 1.6);
  private uniforms: { time: { value: number }; tint: { value: Vector3 } } = {
    time: { value: 0 },
    tint: { value: new Vector3(0.2, 0.65, 1) },
  };
  private material: ShaderMaterial = new ShaderMaterial({
    glslVersion: GLSL.GLSL3,
    uniforms: this.uniforms,
    side: Side.Double,
    vertexShader: `out vec2 sampleUV;
      void main() { sampleUV = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float time; uniform vec3 tint; in vec2 sampleUV; out vec4 result;
      void main() {
        float rings = 0.5 + 0.5 * sin(length(sampleUV - 0.5) * 36.0 - time * 4.0);
        result = vec4(mix(tint, tint.brg, rings) * (0.4 + rings * 0.6), 1.0);
      }`,
  });
  private statusText: string;
  private diagnosticResult: {
    kind: "compile" | "link";
    programLog: string;
    vertexLog: string;
    fragmentLog: string;
  } | null;

  constructor() {
    this.object = new Mesh(this.geometry, this.material);
    this.object.name = "Custom GLSL rings";
    this.object.position.set(0, 2.4, 0);
    this.object.visible = false;
    this.statusText = "Custom GLSL ready";
    this.diagnosticResult = null;
    this.mesh = this.object;
    this.update = this.update.bind(this);
    this.diagnose = this.diagnose.bind(this);
    this.dispose = this.dispose.bind(this);
  }

  get status() {
    return this.statusText;
  }

  get diagnostic() {
    return this.diagnosticResult;
  }

  update(seconds: number) {
    this.uniforms.time.value = seconds;
    this.object.rotation.y = Math.sin(seconds * 0.4) * 0.4;
  }

  diagnose(renderer: WebGLRenderer, camera: Camera, kind: "compile" | "link" = "compile") {
    const gl = renderer.getContext();
    const priorCallback = renderer.debug.onShaderError;
    const priorChecks = renderer.debug.checkShaderErrors;
    const broken = new RawShaderMaterial({
      name: "stage6Diagnostic",
      glslVersion: GLSL.GLSL3,
      vertexShader:
        "precision highp float; in vec3 position; out vec3 mismatch; void main() { mismatch = position; gl_Position = vec4(position, 1.0); }",
      fragmentShader:
        kind === "compile"
          ? "precision highp float; out vec4 result; void main() { result = intentional_compile_failure; }"
          : "precision highp float; in vec4 mismatch; out vec4 result; void main() { result = mismatch; }",
    });
    const probe = new Mesh(this.geometry, broken);
    probe.frustumCulled = false;
    const scene = new Scene();
    scene.add(probe);
    let observed = false;
    this.diagnosticResult = null;
    try {
      if (gl.getError() !== GL.NO_ERROR) throw new Error("Custom shader diagnostic requires a clean GL context");
      renderer.debug.checkShaderErrors = true;
      renderer.debug.onShaderError = (context, program, vertex, fragment) => {
        if (!(context.getShaderSource(fragment) ?? "").includes("stage6Diagnostic")) {
          if (priorCallback) priorCallback(context, program, vertex, fragment);
          throw new Error("Unexpected shader failure during custom diagnostic");
        }
        const vertexOK = context.getShaderParameter(vertex, GL.COMPILE_STATUS) === true;
        const fragmentOK = context.getShaderParameter(fragment, GL.COMPILE_STATUS) === true;
        const linked = context.getProgramParameter(program, GL.LINK_STATUS) === true;
        this.diagnosticResult = {
          kind,
          programLog: context.getProgramInfoLog(program) ?? "",
          vertexLog: context.getShaderInfoLog(vertex) ?? "",
          fragmentLog: context.getShaderInfoLog(fragment) ?? "",
        };
        observed =
          vertexOK &&
          !linked &&
          (kind === "compile"
            ? !fragmentOK && this.diagnosticResult.fragmentLog.length > 0
            : fragmentOK && this.diagnosticResult.programLog.length > 0);
        this.statusText = `${kind} diagnostic: ${this.diagnosticResult.fragmentLog || this.diagnosticResult.programLog}`;
      };
      renderer.render(scene, camera);
      if (!observed) throw new Error(`Expected ${kind} failure was not reported by the driver`);
      for (let error = gl.getError(); error !== GL.NO_ERROR; error = gl.getError()) {
        if (error !== GL.INVALID_OPERATION) throw new Error(`Unexpected diagnostic GL error ${error}`);
      }
      // Repair the same material: needsUpdate must replace the failed program, not hide its error.
      broken.vertexShader =
        "precision highp float; in vec3 position; void main() { gl_Position = vec4(position, 1.0); }";
      broken.fragmentShader =
        "precision highp float; out vec4 result; void main() { result = vec4(0.2, 0.8, 0.4, 1.0); }";
      broken.needsUpdate = true;
      renderer.render(scene, camera);
      if (gl.getError() !== GL.NO_ERROR) throw new Error("Custom shader failed to recover");
      this.statusText = `${kind} error captured; repaired shader rendered successfully`;
      return this.diagnosticResult;
    } catch (error) {
      this.statusText = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      renderer.debug.onShaderError = priorCallback;
      renderer.debug.checkShaderErrors = priorChecks;
      broken.dispose();
    }
  }

  dispose() {
    this.object.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
