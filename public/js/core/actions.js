// Tiny action registry: buttons carry data-act="name"; modules register handlers with on().
const map = new Map();
export const on = (name, fn) => { map.set(name, fn); };
export async function dispatch(name, el) { const fn = map.get(name); if (fn) await fn(el); }
