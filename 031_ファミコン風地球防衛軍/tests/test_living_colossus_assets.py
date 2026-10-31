import contextlib
import hashlib
import io
from pathlib import Path
import sys
import tempfile
import unittest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from living_colossus_assets import ACTORS, EFFECTS, SCENES, generate


class LivingColossusAssets(unittest.TestCase):
    def test_deterministic_isolated_dimensions_alpha_and_anchors(self):
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            with contextlib.redirect_stdout(io.StringIO()):
                a, b = generate(Path(first)), generate(Path(second))
            self.assertEqual(a, b)
            self.assertEqual(len(a['assets']), 26)
            self.assertEqual(sum(x['frames'] for x in a['assets']), 174)
            self.assertEqual(a['seed'], 6008400)
            self.assertEqual(a['sampling'], 'nearest')
            self.assertEqual(a['sourceScale'], 2)
            catalog = {rec['path']: rec for rec in a['assets']}
            for rec in a['assets']:
                rel = Path(rec['path'])
                self.assertFalse(rel.is_absolute())
                self.assertNotIn('..', rel.parts)
                path = Path(first) / 'assets/living-colossus-01' / rel
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), rec['sha256'])
                with Image.open(path) as im:
                    self.assertEqual(list(im.size), rec['size'])
                    if rec['path'].startswith(('sprites/', 'far/', 'effects/')):
                        self.assertEqual(im.mode, 'RGBA')
                        self.assertEqual(im.getpixel((0, 0))[3], 0)
                        self.assertEqual(set(im.getchannel('A').getdata()), {0, 255})
            self.assertEqual(len(list((Path(first) / 'assets').iterdir())), 1)
            for scene in SCENES:
                self.assertEqual(catalog['backgrounds/' + scene + '.png']['size'], [640, 360])
            for kind, (w, h) in ACTORS.items():
                normal = Path(first) / 'assets/living-colossus-01/sprites' / (kind + '.png')
                far = Path(first) / 'assets/living-colossus-01/far' / (kind + '.png')
                with Image.open(normal) as im, Image.open(far) as fm:
                    self.assertEqual(im.size, (w * 16, h * 2))
                    self.assertEqual(im.getchannel('A').tobytes(), fm.getchannel('A').tobytes())
                if kind == 'neuralheart':
                    self.assertEqual(catalog['sprites/' + kind + '.png']['anchor'],
                                     {'centerX': 0, 'topOffset': -24, 'coreCenter': [0, 40]})
            self.assertEqual(len([x for x in catalog if x.startswith('effects/')]), len(EFFECTS))


if __name__ == '__main__':
    unittest.main()
