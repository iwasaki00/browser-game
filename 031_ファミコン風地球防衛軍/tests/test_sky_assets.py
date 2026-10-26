"""Scoped SKY 01 generation, reproducibility and earlier PNG protection."""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from PIL import Image
from tools.sky_assets import generate

ROOT=Path(__file__).resolve().parents[1]
def hashes(paths):return {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}

class SkyAssetsTests(unittest.TestCase):
    def test_reproducible_dimensions_alpha_and_old_assets_untouched(self):
        old=hashes(p for p in (ROOT/'assets').rglob('*.png') if 'sky-01' not in p.parts)
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            with contextlib.redirect_stdout(io.StringIO()):generate(root)
            out=root/'assets/sky-01'
            first=hashes(out.rglob('*.*'))
            with contextlib.redirect_stdout(io.StringIO()):generate(root)
            self.assertEqual(first,hashes(out.rglob('*.*')))
            catalog=json.loads((out/'catalog.json').read_text(encoding='utf-8'))
            self.assertEqual(len(catalog['assets']),19)
            for entry in catalog['assets']:
                p=out/entry['path']
                with Image.open(p) as im:
                    self.assertEqual(list(im.size),entry['size'])
                    self.assertEqual(im.mode,'RGBA')
                    self.assertLessEqual(set(im.getchannel('A').getdata()),{0,255})
                self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),entry['sha256'])
            for kind in ('interceptor','shielddrone','heavygunner','fortress','skydevice'):
                with Image.open(out/f'sprites/{kind}.png') as near,Image.open(out/f'far/{kind}.png') as far:
                    self.assertEqual(near.getchannel('A').tobytes(),far.getchannel('A').tobytes())
        self.assertEqual(old,hashes(Path(p) for p in old))

if __name__=='__main__':unittest.main()
