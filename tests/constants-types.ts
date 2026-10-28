import { BindMode, CullFace, MOUSE, PixelFormat, TextureType } from "ek3d/constants";
import { GL } from "ek3d/GL";
import { GodraysUpsampleQuality } from "ek3d/addons/postprocessing/GodraysPass";
import { Texture } from "ek3d/textures/Texture";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import { EXRLoader } from "ek3d/addons/loaders/EXRLoader";

declare let face: CullFace;
declare const number: number;
declare const string: string;
face = CullFace.Back;
face = 3;
// @ts-expect-error Different enum types are not interchangeable.
face = MOUSE.RIGHT;
// @ts-expect-error Only listed cull-face values are accepted.
face = -1;
// Numeric enums follow TypeScript's number assignability.
face = number;
// @ts-expect-error Constant members are readonly.
CullFace.Back = 2;

declare let bind: BindMode;
bind = BindMode.Attached;
// @ts-expect-error String enums require their declared members.
bind = "detached";
// @ts-expect-error Only listed bind modes are accepted.
bind = "invalid";
// @ts-expect-error Unrestricted strings must be narrowed before use.
bind = string;
const attached: BindMode.Attached = BindMode.Attached;

declare let gl: GL;
gl = GL.FLOAT;
gl = 5126;
// @ts-expect-error Unknown WebGL constants are rejected.
gl = 0xdeadbeef;
// @ts-expect-error WebGL constants are readonly.
GL.FLOAT = 0x140b;

declare let quality: GodraysUpsampleQuality;
quality = GodraysUpsampleQuality.HIGH;
// @ts-expect-error Only listed upsample qualities are accepted.
quality = 2;

const texture = new Texture();
texture.type = TextureType.Float;
texture.format = PixelFormat.RGBA;
texture.type = number;
declare const canvas: HTMLCanvasElement;
new CanvasTexture(canvas, undefined, undefined, undefined, undefined, undefined, PixelFormat.RGBA, TextureType.Float);
// @ts-expect-error Texture subclasses do not widen the format contract.
new CanvasTexture(canvas, undefined, undefined, undefined, undefined, undefined, 0xdeadbeef);
new EXRLoader().setDataType(TextureType.HalfFloat);
// Numeric enum parameters follow the same number assignability.
new EXRLoader().setDataType(number);

void [face, bind, attached, gl, quality];
