export function Rhino3dmWorker(): void {
  type EnumValue = { constructor: { name: string }; value: number };
  type Vector = [number, number, number];
  type Buffers = {
    format: "buffers";
    position: ArrayBufferView;
    normal?: ArrayBufferView;
    index?: ArrayBufferView;
    uv?: ArrayBufferView;
    color?: ArrayBufferView;
  };
  type Node = {
    delete(): void;
    count: number;
    get(index: number): Node;
    geometry(): Node;
    attributes(): Node;
    objectType: EnumValue;
    id: string;
    groupCount: number;
    userStringCount: number;
    getGroupList(): unknown;
    getUserStrings(): unknown;
    decals(): Node;
    drawColor(doc: Document): { r: number; g: number; b: number };
    location: Vector;
    faces(): Node;
    getMesh(type: EnumValue): Node | null;
    append(mesh: Node): void;
    compact(): void;
    subdivide(level: number): void;
    toThreejsBuffers?: (indexed: boolean) => Omit<Buffers, "format">;
    toThreejsJSON(): unknown;
    xform: Node;
    toFloatArray(rowMajor: boolean): number[];
    physicallyBased(): Node & { supported: boolean };
    getTexture(type: EnumValue): Node | null;
    fileName: string;
    wrapU: unknown;
    wrapV: unknown;
    wrapW: unknown;
    uvwTransform: Node;
    kind: string;
    findChild(name: string): Node | null;
    getObjectIds(): unknown;
    domain: [number, number];
    tangentAt(t: number): Vector;
    pointAt(t: number): Vector;
    renderSettings(): Node;
    renderEnvironments: Node & { reflectionId: string };
    groundPlane: Node;
    safeFrame: Node;
    dithering: Node;
    skylight: Node;
    linearWorkflow: Node;
    renderChannels: Node;
    sun: Node;
    postEffects: Node;
  };
  type LineCurve = Node & { pointAtStart: Vector; pointAtEnd: Vector };
  type PolylineCurve = Node & { pointCount: number; point(index: number): Vector };
  type PolyCurve = Node & { segmentCount: number; segmentCurve(index: number): Node };
  type ArcCurve = Node & { angleDegrees: number };
  type NurbsCurve = Node & { degree: number; tryGetPolyline(): Node };
  type Document = Node & {
    objects(): Node;
    instanceDefinitions(): Node;
    materials(): Node;
    layers(): Node;
    views(): Node;
    namedViews(): Node;
    groups(): Node;
    strings(): Node;
    settings(): Node;
    renderContent(): Node;
    embeddedFiles(): Node;
    getEmbeddedFileAsBase64(name: string): string;
  };
  type Rhino = {
    File3dm: { fromByteArray(bytes: Uint8Array): Document | null };
    ObjectType: Record<string, EnumValue>;
    TextureType: Record<string, EnumValue>;
    MeshType: { Any: EnumValue };
    Mesh: { new (): Node; createFromSubDControlNet(node: Node, flag: boolean): Node | null };
    LineCurve: { new (): LineCurve };
    PolylineCurve: { new (): PolylineCurve };
    PolyCurve: { new (): PolyCurve };
    ArcCurve: { new (): ArcCurve };
    NurbsCurve: { new (): NurbsCurve };
  };
  type Message =
    | { type: "init"; libraryConfig: { wasmBinary: ArrayBuffer } }
    | { type: "decode"; id: number; buffer: ArrayBuffer; subdivisionLevel: number };
  type ObjectData = { geometry: unknown; attributes: Record<string, unknown>; objectType: string };
  type Decoded = {
    objects: ObjectData[];
    materials: Record<string, unknown>[];
    layers: Record<string, unknown>[];
    views: Record<string, unknown>[];
    namedViews: Record<string, unknown>[];
    groups: Record<string, unknown>[];
    strings: unknown[];
    settings: Record<string, unknown>;
    renderSettings: Record<string, unknown>;
    renderEnvironment: { type: string; image: string; name: string } | null;
  };
  const worker = self as unknown as {
    postMessage(message: unknown, transfer?: Transferable[]): void;
    rhino3dm(config: { wasmBinary: ArrayBuffer; onAbort(reason: unknown): void }): Promise<Rhino>;
  };
  let pending: Promise<Rhino> | undefined;

  onmessage = (event: MessageEvent<unknown>): void => {
    const message = event.data as Message;
    if (!message || typeof message !== "object") return;
    if (message.type === "init") {
      pending = new Promise<Rhino>((resolve, reject) => {
        try {
          if (!(message.libraryConfig?.wasmBinary instanceof ArrayBuffer)) throw new Error("Invalid Rhino WASM binary");
          Promise.resolve(worker.rhino3dm({ wasmBinary: message.libraryConfig.wasmBinary, onAbort: reject })).then(
            resolve,
            reject,
          );
        } catch (error) {
          reject(error);
        }
      });
      // A decode may arrive later; keep an initialization failure from becoming unhandled.
      void pending.catch(() => {});
    } else if (message.type === "decode") {
      void (async () => {
        try {
          if (!pending) throw new Error("Rhino worker is not initialized");
          if (
            !(message.buffer instanceof ArrayBuffer) ||
            message.buffer.byteLength === 0 ||
            !Number.isInteger(message.subdivisionLevel) ||
            message.subdivisionLevel < 0
          )
            throw new Error("Invalid Rhino decode input");
          const rhino = await pending;
          const data = decodeObjects(rhino, message.buffer, message.subdivisionLevel, message.id);
          worker.postMessage({ type: "decode", id: message.id, data }, collectTransferables(data));
        } catch (error) {
          const e = error instanceof Error ? error : new Error(String(error));
          worker.postMessage({ type: "error", id: message.id, error: { message: e.message, stack: e.stack } });
        }
      })();
    }
  };

  function warning(id: number, message: string, type: string, guid?: string): void {
    worker.postMessage({ type: "warning", id, data: guid === undefined ? { message, type } : { message, type, guid } });
  }

  function properties(object: object): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const source = object as Record<string, unknown>;
    for (const key in source) {
      const value = source[key];
      if (typeof value === "function") continue;
      if (value !== null && typeof value === "object") {
        if (Object.prototype.hasOwnProperty.call(value, "constructor")) {
          const enumeration = value as { constructor: { name: string }; value: unknown };
          result[key] = { name: enumeration.constructor.name, value: enumeration.value };
        } else result[key] = properties(value);
      } else result[key] = value;
    }
    return result;
  }

  function meshToThreejs(mesh: Node): unknown {
    if (typeof mesh.toThreejsBuffers !== "function") return mesh.toThreejsJSON();
    const b = mesh.toThreejsBuffers(false);
    const result: Buffers = { format: "buffers", position: b.position };
    if (b.normal) result.normal = b.normal;
    if (b.index) result.index = b.index;
    if (b.uv) result.uv = b.uv;
    if (b.color) result.color = b.color;
    return result;
  }

  function collectTransferables(data: Decoded): Transferable[] {
    const buffers = new Set<ArrayBuffer>();
    for (const object of data.objects) {
      const geometry = object.geometry as Buffers | null;
      if (geometry?.format !== "buffers") continue;
      for (const attribute of [geometry.position, geometry.normal, geometry.uv, geometry.color, geometry.index]) {
        if (attribute?.buffer instanceof ArrayBuffer) buffers.add(attribute.buffer);
      }
    }
    return Array.from(buffers);
  }

  function curveToPoints(rhino: Rhino, curve: Node, limit: number): Vector[] {
    let count = limit;
    let points: Vector[] = [];
    if (curve instanceof rhino.LineCurve) return [curve.pointAtStart, curve.pointAtEnd];
    if (curve instanceof rhino.PolylineCurve) {
      for (let i = 0; i < curve.pointCount; i++) points.push(curve.point(i));
      return points;
    }
    if (curve instanceof rhino.PolyCurve) {
      for (let i = 0; i < curve.segmentCount; i++) {
        const segment = curve.segmentCurve(i);
        try {
          points = points.concat(curveToPoints(rhino, segment, count));
        } finally {
          segment.delete();
        }
      }
      return points;
    }
    if (curve instanceof rhino.ArcCurve) count = Math.max(2, Math.floor(curve.angleDegrees / 5));
    if (curve instanceof rhino.NurbsCurve && curve.degree === 1) {
      const polyline = curve.tryGetPolyline();
      try {
        for (let i = 0; i < polyline.count; i++) points.push(polyline.get(i) as unknown as Vector);
      } finally {
        polyline.delete();
      }
      return points;
    }
    const domain = curve.domain;
    const times: number[] = [];
    for (let i = 0; i < count; i++) {
      const t = domain[0] + (i / (count - 1)) * (domain[1] - domain[0]);
      if (t === domain[0] || t === domain[1]) {
        times.push(t);
        continue;
      }
      const tangent = curve.tangentAt(t);
      const previous = curve.tangentAt(times[times.length - 1]);
      const denominator = Math.sqrt(
        (tangent[0] ** 2 + tangent[1] ** 2 + tangent[2] ** 2) *
          (previous[0] ** 2 + previous[1] ** 2 + previous[2] ** 2),
      );
      const angle =
        denominator === 0
          ? Math.PI / 2
          : Math.acos(
              Math.max(
                -1,
                Math.min(
                  1,
                  (tangent[0] * previous[0] + tangent[1] * previous[1] + tangent[2] * previous[2]) / denominator,
                ),
              ),
            );
      if (angle >= 0.1) times.push(t);
    }
    return times.map((t) => curve.pointAt(t));
  }

  function extractObject(rhino: Rhino, object: Node, doc: Document, level: number, id: number): ObjectData | undefined {
    const geom = object.geometry();
    const attrs = object.attributes();
    const type = geom.objectType;
    let geometry: unknown;
    try {
      switch (type) {
        case rhino.ObjectType.Curve: {
          const array = curveToPoints(rhino, geom, 100).flat();
          geometry = { data: { attributes: { position: { itemSize: 3, type: "Float32Array", array } } } };
          break;
        }
        case rhino.ObjectType.Point: {
          const color = attrs.drawColor(doc);
          geometry = {
            data: {
              attributes: {
                position: { itemSize: 3, type: "Float32Array", array: geom.location },
                color: { itemSize: 3, type: "Float32Array", array: [color.r / 255, color.g / 255, color.b / 255] },
              },
            },
          };
          break;
        }
        case rhino.ObjectType.PointSet:
        case rhino.ObjectType.Mesh:
          geometry = meshToThreejs(geom);
          break;
        case rhino.ObjectType.Brep: {
          const faces = geom.faces();
          const mesh = new rhino.Mesh();
          try {
            for (let i = 0; i < faces.count; i++) {
              const face = faces.get(i);
              try {
                const part = face.getMesh(rhino.MeshType.Any);
                if (part)
                  try {
                    mesh.append(part);
                  } finally {
                    part.delete();
                  }
              } finally {
                face.delete();
              }
            }
            const meshFaces = mesh.faces();
            try {
              if (meshFaces.count > 0) {
                mesh.compact();
                geometry = meshToThreejs(mesh);
              }
            } finally {
              meshFaces.delete();
            }
          } finally {
            mesh.delete();
            faces.delete();
          }
          break;
        }
        case rhino.ObjectType.Extrusion:
        case rhino.ObjectType.SubD: {
          if (type === rhino.ObjectType.SubD) geom.subdivide(level);
          const mesh =
            type === rhino.ObjectType.SubD
              ? rhino.Mesh.createFromSubDControlNet(geom, false)
              : geom.getMesh(rhino.MeshType.Any);
          if (mesh)
            try {
              geometry = meshToThreejs(mesh);
            } finally {
              mesh.delete();
            }
          break;
        }
        case rhino.ObjectType.TextDot:
          geometry = properties(geom);
          break;
        case rhino.ObjectType.Light: {
          const light = properties(geom);
          geometry = light;
          if ((light.lightStyle as { name?: string } | undefined)?.name === "LightStyle_WorldLinear")
            warning(
              id,
              `THREE.3DMLoader: No conversion exists for ${type.constructor.name} LightStyle_WorldLinear`,
              "no conversion",
              attrs.id,
            );
          break;
        }
        case rhino.ObjectType.InstanceReference: {
          const instance = properties(geom);
          instance.xform = { ...properties(geom.xform), array: geom.xform.toFloatArray(true) };
          geometry = instance;
          break;
        }
        default:
          warning(
            id,
            `THREE.3DMLoader: Conversion not implemented for ${type.constructor.name}`,
            "not implemented",
            attrs.id,
          );
      }
      if (!geometry) {
        warning(
          id,
          `THREE.3DMLoader: ${type.constructor.name} has no associated mesh geometry.`,
          "missing mesh",
          attrs.id,
        );
        return undefined;
      }
      const attributes = properties(attrs);
      const geometryProperties = properties(geom);
      attributes.geometry = geometryProperties;
      if (attrs.groupCount > 0) attributes.groupIds = attrs.getGroupList();
      if (attrs.userStringCount > 0) attributes.userStrings = attrs.getUserStrings();
      if (geom.userStringCount > 0) geometryProperties.userStrings = geom.getUserStrings();
      if (attrs.decals().count > 0)
        warning(
          id,
          "THREE.3DMLoader: No conversion exists for the decals associated with this object.",
          "no conversion",
          attrs.id,
        );
      attributes.drawColor = attrs.drawColor(doc);
      return { geometry, attributes, objectType: type.constructor.name.substring(11) };
    } finally {
      geom.delete();
      attrs.delete();
    }
  }

  function textures(material: Node, types: EnumValue[], doc: Document, id: number): Record<string, unknown>[] {
    const result: Record<string, unknown>[] = [];
    for (const type of types) {
      const texture = material.getTexture(type);
      if (!texture) continue;
      try {
        const name = type.constructor.name.substring(12);
        const image = doc.getEmbeddedFileAsBase64(texture.fileName);
        const uvw = texture.uvwTransform.toFloatArray(true);
        if (!image) warning(id, `THREE.3DMLoader: Image for ${name} texture not embedded in file.`, "missing resource");
        result.push({
          type: name,
          wrapU: texture.wrapU,
          wrapV: texture.wrapV,
          wrapW: texture.wrapW,
          repeat: [uvw[0], uvw[5]],
          image: image ? "data:image/png;base64," + image : null,
        });
      } finally {
        texture.delete();
      }
    }
    return result;
  }

  function decodeObjects(rhino: Rhino, buffer: ArrayBuffer, level: number, id: number): Decoded {
    const doc = rhino.File3dm.fromByteArray(new Uint8Array(buffer));
    if (!doc) throw new Error("Invalid 3DM file");
    try {
      const objects: ObjectData[] = [];
      const objectTable = doc.objects();
      for (let i = 0; i < objectTable.count; i++) {
        const object = objectTable.get(i);
        try {
          const data = extractObject(rhino, object, doc, level, id);
          if (data) objects.push(data);
        } finally {
          object.delete();
        }
      }
      const definitions = doc.instanceDefinitions();
      for (let i = 0; i < definitions.count; i++) {
        const definition = definitions.get(i);
        try {
          const attributes = properties(definition);
          attributes.objectIds = definition.getObjectIds();
          objects.push({ geometry: null, attributes, objectType: "InstanceDefinition" });
        } finally {
          definition.delete();
        }
      }
      const textureTypes = ["Diffuse", "Bump", "Transparency", "Opacity", "Emap"].map(
        (name) => rhino.TextureType[name],
      );
      const pbrTypes = [
        "PBR_BaseColor",
        "PBR_Subsurface",
        "PBR_SubsurfaceScattering",
        "PBR_SubsurfaceScatteringRadius",
        "PBR_Metallic",
        "PBR_Specular",
        "PBR_SpecularTint",
        "PBR_Roughness",
        "PBR_Anisotropic",
        "PBR_Anisotropic_Rotation",
        "PBR_Sheen",
        "PBR_SheenTint",
        "PBR_Clearcoat",
        "PBR_ClearcoatBump",
        "PBR_ClearcoatRoughness",
        "PBR_OpacityIor",
        "PBR_OpacityRoughness",
        "PBR_Emission",
        "PBR_AmbientOcclusion",
        "PBR_Displacement",
      ].map((name) => rhino.TextureType[name]);
      const materials: Record<string, unknown>[] = [];
      const materialTable = doc.materials();
      for (let i = 0; i < materialTable.count; i++) {
        const material = materialTable.get(i);
        try {
          const data = properties(material);
          const maps = textures(material, textureTypes, doc, id);
          const pbr = material.physicallyBased();
          data.pbrSupported = pbr.supported;
          if (pbr.supported) {
            maps.push(...textures(material, pbrTypes, doc, id));
            data.pbr = properties(pbr);
          }
          data.textures = maps;
          materials.push(data);
        } finally {
          material.delete();
        }
      }
      function tableData(table: Node): Record<string, unknown>[] {
        const result: Record<string, unknown>[] = [];
        for (let i = 0; i < table.count; i++) {
          const item = table.get(i);
          try {
            result.push(properties(item));
          } finally {
            item.delete();
          }
        }
        return result;
      }
      const layers = tableData(doc.layers());
      const views = tableData(doc.views());
      const namedViews = tableData(doc.namedViews());
      const groups = tableData(doc.groups());
      const settingsNode = doc.settings();
      const settings = properties(settingsNode);
      const strings: unknown[] = [];
      const stringTable = doc.strings();
      for (let i = 0; i < stringTable.count; i++) strings.push(stringTable.get(i));
      const render = settingsNode.renderSettings();
      const reflectionId = render.renderEnvironments.reflectionId;
      const contentTable = doc.renderContent();
      let renderEnvironment: Decoded["renderEnvironment"] = null;
      for (let i = 0; i < contentTable.count; i++) {
        const content = contentTable.get(i);
        if (content.kind !== "environment" || content.id !== reflectionId) continue;
        const texture = content.findChild("texture");
        if (!texture) continue;
        const files = doc.embeddedFiles();
        for (let j = 0; j < files.count; j++) {
          if (texture.fileName === files.get(j).fileName)
            renderEnvironment = {
              type: "renderEnvironment",
              image: "data:image/png;base64," + doc.getEmbeddedFileAsBase64(texture.fileName),
              name: texture.fileName,
            };
        }
      }
      const renderSource = render as unknown as Record<string, unknown>;
      const renderSettings: Record<string, unknown> = {};
      for (const key of [
        "ambientLight",
        "backgroundColorTop",
        "backgroundColorBottom",
        "useHiddenLights",
        "depthCue",
        "flatShade",
        "renderBackFaces",
        "renderPoints",
        "renderCurves",
        "renderIsoParams",
        "renderMeshEdges",
        "renderAnnotations",
        "useViewportSize",
        "scaleBackgroundToFit",
        "transparentBackground",
        "imageDpi",
        "shadowMapLevel",
        "namedView",
        "snapShot",
        "specificViewport",
      ])
        renderSettings[key] = renderSource[key];
      for (const key of [
        "groundPlane",
        "safeFrame",
        "dithering",
        "skylight",
        "linearWorkflow",
        "renderChannels",
        "sun",
        "renderEnvironments",
        "postEffects",
      ])
        renderSettings[key] = properties(renderSource[key] as object);
      return {
        objects,
        materials,
        layers,
        views,
        namedViews,
        groups,
        strings,
        settings,
        renderSettings,
        renderEnvironment,
      };
    } finally {
      doc.delete();
    }
  }
}
