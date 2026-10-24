// Shared rendering of design elements: used by the live stage and by card thumbnails.
import { $, $$, esc, hasTe } from './core/util.js';
import { FONTS } from './model.js';

export function elHTML(e, sel) {
  const b = `left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;opacity:${e.opacity};`;
  const h = sel ? '<i class="hd" data-h="1"></i>' : '', c = `el${sel ? ' sel' : ''}`;
  if (e.type === 'text') return `<div class="${c}" data-id="${e.id}"${hasTe(e.text) ? ' lang="te"' : ''} style="${b}font-family:${FONTS[e.font]};font-size:${e.size}px;font-weight:${e.weight};color:${e.color};text-align:${e.align};line-height:${e.lh};white-space:pre-wrap;overflow-wrap:break-word">${esc(e.text)}${h}</div>`;
  if (e.type === 'shape') return `<div class="${c}" data-id="${e.id}" style="${b}background:${e.fill};${e.sw ? `border:${e.sw}px solid ${e.stroke};` : ''}border-radius:${e.shape === 'ellipse' ? '50%' : e.radius + 'px'}">${h}</div>`;
  return `<div class="${c}" data-id="${e.id}" style="${b}"><img src="${esc(e.src)}" alt="${esc(e.alt)}" style="object-fit:${e.fit}">${h}</div>`;
}
export const pvHTML = (d) => `<div class="pv" role="img" aria-label="${esc(d.name)}" data-w="${d.w}" data-h="${d.h}" style="background:${d.bg}"><div class="stg" aria-hidden="true" style="width:${d.w}px;height:${d.h}px">${d.els.map((e) => elHTML(e, false)).join('')}</div></div>`;
export function fitPreviews() {
  $$('.frame').forEach((f) => {
    const pv = $('.pv', f); if (!pv) return;
    const w = +pv.dataset.w, h = +pv.dataset.h, side = f.clientWidth - 20; if (side <= 0) return;
    const r = w / h, pw = r >= 1 ? side : side * r, ph = pw / r;
    pv.style.width = pw + 'px'; pv.style.height = ph + 'px'; $('.stg', pv).style.transform = `scale(${pw / w})`;
  });
}
