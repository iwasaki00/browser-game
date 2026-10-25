"""Join actual browser captures without resampling their pixels."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports' / 'mission-art-comparison'

def build():
    labels = [('m01', 'M01 / CITY'), ('m02', 'M02 / UNDERGROUND'), ('m03', 'M03 / COASTAL')]
    sheet = Image.new('RGB', (844 * 3, 434), '#07131f')
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 18)
    except OSError:
        font = ImageFont.load_default()
    for i, (key, title) in enumerate(labels):
        with Image.open(OUT / f'{key}-ranger-unified640.jpg') as src:
            if src.size != (844, 390):
                raise ValueError(f'{key}: expected 844x390 actual browser capture')
            sheet.paste(src.convert('RGB'), (i * 844, 44))
        draw.text((i * 844 + 12, 10), title + ' / RANGER / 0.50 / 640', fill='#d5eee8', font=font)
    sheet.save(OUT / 'missions-side-by-side.png', optimize=True)
    print('Saved 2532x434 comparison; source screenshots unmodified.')

if __name__ == '__main__':
    build()
