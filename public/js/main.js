import { initTheme, nextTheme, setTheme, getTheme, THEMES } from './core/theme.js';
initTheme();
import { $, $$, ic } from './core/util.js';
import { st, route, hooks } from './core/state.js';
import { on, dispatch } from './core/actions.js';
import { confirmDlg } from './core/ui.js';
import { openDoc } from './editor.js';
import { fitPreviews } from './render.js';
import { loadConfig } from './services/api.js';
import { initKeyboard, isEnabled, setEnabled, onKeyboardChange } from './keyboard/keyboard.js';
import { refreshDocs, viewHome, viewTemplates, viewCatalog, viewProjects, viewStudio, viewSettings, viewDesign, paintLibrary } from './views/pages.js';
import './views/ai.js';
import './views/review.js';

const NAV = [['#/', 'home', 'Home', 'Home'], ['#/templates', 'tpl', 'Templates', 'Templates'], ['#/catalog', 'cat', 'Catalog', 'Catalog'], ['#/projects', 'prj', 'Projects', 'Projects'], ['#/studio', 'stu', 'Language Studio', 'Studio'], ['#/settings', 'set', 'Settings', 'Settings']];
function renderNav() {
  const r = route(), cur = r.n === 'editor' ? 'projects' : r.n === 'home' ? 'home' : r.n === 'integrations' || r.n === 'design' ? 'settings' : r.n, key = (n) => (n === '#/' ? 'home' : n.slice(2));
  $('#nav').innerHTML = NAV.map((n) => `<a class="nl" href="${n[0]}" title="${n[2]}" ${key(n[0]) === cur ? 'aria-current="page"' : ''}>${ic(n[1])}<span>${n[2]}</span></a>`).join('');
  $('#tabs').innerHTML = NAV.map((n) => `<a class="tl" href="${n[0]}" ${key(n[0]) === cur ? 'aria-current="page"' : ''}>${ic(n[1])}<span>${n[3]}</span></a>`).join('');
}
async function render() {
  renderNav(); const r = route(), m = $('#main');
  if (r.n !== 'editor') st.doc = null;
  const titles = { editor: 'Editor' };
  switch (r.n) {
    case 'home': m.innerHTML = viewHome(); break;
    case 'templates': m.innerHTML = viewTemplates(); paintLibrary(); break;
    case 'catalog': m.innerHTML = viewCatalog(); break;
    case 'projects': m.innerHTML = viewProjects(); break;
    case 'studio': m.innerHTML = viewStudio(); break;
    case 'settings': case 'integrations': { const cfg = await loadConfig(true); if (route().n === r.n) m.innerHTML = viewSettings(cfg); break; }
    case 'design': m.innerHTML = viewDesign(); break;
    case 'editor': openDoc(r.id, m); break;
    default: m.innerHTML = '<div class="page"><h1>Page not found</h1><a class="btn" href="#/">Go to Home</a></div>';
  }
  document.title = (r.n === 'editor' && st.doc ? st.doc.name + ' · ' : titles[r.n] ? '' : '') + 'AI PrintOS';
  requestAnimationFrame(fitPreviews);
}
hooks.render = render;
window.addEventListener('resize', fitPreviews);

window.addEventListener('hashchange', async () => {
  if (st.guard) { st.guard = false; return; }
  const leaving = st.dirty && st.doc && !(route().n === 'editor' && route().id === st.doc.id);
  if (leaving) {
    const target = location.hash; st.guard = true; location.hash = st.prevHash;
    if (await confirmDlg('Discard unsaved changes?', 'This design has changes that were not saved. Leaving now will lose them.', 'Discard changes')) { st.dirty = false; st.guard = true; location.hash = target; st.prevHash = target; render(); }
    return;
  }
  st.prevHash = location.hash || '#/'; render();
});
document.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) dispatch(b.dataset.act, b); });
$('#skip').addEventListener('click', (e) => { e.preventDefault(); $('#main').focus(); });

/* keyboard toggle in the top bar */
const kbBtn = $('#kbToggle');
const paintKb = () => { kbBtn.setAttribute('aria-pressed', String(isEnabled())); kbBtn.title = isEnabled() ? 'On-screen keyboard is on. Click to turn off.' : 'Turn on the on-screen keyboard (English / Telugu)'; };
on('kbd-toggle', () => { setEnabled(!isEnabled()); paintKb(); });
onKeyboardChange(paintKb);
initKeyboard(); paintKb();

const paintTheme = () => { $('#themeName').textContent = THEMES.find((t) => t.id === getTheme()).name; };
on('theme-next', () => { nextTheme(); paintTheme(); if (['settings', 'design'].includes(route().n)) render(); });
on('theme-set', (b) => { setTheme(b.dataset.id); paintTheme(); render(); });
paintTheme();

refreshDocs(); st.prevHash = location.hash || '#/'; render();
