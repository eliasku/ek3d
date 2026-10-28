export interface VRMLUse {
  USE: string;
}
export interface VRMLRoute {
  FROM: string;
  TO: string;
}
export type VRMLFieldValue = VRMLNode | VRMLUse | string | number | boolean | null;
export interface VRMLField {
  name: string;
  type: "node" | "use" | "string" | "number" | "hex" | "boolean" | "null" | null;
  values: VRMLFieldValue[];
}
export interface VRMLNode {
  name: string;
  fields: VRMLField[];
  DEF?: string;
}
export interface VRMLTree {
  version: string;
  nodes: VRMLNode[];
  routes: VRMLRoute[];
}

export interface ChevrotainTokenType {
  name: string;
}
export interface ChevrotainToken {
  image: string;
}
export interface ChevrotainCstNode {
  name: string;
  children: ChevrotainCstChildren;
}
export interface ChevrotainCstChildren {
  [name: string]: (ChevrotainCstNode | ChevrotainToken)[];
}
interface ChevrotainVisitor {
  visit(node: ChevrotainCstNode | ChevrotainCstNode[]): unknown;
  validateVisitor(): void;
}
interface ChevrotainParser {
  input: ChevrotainToken[];
  errors: unknown[];
  RULE(name: string, implementation: () => void): () => ChevrotainCstNode;
  SUBRULE(rule: () => ChevrotainCstNode): ChevrotainCstNode;
  CONSUME(token: ChevrotainTokenType): ChevrotainToken;
  CONSUME2(token: ChevrotainTokenType): ChevrotainToken;
  OPTION(action: () => void): void;
  MANY(action: () => void): void;
  AT_LEAST_ONE(action: () => void): void;
  OR(alternatives: { ALT: () => void }[]): void;
  OR2(alternatives: { ALT: () => void }[]): void;
  performSelfAnalysis(): void;
  getBaseCstVisitorConstructor(): new () => ChevrotainVisitor;
}
export interface ChevrotainRuntime {
  createToken(config: {
    name: string;
    pattern: RegExp;
    longer_alt?: ChevrotainTokenType;
    group?: string;
  }): ChevrotainTokenType;
  Lexer: {
    new (tokens: ChevrotainTokenType[]): { tokenize(input: string): { tokens: ChevrotainToken[]; errors: unknown[] } };
    SKIPPED: string;
  };
  CstParser: new (vocabulary: Record<string, ChevrotainTokenType>) => ChevrotainParser;
}

