import { ExtendedTriangle } from "../math/ExtendedTriangle";
import { PrimitivePool } from "./PrimitivePool";

class ExtendedTrianglePoolBase extends PrimitivePool<ExtendedTriangle> {
  constructor() {
    super(() => new ExtendedTriangle());
  }
}

export const ExtendedTrianglePool = /* @__PURE__ */ new ExtendedTrianglePoolBase();
