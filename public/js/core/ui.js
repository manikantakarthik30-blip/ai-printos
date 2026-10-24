import { $, esc, ic } from './util.js';

export const dlg = $('#dlg');
export const toast = (m, e) => {
  const d = document.createElement('div'); d.className = 'toast' + (e ? ' e' : ''); d.textContent = m;
  d.setAttribute('role', e ? 'alert' : 'status'); $('#toasts').append(d); setTimeout(() => d.remove(), e ? 9000 : 4500);
};
export function openDlg(title, body) {
  const vk = document.getElementById('vk'); if (vk && dlg.contains(vk)) document.body.append(vk); // keep the keyboard alive when dialog content is replaced
  dlg.innerHTML = `<div class="db"><div class="head"><h2 id="dt">${esc(title)}</h2><button class="btn q i" data-act="dclose" aria-label="Close">${ic('plus').replace('<path', '<path transform="rotate(45 12 12)"')}</button></div>${body}</div>`;
  if (!dlg.open) dlg.showModal();
}
export const confirmDlg = (title, body, label) => new Promise((res) => {
  openDlg(title, `<p>${esc(body)}</p><div class="da"><button class="btn" data-act="dclose">Cancel</button><button class="btn d" data-act="dyes">${esc(label)}</button></div>`);
  dlg.dataset.res = '';
  const onc = () => { dlg.removeEventListener('close', onc); res(dlg.dataset.res === '1'); };
  dlg.addEventListener('close', onc);
});
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

export function downloadBlob(name, blob) {
  const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000);
}
export const downloadText = (name, text, mime) => downloadBlob(name, new Blob([text], { type: mime }));
