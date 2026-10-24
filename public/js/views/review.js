// "Review text" dialog: shows issues found by services/textcheck.js. Nothing changes until you press a fix button.
import { esc } from '../core/util.js';
import { st } from '../core/state.js';
import { on } from '../core/actions.js';
import { openDlg, dlg, toast } from '../core/ui.js';
import { mutate, renderStage, renderInsp } from '../editor.js';
import { reviewText, applyIssue, loadEnglishDict } from '../services/textcheck.js';

let dict = null, dictErr = '', rows = []; const ignore = new Set();

function scan() {
  rows = [];
  for (const e of st.doc.els) if (e.type === 'text') for (const issue of reviewText(e.text, dict, ignore)) { const key = `${e.id}:${issue.type}:${issue.start}:${e.text.slice(issue.start, issue.end)}`; if (!ignore.has(key)) rows.push({ id: e.id, name: e.text.split('\n')[0].slice(0, 40) || e.name, text: e.text, issue, key }); }
}
const snippet = (r) => { const t = r.text, a = r.issue.start, b = r.issue.end; return `${esc(t.slice(Math.max(0, a - 18), a))}<mark>${esc(t.slice(a, b) || '␣')}</mark>${esc(t.slice(b, b + 18))}`; };
function paint() {
  const head = `<p class="hint"><strong>What this checks (all on your device):</strong> English spelling against the bundled en_US dictionary${dict ? '' : ' (<span class="err">dictionary unavailable: ' + esc(dictErr) + '</span>)'}; Telugu and Hindi Unicode problems (stray vowel signs, repeated joiners, mixed scripts, normalization); repeated spaces and spacing before punctuation. Names, numbers, dates, prices, phone numbers, emails, URLs and product codes are skipped.
  <br><strong>Not available:</strong> Telugu/Hindi spelling dictionaries (the open ones are GPL-licensed and not bundled) and grammar review. No text leaves your device.</p>`;
  const list = rows.length ? `<ul class="rv">${rows.map((r, i) => `<li><div class="cm">Layer: ${esc(r.name)} · ${esc(r.issue.type)}</div><div class="ctx"${/[\u0C00-\u0DFF]/.test(r.text) ? ' lang="te"' : ''}>${snippet(r)}</div><div>${esc(r.issue.message)}</div>
   <div class="chips">${(r.issue.suggestions || []).map((s, k) => `<button class="btn s" data-act="rv-apply" data-i="${i}" data-s="${k}">Change to “${esc(s)}”</button>`).join('')}${typeof r.issue.suggestion === 'string' ? `<button class="btn s" data-act="rv-apply" data-i="${i}" data-s="-1">${r.issue.type === 'normalization' ? 'Normalize' : r.issue.suggestion ? 'Fix' : 'Remove'}</button>` : ''}<button class="btn q s" data-act="rv-ignore" data-i="${i}">Ignore</button></div></li>`).join('')}</ul>` : '<div class="note"><p>No issues found in the text layers.</p></div>';
  openDlg('Review text', head + list + '<div class="da"><button class="btn p" data-act="dclose">Done</button></div>');
}
on('review', async () => {
  if (!st.doc.els.some((e) => e.type === 'text')) return toast('This design has no text layers to review.', true);
  if (!dict && !dictErr) { try { dict = await loadEnglishDict(); } catch (e) { dictErr = e.message; } }
  scan(); paint();
});
on('rv-apply', (b) => {
  const r = rows[+b.dataset.i], el = r && st.doc.els.find((e) => e.id === r.id); if (!el || el.text !== r.text) { scan(); return paint(); }
  const k = +b.dataset.s, repl = k < 0 ? r.issue.suggestion : r.issue.suggestions[k];
  mutate(() => { el.text = applyIssue(el.text, r.issue, repl); }); renderStage(); renderInsp(); scan(); paint();
});
on('rv-ignore', (b) => { const r = rows[+b.dataset.i]; if (!r) return; ignore.add(r.key); if (r.issue.type === 'spelling') ignore.add(r.issue.word.toLowerCase()); scan(); paint(); });
void dlg;
