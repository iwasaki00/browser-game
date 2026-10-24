"""Scoped art pipeline integrity; includes every earlier asset set in read-only snapshots."""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import unittest
from PIL import Image
from tools.art_unification import generate, player, enemy, ENEMIES

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/art-refresh/unified-01'
def hashes(paths):return {p:hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}

class UnificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.old=hashes(p for p in (ROOT/'assets').rglob('*') if p.is_file() and 'unified-01' not in p.parts)
        with contextlib.redirect_stdout(io.StringIO()):generate(ROOT)
        cls.first=hashes(p for p in OUT.rglob('*') if p.is_file())
        with contextlib.redirect_stdout(io.StringIO()):generate(ROOT)
        cls.second=hashes(p for p in OUT.rglob('*') if p.is_file())
        cls.manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
    def test_reproducible_all_earlier_assets_unchanged(self):
        self.assertEqual(self.first,self.second);self.assertEqual(self.old,hashes(self.old))
    def test_dimensions_cells_frames_and_alpha(self):
        self.assertEqual(len(list(OUT.rglob('*.png'))),48)
        self.assertEqual(sum(r['frames'] for r in self.manifest['assets'].values()),740)
        for name,r in self.manifest['assets'].items():
            with self.subTest(name=name),Image.open(OUT/name) as im:
                self.assertEqual(list(im.size),r['size']);self.assertEqual(im.mode,'RGBA')
                self.assertLessEqual(set(im.getchannel('A').getdata()),{0,255})
                self.assertEqual(len(set(r['frameIds'])),r['frames'])
                self.assertEqual(hashlib.sha256((OUT/name).read_bytes()).hexdigest(),r['sha256'])
    def test_four_distinct_silhouettes_feet_and_referenced_states(self):
        self.assertEqual(len({player(k,0).getchannel('A').tobytes() for k in ('ranger','scout','guardian','wing')}),4)
        for k in ('ranger','scout','guardian','wing'):
            for f in range(12):self.assertEqual(player(k,f).size,(48,64))
            for f in (0,1,2,3,6,7):self.assertEqual(player(k,f).getbbox()[3],64)
            self.assertNotEqual(player(k,0).tobytes(),player(k,8).tobytes())
        self.assertNotEqual(player('scout',0).tobytes(),player('scout',9).tobytes())
        self.assertNotEqual(player('wing',10).tobytes(),player('wing',11).tobytes())
    def test_enemy_attack_hit_death_and_queen_open_core(self):
        for k in ENEMIES:
            for f in range(6):self.assertTrue(enemy(k,f).getbbox())
            if k!='barrier':self.assertNotEqual(enemy(k,0).tobytes(),enemy(k,3).tobytes())
        self.assertNotEqual(enemy('queen',0).tobytes(),enemy('queen',5).tobytes())
        self.assertEqual(enemy('queen',5).getpixel((128,120)),(241,240,213,255))
    def test_mapping_has_valid_original_and_unified_paths(self):
        for row in self.manifest['mapping']:
            for key in ('assetId','purpose','missions','owner','original','unified','frames','states','anchor','generator','status'):self.assertIn(key,row)
            self.assertTrue((ROOT/row['original']).exists(),row['original']);self.assertTrue((ROOT/row['unified']).exists())
    def test_dedicated_cli_mixed_flags_fail_without_writes(self):
        for flag in ('--classes-only','--weapons-only','--art-readability-only','--art-study-only'):
            p=subprocess.run([sys.executable,str(ROOT/'tools/generate_assets.py'),'--art-unified-only',flag],capture_output=True,text=True)
            self.assertNotEqual(p.returncode,0)
        self.assertEqual(self.old,hashes(self.old))

if __name__=='__main__':unittest.main()
