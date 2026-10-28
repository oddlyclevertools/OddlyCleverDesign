// What the Bulk Create panel and toolbar share: the loaded table and the column links, per design.
const listeners = new Set();
let state = { projectId: null, table: null, links: {}, fit: true, source: "" };

export const getState = () => state;
export function onState(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Replace part of the state (never mutated in place) and tell the panel and toolbar. */
export function setState(patch) {
  state = { ...state, ...patch };
  for (const fn of [...listeners]) fn(state);
}

/** Links belong to one design: switching designs starts fresh (the table stays). */
export function forProject(id) {
  if (state.projectId !== id) setState({ projectId: id, links: {} });
  return state;
}

export function setLink(key, column) {
  const links = { ...state.links };
  if (column) links[key] = column; else delete links[key];
  setState({ links });
}
