"""Read-only PNG audit. Does not regenerate assets or claim browser verification."""
from pathlib import Path
import hashlib
import json
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
prefix = subprocess.check_output(['git', 'rev-parse', '--show-prefix'], cwd=ROOT, encoding='utf-8').strip()
rows = []
for directory in ['sprites', 'far']:
    for name in ['ranger', 'wing']:
        path = f'assets/art-refresh/unified-01/{directory}/{name}.png'
        raw = (ROOT / path).read_bytes()
        image = Image.open(ROOT / path)
        alpha = image.getchannel('A')
        frames = []
        for frame in range(12):
            a = alpha.crop((frame * 48, 0, frame * 48 + 48, 64))
            perimeter = [a.getpixel((x, y)) for x in range(48) for y in [0, 63]]
            perimeter += [a.getpixel((x, y)) for x in [0, 47] for y in range(1, 63)]
            frames.append({'frame': frame, 'alphaBounds': a.getbbox(),
                           'opaquePerimeterPixels': sum(v == 255 for v in perimeter),
                           'fullOpaqueFrameBorder': all(v == 255 for v in perimeter)})
        hashes = {ref: hashlib.sha256(subprocess.check_output(['git', 'show', ref + ':' + prefix + path], cwd=ROOT)).hexdigest()
                  for ref in ['08e1548', 'dfad850']}
        digest = hashlib.sha256(raw).hexdigest()
        assert all(v == digest for v in hashes.values()), path
        assert all(not f['fullOpaqueFrameBorder'] for f in frames), path
        rows.append({'path': path, 'sha256': digest, 'historicalHashes': hashes,
                     'mode': image.mode, 'size': image.size, 'alphaValues': sorted(set(alpha.getdata())), 'frames': frames})
out = ROOT / 'reports/movement-regression'
out.mkdir(parents=True, exist_ok=True)
(out / 'sprite-alpha-audit.json').write_text(json.dumps({'method': 'Pillow inspection only; NOT a browser screenshot', 'assets': rows}, indent=2) + '\n', encoding='utf-8')
print('4 PNG / 48 frames: historical hashes match, no complete opaque cell border')
