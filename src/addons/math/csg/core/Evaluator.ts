import type { BufferGeometry } from "../../../../core/BufferGeometry";
import type { Object3D } from "../../../../core/Object3D";
import { CDTTriangleSplitter } from "./CDTTriangleSplitter";
import { LegacyTriangleSplitter } from "./LegacyTriangleSplitter";
import { OperationDebugData } from "./debug/OperationDebugData";
import { performOperation } from "./operations/operations";
import { Operation } from "./operations/Operation";
import { OperationGroup } from "./operations/OperationGroup";
import { Brush } from "./Brush";
import type { CSGOperation } from "./constants";
import { GeometryBuilder } from "./operations/GeometryBuilder";
import * as GeometryUtils from "./operations/GeometryUtils";

export class Evaluator {
  triangleSplitter: LegacyTriangleSplitter | CDTTriangleSplitter;
  geometryBuilders: GeometryBuilder[];
  attributes: string[];
  useGroups: boolean;
  consolidateGroups: boolean;
  removeUnusedMaterials: boolean;
  debug: OperationDebugData;

  constructor() {
    this.triangleSplitter = new LegacyTriangleSplitter();
    this.geometryBuilders = [];
    this.attributes = ["position", "uv", "normal"];
    this.useGroups = true;
    this.consolidateGroups = true;
    this.removeUnusedMaterials = true;
    this.debug = new OperationDebugData();
  }

  get useCDTClipping(): boolean {
    return this.triangleSplitter instanceof CDTTriangleSplitter;
  }

  set useCDTClipping(value: boolean) {
    if (value !== this.useCDTClipping) {
      this.triangleSplitter = value ? new CDTTriangleSplitter() : new LegacyTriangleSplitter();
    }
  }

  getGroupRanges(geometry: BufferGeometry) {
    return !this.useGroups || geometry.groups.length === 0
      ? [{ start: 0, count: Infinity, materialIndex: 0 }]
      : geometry.groups.map((group) => ({ ...group }));
  }

  evaluate(a: Brush, b: Brush, operation: CSGOperation, target?: Brush): Brush;
  evaluate(a: Brush, b: Brush, operations: CSGOperation[], targets: Brush[]): Brush[];
  evaluate(
    a: Brush,
    b: Brush,
    operations: CSGOperation | CSGOperation[],
    targetBrushes: Brush | Brush[] = new Brush(),
  ): Brush | Brush[] {
    const operationList = Array.isArray(operations) ? operations : [operations];
    const wasArray = Array.isArray(targetBrushes);
    const targets = wasArray ? targetBrushes : [targetBrushes];
    if (targets.length !== operationList.length) {
      throw new Error("Evaluator: operations and target array passed as different sizes.");
    }
    a.prepareGeometry();
    b.prepareGeometry();
    const {
      triangleSplitter,
      geometryBuilders,
      attributes,
      useGroups,
      consolidateGroups,
      removeUnusedMaterials,
      debug,
    } = this;
    while (geometryBuilders.length < targets.length) geometryBuilders.push(new GeometryBuilder());
    targets.forEach((brush, i) => {
      geometryBuilders[i].initFromGeometry(a.geometry, attributes);
      GeometryUtils.trimAttributes(brush.geometry, attributes);
    });
    debug.init();
    performOperation(a, b, operationList, triangleSplitter, geometryBuilders, { useGroups });
    debug.complete();

    const aGroups = this.getGroupRanges(a.geometry);
    const aMaterials = GeometryUtils.getMaterialList(aGroups, a.material);
    const bGroups = this.getGroupRanges(b.geometry);
    const bMaterials = GeometryUtils.getMaterialList(bGroups, b.material);
    bGroups.forEach((group) => (group.materialIndex += aMaterials.length));
    const materials = [...aMaterials, ...bMaterials];
    let groups = [...aGroups, ...bGroups].map((group, index) => ({ ...group, index }));
    if (!useGroups) {
      groups = [{ start: 0, count: Infinity, index: 0, materialIndex: 0 }];
    } else if (consolidateGroups) {
      groups = GeometryUtils.useCommonMaterials(groups, materials);
      groups.sort((a, b) => a.materialIndex - b.materialIndex);
    }
    targets.forEach((brush, i) => {
      const targetGeometry = brush.geometry;
      geometryBuilders[i].buildGeometry(targetGeometry, groups);
      a.matrixWorld.decompose(brush.position, brush.quaternion, brush.scale);
      brush.updateMatrix();
      brush.matrixWorld.copy(a.matrixWorld);
      if (useGroups) {
        brush.material = materials;
        if (consolidateGroups) GeometryUtils.joinGroups(targetGeometry.groups);
        if (removeUnusedMaterials)
          brush.material = GeometryUtils.removeUnusedMaterials(targetGeometry.groups, materials);
      } else {
        brush.material = materials[0];
      }
    });
    return wasArray ? targets : targets[0];
  }

  evaluateHierarchy(root: Operation, target = new Brush()): Brush {
    root.updateMatrixWorld(true);
    const flatTraverse = (obj: Object3D, callback: (child: Operation) => void): void => {
      for (const child of obj.children) {
        if (child instanceof OperationGroup) flatTraverse(child, callback);
        else callback(child as Operation);
      }
    };
    const traverse = (brush: Operation | OperationGroup): boolean => {
      let didChange = false;
      for (const child of brush.children) didChange = traverse(child as Operation | OperationGroup) || didChange;
      const isDirty = brush.isDirty();
      if (isDirty) brush.markUpdated();
      if (didChange && !(brush instanceof OperationGroup)) {
        let result: Brush | undefined;
        flatTraverse(brush, (child) => {
          result = this.evaluate(result || brush, child, child.operation);
        });
        brush._cachedGeometry = result!.geometry;
        brush._cachedMaterials = result!.material;
        return true;
      }
      return didChange || isDirty;
    };
    traverse(root);
    target.geometry = root._cachedGeometry;
    target.material = root._cachedMaterials!;
    return target;
  }

  reset(): void {
    this.triangleSplitter.reset();
  }
}
