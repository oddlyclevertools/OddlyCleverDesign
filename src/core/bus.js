// A tiny event bus: on(name, fn) returns an unsubscribe function; emit(name, ...args).
export function createBus() {
  const handlers = new Map();
  return {
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(fn);
      return () => handlers.get(name)?.delete(fn);
    },
    emit(name, ...args) {
      for (const fn of [...(handlers.get(name) || [])]) {
        try { fn(...args); } catch (e) { console.error(`[bus] ${name} handler failed`, e); }
      }
    },
  };
}
