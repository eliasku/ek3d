import { GL } from "../../GL";
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
export class WebGLInfo implements WebGLInfoState {
  memory: WebGLInfoState["memory"] = {
    geometries: 0,
    textures: 0,
  };
  private readonly renderState: WebGLInfoState["render"] = {
    frame: 0,
    calls: 0,
    triangles: 0,
    points: 0,
    lines: 0,
  };
  render: WebGLInfoState["render"] = this.renderState;
  programs: WebGLProgramInfo[] | null = null;
  autoReset: boolean = true;

  constructor() {
    this.reset = this.reset.bind(this);
    this.update = this.update.bind(this);
  }

  update(count: number, mode: number, instanceCount: number): void {
    this.renderState.calls++;
    switch (mode) {
      case GL.TRIANGLES:
        this.renderState.triangles += instanceCount * (count / 3);
        break;
      case GL.LINES:
        this.renderState.lines += instanceCount * (count / 2);
        break;
      case GL.LINE_STRIP:
        this.renderState.lines += instanceCount * (count - 1);
        break;
      case GL.LINE_LOOP:
        this.renderState.lines += instanceCount * count;
        break;
      case GL.POINTS:
        this.renderState.points += instanceCount * count;
        break;
      default:
        error("WebGLInfo: Unknown draw mode:", mode);
        break;
    }
  }

  reset(): void {
    this.renderState.calls = 0;
    this.renderState.triangles = 0;
    this.renderState.points = 0;
    this.renderState.lines = 0;
  }
}
