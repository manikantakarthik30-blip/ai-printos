# AI PrintOS DESIGN.md

Design system for AI PrintOS, written in the nine-section DESIGN.md format popularised by the awesome-design-md collection. Pure HTML + CSS + vanilla JS: every value below is a CSS custom property in `public/css/app.css` (default theme) or `public/css/themes.css` (other themes). Change a token there and the whole app follows. The built-in page `#/design` shows these tokens live.

## 1. Visual Theme & Atmosphere
A calm, tool-first workspace for people making printed material in English and Telugu. Content (the design canvas) is the hero; chrome stays quiet. Medium density, generous touch targets, no decorative animation. Four themes: **Studio** (default light, magenta accent), **Blueprint** (technical grid paper, monospace, 2px corners), **Void** (dark, emerald accent), **Warm Paper** (cream, serif headings, 12px corners). Telugu and Latin text must look equally first-class.

## 2. Color Palette & Roles (Studio)
| Token | Value | Role |
|---|---|---|
| `--paper` | #f4f5f8 | Page background |
| `--surf` | #ffffff | Cards, inputs, dialogs, top bar |
| `--ink` / `--ink2` / `--ink3` | #15171f / #4a4f5e / #6b7080 | Primary / secondary / muted text (all ≥ 4.5:1 on surfaces) |
| `--line` | #dadde5 | Borders and dividers |
| `--mag` (`--mag2` hover) | #c21a5e (#a8134f) | Primary action, active nav marker |
| `--cyan`, `--yel` | #007c99, #f5c400 | Secondary accent, highlight |
| `--danger`, `--focus` | #b3261e, #0a6cff | Errors, focus ring |
| `--on-accent` | #ffffff | Text on `--mag` |
| `--side-bg`, `--side-fg`, `--side-fg2` | #15171f, #e9ebf2, #c8ccda | Sidebar |
| `--chip`, `--sel`, `--canvas` | #e8eaf0, #eaf1ff, #e3e6ed | Neutral chip, selected row, editor backdrop |
Never hard-code colors in components: use tokens so every theme works.

## 3. Typography Rules
`--font`: system-ui stack with Telugu fallbacks (Noto Sans Telugu, Nirmala UI, Gautami, Telugu Sangam MN). `--head` equals `--font` except Warm Paper (Georgia/serif). Body 16px, line-height 1.5 minimum (Telugu needs it), hints 13–14px, labels 600–700 weight. Headings: h1 ~1.75rem, h2 ~1.125rem. Mark Telugu runs with `lang="te"`.

## 4. Component Stylings
Buttons `.btn` (36–44px tall, 1px border, `--r` radius): `.p` primary (accent fill, `--on-accent` text), `.d` danger, `.q` quiet, `.i` icon-only (needs `aria-label`). Inputs `.fld` (label above, 1px `--line`, 3px focus ring in `--focus`). Cards `.card`/`.panel` (surface, 1px border, no shadow). Chips `.chip` toggle with `aria-pressed`. Badges `.bdg` (`.live`, `.off`, `.sample`). Dialogs use native `<dialog>`. Toasts bottom-centre, `role=status` or `alert`. The virtual keyboard is always dark glass (see section 6).

## 5. Layout Principles
App shell: fixed 232px sidebar (72px icons on tablets, bottom tab bar on phones), sticky 64px top bar, content `.page` max ~1200px. Spacing scale 4/8/12/16/24/32. Cards in auto-fill grids (min ~220px). Editor: toolbar on top, canvas left, 300px inspector right (stacks below on narrow screens).

## 6. Depth & Elevation
Flat by default: borders, not shadows. Exceptions: dialogs (backdrop dim), toasts, and the **glassmorphism keyboard**: `rgba(21,23,31,.82)` over a faint white gradient, `backdrop-filter: blur(22px) saturate(170%)`, 1px translucent white border, soft 50px shadow. Falls back to a solid `rgba(21,23,31,.96)` when `backdrop-filter` is unsupported or `prefers-reduced-transparency` is set.

## 7. Do's and Don'ts
Do: use tokens; keep touch targets ≥ 44px on phones; label icon buttons; keep error text specific and actionable; show real status (never fake integrations). Don't: add fake reviews/testimonials; hard-code hex colors; rely on color alone; add motion beyond the 160ms keyboard fade (honor `prefers-reduced-motion`); use frameworks or build steps.

## 8. Responsive Behavior
Breakpoints: ≤1023px collapses the sidebar to icons; ≤767px swaps it for the bottom tab bar and shrinks the top bar; ≤480px tightens keyboard keys. The keyboard is full-width on phones, max 760px and centred on desktop; the page gains bottom padding equal to the keyboard height (`--kb-h`) so fields are never covered.

## 9. Agent Prompt Guide
"Build/extend a page for AI PrintOS using only HTML, CSS and vanilla JS. Use the CSS variables from `public/css/app.css` and `themes.css`; do not introduce new colors. Reuse `.btn`, `.fld`, `.panel`, `.card`, `.chip`, `.bdg`. Keep Telugu text in `lang="te"` with line-height ≥ 1.5. Verify all four themes (`data-theme` = studio, blueprint, void, paper) and that text contrast stays ≥ 4.5:1. To add a theme: copy a block in `themes.css`, add it to `js/core/theme.js`."
