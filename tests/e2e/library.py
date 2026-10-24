import asyncio, json, io, base64, hashlib, subprocess
from xml.dom import minidom
from playwright.async_api import async_playwright
from PIL import Image
BASE='http://localhost:3000'
buf=io.BytesIO(); Image.new('RGB',(120,80),(30,140,90)).save(buf,'PNG'); PNG=buf.getvalue()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1280,'height':900},accept_downloads=True); pg=await ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:errs.append(m.text) if m.type=='error' and 'Failed to load' not in m.text and 'Template preview' not in m.text else None)
        await pg.goto(BASE+'/#/templates'); await pg.wait_for_selector('#libGrid .libcard'); print('count:', await pg.inner_text('#libCount'))
        await pg.click('[data-act=lib-cat][data-c=posters]'); print('posters:', await pg.inner_text('#libCount'))
        await pg.click('[data-act=lib-cat][data-c=all]'); await pg.select_option('#ll','te'); print('telugu only:', await pg.inner_text('#libCount'))
        await pg.select_option('#ll','bi'); await pg.select_option('#lt','dark'); print('bilingual+dark:', await pg.inner_text('#libCount'))
        await pg.select_option('#ll','all'); await pg.select_option('#lt','all'); await pg.fill('#lq','wedding emerald'); print('search "wedding emerald":', await pg.inner_text('#libCount'))
        await pg.fill('#lq','zzzz'); print('no match msg:', (await pg.inner_text('#libGrid'))[:45]); await pg.fill('#lq','')
        await pg.click('[data-act=lib-page][data-d="1"]'); print('pager:', await pg.inner_text('#libPager span'))
        await pg.click('[data-act=lib-cat][data-c=flyers]'); await pg.screenshot(path='/tmp/lib.png')
        await pg.click('#libGrid .libcard .thumb >> nth=0'); await pg.wait_for_selector('#dlg .meta'); print('preview dlg:', (await pg.inner_text('#dlg h2')), '| press-ready line:', (await pg.inner_text('#dlg .meta dd >> nth=-1'))[:40])
        await pg.screenshot(path='/tmp/dlg.png')
        orig=await pg.evaluate("fetch('templates/flyers/fl-001.json').then(r=>r.text())"); h1=hashlib.md5(orig.encode()).hexdigest()
        async with pg.expect_download() as d: await pg.click('#dlg [data-act=lib-dl][data-k=svg]')
        dl=await d.value; await dl.save_as('/tmp/dl.svg'); minidom.parse('/tmp/dl.svg'); print('library SVG download ok', dl.suggested_filename)
        await pg.click('#dlg [data-act=lib-use]'); await pg.wait_for_selector('#stg .el'); print('opened in editor, els:', await pg.locator('#stg .el').count(), '| name:', await pg.input_value('#nm'))
        # guides
        await pg.click('#bGuides'); print('guides drawn:', await pg.locator('#stg .gd').count()); await pg.screenshot(path='/tmp/ed_guides.png'); await pg.click('#bGuides')
        # edit text, undo
        await pg.click('.lay button:has-text("Special")'); await pg.fill('#tx','Grand Sale Today'); print('edited:', 'Grand Sale Today' in await pg.inner_text('#stg'))
        # placeholder replace
        await pg.click('.lay button:has-text("Image placeholder")'); await pg.click('[data-act=ph-replace]')
        await pg.set_input_files('#fImage',{'name':'pic.png','mimeType':'image/png','buffer':PNG}); await pg.wait_for_selector('#stg .el img'); print('placeholder -> image: ok, images:', await pg.locator('#stg .el img').count())
        await pg.click('[data-act=save]'); await pg.wait_for_timeout(200)
        # exports
        for act,ext in [('svg','svg'),('png','png'),('pdf','pdf')]:
            async with pg.expect_download() as d: await pg.click(f'[data-act={act}]')
            dl=await d.value; await dl.save_as(f'/tmp/ex.{ext}'); print('export', act, dl.suggested_filename)
        minidom.parse('/tmp/ex.svg'); print('exported SVG well-formed; has <image>:', '<image' in open('/tmp/ex.svg',encoding='utf-8').read())
        print(subprocess.run(['qpdf','--check','/tmp/ex.pdf'],capture_output=True,text=True).stdout.strip().splitlines()[-1][:60])
        orig2=await pg.evaluate("fetch('templates/flyers/fl-001.json').then(r=>r.text())"); print('library original unchanged:', hashlib.md5(orig2.encode()).hexdigest()==h1)
        # second copy from same template
        await pg.evaluate("location.hash='#/projects'"); await pg.wait_for_selector('.card'); print('projects after save:', await pg.locator('.card').count())
        # text review
        await pg.evaluate("location.hash='#/templates'"); await pg.click('[data-act=lib-cat][data-c=visiting-cards]'); await pg.click('#libGrid .libcard .thumb >> nth=0'); await pg.click('#dlg [data-act=lib-use]'); await pg.wait_for_selector('#stg .el')
        await pg.click('.lay button >> nth=2'); 
        await pg.click('.lay button:has-text("hello@example.com")'); await pg.fill('#tx','Welcom to our printting studio. Call +91 98765 43210 or hello@kfcprint.in  SKU AB-1234')
        await pg.click('[data-act=review]'); await pg.wait_for_selector('#dlg .rv li'); rows=await pg.locator('#dlg .rv li').all_inner_texts(); print('review issues:', len(rows), [r.split('\n')[0][-14:] for r in rows])
        print('flagged emails/phones/SKU?', any('98765' in r.split('\n')[1] or 'kfcprint' in r.split('\n')[1] or 'AB-1234' in r.split('\n')[1] for r in rows))
        await pg.click('#dlg [data-act=rv-apply] >> nth=0'); print('after fix:', await pg.input_value('#tx'))
        await pg.screenshot(path='/tmp/review.png'); await pg.click('#dlg [data-act=dclose]')
        # hindi phonetic
        await pg.click('#kbToggle'); await pg.fill('#tx',''); await pg.focus('#tx'); await pg.wait_for_selector('#vk:not([hidden])')
        for i in range(3): await pg.locator('#vk .vk-k[data-t=lang]').click()
        print('kb lang:', await pg.locator('#vk .vk-k.space').inner_text())
        for c in 'namaste': await pg.locator(f'#vk .vk-k[data-t=ch][data-v="{c}" i]').first.click()
        print('hindi live:', await pg.input_value('#tx'), '| sugg:', await pg.locator('#vk .vk-s').all_inner_texts())
        await pg.locator('#vk .vk-k.space').click(); print('hindi committed:', repr(await pg.input_value('#tx')))
        await pg.locator('#vk .vk-close').click()
        # failure handling
        pg2=await ctx.new_page(); await pg2.route('**/templates/manifest.json', lambda r: r.abort()); await pg2.goto(BASE+'/#/templates'); await pg2.wait_for_selector('#libBody .err'); print('manifest failure:', (await pg2.inner_text('#libBody .err'))[:70]); await pg2.close()
        pg3=await ctx.new_page(); await pg3.route('**/templates/flyers/fl-001.webp', lambda r: r.fulfill(status=404)); await pg3.goto(BASE+'/#/templates'); await pg3.click('[data-act=lib-cat][data-c=flyers]'); await pg3.wait_for_selector('#libGrid .cm:has-text("Preview unavailable")'); print('missing preview handled')
        await pg3.route('**/templates/flyers/fl-002.json', lambda r: r.fulfill(status=404)); await pg3.click('#libGrid .libcard .thumb >> nth=1'); await pg3.click('#dlg [data-act=lib-use]'); await pg3.wait_for_selector('#libErr:not(:empty)'); print('missing file handled:', (await pg3.inner_text('#libErr'))[:60]); await pg3.close()
        print('ERRORS', errs); await b.close()
asyncio.run(main())
