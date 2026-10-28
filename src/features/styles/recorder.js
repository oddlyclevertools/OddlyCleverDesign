// A change recorder: sets properties on Fabric objects and remembers the first value of each,
// so a hover preview can be undone exactly (restore) or kept (the caller commits).
// Values are replaced, never mutated in place, so the remembered originals stay pristine.

export class Recorder {
  constructor(canvas) {
    this.canvas = canvas;
    this.saved = new Map(); // obj -> Map(prop -> original value)
  }

  /** Set obj[prop] = value, remembering the value it had before the first change. */
  set(obj, prop, value) {
    let props = this.saved.get(obj);
    if (!props) this.saved.set(obj, props = new Map());
    if (!props.has(prop)) props.set(prop, obj[prop]);
    obj.set(prop, value);
    obj.dirty = true;
  }

  get size() { return this.saved.size; }

  /** Put every recorded property back. */
  restore() {
    for (const [obj, props] of this.saved) {
      for (const [prop, value] of props) obj.set(prop, value);
      obj.initDimensions?.();
      obj.setCoords();
      obj.dirty = true;
    }
    refitGroups([...this.saved.keys()]);
    this.saved.clear();
    this.canvas.requestRenderAll();
  }
}

/** Refit the bounds of every group that holds one of `objs` (inner groups first). */
export function refitGroups(objs) {
  const set = new Set();
  for (const o of objs) for (let g = o.parent; g; g = g.parent) set.add(g);
  const depth = (g) => { let d = 0; for (let p = g.parent; p; p = p.parent) d++; return d; };
  for (const g of [...set].sort((a, b) => depth(b) - depth(a))) {
    g.triggerLayout?.();
    g.setCoords();
    g.dirty = true;
  }
}
