"""
Renders tools/home-art/svg/*.svg to transparent WebP:
  customer-app/assets/home/<key>.webp   (bundled defaults shown when admin has not uploaded a photo)
  admin-dashboard/public/home-art/<key>.webp  (previews in the admin editor)

Uses Playwright's Chromium (already used for screenshots). Run from the repo root:
  python3 tools/home-art/render.py
"""
import asyncio
import io
import os

from PIL import Image
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(os.path.dirname(__file__), 'svg')
TARGETS = [
    (os.path.join(ROOT, 'customer-app', 'assets', 'home'), 512),
    (os.path.join(ROOT, 'admin-dashboard', 'public', 'home-art'), 256),
]


async def main():
    for folder, _ in TARGETS:
        os.makedirs(folder, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 512, 'height': 512})
        for name in sorted(os.listdir(SRC)):
            if not name.endswith('.svg'):
                continue
            with open(os.path.join(SRC, name)) as f:
                markup = f.read()
            await page.set_content(f'<html><body style="margin:0;background:transparent">{markup}</body></html>')
            png = await page.screenshot(omit_background=True, clip={'x': 0, 'y': 0, 'width': 512, 'height': 512})
            image = Image.open(io.BytesIO(png)).convert('RGBA')
            key = name[:-4]
            for folder, size in TARGETS:
                out = image if size == 512 else image.resize((size, size), Image.LANCZOS)
                out.save(os.path.join(folder, f'{key}.webp'), 'WEBP', quality=84, method=6)
        await browser.close()
    sizes = [os.path.getsize(os.path.join(TARGETS[0][0], f)) for f in os.listdir(TARGETS[0][0])]
    print(f'{len(sizes)} images, largest {max(sizes) // 1024} KB, total {sum(sizes) // 1024} KB')


asyncio.run(main())
