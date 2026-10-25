"""Scoped M03 art-generation integrity; earlier PNGs are read-only snapshots."""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from PIL import Image
from tools.coastal_assets import generate, enemy, ENEMIES

ROOT=Path(__file__).resolve().parents[1]

def hashes(paths):return {p:hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}

class CoastalAssetsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.old=hashes(p for p in (ROOT/'assets').rglob('*.png') if 'coastal-01' not in p.parts)
        cls.tmp=tempfile.TemporaryDirectory()
        cls.out=Path(cls.tmp.name)/'assets/coastal-01'
        with contextlib.redirect_stdout(io.StringIO()):cls.manifest=generate(cls.tmp.name)
        cls.first=hashes(p for p in cls.out.rglob('*') if p.is_file())
        with contextlib.redirect_stdout(io.StringIO()):generate(cls.tmp.name)
        cls.second=hashes(p for p in cls.out.rglob('*') if p.is_file())
    @classmethod
    def tearDownClass(cls):cls.tmp.cleanup()
    def test_reproducible_and_earlier_material_unchanged(self):
        self.assertEqual(self.first,self.second);self.assertEqual(self.old,hashes(self.old))
    def test_runtime_dimensions_and_binary_alpha(self):
        self.assertEqual(len(self.manifest['assets']),19)
        self.assertEqual(len(list(self.out.rglob('*.png'))),20)
        for name,r in self.manifest['assets'].items():
            with self.subTest(name=name),Image.open(self.out/name) as im:
                self.assertEqual(list(im.size),r['size']);self.assertEqual(im.mode,'RGBA')
                self.assertLessEqual(set(im.getchannel('A').getdata()),{0,255})
                self.assertEqual(hashlib.sha256((self.out/name).read_bytes()).hexdigest(),r['sha256'])
        self.assertEqual(self.manifest['assets']['sprites/leviathan.png']['size'],[1920,192])
        self.assertEqual(self.manifest['assets']['sprites/shorecrab.png']['size'],[480,144])
        self.assertEqual(self.manifest['assets']['sprites/skyray.png']['size'],[480,144])
        self.assertEqual(self.manifest['assets']['sprites/siegebeetle.png']['size'],[576,240])
    def test_animation_variants_and_core_anchor(self):
        for kind in ENEMIES:
            self.assertNotEqual(enemy(kind,0).tobytes(),enemy(kind,1).tobytes())
            self.assertNotEqual(enemy(kind,0).tobytes(),enemy(kind,3).tobytes())
            self.assertNotEqual(enemy(kind,0).tobytes(),enemy(kind,4).tobytes())
        self.assertEqual(enemy('leviathan',5).getpixel((160,116)),(241,240,213,255))
        self.assertNotEqual(enemy('leviathan',0).getpixel((160,116)),(241,240,213,255))
    def test_far_alpha_unchanged(self):
        for kind in ENEMIES:
            with Image.open(self.out/f'sprites/{kind}.png') as near,Image.open(self.out/f'far/{kind}.png') as far:
                self.assertEqual(near.getchannel('A').tobytes(),far.getchannel('A').tobytes())
    def test_cli_mixed_flags_fail_without_writes(self):
        for flag in ('--classes-only','--art-unified-only','--underground-only'):
            p=subprocess.run([sys.executable,str(ROOT/'tools/generate_assets.py'),'--coastal-only',flag],capture_output=True,text=True)
            self.assertNotEqual(p.returncode,0)
        self.assertEqual(self.old,hashes(self.old))

if __name__=='__main__':unittest.main()
