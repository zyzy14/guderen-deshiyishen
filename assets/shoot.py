import asyncio, os
from playwright.async_api import async_playwright

OUT = "/workspace/assets"
BASE = "http://localhost:8000"

async def wait_fonts(page):
    try:
        await page.evaluate("async () => { await document.fonts.ready; }")
    except Exception:
        pass
    await page.wait_for_timeout(400)

async def shot(page, path, full=False, w=1440, h=900):
    await page.set_viewport_size({"width": w, "height": h})
    await page.screenshot(path=path, full_page=full)
    print("saved", path, os.path.getsize(path), "bytes")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(device_scale_factor=2, locale="zh-CN")
        page = await ctx.new_page()

        # 1) 封面
        await page.goto("file:///workspace/assets/cover.html")
        await wait_fonts(page)
        await page.wait_for_timeout(500)
        await page.screenshot(path=f"{OUT}/cover.png")
        print("saved cover.png", os.path.getsize(f"{OUT}/cover.png"), "bytes")

        # 2) 首页「备席」结果态
        await page.goto(f"{BASE}/index.html")
        await wait_fonts(page)
        await page.fill("#input", "鸡胸肉、豆腐、大葱")
        await page.click("#btn-cook")
        # 等过场结束 + 结果渲染
        await page.wait_for_function(
            "document.querySelector('#recipe-card') && document.querySelector('#recipe-card').children.length>0",
            timeout=8000)
        await page.wait_for_timeout(600)
        await page.evaluate("window.scrollTo(0,0)")
        await shot(page, f"{OUT}/preview-home.png", full=False, w=1440, h=980)

        # 3) 灶台过场（烧灶火·掀盖 瞬间）
        await page.goto(f"{BASE}/index.html")
        await wait_fonts(page)
        await page.fill("#input", "羊肉、葱")
        await page.click("#btn-cook")
        await page.wait_for_timeout(1100)  # 此时处于 掀盖 阶段
        await shot(page, f"{OUT}/preview-stove.png", full=False, w=1440, h=900)

        # 4) 古籍课堂
        await page.goto(f"{BASE}/sources.html")
        await wait_fonts(page)
        await page.wait_for_timeout(500)
        await shot(page, f"{OUT}/preview-sources.png", full=True, w=1440, h=900)

        # 5) 玩法导览
        await page.goto(f"{BASE}/guide.html")
        await wait_fonts(page)
        await page.wait_for_timeout(500)
        await shot(page, f"{OUT}/preview-guide.png", full=True, w=1440, h=900)

        # 6) 美食家人格
        await page.goto(f"{BASE}/quiz.html")
        await wait_fonts(page)
        await page.wait_for_timeout(500)
        await shot(page, f"{OUT}/preview-quiz.png", full=True, w=1440, h=900)

        await b.close()

asyncio.run(main())
print("DONE")
