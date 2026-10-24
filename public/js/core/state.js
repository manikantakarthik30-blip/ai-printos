// Shared mutable app state and cross-module hooks (avoids circular imports).
export const st = {
  docs: [], listErr: '', doc: null, sel: null, undo: [], redo: [], dirty: false, lastKey: '', lastT: 0,
  tplCat: 'all', tplQ: '', catGroup: 'all', catQ: '', scale: 1, prevHash: '#/', guard: false,
  ai: { status: 'idle', prompt: '', aspect: '1:1', image: null, error: null, ctl: null },
  config: null, guides: false, phTarget: null,
  lib: { status: 'idle', manifest: null, cat: 'all', q: '', lang: 'all', layout: 'all', tone: 'all', page: 1, err: '' }
};
export const hooks = { render: () => {} };
export function route() {
  const h = location.hash || '#/';
  const p = h.replace(/^#/, '').split('?')[0].split('/').filter(Boolean);
  return p.length ? { n: p[0], id: p[1] && decodeURIComponent(p[1]) } : { n: 'home' };
}
