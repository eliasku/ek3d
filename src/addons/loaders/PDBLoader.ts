import { ColorSpace } from "../../constants";
import { Float32BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import { Color } from "../../math/Color";

export type PDBAtom = [number, number, number, number[], string];
export interface PDBResult {
  geometryAtoms: BufferGeometry;
  geometryBonds: BufferGeometry;
  json: { atoms: PDBAtom[] };
}

const CPK: Record<string, number[]> = {
  h: [255, 255, 255],
  he: [217, 255, 255],
  li: [204, 128, 255],
  be: [194, 255, 0],
  b: [255, 181, 181],
  c: [144, 144, 144],
  n: [48, 80, 248],
  o: [255, 13, 13],
  f: [144, 224, 80],
  ne: [179, 227, 245],
  na: [171, 92, 242],
  mg: [138, 255, 0],
  al: [191, 166, 166],
  si: [240, 200, 160],
  p: [255, 128, 0],
  s: [255, 255, 48],
  cl: [31, 240, 31],
  ar: [128, 209, 227],
  k: [143, 64, 212],
  ca: [61, 255, 0],
  sc: [230, 230, 230],
  ti: [191, 194, 199],
  v: [166, 166, 171],
  cr: [138, 153, 199],
  mn: [156, 122, 199],
  fe: [224, 102, 51],
  co: [240, 144, 160],
  ni: [80, 208, 80],
  cu: [200, 128, 51],
  zn: [125, 128, 176],
  ga: [194, 143, 143],
  ge: [102, 143, 143],
  as: [189, 128, 227],
  se: [255, 161, 0],
  br: [166, 41, 41],
  kr: [92, 184, 209],
  rb: [112, 46, 176],
  sr: [0, 255, 0],
  y: [148, 255, 255],
  zr: [148, 224, 224],
  nb: [115, 194, 201],
  mo: [84, 181, 181],
  tc: [59, 158, 158],
  ru: [36, 143, 143],
  rh: [10, 125, 140],
  pd: [0, 105, 133],
  ag: [192, 192, 192],
  cd: [255, 217, 143],
  in: [166, 117, 115],
  sn: [102, 128, 128],
  sb: [158, 99, 181],
  te: [212, 122, 0],
  i: [148, 0, 148],
  xe: [66, 158, 176],
  cs: [87, 23, 143],
  ba: [0, 201, 0],
  la: [112, 212, 255],
  ce: [255, 255, 199],
  pr: [217, 255, 199],
  nd: [199, 255, 199],
  pm: [163, 255, 199],
  sm: [143, 255, 199],
  eu: [97, 255, 199],
  gd: [69, 255, 199],
  tb: [48, 255, 199],
  dy: [31, 255, 199],
  ho: [0, 255, 156],
  er: [0, 230, 117],
  tm: [0, 212, 82],
  yb: [0, 191, 56],
  lu: [0, 171, 36],
  hf: [77, 194, 255],
  ta: [77, 166, 255],
  w: [33, 148, 214],
  re: [38, 125, 171],
  os: [38, 102, 150],
  ir: [23, 84, 135],
  pt: [208, 208, 224],
  au: [255, 209, 35],
  hg: [184, 184, 208],
  tl: [166, 84, 77],
  pb: [87, 89, 97],
  bi: [158, 79, 181],
  po: [171, 92, 0],
  at: [117, 79, 69],
  rn: [66, 130, 150],
  fr: [66, 0, 102],
  ra: [0, 125, 0],
  ac: [112, 171, 250],
  th: [0, 186, 255],
  pa: [0, 161, 255],
  u: [0, 143, 255],
  np: [0, 128, 255],
  pu: [0, 107, 255],
  am: [84, 92, 242],
  cm: [120, 92, 227],
  bk: [138, 79, 227],
  cf: [161, 54, 212],
  es: [179, 31, 212],
  fm: [179, 31, 186],
  md: [179, 13, 166],
  no: [189, 13, 135],
  lr: [199, 0, 102],
  rf: [204, 0, 89],
  db: [209, 0, 79],
  sg: [217, 0, 69],
  bh: [224, 0, 56],
  hs: [230, 0, 46],
  mt: [235, 0, 38],
  ds: [235, 0, 38],
  rg: [235, 0, 38],
  cn: [235, 0, 38],
  uut: [235, 0, 38],
  uuq: [235, 0, 38],
  uup: [235, 0, 38],
  uuh: [235, 0, 38],
  uus: [235, 0, 38],
  uuo: [235, 0, 38],
};

/** Loads atom and bond geometry from Protein Data Bank files. */
export class PDBLoader extends Loader<PDBResult> {
  load(
    url: string,
    onLoad?: (result: PDBResult) => void,
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
      (data) => {
        try {
          if (typeof data !== "string") throw new Error("PDBLoader: Expected text");
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

  parse(text: string): PDBResult {
    const atoms: PDBAtom[] = [];
    const atomMap = new Map<number, PDBAtom>();
    const bonds: [number, number][] = [];
    const seen = new Set<string>();
    for (const line of text.split("\n")) {
      if (line.slice(0, 4) === "ATOM" || line.slice(0, 6) === "HETATM") {
        const element = (line.slice(76, 78).trim() || line.slice(12, 14).trim()).toLowerCase();
        const atom: PDBAtom = [
          parseFloat(line.slice(30, 38)),
          parseFloat(line.slice(38, 46)),
          parseFloat(line.slice(46, 54)),
          CPK[element],
          element.charAt(0).toUpperCase() + element.slice(1),
        ];
        atoms.push(atom);
        atomMap.set(parseInt(line.slice(6, 11)) - 1, atom);
      } else if (line.slice(0, 6) === "CONECT") {
        const start = parseInt(line.slice(6, 11));
        for (const offset of [11, 16, 21, 26]) {
          const end = parseInt(line.slice(offset, offset + 5));
          const key = `s${Math.min(start, end)}e${Math.max(start, end)}`;
          if (end && !seen.has(key)) {
            seen.add(key);
            bonds.push([start - 1, end - 1]);
          }
        }
      }
    }
    const positions: number[] = [],
      colors: number[] = [],
      bondPositions: number[] = [];
    const color = new Color();
    for (const atom of atoms) {
      positions.push(atom[0], atom[1], atom[2]);
      color.setRGB(atom[3][0] / 255, atom[3][1] / 255, atom[3][2] / 255, ColorSpace.SRGB);
      colors.push(color.r, color.g, color.b);
    }
    for (const [start, end] of bonds) {
      const a = atomMap.get(start),
        b = atomMap.get(end);
      if (!a || !b) throw new Error("PDBLoader: Bond references a missing atom");
      bondPositions.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
    const geometryAtoms = new BufferGeometry();
    geometryAtoms.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometryAtoms.setAttribute("color", new Float32BufferAttribute(colors, 3));
    const geometryBonds = new BufferGeometry();
    geometryBonds.setAttribute("position", new Float32BufferAttribute(bondPositions, 3));
    return { geometryAtoms, geometryBonds, json: { atoms } };
  }
}
