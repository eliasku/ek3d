export class Hud {
  private overlay: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private expanded: boolean;

  constructor(overlay: HTMLCanvasElement) {
    this.overlay = overlay;
    this.context = overlay.getContext("2d")!;
    this.expanded = false;
    this.toggle = this.toggle.bind(this);
    this.hitTitle = this.hitTitle.bind(this);
    this.draw = this.draw.bind(this);
  }

  private width() {
    return Math.max(0, Math.min(this.expanded ? 740 : 570, this.overlay.width - 24));
  }

  toggle() {
    this.expanded = !this.expanded;
  }

  hitTitle(clientX: number, clientY: number) {
    const rect = this.overlay.getBoundingClientRect();
    const x = ((clientX - rect.left) * this.overlay.width) / rect.width;
    const y = ((clientY - rect.top) * this.overlay.height) / rect.height;
    return x >= 12 && x <= 12 + this.width() && y >= 12 && y < 38;
  }

  draw(details: string[], status: string, assets: string) {
    const title = `ek3d · Help [${this.expanded ? "−" : "+"}] · click here / ?`;
    const lines = this.expanded
      ? [title, ...details]
      : [title, "Drag: orbit · Wheel: zoom · Space: pause · P: materials", status, assets];
    this.context.clearRect(0, 0, this.overlay.width, this.overlay.height);
    this.context.fillStyle = "#101b2be8";
    this.context.fillRect(12, 12, this.width(), lines.length * 18 + 16);
    this.context.fillStyle = "#edf5ff";
    this.context.font = "12px monospace";
    for (let i = 0; i < lines.length; i++) {
      this.context.fillText(lines[i], 24, 32 + i * 18, Math.max(1, this.width() - 24));
    }
  }
}
