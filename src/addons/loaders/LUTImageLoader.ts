import { Wrapping, TextureFilter, PixelFormat, TextureType } from "../../constants";
import { Loader } from "../../loaders/Loader";
import { TextureLoader } from "../../loaders/TextureLoader";
import { Data3DTexture } from "../../textures/Data3DTexture";

/** Loads horizontal or vertical image-strip color lookup tables. */
export class LUTImageLoader extends Loader<{ size: number; texture3D: Data3DTexture }> {
  /** Flip vertically for LUT strips originating in Unity. */
  flip: boolean = false;

  override load(
    url: string,
    onLoad?: (result: { size: number; texture3D: Data3DTexture }) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const loader = new TextureLoader(this.manager);
    loader.setPriority(this.priority).setCache(this.cache).setCrossOrigin(this.crossOrigin).setPath(this.path);
    loader.load(
      url,
      (texture) => {
        try {
          const image = texture.image as HTMLImageElement;
          const size = Math.min(image.width, image.height);
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = Math.max(image.width, image.height);
          const context = canvas.getContext("2d");
          if (context === null) throw new Error("LUTImageLoader: Cannot create 2D context");
          if (this.flip) {
            context.scale(1, -1);
            context.translate(0, -canvas.height);
          }
          if (image.width < image.height) {
            context.drawImage(image, 0, 0);
          } else {
            for (let i = 0; i < size; i++) {
              const y = this.flip ? canvas.height - (i + 1) * size : i * size;
              context.drawImage(image, i * size, 0, size, size, 0, y, size, size);
            }
          }
          onLoad?.(this.parse(context.getImageData(0, 0, canvas.width, canvas.height).data, size));
        } catch (error) {
          if (onError) onError(error);
          else console.error(error);
          this.manager.itemError(url);
        } finally {
          texture.dispose();
        }
      },
      onProgress,
      onError,
    );
  }

  parse(dataArray: Uint8ClampedArray, size: number): { size: number; texture3D: Data3DTexture } {
    const texture3D = new Data3DTexture(new Uint8Array(dataArray), size, size, size);
    texture3D.format = PixelFormat.RGBA;
    texture3D.type = TextureType.UnsignedByte;
    texture3D.magFilter = texture3D.minFilter = TextureFilter.Linear;
    texture3D.wrapS = texture3D.wrapT = texture3D.wrapR = Wrapping.ClampToEdge;
    texture3D.generateMipmaps = false;
    texture3D.needsUpdate = true;
    return { size, texture3D };
  }
}
