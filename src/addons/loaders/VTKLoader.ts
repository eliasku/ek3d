import { SRGBColorSpace } from "../../constants";
import { BufferAttribute, Float32BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { Color } from "../../math/Color";

export interface VTKZlibDecoder {
  unzlibSync(data: Uint8Array): Uint8Array;
}

/** Loads legacy VTK and XML VTP polygonal data. Compressed VTP requires a zlib decoder. */
export class VTKLoader extends Loader<BufferGeometry> {
  zlibDecoder: VTKZlibDecoder | undefined;

  constructor(manager?: LoadingManager, zlibDecoder?: VTKZlibDecoder) {
    super(manager);
    this.zlibDecoder = zlibDecoder;
    console.warn(
      "THREE.VTKLoader: The loader has been deprecated and will be removed with r194. Export your VTK files to glTF before using them on the web.",
    );
  }

  load(
    url: string,
    onLoad?: (geometry: BufferGeometry) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setPath(this.path);
    loader.setResponseType("arraybuffer");
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      (data) => {
        try {
          if (!(data instanceof ArrayBuffer)) throw new Error("VTKLoader: Expected an ArrayBuffer");
          onLoad?.(this.parse(data));
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

  parse(data: ArrayBuffer): BufferGeometry {
    const decoder = new TextDecoder();
    const prefix = decoder.decode(new Uint8Array(data, 0, Math.min(data.byteLength, 250)));
    if (prefix.split("\n")[0].includes("xml")) return this.parseXML(decoder.decode(data));
    if (prefix.split("\n")[2]?.includes("ASCII")) return this.parseASCII(decoder.decode(data));
    return this.parseBinary(data);
  }

  private parseASCII(text: string): BufferGeometry {
    const positions: number[] = [],
      indices: number[] = [],
      normals: number[] = [],
      colors: number[] = [];
    let section = "",
      dataSection = "";
    const color = new Color();
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (line.startsWith("DATASET ") && line.split(/\s+/)[1] !== "POLYDATA")
        throw new Error("Unsupported DATASET type: " + line.split(/\s+/)[1]);
      const keyword = line.split(/\s+/)[0];
      if (["POINTS", "POLYGONS", "TRIANGLE_STRIPS"].includes(keyword)) {
        section = keyword;
        continue;
      }
      if (keyword === "POINT_DATA" || keyword === "CELL_DATA") {
        section = "";
        dataSection = keyword;
        continue;
      }
      if (dataSection && (keyword === "COLOR_SCALARS" || keyword === "NORMALS")) {
        section = keyword;
        continue;
      }
      if (!line || /^[^\d.\s-]+/.test(line)) continue;
      const values = line.split(/\s+/).map(Number);
      if (section === "POINTS") positions.push(...values.slice(0, values.length - (values.length % 3)));
      else if (section === "NORMALS") normals.push(...values.slice(0, values.length - (values.length % 3)));
      else if (section === "COLOR_SCALARS") {
        for (let i = 0; i + 2 < values.length; i += 3) {
          color.setRGB(values[i], values[i + 1], values[i + 2], SRGBColorSpace);
          colors.push(color.r, color.g, color.b);
        }
      } else if (section === "POLYGONS" || section === "TRIANGLE_STRIPS") {
        const count = values[0],
          nodes = values.slice(1, count + 1);
        for (let i = 0; i < count - 2; i++) {
          if (section === "POLYGONS") indices.push(nodes[0], nodes[i + 1], nodes[i + 2]);
          else if (i % 2) indices.push(nodes[i], nodes[i + 2], nodes[i + 1]);
          else indices.push(nodes[i], nodes[i + 1], nodes[i + 2]);
        }
      }
    }
    let geometry = new BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    if (normals.length === positions.length) geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    if (colors.length !== indices.length) {
      if (colors.length === positions.length) geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    } else {
      geometry = geometry.toNonIndexed();
      if (colors.length === geometry.attributes.position.count) {
        const expanded: number[] = [];
        for (let i = 0; i < colors.length; i += 3) {
          color.setRGB(colors[i], colors[i + 1], colors[i + 2], SRGBColorSpace);
          for (let j = 0; j < 3; j++) expanded.push(color.r, color.g, color.b);
        }
        geometry.setAttribute("color", new Float32BufferAttribute(expanded, 3));
      }
    }
    return geometry;
  }

  private parseBinary(data: ArrayBuffer): BufferGeometry {
    const bytes = new Uint8Array(data),
      view = new DataView(data);
    let index = 0;
    let points = new Float32Array(0),
      normals = new Float32Array(0),
      indices = new Uint32Array(0);
    const line = (): string => {
      const start = index;
      while (index < bytes.length && bytes[index] !== 10) index++;
      return new TextDecoder().decode(bytes.subarray(start, index++));
    };
    while (index < bytes.length) {
      const parts = line().trim().split(/\s+/);
      if (parts[0] === "DATASET" && parts[1] !== "POLYDATA") throw new Error("Unsupported DATASET type: " + parts[1]);
      if (parts[0] === "POINTS" || parts[0] === "POINT_DATA") {
        const count = Number(parts[1]) * 3;
        if (parts[0] === "POINT_DATA") line();
        const values = new Float32Array(count);
        for (let i = 0; i < count; i++, index += 4) values[i] = view.getFloat32(index, false);
        if (parts[0] === "POINTS") points = values;
        else normals = values;
        index++;
      } else if (parts[0] === "POLYGONS" || parts[0] === "TRIANGLE_STRIPS") {
        const result: number[] = [];
        for (let n = 0; n < Number(parts[1]); n++) {
          const count = view.getInt32(index, false);
          index += 4;
          const nodes: number[] = [];
          for (let i = 0; i < count; i++, index += 4) nodes.push(view.getInt32(index, false));
          for (let i = 0; i < count - 2; i++) {
            if (parts[0] === "POLYGONS") result.push(nodes[0], nodes[i + 1], nodes[i + 2]);
            else if (i % 2) result.push(nodes[i], nodes[i + 2], nodes[i + 1]);
            else result.push(nodes[i], nodes[i + 1], nodes[i + 2]);
          }
        }
        indices = new Uint32Array(result);
        index++;
      }
    }
    const geometry = new BufferGeometry();
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.setAttribute("position", new BufferAttribute(points, 3));
    if (normals.length === points.length) geometry.setAttribute("normal", new BufferAttribute(normals, 3));
    return geometry;
  }

  private parseXML(text: string): BufferGeometry {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const root = doc.documentElement,
      piece = root.querySelector("PolyData > Piece");
    if (!piece) throw new Error("Unsupported DATASET type");
    const headerBytes = root.getAttribute("header_type") === "UInt64" ? 8 : 4;
    const littleEndian = root.getAttribute("byte_order") !== "BigEndian";
    const compressed = root.hasAttribute("compressor");
    const appended = root.querySelector("AppendedData")?.textContent?.trim().slice(1) ?? "";
    const arrays = Array.from(piece.querySelectorAll("DataArray"));
    const offsets = arrays
      .filter((array) => array.hasAttribute("offset"))
      .map((array) => Number(array.getAttribute("offset")));
    const readArray = (element: Element): number[] => {
      const format = element.getAttribute("format") ?? "ascii";
      const type = element.getAttribute("type");
      if (!["Float32", "Int32", "Int64"].includes(type ?? ""))
        throw new Error("VTKLoader: Unsupported array type " + type);
      if (format === "ascii") return (element.textContent ?? "").trim().split(/\s+/).filter(Boolean).map(Number);
      let encoded = (element.textContent ?? "").trim();
      if (format === "appended") {
        const offset = Number(element.getAttribute("offset"));
        const next = offsets.find((value) => value > offset);
        encoded = appended.slice(offset, next);
      }
      const decodeBase64 = (value: string): Uint8Array =>
        Uint8Array.from(atob(value.replace(/\s/g, "")), (c) => c.charCodeAt(0));
      let payload: Uint8Array;
      if (compressed) {
        if (!this.zlibDecoder) throw new Error("VTKLoader: Compressed data requires a zlib decoder");
        const first = decodeBase64(encoded.slice(0, Math.ceil((headerBytes * 3) / 3) * 4));
        const headView = new DataView(first.buffer, first.byteOffset, first.byteLength);
        const blocks =
          headerBytes === 8 ? Number(headView.getBigUint64(0, littleEndian)) : headView.getUint32(0, littleEndian);
        const headerLength = headerBytes * (blocks + 3);
        const encodedHeaderLength = Math.ceil(headerLength / 3) * 4;
        const header = decodeBase64(encoded.slice(0, encodedHeaderLength));
        const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
        const compressedData = decodeBase64(encoded.slice(encodedHeaderLength));
        const chunks: Uint8Array[] = [];
        let offset = 0,
          total = 0;
        for (let i = 0; i < blocks; i++) {
          const at = headerBytes * (i + 3);
          const size =
            headerBytes === 8 ? Number(view.getBigUint64(at, littleEndian)) : view.getUint32(at, littleEndian);
          const chunk = this.zlibDecoder.unzlibSync(compressedData.subarray(offset, offset + size));
          chunks.push(chunk);
          total += chunk.length;
          offset += size;
        }
        payload = new Uint8Array(total);
        let cursor = 0;
        for (const chunk of chunks) {
          payload.set(chunk, cursor);
          cursor += chunk.length;
        }
      } else {
        payload = decodeBase64(encoded).subarray(headerBytes);
      }
      const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
      const stride = type === "Int64" ? 8 : 4,
        result: number[] = [];
      for (let i = 0; i + stride <= payload.length; i += stride) {
        result.push(
          type === "Float32"
            ? view.getFloat32(i, littleEndian)
            : type === "Int64"
              ? Number(view.getBigInt64(i, littleEndian))
              : view.getInt32(i, littleEndian),
        );
      }
      return result;
    };
    const pointArray = piece.querySelector(":scope > Points > DataArray");
    const numberOfPoints = Number(piece.getAttribute("NumberOfPoints"));
    const points = new Float32Array(
      pointArray && numberOfPoints > 0 ? numberOfPoints * Number(pointArray.getAttribute("NumberOfComponents")) : 0,
    );
    if (pointArray && numberOfPoints > 0) points.set(readArray(pointArray));
    const pointData = piece.querySelector(":scope > PointData");
    const normalName = pointData?.getAttribute("Normals");
    const normalArray = Array.from(pointData?.querySelectorAll("DataArray") ?? []).find(
      (array) => array.getAttribute("Name") === normalName,
    );
    const normals = new Float32Array(
      normalArray && numberOfPoints > 0 ? numberOfPoints * Number(normalArray.getAttribute("NumberOfComponents")) : 0,
    );
    if (normalArray && numberOfPoints > 0) normals.set(readArray(normalArray));
    let indices: number[] = [];
    for (const name of ["Strips", "Polys"]) {
      const section = piece.querySelector(`:scope > ${name}`);
      const elements = Array.from(section?.querySelectorAll("DataArray") ?? []);
      if (elements.length < 2 || Number(piece.getAttribute(`NumberOf${name}`)) <= 0) continue;
      indices = [];
      const connectivity = readArray(elements[0]),
        ends = readArray(elements[1]);
      let start = 0;
      for (const end of ends) {
        const nodes = name === "Strips" ? connectivity.slice(0, end - start) : connectivity.slice(start, end);
        for (let i = 0; i < nodes.length - 2; i++) {
          if (name === "Polys") indices.push(nodes[0], nodes[i + 1], nodes[i + 2]);
          else if (i % 2) indices.push(nodes[i], nodes[i + 2], nodes[i + 1]);
          else indices.push(nodes[i], nodes[i + 1], nodes[i + 2]);
        }
        start = end;
      }
    }
    const geometry = new BufferGeometry();
    geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1));
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    if (normals.length === points.length)
      geometry.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
    return geometry;
  }
}