function createTokens(runtime: ChevrotainRuntime): {
  tokens: ChevrotainTokenType[];
  vocabulary: Record<string, ChevrotainTokenType>;
} {
  const createToken = runtime.createToken.bind(runtime);
  const RouteIdentifier = createToken({
    name: "RouteIdentifier",
    pattern:
      /[^\x30-\x39\0-\x20\x22\x27\x23\x2b\x2c\x2d\x2e\x5b\x5d\x5c\x7b\x7d][^\0-\x20\x22\x27\x23\x2b\x2c\x2d\x2e\x5b\x5d\x5c\x7b\x7d]*[.][^\x30-\x39\0-\x20\x22\x27\x23\x2b\x2c\x2d\x2e\x5b\x5d\x5c\x7b\x7d][^\0-\x20\x22\x27\x23\x2b\x2c\x2d\x2e\x5b\x5d\x5c\x7b\x7d]*/,
  });
  const Identifier = createToken({
    name: "Identifier",
    pattern:
      /[^\x30-\x39\0-\x20\x22\x27\x23\x2b\x2c\x2d\x2e\x5b\x5d\x5c\x7b\x7d]([^\0-\x20\x22\x27\x23\x2b\x2c\x2e\x5b\x5d\x5c\x7b\x7d])*/,
    longer_alt: RouteIdentifier,
  });
  const nodeTypes = [
    "Anchor",
    "Billboard",
    "Collision",
    "Group",
    "Transform",
    "Inline",
    "LOD",
    "Switch",
    "PerspectiveCamera",
    "OrthographicCamera",
    "AudioClip",
    "DirectionalLight",
    "PointLight",
    "Script",
    "Shape",
    "Sound",
    "SpotLight",
    "WorldInfo",
    "CylinderSensor",
    "PlaneSensor",
    "ProximitySensor",
    "SphereSensor",
    "TimeSensor",
    "TouchSensor",
    "VisibilitySensor",
    "Box",
    "Cone",
    "Cylinder",
    "ElevationGrid",
    "Extrusion",
    "IndexedFaceSet",
    "IndexedLineSet",
    "PointSet",
    "Sphere",
    "Color",
    "Coordinate",
    "Normal",
    "TextureCoordinate",
    "Appearance",
    "FontStyle",
    "ImageTexture",
    "Material",
    "MovieTexture",
    "PixelTexture",
    "TextureTransform",
    "ColorInterpolator",
    "CoordinateInterpolator",
    "NormalInterpolator",
    "OrientationInterpolator",
    "PositionInterpolator",
    "ScalarInterpolator",
    "Background",
    "Fog",
    "NavigationInfo",
    "Viewpoint",
    "Text",
  ];
  const Version = createToken({ name: "Version", pattern: /#VRML.*/, longer_alt: Identifier });
  const NodeName = createToken({ name: "NodeName", pattern: new RegExp(nodeTypes.join("|")), longer_alt: Identifier });
  const DEF = createToken({ name: "DEF", pattern: /DEF/, longer_alt: Identifier });
  const USE = createToken({ name: "USE", pattern: /USE/, longer_alt: Identifier });
  const ROUTE = createToken({ name: "ROUTE", pattern: /ROUTE/, longer_alt: Identifier });
  const TO = createToken({ name: "TO", pattern: /TO/, longer_alt: Identifier });
  const StringLiteral = createToken({
    name: "StringLiteral",
    pattern: /"(?:[^\\"]|\\[bfnrtv"\\/]|\\u[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F])*"/,
  });
  const HexLiteral = createToken({ name: "HexLiteral", pattern: /0[xX][0-9a-fA-F]+/ });
  const NumberLiteral = createToken({ name: "NumberLiteral", pattern: /[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/ });
  const TrueLiteral = createToken({ name: "TrueLiteral", pattern: /TRUE/ });
  const FalseLiteral = createToken({ name: "FalseLiteral", pattern: /FALSE/ });
  const NullLiteral = createToken({ name: "NullLiteral", pattern: /NULL/ });
  const LSquare = createToken({ name: "LSquare", pattern: /\[/ });
  const RSquare = createToken({ name: "RSquare", pattern: /]/ });
  const LCurly = createToken({ name: "LCurly", pattern: /{/ });
  const RCurly = createToken({ name: "RCurly", pattern: /}/ });
  const Comment = createToken({ name: "Comment", pattern: /#.*/, group: runtime.Lexer.SKIPPED });
  const WhiteSpace = createToken({ name: "WhiteSpace", pattern: /[ ,\s]/, group: runtime.Lexer.SKIPPED });
  const tokens = [
    WhiteSpace,
    NodeName,
    DEF,
    USE,
    ROUTE,
    TO,
    TrueLiteral,
    FalseLiteral,
    NullLiteral,
    Version,
    Identifier,
    RouteIdentifier,
    StringLiteral,
    HexLiteral,
    NumberLiteral,
    LSquare,
    RSquare,
    LCurly,
    RCurly,
    Comment,
  ];
  const vocabulary: Record<string, ChevrotainTokenType> = {};
  for (const token of tokens) vocabulary[token.name] = token;
  return { tokens, vocabulary };
}

function createParser(runtime: ChevrotainRuntime, vocabulary: Record<string, ChevrotainTokenType>) {
  class VRMLParser extends runtime.CstParser {
    vrml: () => ChevrotainCstNode;
    version: () => ChevrotainCstNode;
    node: () => ChevrotainCstNode;
    field: () => ChevrotainCstNode;
    def: () => ChevrotainCstNode;
    use: () => ChevrotainCstNode;
    singleFieldValue: () => ChevrotainCstNode;
    multiFieldValue: () => ChevrotainCstNode;
    route: () => ChevrotainCstNode;
    constructor() {
      super(vocabulary);
      const {
        Version,
        LCurly,
        RCurly,
        LSquare,
        RSquare,
        Identifier,
        RouteIdentifier,
        StringLiteral,
        HexLiteral,
        NumberLiteral,
        TrueLiteral,
        FalseLiteral,
        NullLiteral,
        DEF,
        USE,
        ROUTE,
        TO,
        NodeName,
      } = vocabulary;
      this.vrml = this.RULE("vrml", () => {
        this.SUBRULE(this.version);
        this.AT_LEAST_ONE(() => {
          this.SUBRULE(this.node);
        });
        this.MANY(() => {
          this.SUBRULE(this.route);
        });
      });
      this.version = this.RULE("version", () => {
        this.CONSUME(Version);
      });
      this.node = this.RULE("node", () => {
        this.OPTION(() => {
          this.SUBRULE(this.def);
        });
        this.CONSUME(NodeName);
        this.CONSUME(LCurly);
        this.MANY(() => {
          this.SUBRULE(this.field);
        });
        this.CONSUME(RCurly);
      });
      this.field = this.RULE("field", () => {
        this.CONSUME(Identifier);
        this.OR2([
          {
            ALT: () => {
              this.SUBRULE(this.singleFieldValue);
            },
          },
          {
            ALT: () => {
              this.SUBRULE(this.multiFieldValue);
            },
          },
        ]);
      });
      this.def = this.RULE("def", () => {
        this.CONSUME(DEF);
        this.OR([
          {
            ALT: () => {
              this.CONSUME(Identifier);
            },
          },
          {
            ALT: () => {
              this.CONSUME(NodeName);
            },
          },
        ]);
      });
      this.use = this.RULE("use", () => {
        this.CONSUME(USE);
        this.OR([
          {
            ALT: () => {
              this.CONSUME(Identifier);
            },
          },
          {
            ALT: () => {
              this.CONSUME(NodeName);
            },
          },
        ]);
      });
      this.singleFieldValue = this.RULE("singleFieldValue", () => {
        this.AT_LEAST_ONE(() => {
          this.OR([
            {
              ALT: () => {
                this.SUBRULE(this.node);
              },
            },
            {
              ALT: () => {
                this.SUBRULE(this.use);
              },
            },
            {
              ALT: () => {
                this.CONSUME(StringLiteral);
              },
            },
            {
              ALT: () => {
                this.CONSUME(HexLiteral);
              },
            },
            {
              ALT: () => {
                this.CONSUME(NumberLiteral);
              },
            },
            {
              ALT: () => {
                this.CONSUME(TrueLiteral);
              },
            },
            {
              ALT: () => {
                this.CONSUME(FalseLiteral);
              },
            },
            {
              ALT: () => {
                this.CONSUME(NullLiteral);
              },
            },
          ]);
        });
      });
      this.multiFieldValue = this.RULE("multiFieldValue", () => {
        this.CONSUME(LSquare);
        this.MANY(() => {
          this.OR([
            {
              ALT: () => {
                this.SUBRULE(this.node);
              },
            },
            {
              ALT: () => {
                this.SUBRULE(this.use);
              },
            },
            {
              ALT: () => {
                this.CONSUME(StringLiteral);
              },
            },
            {
              ALT: () => {
                this.CONSUME(HexLiteral);
              },
            },
            {
              ALT: () => {
                this.CONSUME(NumberLiteral);
              },
            },
            {
              ALT: () => {
                this.CONSUME(NullLiteral);
              },
            },
          ]);
        });
        this.CONSUME(RSquare);
      });
      this.route = this.RULE("route", () => {
        this.CONSUME(ROUTE);
        this.CONSUME(RouteIdentifier);
        this.CONSUME(TO);
        this.CONSUME2(RouteIdentifier);
      });
      this.performSelfAnalysis();
    }
  }
  return new VRMLParser();
}

function createVisitor(Base: new () => ChevrotainVisitor): ChevrotainVisitor {
  class VRMLToASTVisitor extends Base {
    constructor() {
      super();
      this.validateVisitor();
    }
    vrml(ctx: ChevrotainCstChildren): VRMLTree {
      return {
        version: this.visit(ctx.version as ChevrotainCstNode[]) as string,
        nodes: (ctx.node as ChevrotainCstNode[]).map((node) => this.visit(node) as VRMLNode),
        routes: ((ctx.route || []) as ChevrotainCstNode[]).map((route) => this.visit(route) as VRMLRoute),
      };
    }
    version(ctx: ChevrotainCstChildren): string {
      return (ctx.Version[0] as ChevrotainToken).image;
    }
    node(ctx: ChevrotainCstChildren): VRMLNode {
      const node: VRMLNode = {
        name: (ctx.NodeName[0] as ChevrotainToken).image,
        fields: ((ctx.field || []) as ChevrotainCstNode[]).map((field) => this.visit(field) as VRMLField),
      };
      if (ctx.def) node.DEF = this.visit(ctx.def[0] as ChevrotainCstNode) as string;
      return node;
    }
    field(ctx: ChevrotainCstChildren): VRMLField {
      const result = this.visit((ctx.singleFieldValue || ctx.multiFieldValue)[0] as ChevrotainCstNode) as Pick<
        VRMLField,
        "type" | "values"
      >;
      return { name: (ctx.Identifier[0] as ChevrotainToken).image, type: result.type, values: result.values };
    }
    def(ctx: ChevrotainCstChildren): string {
      return ((ctx.Identifier || ctx.NodeName)[0] as ChevrotainToken).image;
    }
    use(ctx: ChevrotainCstChildren): VRMLUse {
      return { USE: ((ctx.Identifier || ctx.NodeName)[0] as ChevrotainToken).image };
    }
    singleFieldValue(ctx: ChevrotainCstChildren): Pick<VRMLField, "type" | "values"> {
      return processField(this, ctx);
    }
    multiFieldValue(ctx: ChevrotainCstChildren): Pick<VRMLField, "type" | "values"> {
      return processField(this, ctx);
    }
    route(ctx: ChevrotainCstChildren): VRMLRoute {
      const tokens = ctx.RouteIdentifier as ChevrotainToken[];
      return { FROM: tokens[0].image, TO: tokens[1].image };
    }
  }
  return new VRMLToASTVisitor();
}

function processField(visitor: ChevrotainVisitor, ctx: ChevrotainCstChildren): Pick<VRMLField, "type" | "values"> {
  const field: Pick<VRMLField, "type" | "values"> = { type: null, values: [] };
  if (ctx.node) {
    field.type = "node";
    for (const node of ctx.node as ChevrotainCstNode[]) field.values.push(visitor.visit(node) as VRMLNode);
  }
  if (ctx.use) {
    field.type = "use";
    for (const use of ctx.use as ChevrotainCstNode[]) field.values.push(visitor.visit(use) as VRMLUse);
  }
  if (ctx.StringLiteral) {
    field.type = "string";
    for (const token of ctx.StringLiteral as ChevrotainToken[]) field.values.push(token.image.replace(/'|"/g, ""));
  }
  if (ctx.NumberLiteral) {
    field.type = "number";
    for (const token of ctx.NumberLiteral as ChevrotainToken[]) field.values.push(parseFloat(token.image));
  }
  if (ctx.HexLiteral) {
    field.type = "hex";
    for (const token of ctx.HexLiteral as ChevrotainToken[]) field.values.push(token.image);
  }
  if (ctx.TrueLiteral) {
    field.type = "boolean";
    for (const token of ctx.TrueLiteral as ChevrotainToken[]) if (token.image === "TRUE") field.values.push(true);
  }
  if (ctx.FalseLiteral) {
    field.type = "boolean";
    for (const token of ctx.FalseLiteral as ChevrotainToken[]) if (token.image === "FALSE") field.values.push(false);
  }
  if (ctx.NullLiteral) {
    field.type = "null";
    for (const _token of ctx.NullLiteral) field.values.push(null);
  }
  return field;
}

export function parseVRML(data: string, runtime: ChevrotainRuntime): VRMLTree {
  const { tokens, vocabulary } = createTokens(runtime);
  const lexer = new runtime.Lexer(tokens);
  const parser = createParser(runtime, vocabulary);
  const visitor = createVisitor(parser.getBaseCstVisitorConstructor());
  const lexingResult = lexer.tokenize(data);
  if (lexingResult.errors.length > 0) {
    console.error(lexingResult.errors);
    throw Error("THREE.VRMLLexer: Lexing errors detected.");
  }
  parser.input = lexingResult.tokens;
  const cst = parser.vrml();
  if (parser.errors.length > 0) {
    console.error(parser.errors);
    throw Error("THREE.VRMLLoader: Parsing errors detected.");
  }
  return visitor.visit(cst) as VRMLTree;
}
