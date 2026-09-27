"""Create visual-review contact sheets from Playwright's real page captures."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

base = Path(__file__).resolve().parents[2] / 'reports' / 'redesign' / 'after'
main = ['overview', 'operations', 'analytics', 'models', 'scenario', 'analyst']
secondary = ['anomalies', 'products', 'segments', 'statistics', 'quality']
font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 15)
for viewport, height in [('desktop', 900), ('laptop', 800), ('mobile', 844), ('tablet', 1024)]:
    for theme in ['light', 'dark']:
        for group, routes in [('main', main), ('secondary', secondary)]:
            thumb_width = 480 if viewport in ['desktop', 'laptop'] else 390
            panels = []
            for route in routes:
                source = Image.open(base / f'{viewport}-{theme}-{route}.png').convert('RGB')
                crop = source.crop((0, 0, source.width, min(source.height, height)))
                crop = crop.resize((thumb_width, int(crop.height * thumb_width / crop.width)))
                panels.append((route, crop))
            panel_height = max(img.height for _, img in panels) + 33
            sheet = Image.new('RGB', (3 * (thumb_width + 12) + 12, 2 * (panel_height + 12) + 12), '#dddeda')
            draw = ImageDraw.Draw(sheet)
            for index, (route, image) in enumerate(panels):
                x, y = 12 + (index % 3) * (thumb_width + 12), 12 + (index // 3) * (panel_height + 12)
                draw.text((x + 3, y + 5), f'{viewport} / {theme} / {route}', font=font, fill='#24342a')
                sheet.paste(image, (x, y + 30))
            sheet.save(base / f'review-{viewport}-{theme}-{group}.jpg', quality=92)
print('Created 16 labeled review sheets from the 88 complete screenshots.')
