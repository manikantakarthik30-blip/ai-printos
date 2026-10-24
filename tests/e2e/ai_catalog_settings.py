import asyncio, base64
from playwright.async_api import async_playwright
from PIL import Image; import io
im=Image.new('RGB',(64,64),(10,120,200)); bf=io.BytesIO(); im.save(bf,'PNG'); B64=base64.b64encode(bf.getvalue()).decode()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':1280,'height':900},accept_downloads=True)).new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'Failed to load resource' not in m.text else None)
        await pg.goto('http://localhost:3000'); 
        # real server, no key -> honest not-configured error
        await pg.fill('#pi','a marigold banner'); await pg.click('#aiGo'); await pg.wait_for_selector('#aiOut .err')
        print('no key ->', await pg.inner_text('#aiOut .err'))
        calls={'n':0}
        async def route(r):
            calls['n']+=1
            if calls['n']==1: await r.fulfill(status=429, content_type='application/json', body='{"ok":false,"error":{"code":"rate_limited","message":"Image quota or rate limit reached. Wait a moment and retry.","retryable":true}}')
            else: await r.fulfill(status=200, content_type='application/json', body='{"ok":true,"image":{"mimeType":"image/png","data":"%s"}}'%B64)
        await pg.route('**/api/generate-image', route)
        await pg.click('[data-act=ai-gen]'); await pg.wait_for_selector('#aiOut .err'); print('429 ->', await pg.inner_text('#aiOut .err'), '| retry btn:', await pg.locator('#aiOut [data-act=ai-gen]').inner_text())
        await pg.click('#aiOut [data-act=ai-gen]'); await pg.wait_for_selector('.aires img'); print('success image shown')
        async with pg.expect_download() as d: await pg.click('[data-act=ai-dl]')
        print('download', (await d.value).suggested_filename)
        await pg.click('[data-act=ai-use]'); await pg.wait_for_selector('#stg .el img'); print('design created with image; els', await pg.locator('#stg .el').count())
        # add AI image from editor dialog
        await pg.click('[data-act=ai-open]'); await pg.wait_for_selector('#dlg #pi'); await pg.fill('#pi','again'); await pg.click('#dlg [data-act=ai-gen]'); await pg.wait_for_selector('#dlg .aires img')
        await pg.click('#dlg [data-act=ai-use]'); await pg.wait_for_timeout(400); print('after add in editor els', await pg.locator('#stg .el').count())
        # integrations not configured -> honest dialogs
        await pg.click('[data-act=adobe-edit]'); print('adobe ->', (await pg.inner_text('#dlg h2'))); await pg.click('#dlg [data-act=dclose]')
        await pg.click('[data-act=canva-new]'); print('canva ->', (await pg.inner_text('#dlg h2'))); await pg.click('#dlg [data-act=dclose]')
        await pg.click('[data-act=save]'); await pg.evaluate("location.hash='#/settings'"); await pg.wait_for_selector('.pl')
        print('settings badges:', await pg.locator('.pl .bdg').all_inner_texts())
        await pg.evaluate("location.hash='#/catalog'"); await pg.fill('#cq','card'); print('catalog filtered:', await pg.locator('#pg .prod').count()); await pg.click('#pg [data-act=prod] >> nth=0'); await pg.wait_for_selector('#stg'); print('catalog->editor ok')
        print('ERRORS', errs); await b.close()
asyncio.run(main())
