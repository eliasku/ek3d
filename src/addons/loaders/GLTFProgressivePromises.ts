// Adapted from @needle-tools/gltf-progressive, commit 4d423859641a275d322318b0164bc6dce48d36a4.
// Copyright (c) 2026 Needle Tools; MIT license included in GLTFProgressive.ts.

export interface PromiseGroupOptions {
  name?: string;
  frames?: number;
  waitForFirstCapture?: boolean;
  signal?: AbortSignal;
  maxPromisesPerObject?: number;
}

export interface PromiseGroupResult {
  cancelled: boolean;
  awaited_count: number;
  resolved_count: number;
}

export class PromiseGroup {
  readonly ready: Promise<PromiseGroupResult>;
  private readonly resolve: (result: PromiseGroupResult) => void;
  private readonly signal: AbortSignal | undefined;
  private readonly frames: number;
  private readonly limit: number;
  private readonly seen: WeakMap<object, number> = new WeakMap();
  private start: number | undefined;
  private frame: number = 0;
  private added: number = 0;
  private resolved: number = 0;
  private pending: number = 0;
  private finished: boolean = false;

  constructor(frame: number, options: PromiseGroupOptions = {}) {
    this.frames = Math.max(2, options.frames ?? 2);
    this.limit = Math.max(1, options.maxPromisesPerObject ?? 1);
    this.start = options.waitForFirstCapture ? undefined : frame;
    this.signal = options.signal;
    let resolve!: (result: PromiseGroupResult) => void;
    this.ready = new Promise<PromiseGroupResult>((callback) => {
      resolve = callback;
    });
    this.resolve = resolve;
    this.signal?.addEventListener("abort", this.abort, { once: true });
    if (this.signal?.aborted) this.abort();
  }

  private readonly abort: () => void = () => {
    this.finish();
  };

  add(object: object, promise: Promise<unknown>): void {
    if (this.finished || (this.start !== undefined && this.frame > this.start + this.frames)) return;
    const count = this.seen.get(object) ?? 0;
    if (count >= this.limit) return;
    this.seen.set(object, count + 1);
    this.added++;
    this.pending++;
    void promise.then(
      () => {
        this.resolved++;
        this.pending--;
      },
      () => {
        this.resolved++;
        this.pending--;
      },
    );
  }

  update(frame: number): void {
    this.frame = frame;
    if (this.start === undefined && this.added > 0) this.start = frame;
    if (this.signal?.aborted || (this.pending === 0 && this.start !== undefined && frame > this.start + this.frames)) {
      this.finish();
    }
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.signal?.removeEventListener("abort", this.abort);
    this.resolve({
      cancelled: this.signal?.aborted ?? false,
      awaited_count: this.added,
      resolved_count: this.resolved,
    });
  }
}
