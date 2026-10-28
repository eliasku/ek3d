import { BoxGeometry } from "../../geometries/BoxGeometry";
import { BufferAttribute } from "../../core/BufferAttribute";
import { Side } from "../../constants";
import { Mesh } from "../../objects/Mesh";
import { PlaneGeometry } from "../../geometries/PlaneGeometry";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { Vector3 } from "../../math/Vector3";
import type { Texture } from "../../textures/Texture";
import type { BufferGeometry } from "../../core/BufferGeometry";
import { mergeGeometries } from "../utils/BufferGeometryUtils";

type TextureKinds = Texture & {
  isCubeTexture?: boolean;
  isDataArrayTexture?: boolean;
  isCompressedArrayTexture?: boolean;
  isData3DTexture?: boolean;
  isCompressed3DTexture?: boolean;
};

export class TextureHelper extends Mesh<ShaderMaterial> {
  texture: Texture;

  constructor(texture: TextureKinds, width = 1, height = 1, depth = 1) {
    const material = new ShaderMaterial({
      type: "TextureHelperMaterial",

      side: Side.Double,
      transparent: true,

      uniforms: {
        map: { value: texture },
        alpha: { value: getAlpha(texture) },
      },

      vertexShader: [
        "attribute vec3 uvw;",

        "varying vec3 vUvw;",

        "void main() {",

        "	vUvw = uvw;",

        "	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

        "}",
      ].join("\n"),

      fragmentShader: [
        "precision highp float;",

        "precision highp sampler2DArray;",

        "precision highp sampler3D;",

        "uniform {samplerType} map;",

        "uniform float alpha;",

        "varying vec3 vUvw;",

        "vec4 textureHelper( in sampler2D map ) { return texture( map, vUvw.xy ); }",

        "vec4 textureHelper( in sampler2DArray map ) { return texture( map, vUvw ); }",

        "vec4 textureHelper( in sampler3D map ) { return texture( map, vUvw ); }",

        "vec4 textureHelper( in samplerCube map ) { return texture( map, vUvw ); }",

        "void main() {",

        "	gl_FragColor = linearToOutputTexel( vec4( textureHelper( map ).xyz, alpha ) );",

        "}",
      ]
        .join("\n")
        .replace("{samplerType}", getSamplerType(texture)),
    });

    const geometry = texture.isCubeTexture
      ? createCubeGeometry(width, height, depth)
      : createSliceGeometry(texture, width, height, depth);

    super(geometry, material);

    this.texture = texture;
    this.type = "TextureHelper";
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

function getSamplerType(texture: TextureKinds) {
  if (texture.isCubeTexture) {
    return "samplerCube";
  } else if (texture.isDataArrayTexture || texture.isCompressedArrayTexture) {
    return "sampler2DArray";
  } else if (texture.isData3DTexture || texture.isCompressed3DTexture) {
    return "sampler3D";
  } else {
    return "sampler2D";
  }
}

function getImageCount(texture: TextureKinds) {
  if (texture.isCubeTexture) {
    return 6;
  } else if (
    texture.isDataArrayTexture ||
    texture.isCompressedArrayTexture ||
    texture.isData3DTexture ||
    texture.isCompressed3DTexture
  ) {
    // Array and 3D texture images carry their slice count as depth.
    const image = texture.image as { depth: number };
    return image.depth;
  } else {
    return 1;
  }
}

function getAlpha(texture: TextureKinds) {
  if (texture.isCubeTexture) {
    return 1;
  } else if (
    texture.isDataArrayTexture ||
    texture.isCompressedArrayTexture ||
    texture.isData3DTexture ||
    texture.isCompressed3DTexture
  ) {
    return Math.max(1 / getImageCount(texture), 0.25);
  } else {
    return 1;
  }
}

function createCubeGeometry(width: number, height: number, depth: number) {
  const geometry = new BoxGeometry(width, height, depth);

  const position = geometry.attributes.position as BufferAttribute;
  const uv = geometry.attributes.uv as BufferAttribute;
  const uvw = new BufferAttribute(new Float32Array(uv.count * 3), 3);

  const _direction = new Vector3();

  for (let j = 0, jl = uv.count; j < jl; ++j) {
    _direction.fromBufferAttribute(position, j).normalize();

    const u = _direction.x;
    const v = _direction.y;
    const w = _direction.z;

    uvw.setXYZ(j, u, v, w);
  }

  geometry.deleteAttribute("uv");
  geometry.setAttribute("uvw", uvw);

  return geometry;
}

function createSliceGeometry(texture: TextureKinds, width: number, height: number, depth: number) {
  const sliceCount = getImageCount(texture);

  const geometries: BufferGeometry[] = [];

  for (let i = 0; i < sliceCount; ++i) {
    const geometry = new PlaneGeometry(width, height);

    if (sliceCount > 1) {
      geometry.translate(0, 0, depth * (i / (sliceCount - 1) - 0.5));
    }

    const uv = geometry.attributes.uv as BufferAttribute;
    const uvw = new BufferAttribute(new Float32Array(uv.count * 3), 3);

    for (let j = 0, jl = uv.count; j < jl; ++j) {
      const u = uv.getX(j);
      const v = texture.flipY ? uv.getY(j) : 1 - uv.getY(j);
      const w =
        sliceCount === 1
          ? 1
          : texture.isDataArrayTexture || texture.isCompressedArrayTexture
            ? i
            : i / (sliceCount - 1);

      uvw.setXYZ(j, u, v, w);
    }

    geometry.deleteAttribute("uv");
    geometry.setAttribute("uvw", uvw);

    geometries.push(geometry);
  }

  return mergeGeometries(geometries)!;
}
