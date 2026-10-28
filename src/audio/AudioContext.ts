let context: globalThis.AudioContext | undefined;

/** Shared native context. Consumers may supply their own before creating audio objects. */
export class AudioContext {
  static getContext(): globalThis.AudioContext {
    if (context === undefined) {
      const browser = window as Window & typeof globalThis & { webkitAudioContext?: typeof globalThis.AudioContext };
      const Context = browser.AudioContext || browser.webkitAudioContext;
      if (!Context) throw new Error("Web Audio is not supported");
      context = new Context();
    }
    return context;
  }
  static setContext(value: globalThis.AudioContext): void {
    context = value;
  }
}
