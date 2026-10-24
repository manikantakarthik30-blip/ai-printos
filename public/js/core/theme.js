// Theme switcher: themes are CSS custom-property sets in css/themes.css (documented in DESIGN.md).
export const THEMES = [
  { id: 'studio', name: 'Studio', note: 'Default light, magenta accent', dots: ['#f4f5f8', '#ffffff', '#15171f', '#c21a5e'] },
  { id: 'blueprint', name: 'Blueprint', note: 'Technical, grid paper, monospace, sharp corners', dots: ['#eef4fa', '#fbfdff', '#0f2a43', '#0b5cad'] },
  { id: 'void', name: 'Void', note: 'Dark, terminal-style, emerald accent', dots: ['#090d0b', '#111816', '#e8f1ec', '#34d399'] },
  { id: 'paper', name: 'Warm Paper', note: 'Cream, serif headings, rounded', dots: ['#f7f1e6', '#fffaf1', '#2b2118', '#a63d2a'] }
];
const KEY = 'aiprintos:v1:theme';
export const getTheme = () => document.documentElement.dataset.theme || 'studio';
export function setTheme(id) {
  if (!THEMES.some((t) => t.id === id)) return;
  document.documentElement.dataset.theme = id;
  try { localStorage.setItem(KEY, id); } catch { /* preference just won't persist */ }
}
export const nextTheme = () => setTheme(THEMES[(THEMES.findIndex((t) => t.id === getTheme()) + 1) % THEMES.length].id);
export function initTheme() {
  let id = 'studio';
  try { id = localStorage.getItem(KEY) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'void' : 'studio'); } catch { /* default */ }
  document.documentElement.dataset.theme = THEMES.some((t) => t.id === id) ? id : 'studio';
}
