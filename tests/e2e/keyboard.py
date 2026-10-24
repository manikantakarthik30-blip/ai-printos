import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:3000'
async def key(pg, v, t='ch'):
    await pg.locator(f'#vk .vk-k[data-t="{t}"][data-v="{v}" i]').first.click()
async def typ(pg, s):
    for c in s:
        if c==' ': await pg.locator('#vk .vk-k.space').click()
        else: await key(pg,c)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={'width':1280,'height':900})
        pg=await ctx.new_page(); errs=[]
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.click('#kbToggle')
        print('toggle pressed', await pg.get_attribute('#kbToggle','aria-pressed'))
        await pg.evaluate("location.hash='#/templates'"); await pg.click('[data-act=tpl][data-id=sale]'); await pg.wait_for_selector('#stg .el')
        await pg.click('.lay button:has-text("Special Offer")'); await pg.wait_for_selector('#tx')
        await pg.fill('#tx',''); await pg.focus('#tx'); await pg.wait_for_selector('#vk:not([hidden])')
        print('keyboard visible, shift auto:', await pg.locator('#vk .vk-k[data-t="shift"]').get_attribute('class'))
        await typ(pg,'teh '); v=await pg.input_value('#tx'); print('EN autocorrect:', repr(v))
        await pg.locator('#vk .vk-k[data-t="bs"]').click(); print('backspace reverts autocorrect ->', repr(await pg.input_value('#tx')))
        await typ(pg,' wlecome '); print('typo:', repr(await pg.input_value('#tx')))
        print('stage shows text:', 'welcome' in (await pg.inner_text('#stg')).lower())
        print('suggestions after space:', await pg.locator('#vk .vk-s').all_inner_texts())
        # phonetic
        await pg.fill('#tx',''); await pg.focus('#tx')
        await pg.locator('#vk .vk-k[data-t="lang"]').click(); await pg.locator('#vk .vk-k[data-t="lang"]').click()
        print('lang label:', await pg.locator('#vk .vk-k.space').inner_text())
        await typ(pg,'namaskaaram'); print('phonetic live:', await pg.input_value('#tx'), '| sugg:', await pg.locator('#vk .vk-s').all_inner_texts())
        await typ(pg,' '); print('after space:', repr(await pg.input_value('#tx')))
        await typ(pg,'amma'); await pg.locator('#vk .vk-s').first.click(); print('picked suggestion:', repr(await pg.input_value('#tx')))
        # native telugu
        await pg.locator('#vk .vk-k[data-t="lang"]').click(); await pg.locator('#vk .vk-k[data-t="lang"]').click(); await pg.locator('#vk .vk-k[data-t="lang"]').click(); print('lang ->', await pg.locator('#vk .vk-k.space').inner_text())
        await pg.fill('#tx',''); await pg.focus('#tx')
        await key(pg,'క'); await pg.locator('#vk .vk-k[data-t="tepage"]').click(); await key(pg,'ా'); print('native:', repr(await pg.input_value('#tx')))
        # emoji
        await pg.locator('#vk .vk-k[data-t="page"][data-v="emoji"]').click(); await key(pg,'😀','emoji'); print('emoji:', repr(await pg.input_value('#tx')))
        await pg.locator('#vk .vk-k[data-t="page"][data-v="main"]').first.click()
        # undo in editor after kb typing
        await pg.locator('#vk .vk-close').click(); print('hidden after close:', await pg.locator('#vk').is_hidden())
        # AI dialog with keyboard inside dialog
        await pg.click('[data-act=ai-open]'); await pg.wait_for_selector('#pi'); await pg.focus('#pi'); await pg.wait_for_selector('#dlg #vk:not([hidden])')
        print('keyboard inside dialog ok')
        await pg.locator('#vk .vk-k[data-t="lang"]').click(); await pg.locator('#vk .vk-k[data-t="lang"]').click(); await pg.locator('#vk .vk-k[data-t="lang"]').click(); await typ(pg,'cat'); print('prompt:', await pg.input_value('#pi'))
        await pg.screenshot(path='/tmp/kb_desktop.png')
        print('ERRORS', errs)
        # mobile
        m=await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        mp=await m.new_page(); await mp.goto(BASE)
        print('mobile default kb pref:', await mp.get_attribute('#kbToggle','aria-pressed'))
        await mp.evaluate("location.hash='#/studio'"); await mp.wait_for_selector('#sf'); await mp.tap('#sf'); await mp.wait_for_selector('#vk:not([hidden])')
        await mp.screenshot(path='/tmp/kb_mobile_en.png')
        await mp.locator('#vk .vk-k[data-t="lang"]').tap(); await mp.screenshot(path='/tmp/kb_mobile_te.png')
        await b.close()
asyncio.run(main())
