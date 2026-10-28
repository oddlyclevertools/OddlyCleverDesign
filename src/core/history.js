// Undo/redo by whole-design snapshots. Simple and robust: any feature that changes the design
// just calls editor.commit(). A burst of commits with merge: true and the same label (a slider
// drag) becomes one step.
const MAX_STEPS = 80;
const MERGE_MS = 400;

export class History {
  constructor(editor) {
    this.editor = editor;
    this.stack = [];
    this.index = -1;
    this.paused = 0;
    this.lastAt = 0;
    this.lastLabel = "";
    this.busy = false;
  }

  pause() { this.paused++; }
  resume() { this.paused = Math.max(0, this.paused - 1); }

  reset() {
    this.stack = [JSON.stringify(this.editor.toJSON())];
    this.index = 0;
    this._emit();
  }

  record(label = "Edit", { merge = false } = {}) {
    if (this.paused || this.busy) return;
    const snap = JSON.stringify(this.editor.toJSON());
    if (snap === this.stack[this.index]) return;
    const now = performance.now();
    merge = merge && label === this.lastLabel && now - this.lastAt < MERGE_MS && this.index > 0
      && this.index === this.stack.length - 1;
    this.stack.length = this.index + 1;
    if (merge) this.stack[this.index] = snap;
    else this.stack.push(snap);
    if (this.stack.length > MAX_STEPS) this.stack.splice(0, this.stack.length - MAX_STEPS);
    this.index = this.stack.length - 1;
    this.lastAt = now;
    this.lastLabel = label;
    this._emit();
  }

  get canUndo() { return this.index > 0; }
  get canRedo() { return this.index < this.stack.length - 1; }

  async undo() { if (this.canUndo) await this._go(this.index - 1); }
  async redo() { if (this.canRedo) await this._go(this.index + 1); }

  async _go(i) {
    if (this.busy) return;
    this.busy = true;
    const ed = this.editor;
    const selected = new Set(ed.selection().map((o) => o.id));
    const vpt = ed.canvas.viewportTransform.slice();
    const from = this.index;
    try {
      this.index = i;
      await ed.loadJSON(JSON.parse(this.stack[i]), { keepHistory: true });
      ed.canvas.setViewportTransform(vpt);
      ed.select(ed.objects().filter((o) => selected.has(o.id)));
      this.lastLabel = "";
    } catch (e) {
      this.index = from; // the design didn't change, so neither does the position
      console.error("[history]", e);
      return;
    } finally {
      this.busy = false;
    }
    this._emit();
    ed.bus.emit("change", "History");
  }

  _emit() {
    this.editor.bus.emit("history", { canUndo: this.canUndo, canRedo: this.canRedo });
  }
}
