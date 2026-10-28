import { error } from "../../utils";
import type { WebGLProgramInfo } from "./WebGLProgram";
export interface WebGLInfoState {
  /** Information about allocated objects. */
  memory: {
    /** Number of active geometries. */
    geometries: number;
    /** Number of active textures. */
    textures: number;
  };
  /** Counts for the current frame. */
  render: {
    /** Frame ID. */
    frame: number;
    /** Number of draw calls. */
    calls: number;
    /** Number of rendered triangle primitives. */
    triangles: number;
    /** Number of rendered point primitives. */
    points: number;
    /** Number of rendered line primitives. */
    lines: number;
  };
  /** Shader programs used for rendering. */
  programs: WebGLProgramInfo[] | null;
  /** Whether the renderer automatically resets these counters. Defaults to true. */
  autoReset: boolean;
  /** Resets the render counters for the next frame. */
  reset(): void;
  update(count: number, mode: number, instanceCount: number): void;
}
export function WebGLInfo(gl: WebGL2RenderingContext): WebGLInfoState {
  const memory: WebGLInfoState["memory"] = {
    geometries: 0,
    textures: 0,
  };
  const render: WebGLInfoState["render"] = {
    frame: 0,
    calls: 0,
    triangles: 0,
    points: 0,
    lines: 0,
  };
  function update(count: number, mode: number, instanceCount: number) {
    render.calls++;
    switch (mode) {
      case gl.TRIANGLES:
        render.triangles += instanceCount * (count / 3);
        break;
      case gl.LINES:
        render.lines += instanceCount * (count / 2);
        break;
      case gl.LINE_STRIP:
        render.lines += instanceCount * (count - 1);
        break;
      case gl.LINE_LOOP:
        render.lines += instanceCount * count;
        break;
      case gl.POINTS:
        render.points += instanceCount * count;
        break;
      default:
        error("WebGLInfo: Unknown draw mode:", mode);
        break;
    }
  }
  function reset() {
    render.calls = 0;
    render.triangles = 0;
    render.points = 0;
    render.lines = 0;
  }
  return {
    memory: memory,
    render: render,
    programs: null,
    autoReset: true,
    reset: reset,
    update: update,
  };
}
