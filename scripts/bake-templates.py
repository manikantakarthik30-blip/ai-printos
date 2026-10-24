"""Renders every template in a real browser (bundled Noto fonts) to produce, per template:
   <id>.svg  (editable vector export), <id>.webp (preview), and records the text-fit result in manifest.json.
Requires: Python 3 + `pip install playwright` + `playwright install chromium`, and the dev server running
(`node scripts/dev-server.js`).  Usage: python3 scripts/bake-templates.py [http://localhost:3000]"""
import asyncio, base64, json, sys, pathlib
from xml.dom import minidom
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000'
PUB = pathlib.Path(__file__).resolve().parent.parent / 'public'
JS = """
async ({ entries, maxDim }) => {
  const ex = await import('/js/services/export.js'); const out = [];
  for (const e of entries) {
    const doc = await (await fetch('/' + e.file)).json();
    const bad = await ex.checkTextFit(doc), svg = await ex.designToSVG(doc);
    const cv = await ex.renderCanvas(doc, maxDim / Math.max(doc.w, doc.h));
    out.push({ id: e.id, bad, svg, webp: cv.toDataURL('image/webp', 0.82).split(',')[1] });
  }
  return out;
}
"""
async def main():
    manifest = json.loads((PUB / 'templates/manifest.json').read_text(encoding='utf-8'))
    byid = {t['id']: t for t in manifest['templates']}
    fails, svgbad = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1200, 'height': 800})
        await pg.goto(BASE); await pg.wait_for_selector('h1')
        ts = manifest['templates']
        for i in range(0, len(ts), 25):
            res = await pg.evaluate(JS, {'entries': ts[i:i + 25], 'maxDim': 520})
            for r in res:
                t = byid[r['id']]; base = PUB / t['svg'][:-4]
                try: minidom.parseString(r['svg'].encode('utf-8'))
                except Exception as ex: svgbad.append((r['id'], str(ex)))
                (PUB / t['svg']).write_text(r['svg'], encoding='utf-8'); (PUB / t['preview']).write_bytes(base64.b64decode(r['webp']))
                t['printValidation']['textFits'] = not r['bad']
                if r['bad']: fails.append((r['id'], r['bad'][:2]))
        await b.close()
    (PUB / 'templates/manifest.json').write_text(json.dumps(manifest, ensure_ascii=False), encoding='utf-8')
    print('baked', len(ts), '| text-fit failures:', len(fails), '| invalid SVG:', len(svgbad))
    for f in fails[:12]: print(' ', f)
    for f in svgbad[:5]: print(' svg', f)
asyncio.run(main())
