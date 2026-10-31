import contextlib
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from mobile_fortress_assets import generate

class MobileFortressAssets(unittest.TestCase):
    def test_deterministic_isolated_catalog_dimensions_alpha(self):
        with tempfile.TemporaryDirectory() as one, tempfile.TemporaryDirectory() as two:
            with contextlib.redirect_stdout(io.StringIO()):
                a, b = generate(Path(one)), generate(Path(two))
            self.assertEqual(a, b)
            self.assertEqual(len(a['assets']), 24)
            self.assertEqual(a['seed'], 5008000)
            for rec in a['assets']:
                path = Path(one) / 'assets/mobile-fortress-01' / rec['path']
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), rec['sha256'])
                with Image.open(path) as im:
                    self.assertEqual(list(im.size), rec['size'])
                    if rec['path'].startswith(('sprites/', 'far/', 'effects/')):
                        self.assertEqual(im.mode, 'RGBA')
                        self.assertEqual(im.getpixel((0, 0))[3], 0)
            self.assertEqual(len(list((Path(one) / 'assets').iterdir())), 1)
            self.assertEqual(a['sampling'], 'nearest')

if __name__ == '__main__':
    unittest.main()
