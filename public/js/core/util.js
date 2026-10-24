export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const hasTe = (s) => /[\u0C00-\u0C7F]/.test(s);
export const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'design';
export const mmToPx = (mm) => Math.round((mm / 25.4) * 96);

const IC = {
  home: 'M3 11 12 3l9 8M5 10v10h5v-6h4v6h5V10', tpl: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  cat: 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10', prj: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  stu: 'M4 7V4h16v3M12 4v16M9 20h6', plug: 'M9 3v5M15 3v5M7 8h10v4a5 5 0 0 1-10 0zM12 17v4',
  set: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  plus: 'M12 5v14M5 12h14', copy: 'M9 9h10v11H9zM5 15V4h10', dl: 'M12 4v11M7 11l5 5 5-5M5 20h14', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  up: 'M12 16V5M7 9l5-5 5 5M5 20h14', spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', back: 'M19 12H5M11 6l-6 6 6 6',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3', redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3', txt: 'M5 6V4h14v2M12 4v16M9 20h6',
  rect: 'M4 5h16v14H4z', ell: 'M12 4a8 7 0 1 0 0 14 8 7 0 0 0 0-14z', img: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01',
  fwd: 'M12 19V5M6 11l6-6 6 6', bwd: 'M12 5v14M6 13l6 6 6-6', save: 'M5 4h12l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  kbd: 'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8', ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6', refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7'
};
export const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[n]}"/></svg>`;
