import asyncio, json, base64, sys
from playwright.async_api import async_playwright
BASE='http://localhost:3000'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={'width':1280,'height':900}, accept_downloads=True)
        pg=await ctx.new_page()
        errs=[]
        pg.on('console', lambda m: errs.append(('console',m.text)) if m.type=='error' else None)
        pg.on('pageerror', lambda e: errs.append(('pageerror',str(e))))
        await pg.goto(BASE)
        await pg.wait_for_selector('h1')
        for h in ['#/templates','#/catalog','#/projects','#/studio','#/settings','#/']:
            await pg.evaluate(f"location.hash='{h}'"); await pg.wait_for_timeout(250)
            print(h, (await pg.inner_text('h1')))
        # template -> editor
        await pg.evaluate("location.hash='#/templates'"); await pg.wait_for_selector('[data-act=tpl]')
        await pg.click('[data-act=tpl][data-id=sale]'); await pg.wait_for_selector('#stg .el')
        print('editor els', await pg.locator('#stg .el').count())
        # select headline via layer button, edit text through inspector
        await pg.click('.lay button:has-text("Special Offer")'); await pg.wait_for_selector('#tx')
        await pg.fill('#tx','Hello PrintOS')
        print('stage has text', 'Hello PrintOS' in await pg.inner_text('#stg'))
        await pg.click('[data-act=undo]'); print('after undo count text:', 'Hello PrintOS' in await pg.inner_text('#stg'))
        await pg.click('[data-act=redo]')
        await pg.click('[data-act=add-rect]'); print('els after rect', await pg.locator('#stg .el').count())
        await pg.click('[data-act=save]'); await pg.wait_for_timeout(200); print('status', await pg.inner_text('#stt'))
        # exports
        async with pg.expect_download() as d: await pg.click('[data-act=png]')
        dl=await d.value; await dl.save_as('/tmp/out.png'); print('png', dl.suggested_filename)
        async with pg.expect_download() as d: await pg.click('[data-act=pdf]')
        dl=await d.value; await dl.save_as('/tmp/out.pdf'); print('pdf', dl.suggested_filename)
        await pg.screenshot(path='/tmp/editor.png')
        print('ERRORS', errs)
        await b.close()
asyncio.run(main())
