/**
 * A simple performance monitor: FPS, millisecond and memory panels drawn on stacked
 * canvases. Click or call `showPanel()` to cycle panels. Port of the stats.js r16 module
 * used by upstream examples; the class form replaces the closure-based original.
 */
export class Stats {
  REVISION: string = "16";

  /** The outermost container element. */
  domElement: HTMLDivElement;

  /**
   * The container element; identical to `domElement`.
   */
  dom: HTMLDivElement;

  _panels: StatsPanel[];

  /** Index of the visible panel. */
  mode: number;

  _beginTime: number;
  _prevTime: number;
  _frames: number;

  _fpsPanel: StatsPanel;
  _msPanel: StatsPanel;
  _memPanel: StatsPanel | undefined;

  /** `begin()` stored for the `update()` shorthand. */
  _updateBound: () => void;

  _onClick: (event: MouseEvent) => void;

  /**
   * Constructs the statistics panel and appends nothing; callers add `stats.dom` themselves.
   */
  constructor() {
    this.mode = 0;

    const container = document.createElement("div");
    container.style.cssText = "position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000";

    this._panels = [];
    this._onClick = (event: MouseEvent) => {
      event.preventDefault();
      this.showPanel(++this.mode % container.children.length);
    };
    container.addEventListener("click", this._onClick, false);

    this.domElement = container;
    this.dom = container;

    this._beginTime = (performance || Date).now();
    this._prevTime = this._beginTime;
    this._frames = 0;

    this._fpsPanel = this.addPanel(new StatsPanel("FPS", "#0ff", "#002"));
    this._msPanel = this.addPanel(new StatsPanel("MS", "#0f0", "#020"));

    const perfWithMemory = self.performance as Performance & {
      memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
    };
    if (perfWithMemory && perfWithMemory.memory) {
      this._memPanel = this.addPanel(new StatsPanel("MB", "#f08", "#201"));
    }

    this.showPanel(0);

    this._updateBound = () => {
      this._beginTime = this.end();
    };
  }

  /** Adds a panel to the container and returns it. */
  addPanel(panel: StatsPanel): StatsPanel {
    this.domElement.appendChild(panel.dom);
    return panel;
  }

  /** Shows the panel with the given index, hiding the others. */
  showPanel(id: number): void {
    const children = this.domElement.children;
    for (let i = 0; i < children.length; i++) {
      (children[i] as HTMLElement).style.display = i === id ? "block" : "none";
    }

    this.mode = id;
  }

  /** Starts a timing span. */
  begin(): void {
    this._beginTime = (performance || Date).now();
  }

  /** Ends the timing span, updates panels and returns the current timestamp. */
  end(): number {
    this._frames++;

    const time = (performance || Date).now();

    this._msPanel.update(time - this._beginTime, 200);

    if (time >= this._prevTime + 1000) {
      this._fpsPanel.update((this._frames * 1000) / (time - this._prevTime), 100);

      this._prevTime = time;
      this._frames = 0;

      if (this._memPanel) {
        const memory = (
          self.performance as Performance & { memory: { usedJSHeapSize: number; jsHeapSizeLimit: number } }
        ).memory;
        this._memPanel.update(memory.usedJSHeapSize / 1048576, memory.jsHeapSizeLimit / 1048576);
      }
    }

    return time;
  }

  /** Shorthand for a per-frame `end()` followed by `begin()`. */
  update(): void {
    this._updateBound();
  }
}

/** Canvas-drawn graph panel showing a value with min/max history. */
export class StatsPanel {
  /** The canvas element showing this panel. */
  dom: HTMLCanvasElement;

  _name: string;
  _fg: string;
  _bg: string;

  _min: number;
  _max: number;

  _PR: number;
  _WIDTH: number;
  _HEIGHT: number;
  _TEXT_X: number;
  _TEXT_Y: number;
  _GRAPH_X: number;
  _GRAPH_Y: number;
  _GRAPH_WIDTH: number;
  _GRAPH_HEIGHT: number;

  _context: CanvasRenderingContext2D;

  /**
   * Constructs a panel.
   *
   * @param name - Panel label.
   * @param fg - Foreground color.
   * @param bg - Background color.
   */
  constructor(name: string, fg: string, bg: string) {
    this._name = name;
    this._fg = fg;
    this._bg = bg;
    this._min = Infinity;
    this._max = 0;

    const round = Math.round;
    const PR = round(window.devicePixelRatio || 1);
    this._PR = PR;

    const WIDTH = 80 * PR,
      HEIGHT = 48 * PR;
    const TEXT_X = 3 * PR,
      TEXT_Y = 2 * PR;
    const GRAPH_X = 3 * PR,
      GRAPH_Y = 15 * PR;
    const GRAPH_WIDTH = 74 * PR,
      GRAPH_HEIGHT = 30 * PR;
    this._WIDTH = WIDTH;
    this._HEIGHT = HEIGHT;
    this._TEXT_X = TEXT_X;
    this._TEXT_Y = TEXT_Y;
    this._GRAPH_X = GRAPH_X;
    this._GRAPH_Y = GRAPH_Y;
    this._GRAPH_WIDTH = GRAPH_WIDTH;
    this._GRAPH_HEIGHT = GRAPH_HEIGHT;

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas.style.cssText = "width:80px;height:48px";
    this.dom = canvas;

    const context = canvas.getContext("2d")!;
    this._context = context;
    context.font = `bold ${9 * PR}px Helvetica,Arial,sans-serif`;
    context.textBaseline = "top";

    context.fillStyle = bg;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.fillStyle = fg;
    context.fillText(name, TEXT_X, TEXT_Y);
    context.fillRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);

    context.fillStyle = bg;
    context.globalAlpha = 0.9;
    context.fillRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);
  }

  /**
   * Pushes a value onto the graph.
   *
   * @param value - The measured value.
   * @param maxValue - The scale maximum.
   */
  update(this: StatsPanel, value: number, maxValue: number): void {
    this._min = Math.min(this._min, value);
    this._max = Math.max(this._max, value);

    const context = this._context;
    const round = Math.round;

    context.fillStyle = this._bg;
    context.globalAlpha = 1;
    context.fillRect(0, 0, this._WIDTH, this._GRAPH_Y);
    context.fillStyle = this._fg;
    context.fillText(
      `${round(value)} ${this._name} (${round(this._min)}-${round(this._max)})`,
      this._TEXT_X,
      this._TEXT_Y,
    );

    context.drawImage(
      this.dom,
      this._GRAPH_X + this._PR,
      this._GRAPH_Y,
      this._GRAPH_WIDTH - this._PR,
      this._GRAPH_HEIGHT,
      this._GRAPH_X,
      this._GRAPH_Y,
      this._GRAPH_WIDTH - this._PR,
      this._GRAPH_HEIGHT,
    );

    context.fillRect(this._GRAPH_X + this._GRAPH_WIDTH - this._PR, this._GRAPH_Y, this._PR, this._GRAPH_HEIGHT);

    context.fillStyle = this._bg;
    context.globalAlpha = 0.9;
    context.fillRect(
      this._GRAPH_X + this._GRAPH_WIDTH - this._PR,
      this._GRAPH_Y,
      this._PR,
      round((1 - value / maxValue) * this._GRAPH_HEIGHT),
    );
  }
}
