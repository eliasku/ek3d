export class WebGLAnimation {
  private context: AnimationFrameProvider | null = null;
  private isAnimating: boolean = false;
  private animationLoop: FrameRequestCallback | null = null;
  private requestId: number | null = null;

  constructor() {
    this.onAnimationFrame = this.onAnimationFrame.bind(this);
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.setAnimationLoop = this.setAnimationLoop.bind(this);
    this.setContext = this.setContext.bind(this);
  }

  private onAnimationFrame(time: number): void {
    this.requestId = this.context!.requestAnimationFrame(this.onAnimationFrame);
    const animationLoop = this.animationLoop!;
    animationLoop(time);
  }

  start(): void {
    if (this.isAnimating === true) return;
    if (this.animationLoop === null) return;
    if (this.context === null) return;
    this.requestId = this.context.requestAnimationFrame(this.onAnimationFrame);
    this.isAnimating = true;
  }

  stop(): void {
    if (this.context !== null) this.context.cancelAnimationFrame(this.requestId!);
    this.isAnimating = false;
  }

  setAnimationLoop(callback: FrameRequestCallback | null): void {
    this.animationLoop = callback;
  }

  setContext(value: AnimationFrameProvider | null): void {
    this.context = value;
  }
}
