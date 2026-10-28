import { AudioContext } from "../audio/AudioContext";
import { error } from "../utils";
import { FileLoader } from "./FileLoader";
import { Loader } from "./Loader";

/** Loads and decodes audio without detaching FileLoader's cached buffer. */
export class AudioLoader extends Loader<AudioBuffer> {
  load(
    url: string,
    onLoad?: (buffer: AudioBuffer) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setResponseType("arraybuffer");
    loader.setPath(this.path);
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    const handleError = (cause: unknown): void => {
      if (onError) onError(cause);
      else error(cause);
      this.manager.itemError(url);
    };
    loader.load(
      url,
      (buffer) => {
        const decodeUrl = `${url}#decode`;
        let started = false;
        try {
          if (!(buffer instanceof ArrayBuffer)) throw new Error("AudioLoader: expected an ArrayBuffer");
          const bufferCopy = buffer.slice(0);
          const context = AudioContext.getContext();
          this.manager.itemStart(decodeUrl);
          started = true;
          void context
            .decodeAudioData(bufferCopy)
            .then((decoded) => onLoad?.(decoded))
            .catch(handleError)
            .finally(() => this.manager.itemEnd(decodeUrl));
        } catch (cause) {
          try {
            handleError(cause);
          } finally {
            if (started) this.manager.itemEnd(decodeUrl);
          }
        }
      },
      onProgress,
      onError,
    );
  }
}
