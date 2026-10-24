# Licence audit of the referenced resources

Audited 2026-10-22 by reading each repository's LICENSE file on raw.githubusercontent.com (the GitHub API was rate-limited). Licence text was read, not assumed. **Nothing from these repositories is included in the templates.** The 500 templates are original work.

| Resource | Licence found | Decision | Why |
|---|---|---|---|
| CaptExcellent/kits-library-assets | CC0-1.0 | Approved, **not imported** | Hand-drawn game-style illustrations, not print templates. Safe to add later; keep attribution fields empty (CC0). |
| Xcrysdale/Open-Templates-Cricut | GPL-3.0 | **Excluded** | Strong copyleft: bundling would force the combined work under GPL-3.0. |
| richrdkng/adobe-illustrator-templates | CC0-1.0 | **Excluded** | Native `.ai` files; they cannot be loaded or edited in a browser editor, and converting them was not verified. |
| ZaparooProject/zaparoo-designer | GPL-3.0 | **Excluded** | Strong copyleft (and application code, not artwork). |
| sketchvalley.com/free-templates | Not checked | **Excluded** | Website terms were not reviewed, and scraping was out of scope. Review its terms before any use. |
| hunspell/hunspell | GPL-2.0 (the C++ engine) | **Not used** | Only the file format is used (see en_US below); no Hunspell code is bundled. |
| LibreOffice/dictionaries (repo root) | no top-level licence | Per-dictionary review | Each language folder carries its own licence. |
| ... `en/` en_US | SCOWL licence (permissive; includes public-domain parts) | **Bundled** (expanded word list, 121,252 words) | Notice kept in `public/data/dict/en_US.README.txt`; see THIRD_PARTY_NOTICES.md. |
| ... `te_IN/`, `hi_IN/` | GPL | **Not bundled** | Copyleft, and 3–5 MB each. Telugu/Hindi spelling is therefore not offered. |
| AI4Bharat/indicnlp_catalog | no LICENSE file | **Not used** | It is a catalogue of links; no licence to rely on. |
| GokulNC/Indic-NLP-Library | MIT | **Not used** | Python library; its transliteration/normalization ideas were not needed in the browser. |

## What is bundled from third parties
* Noto Sans / Noto Serif for Telugu and Devanagari: SIL Open Font License 1.1 (`public/fonts/OFL.txt`).
* Hunspell en_US dictionary data (SCOWL): `public/data/dict/en_US.README.txt`.

## Before adding any new resource
1. Read its LICENSE and any per-folder licences. 2. Record the licence and attribution in the template's `provenance` and `licence` manifest fields. 3. Reject copyleft (GPL/AGPL/CC-BY-SA) material unless you accept its obligations, and reject anything without a licence.
