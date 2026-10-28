import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Texture } from "ek3d/textures/Texture";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import { VideoTexture } from "ek3d/textures/VideoTexture";
import { VideoFrameTexture } from "ek3d/textures/VideoFrameTexture";
import { FramebufferTexture } from "ek3d/textures/FramebufferTexture";
import { CompressedTexture } from "ek3d/textures/CompressedTexture";
import { CompressedArrayTexture } from "ek3d/textures/CompressedArrayTexture";
import { CompressedCubeTexture } from "ek3d/textures/CompressedCubeTexture";
import {
  GLSL3,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  NearestFilter,
  NearestMipmapNearestFilter,
  NoColorSpace,
  RepeatWrapping,
  RGBA_S3TC_DXT1_Format,
  SRGBColorSpace,
} from "ek3d/constants";

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function canvasSource() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 4;
  const context = canvas.getContext("2d");
  check(context !== null, "Texture fixture requires CanvasRenderingContext2D");
  const fill = (color: string) => {
    context.fillStyle = color;
    context.fillRect(0, 0, 4, 4);
  };
  return { canvas, context, fill };
}

function renderFixture() {
  const renderer = new WebGLRenderer({ preserveDrawingBuffer: true, shaders: { MeshBasicMaterial: basicShader } });
  renderer.setSize(16, 16);
  renderer.outputColorSpace = LinearSRGBColorSpace;
  const geometry = new PlaneGeometry(2, 2);
  const material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material);
  const scene = new Scene();
  scene.add(mesh);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;
  const gl = renderer.getContext();
  const pixel = new Uint8Array(4);
  const sample = (expected: number[], label: string, tolerance = 2) => {
    renderer.render(scene, camera);
    gl.readPixels(8, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    check(gl.getError() === gl.NO_ERROR, `${label}: WebGL upload/render error`);
    check(
      pixel.every((value, index) => Math.abs(value - expected[index]) <= tolerance),
      `${label}: ${pixel.join(",")} != ${expected.join(",")}`,
    );
  };
  const map = (texture: Texture) => {
    material.map = texture;
    material.needsUpdate = true;
    mesh.material = material;
  };
  return {
    renderer,
    material,
    mesh,
    gl,
    sample,
    map,
    dispose() {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}

function disposeGpu(renderer: WebGLRenderer, texture: Texture, label: string) {
  const gl = renderer.getContext();
  const handle: WebGLTexture = renderer.properties.get(texture).__webglTexture;
  check(gl.isTexture(handle), `${label}: expected a live GPU texture before disposal`);
  texture.dispose();
  check(!gl.isTexture(handle), `${label}: disposal retained the WebGL texture`);
  return handle;
}

export function verifyCanvasAndFramebufferTextures() {
  const fixture = renderFixture();
  const source = canvasSource();
  const canvas = new CanvasTexture(source.canvas);
  const framebuffer = new FramebufferTexture(4, 4);
  try {
    source.fill("#ff0000");
    fixture.map(canvas);
    fixture.sample([255, 0, 0, 255], "canvas initial upload");
    source.fill("#00ff00");
    fixture.sample([255, 0, 0, 255], "canvas requires explicit needsUpdate");
    canvas.needsUpdate = true;
    fixture.sample([0, 255, 0, 255], "canvas update");
    canvas.colorSpace = SRGBColorSpace;
    source.fill("#808080");
    canvas.needsUpdate = true;
    fixture.sample([55, 55, 55, 255], "canvas sRGB decoding");
    canvas.colorSpace = NoColorSpace;
    canvas.needsUpdate = true;
    fixture.sample([128, 128, 128, 255], "canvas untagged color");

    source.fill("#ff0000");
    source.context.fillStyle = "#0000ff";
    source.context.fillRect(2, 0, 2, 4);
    canvas.wrapS = RepeatWrapping;
    canvas.minFilter = canvas.magFilter = NearestFilter;
    canvas.repeat.set(0, 0);
    canvas.offset.set(1.125, 0.5);
    canvas.needsUpdate = true;
    fixture.sample([255, 0, 0, 255], "repeat wrapping and nearest filtering");
    canvas.offset.x = 0.5;
    canvas.minFilter = canvas.magFilter = LinearFilter;
    canvas.needsUpdate = true;
    fixture.sample([128, 0, 128, 255], "linear filtering");
    canvas.minFilter = LinearMipmapLinearFilter;
    canvas.repeat.set(64, 64);
    canvas.offset.set(0, 0);
    canvas.needsUpdate = true;
    fixture.sample([128, 0, 128, 255], "generated canvas mipmaps");

    source.fill("#00ff00");
    canvas.repeat.set(1, 1);
    canvas.needsUpdate = true;
    fixture.sample([0, 255, 0, 255], "framebuffer source");
    fixture.renderer.copyFramebufferToTexture(framebuffer);
    fixture.map(framebuffer);
    fixture.sample([0, 255, 0, 255], "framebuffer copy upload");
    fixture.renderer.setClearColor(0xff0000, 1);
    fixture.renderer.clear();
    fixture.renderer.copyFramebufferToTexture(framebuffer);
    fixture.sample([255, 0, 0, 255], "framebuffer copy update");
    const before = fixture.renderer.info.memory.textures;
    const oldCanvasHandle = disposeGpu(fixture.renderer, canvas, "canvas");
    disposeGpu(fixture.renderer, framebuffer, "framebuffer");
    check(fixture.renderer.info.memory.textures === before - 2, "Texture disposal did not release GPU allocations");
    check(
      source.canvas.width === 4 && source.context.getImageData(0, 0, 1, 1).data[1] === 255,
      "GPU disposal destroyed caller-owned canvas",
    );
    fixture.map(canvas);
    fixture.sample([0, 255, 0, 255], "canvas reupload after disposal");
    check(
      fixture.renderer.properties.get(canvas).__webglTexture !== oldCanvasHandle,
      "Canvas reupload reused a deleted handle",
    );
    disposeGpu(fixture.renderer, canvas, "reuploaded canvas");
    return {
      upload: true,
      update: true,
      colorSpace: true,
      mipmaps: true,
      filtering: true,
      wrapping: true,
      framebuffer: true,
      ownership: true,
      glError: fixture.gl.getError(),
    };
  } finally {
    canvas.dispose();
    framebuffer.dispose();
    fixture.dispose();
  }
}

const red = new Uint8Array([0, 248, 0, 248, 0, 0, 0, 0]);
const green = new Uint8Array([224, 7, 224, 7, 0, 0, 0, 0]);
const blue = new Uint8Array([31, 0, 31, 0, 0, 0, 0, 0]);

export function verifyCompressedTextures() {
  const fixture = renderFixture();
  const textures: Texture[] = [];
  const materials: RawShaderMaterial[] = [];
  try {
    check(
      fixture.gl.getExtension("WEBGL_compressed_texture_s3tc") !== null,
      "Compressed texture fixture requires WEBGL_compressed_texture_s3tc at runtime",
    );
    const mipmaps = [
      { width: 4, height: 4, data: red.slice() },
      { width: 2, height: 2, data: green.slice() },
      { width: 1, height: 1, data: blue.slice() },
    ];
    const texture = new CompressedTexture(mipmaps, 4, 4, RGBA_S3TC_DXT1_Format);
    texture.minFilter = NearestMipmapNearestFilter;
    texture.magFilter = NearestFilter;
    texture.needsUpdate = true;
    textures.push(texture);
    const shader = (map: Texture, sampler: string, coordinate: string) => {
      const material = new RawShaderMaterial({
        glslVersion: GLSL3,
        uniforms: { map: { value: map }, level: { value: 0 }, layer: { value: 0 } },
        vertexShader: "precision highp float; in vec3 position; void main() { gl_Position = vec4(position, 1.0); }",
        fragmentShader: `precision highp float; precision highp ${sampler}; uniform ${sampler} map; uniform float level; uniform float layer; out vec4 color; void main() { color = textureLod(map, ${coordinate}, level); }`,
      });
      materials.push(material);
      fixture.mesh.material = material;
      return material;
    };
    const material = shader(texture, "sampler2D", "vec2(0.5)");
    fixture.sample([255, 0, 0, 255], "compressed 2D upload");
    material.uniforms.level.value = 1;
    fixture.sample([0, 255, 0, 255], "compressed explicit mip 1");
    material.uniforms.level.value = 2;
    fixture.sample([0, 0, 255, 255], "compressed explicit mip 2");
    material.uniforms.level.value = 0;
    mipmaps[0].data.set(green);
    texture.needsUpdate = true;
    fixture.sample([0, 255, 0, 255], "compressed 2D update");

    const layers = new Uint8Array(16);
    layers.set(red);
    layers.set(blue, 8);
    const array = new CompressedArrayTexture([{ width: 4, height: 4, data: layers }], 4, 4, 2, RGBA_S3TC_DXT1_Format);
    array.minFilter = array.magFilter = NearestFilter;
    array.needsUpdate = true;
    textures.push(array);
    const arrayMaterial = shader(array, "sampler2DArray", "vec3(0.5, 0.5, layer)");
    fixture.sample([255, 0, 0, 255], "compressed array layer 0");
    arrayMaterial.uniforms.layer.value = 1;
    fixture.sample([0, 0, 255, 255], "compressed array layer 1");
    layers.set(green, 8);
    array.addLayerUpdate(1);
    array.needsUpdate = true;
    fixture.sample([0, 255, 0, 255], "compressed array partial layer update");
    check(array.layerUpdates.size === 0, "Uploaded compressed array layers were not cleared");
    arrayMaterial.uniforms.layer.value = 0;
    fixture.sample([255, 0, 0, 255], "compressed array untouched layer");

    const faces = Array.from({ length: 6 }, () => ({
      width: 4,
      height: 4,
      mipmaps: [{ width: 4, height: 4, data: red.slice() }],
    }));
    const cube = new CompressedCubeTexture(faces, RGBA_S3TC_DXT1_Format);
    cube.minFilter = cube.magFilter = NearestFilter;
    cube.needsUpdate = true;
    textures.push(cube);
    shader(cube, "samplerCube", "vec3(1.0, 0.0, 0.0)");
    fixture.sample([255, 0, 0, 255], "compressed cube upload");
    faces[0].mipmaps[0].data.set(green);
    cube.needsUpdate = true;
    fixture.sample([0, 255, 0, 255], "compressed cube update");
    const before = fixture.renderer.info.memory.textures;
    for (const owned of textures) disposeGpu(fixture.renderer, owned, owned.constructor.name);
    check(fixture.renderer.info.memory.textures === before - 3, "Compressed GPU ownership leaked");
    check(
      layers.byteLength === 16 && faces[0].mipmaps[0].data[1] === 7,
      "Disposal changed caller-owned compressed bytes",
    );
    fixture.mesh.material = material;
    fixture.sample([0, 255, 0, 255], "compressed reupload after disposal");
    disposeGpu(fixture.renderer, texture, "reuploaded compressed texture");
    return {
      texture2D: true,
      mipmaps: true,
      array: true,
      partialLayerUpdate: true,
      cube: true,
      ownership: true,
      glError: fixture.gl.getError(),
    };
  } finally {
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    fixture.dispose();
  }
}

export function verifyVideoFrameTextures() {
  check(
    typeof VideoFrame === "function",
    "VideoFrameTexture fixture requires a runtime WebCodecs VideoFrame implementation",
  );
  const fixture = renderFixture();
  const source = canvasSource();
  const texture = new VideoFrameTexture();
  const frames: VideoFrame[] = [];
  try {
    fixture.map(texture);
    for (const [color, expected] of [
      ["#ff0000", [255, 0, 0, 255]],
      ["#00ff00", [0, 255, 0, 255]],
    ] as const) {
      source.fill(color);
      const frame = new VideoFrame(source.canvas, { timestamp: frames.length * 1000 });
      frames.push(frame);
      texture.setFrame(frame);
      fixture.sample([...expected], "VideoFrame upload/update");
    }
    disposeGpu(fixture.renderer, texture, "VideoFrame texture");
    fixture.sample([0, 255, 0, 255], "VideoFrame reupload after disposal");
    disposeGpu(fixture.renderer, texture, "reuploaded VideoFrame texture");
    for (const frame of frames) {
      check(frame.codedWidth === 4, "Texture replacement/disposal closed a caller-owned VideoFrame");
      const copy = frame.clone();
      copy.close();
    }
    return { upload: true, update: true, callerClosesFrames: true, glError: fixture.gl.getError() };
  } finally {
    texture.dispose();
    for (const frame of frames) frame.close();
    fixture.dispose();
  }
}

export async function verifyVideoTextures() {
  const source = canvasSource();
  check(
    typeof source.canvas.captureStream === "function",
    "VideoTexture fixture requires canvas.captureStream at runtime",
  );
  const video = document.createElement("video");
  check(
    typeof video.requestVideoFrameCallback === "function",
    "VideoTexture fixture requires requestVideoFrameCallback at runtime",
  );
  source.fill("#ff0000");
  const stream = source.canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  check(
    track && typeof track.requestFrame === "function",
    "VideoTexture fixture requires CanvasCaptureMediaStreamTrack.requestFrame",
  );
  const fixture = renderFixture();
  const texture = new VideoTexture(video);
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  const nextFrame = () =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        video.cancelVideoFrameCallback(id);
        reject(new Error("VideoTexture timed out waiting for a captured video frame"));
      }, 5000);
      const id = video.requestVideoFrameCallback(() => {
        clearTimeout(timer);
        resolve();
      });
      track.requestFrame();
    });
  try {
    fixture.map(texture);
    const firstFrame = nextFrame();
    await video.play();
    await firstFrame;
    fixture.sample([255, 0, 0, 255], "video upload", 8);
    const version = texture.version;
    source.fill("#00ff00");
    await nextFrame();
    check(texture.version > version, "Video frame callback did not request an update");
    fixture.sample([0, 255, 0, 255], "video update", 8);
    disposeGpu(fixture.renderer, texture, "video");
    const disposedVersion = texture.version;
    source.fill("#0000ff");
    await nextFrame();
    check(texture.version === disposedVersion, "VideoTexture disposal did not cancel its frame callback");
    check(
      track.readyState === "live" && video.srcObject === stream,
      "Texture disposal stopped caller-owned video media",
    );
    return { upload: true, update: true, callback: true, callerOwnsMedia: true, glError: fixture.gl.getError() };
  } finally {
    texture.dispose();
    video.pause();
    video.srcObject = null;
    for (const owned of stream.getTracks()) owned.stop();
    fixture.dispose();
  }
}

export async function runTextureChecks() {
  const canvasAndFramebuffer = verifyCanvasAndFramebufferTextures();
  const compressed = verifyCompressedTextures();
  const videoFrame = verifyVideoFrameTextures();
  const video = await verifyVideoTextures();
  return {
    canvasAndFramebuffer,
    compressed,
    videoFrame,
    video,
    glError: canvasAndFramebuffer.glError | compressed.glError | videoFrame.glError | video.glError,
  };
}
