import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { error } from "../../utils";
import type { FontData, FontOriginalInformation, Glyph } from "./FontLoader";

export interface TTFCommand {
  type: string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

export interface TTFFont {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  encoding: { cmap: { glyphIndexMap: Record<string, number> } };
  glyphs: {
    get(index: number): { advanceWidth: number; xMin: number; xMax: number; path: { commands: TTFCommand[] } };
  };
  tables: {
    post: { underlinePosition: number; underlineThickness: number };
    head: { xMin: number; xMax: number; yMin: number; yMax: number };
    name: unknown;
  };
  getEnglishName(name: string): string;
}

export interface TTFParser {
  parse(buffer: ArrayBuffer): TTFFont;
}

/** Converts a TrueType font to the typeface data consumed by Font. The parser is supplied by the consumer. */
export class TTFLoader extends Loader<FontData> {
  parser: TTFParser;
  reversed: boolean;

  constructor(parser: TTFParser, manager?: LoadingManager) {
    super(manager);
    this.parser = parser;
    this.reversed = false;
  }

  load(
    url: string,
    onLoad?: (data: FontData) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (cause: unknown) => void,
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
      (buffer) => {
        try {
          if (!(buffer instanceof ArrayBuffer)) throw new Error("TTFLoader: Expected an ArrayBuffer response.");
          onLoad?.(this.parse(buffer));
        } catch (cause) {
          if (onError) onError(cause);
          else error(cause);
          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }

  parse(buffer: ArrayBuffer): FontData {
    const font = this.parser.parse(buffer);
    const scale = 100000 / ((font.unitsPerEm || 2048) * 72);
    const glyphs: Record<string, Glyph> = {};
    for (const [unicode, index] of Object.entries(font.encoding.cmap.glyphIndexMap)) {
      const glyph = font.glyphs.get(index);
      const commands = this.reversed ? reverseCommands(glyph.path.commands) : glyph.path.commands;
      let outline = "";
      for (const command of commands) {
        const type = command.type.toLowerCase();
        outline += (type === "c" ? "b" : type) + " ";
        if (command.x !== undefined && command.y !== undefined)
          outline += `${Math.round(command.x * scale)} ${Math.round(command.y * scale)} `;
        if (command.x1 !== undefined && command.y1 !== undefined)
          outline += `${Math.round(command.x1 * scale)} ${Math.round(command.y1 * scale)} `;
        if (command.x2 !== undefined && command.y2 !== undefined)
          outline += `${Math.round(command.x2 * scale)} ${Math.round(command.y2 * scale)} `;
      }
      glyphs[String.fromCodePoint(Number(unicode))] = {
        ha: Math.round(glyph.advanceWidth * scale),
        x_min: Math.round(glyph.xMin * scale),
        x_max: Math.round(glyph.xMax * scale),
        o: outline,
      };
    }
    return {
      glyphs,
      familyName: font.getEnglishName("fullName"),
      ascender: Math.round(font.ascender * scale),
      descender: Math.round(font.descender * scale),
      underlinePosition: font.tables.post.underlinePosition,
      underlineThickness: font.tables.post.underlineThickness,
      boundingBox: {
        xMin: font.tables.head.xMin,
        xMax: font.tables.head.xMax,
        yMin: font.tables.head.yMin,
        yMax: font.tables.head.yMax,
      },
      resolution: 1000,
      original_font_information: font.tables.name as FontOriginalInformation,
    };
  }
}

function reverseCommands(commands: TTFCommand[]): TTFCommand[] {
  const paths: TTFCommand[][] = [];
  for (const command of commands) {
    if (command.type.toLowerCase() === "m") paths.push([command]);
    else if (command.type.toLowerCase() !== "z") {
      const path = paths[paths.length - 1];
      if (path === undefined) throw new Error("TTFLoader: Outline must start with a move command.");
      path.push(command);
    }
  }
  const result: TTFCommand[] = [];
  for (const path of paths) {
    const last = path[path.length - 1];
    result.push({ type: "m", x: last.x, y: last.y });
    for (let i = path.length - 1; i > 0; i--) {
      const command = path[i];
      const previous = path[i - 1];
      const reversed: TTFCommand = { type: command.type, x: previous.x, y: previous.y };
      if (command.x2 !== undefined && command.y2 !== undefined) {
        reversed.x1 = command.x2;
        reversed.y1 = command.y2;
        reversed.x2 = command.x1;
        reversed.y2 = command.y1;
      } else if (command.x1 !== undefined && command.y1 !== undefined) {
        reversed.x1 = command.x1;
        reversed.y1 = command.y1;
      }
      result.push(reversed);
    }
  }
  return result;
}
