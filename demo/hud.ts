export function createHud(overlay: HTMLCanvasElement) {
  const context = overlay.getContext("2d")!;
  let expanded = false;

  function width() {
    return Math.max(0, Math.min(expanded ? 740 : 570, overlay.width - 24));
  }

  return {
    toggle() {
      expanded = !expanded;
    },
    hitTitle(clientX: number, clientY: number) {
      const rect = overlay.getBoundingClientRect();
      const x = ((clientX - rect.left) * overlay.width) / rect.width;
      const y = ((clientY - rect.top) * overlay.height) / rect.height;
      return x >= 12 && x <= 12 + width() && y >= 12 && y < 38;
    },
    draw(details: string[], status: string, assets: string) {
      const title = `ek3d · Help [${expanded ? "−" : "+"}] · click here / ?`;
      const lines = expanded
        ? [title, ...details]
        : [title, "Drag: orbit · Wheel: zoom · Space: pause · P: materials", status, assets];
      context.clearRect(0, 0, overlay.width, overlay.height);
      context.fillStyle = "#101b2be8";
      context.fillRect(12, 12, width(), lines.length * 18 + 16);
      context.fillStyle = "#edf5ff";
      context.font = "12px monospace";
      for (let i = 0; i < lines.length; i++) {
        context.fillText(lines[i], 24, 32 + i * 18, Math.max(1, width() - 24));
      }
    },
  };
}
