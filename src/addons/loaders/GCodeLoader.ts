import { Float32BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import { LineBasicMaterial } from "../../materials/LineBasicMaterial";
import { Group } from "../../objects/Group";
import { LineSegments } from "../../objects/LineSegments";

interface State {
  x: number;
  y: number;
  z: number;
  e: number;
  f: number;
  extruding: boolean;
  relative: boolean;
  extrusionOverride: boolean;
  extrusionRelative: boolean;
}

interface Layer {
  vertex: number[];
  pathVertex: number[];
  z: number;
}

/**
 * Loads linear GCode toolpaths for 3D printing and CNC applications.
 * Arc commands and other unsupported commands are ignored, matching upstream.
 *
 * ```typescript
 * import { GCodeLoader } from "ek3d/addons/loaders/GCodeLoader";
 * const object = await new GCodeLoader().loadAsync("models/gcode/benchy.gcode");
 * ```
 */
export class GCodeLoader extends Loader<Group> {
  /** Whether to create separate line objects for each layer. */
  splitLayer: boolean = false;

  override load(
    url: string,
    onLoad?: (object: Group) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setPath(this.path);
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      (text) => {
        try {
          if (typeof text !== "string") throw new TypeError("GCodeLoader requires text data");
          const object = this.parse(text);
          onLoad?.(object);
        } catch (error) {
          if (onError) onError(error);
          else console.error(error);
          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }

  /** Parses G0/G1, G90/G91, G92 and M82/M83 commands into extrusion and travel lines. */
  parse(data: string): Group {
    let state: State = {
      x: 0,
      y: 0,
      z: 0,
      e: 0,
      f: 0,
      extruding: false,
      relative: false,
      extrusionOverride: false,
      extrusionRelative: false,
    };
    const layers: Layer[] = [];
    let currentLayer: Layer | undefined;
    const pathMaterial = new LineBasicMaterial({ color: 0xff0000 });
    pathMaterial.name = "path";
    const extrudingMaterial = new LineBasicMaterial({ color: 0x00ff00 });
    extrudingMaterial.name = "extruded";

    function newLayer(line: State): Layer {
      const layer: Layer = { vertex: [], pathVertex: [], z: line.z };
      layers.push(layer);
      currentLayer = layer;
      return layer;
    }

    function absolute(previous: number, value: number): number {
      return state.relative ? previous + value : value;
    }

    for (const source of data.replace(/;.+/g, "").split("\n")) {
      const tokens = source.trim().split(/\s+/);
      const cmd = tokens[0].toUpperCase();
      const args: Record<string, number | undefined> = {};
      for (let i = 1; i < tokens.length; i++) {
        const token = tokens[i];
        if (token[0] !== undefined) args[token[0].toLowerCase()] = parseFloat(token.substring(1));
      }
      if (cmd === "G0" || cmd === "G1") {
        const line = { ...state };
        if (args.x !== undefined) line.x = absolute(state.x, args.x);
        if (args.y !== undefined) line.y = absolute(state.y, args.y);
        if (args.z !== undefined) line.z = absolute(state.z, args.z);
        if (args.e !== undefined) {
          const relative = state.extrusionOverride ? state.extrusionRelative : state.relative;
          line.e = relative ? state.e + args.e : args.e;
        }
        if (args.f !== undefined) line.f = absolute(state.f, args.f);
        if (line.e > state.e) {
          state.extruding = true;
          if (currentLayer === undefined || line.z !== currentLayer.z) newLayer(line);
        }
        const layer = currentLayer ?? newLayer(state);
        const vertices = state.extruding ? layer.vertex : layer.pathVertex;
        vertices.push(state.x, state.y, state.z, line.x, line.y, line.z);
        state = line;
      } else if (cmd === "G90" || cmd === "G91") {
        state.relative = cmd === "G91";
        state.extrusionOverride = false;
      } else if (cmd === "M82" || cmd === "M83") {
        state.extrusionOverride = true;
        state.extrusionRelative = cmd === "M83";
      } else if (cmd === "G92") {
        if (args.x !== undefined) state.x = args.x;
        if (args.y !== undefined) state.y = args.y;
        if (args.z !== undefined) state.z = args.z;
        if (args.e !== undefined) state.e = args.e;
      }
    }

    const object = new Group();
    object.name = "gcode";
    function addObject(vertices: number[], extruding: boolean, index: number): void {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      const segments = new LineSegments(geometry, extruding ? extrudingMaterial : pathMaterial);
      segments.name = "layer" + index;
      object.add(segments);
    }
    if (this.splitLayer) {
      for (let i = 0; i < layers.length; i++) {
        addObject(layers[i].vertex, true, i);
        addObject(layers[i].pathVertex, false, i);
      }
    } else {
      const vertices: number[] = [];
      const pathVertices: number[] = [];
      for (const layer of layers) {
        for (const value of layer.vertex) vertices.push(value);
        for (const value of layer.pathVertex) pathVertices.push(value);
      }
      addObject(vertices, true, layers.length);
      addObject(pathVertices, false, layers.length);
    }
    object.rotation.set(-Math.PI / 2, 0, 0);
    return object;
  }
}
