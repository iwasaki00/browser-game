"""Readability generator and old-asset protection only, no unrelated regressions."""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import unittest
from PIL import Image, ImageChops
from tools.art_readability import generate, player_frame, background_layers

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/art-refresh/study-01-b'
def hashes(paths):return {p:hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}

class ArtReadabilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.old=hashes(p for p in (ROOT/'assets').rglob('*') if p.is_file() and 'study-01-b' not in p.parts)
        with contextlib.redirect_stdout(io.StringIO()):generate(ROOT)
        cls.first=hashes(p for p in OUT.rglob('*') if p.is_file())
        with contextlib.redirect_stdout(io.StringIO()):generate(ROOT)
        cls.second=hashes(p for p in OUT.rglob('*') if p.is_file());cls.manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
    def test_01_deterministic_and_all_existing_assets_unchanged(self):
        self.assertEqual(self.first,self.second);self.assertEqual(self.old,hashes(self.old))
    def test_02_dimensions_hashes_and_binary_transparency(self):
        self.assertEqual(len(self.manifest['assets']),15)
        for path,record in self.manifest['assets'].items():
            with self.subTest(path=path),Image.open(OUT/path) as im:
                self.assertEqual(list(im.size),record['size']);self.assertEqual(im.mode,'RGBA')
                self.assertLessEqual(set(im.getchannel('A').getdata()),{0,255})
                self.assertEqual(hashlib.sha256((OUT/path).read_bytes()).hexdigest(),record['sha256'])
    def test_03_real_player_poses_differ_and_keep_envelopes(self):
        for id in ('ranger','wing'):
            frames=[player_frame(id,i) for i in range(12)]
            self.assertEqual(len({im.tobytes() for im in frames}),12)
            for im in frames:self.assertEqual(im.size,(48,64));self.assertTrue(im.getbbox())
            for i in (0,1,2,3,6,7):self.assertEqual(frames[i].getbbox()[3],64)
    def test_04_enemy_variants_and_attack_death_are_distinct(self):
        for name,cell,rows in [('crawler',(64,64),3),('needle',(64,64),3),('mother_crawler',(192,128),1)]:
            with Image.open(OUT/f'sprites/{name}.png') as im:
                for row in range(rows):
                    frames=[im.crop((i*cell[0],row*cell[1],(i+1)*cell[0],(row+1)*cell[1])).tobytes() for i in range(4)]
                    self.assertEqual(len(set(frames)),4)
    def test_05_background_layers_have_not_been_flattened_to_one_tone(self):
        for under in (False,True):
            for layer in background_layers(under):self.assertGreater(len(layer.getcolors(10000)),4)
    def test_06_dedicated_flag_and_mix_guard(self):
        result=subprocess.run([sys.executable,str(ROOT/'tools/generate_assets.py'),'--art-readability-only'],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr);self.assertEqual(self.old,hashes(self.old))
        for flag in ('--classes-only','--art-study-only','--art-in-game-only'):
            result=subprocess.run([sys.executable,str(ROOT/'tools/generate_assets.py'),'--art-readability-only',flag],capture_output=True,text=True);self.assertNotEqual(result.returncode,0)

if __name__=='__main__':unittest.main()
