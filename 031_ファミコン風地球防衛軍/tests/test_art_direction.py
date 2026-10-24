"""Only the isolated art pipeline; no unrelated gameplay regression suite."""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import sys
import unittest
from PIL import Image, ImageChops, ImageColor
from tools.art_direction_samples import generate, generate_in_game, P

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/"assets/art-refresh/study-01"


def hashes(paths):
    return {str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}


class ArtDirectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.production=list((ROOT/"assets").rglob("*.png"))
        cls.production=[p for p in cls.production if "art-refresh" not in p.parts]+[ROOT/"assets/underground.json"]
        cls.before=hashes(cls.production)
        with contextlib.redirect_stdout(io.StringIO()):generate(ROOT)
        cls.first=hashes(p for p in OUTPUT.rglob("*") if p.is_file())
        with contextlib.redirect_stdout(io.StringIO()):generate(ROOT)
        cls.second=hashes(p for p in OUTPUT.rglob("*") if p.is_file())
        cls.manifest=json.loads((OUTPUT/"manifest.json").read_text(encoding="utf-8"))

    def test_01_reproducible_bytes_and_production_untouched(self):
        self.assertEqual(self.first,self.second)
        self.assertEqual(self.before,hashes(self.production))

    def test_02_all_frames_dimensions_and_hashes_match_manifest(self):
        self.assertEqual(len(self.manifest["assets"]),22)
        self.assertEqual(sum(a["frames"] for a in self.manifest["assets"].values()),72)
        self.assertEqual(self.manifest["status"],"PROPOSAL_NOT_INTEGRATED")
        for name,a in self.manifest["assets"].items():
            with self.subTest(name=name),Image.open(OUTPUT/name) as im:
                self.assertEqual(im.mode,"RGBA");self.assertEqual(list(im.size),a["size"])
                self.assertEqual(im.width%a["cell"][0],0);self.assertEqual(im.height%a["cell"][1],0)
                self.assertGreaterEqual(im.width//a["cell"][0]* (im.height//a["cell"][1]),a["frames"])
                self.assertEqual(hashlib.sha256((OUTPUT/name).read_bytes()).hexdigest(),a["sha256"])
                self.assertTrue(im.getbbox())

    def test_03_native_sprites_have_only_palette_colors_binary_alpha_and_safe_bounds(self):
        palette={ImageColor.getcolor(c,"RGBA") if isinstance(c,str) else c for c in P.values()}
        for name,a in self.manifest["assets"].items():
            if not name.startswith(("sprites/","weapons/","tiles/")):continue
            with self.subTest(name=name),Image.open(OUTPUT/name) as im:
                self.assertLessEqual(set(im.getdata()),palette)
                self.assertLessEqual(set(im.getchannel("A").getdata()),{0,255})
                for i in range(a["frames"]):
                    w,h=a["cell"];x=i%a["columns"]*w;y=i//a["columns"]*h
                    cell=im.crop((x,y,x+w,y+h));self.assertTrue(cell.getbbox())
                    if name.startswith("sprites/"):
                        left,top,right,bottom=cell.getbbox()
                        self.assertGreaterEqual(left,0);self.assertGreater(top,0)
                        self.assertLess(right,w);self.assertLessEqual(bottom,h) # feet may meet the logical ground line

    def test_04_actor_and_weapon_silhouettes_are_not_palette_swaps(self):
        def mask(name,w,h):
            with Image.open(OUTPUT/name) as im:return im.crop((0,0,w,h)).getchannel("A")
        self.assertTrue(ImageChops.difference(mask("sprites/ranger.png",48,64),mask("sprites/wing.png",48,64)).getbbox())
        self.assertTrue(ImageChops.difference(mask("sprites/crawler.png",64,64),mask("sprites/needle.png",64,64)).getbbox())
        with Image.open(OUTPUT/"weapons/icons.png") as im:
            masks=[im.crop((i*32,0,i*32+32,32)).getchannel("A").tobytes() for i in range(5)]
            self.assertEqual(len(set(masks)),5)

    def test_05_logical_envelopes_and_weapon_subset_are_explicit(self):
        for name,logical in [("ranger",[24,32]),("wing",[24,32]),("crawler",[32,32]),("needle",[32,32]),("mother_crawler",[96,64])]:
            self.assertEqual(self.manifest["assets"][f"sprites/{name}.png"]["logicalCell"],logical)
        self.assertEqual(self.manifest["weaponOrder"],["A-01","R-04","H-08","T-06","D-19"])

    def test_06_preview_static_links_exist_and_viewer_has_no_game_or_storage_imports(self):
        html=ROOT/"docs/art-preview/index.html"
        for url in re.findall(r'(?:src|href)="([^"]+)"',html.read_text(encoding="utf-8")):
            self.assertNotIn("://",url);self.assertTrue((html.parent/url).resolve().is_file(),url)
        js=(html.parent/"preview.js").read_text(encoding="utf-8")
        self.assertNotRegex(js,r"localStorage|sessionStorage|requestAnimationFrame|setInterval|import\s")
        self.assertIn("ctx.imageSmoothingEnabled=false",js)

    def test_07_entry_point_is_opt_in_and_rejects_production_flag_mix(self):
        result=subprocess.run([sys.executable,str(ROOT/"tools/generate_assets.py"),"--art-study-only"],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr);self.assertIn("22 PNG",result.stdout)
        self.assertEqual(self.before,hashes(self.production))
        mixed=subprocess.run([sys.executable,str(ROOT/"tools/generate_assets.py"),"--art-study-only","--classes-only"],capture_output=True,text=True)
        self.assertNotEqual(mixed.returncode,0)

    def test_08_in_game_companions_are_reproducible_and_leave_existing_pngs_untouched(self):
        existing=hashes([*self.production,*[OUTPUT/name for name in self.manifest['assets']]])
        with contextlib.redirect_stdout(io.StringIO()):generate_in_game(ROOT)
        folder=OUTPUT/'in-game';first=hashes(folder.iterdir())
        with contextlib.redirect_stdout(io.StringIO()):generate_in_game(ROOT)
        self.assertEqual(first,hashes(folder.iterdir()))
        self.assertEqual(existing,hashes([ROOT/name for name in existing]))
        metadata=json.loads((folder/'anchors.json').read_text(encoding='utf-8'))
        self.assertEqual(len(metadata['assets']),2)
        for name,record in metadata['assets'].items():
            with self.subTest(name=name),Image.open(folder/name) as im,Image.open(OUTPUT/'sprites'/name.replace('_body','')) as old:
                self.assertEqual(im.size,(96,64));self.assertEqual(record['cell'],[48,64])
                self.assertEqual(hashlib.sha256((folder/name).read_bytes()).hexdigest(),record['sha256'])
                self.assertLessEqual(set(im.getchannel('A').getdata()),{0,255})
                self.assertTrue(ImageChops.difference(im,old).getbbox())

    def test_09_companion_entry_point_and_game_image_dimensions(self):
        result=subprocess.run([sys.executable,str(ROOT/'tools/generate_assets.py'),'--art-in-game-only'],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(self.before,hashes(self.production))
        mixed=subprocess.run([sys.executable,str(ROOT/'tools/generate_assets.py'),'--art-in-game-only','--weapons-only'],capture_output=True,text=True)
        self.assertNotEqual(mixed.returncode,0)
        js=(ROOT/'js/art-preview.js').read_text(encoding='utf-8')
        files=re.findall(r"\w+:\['([^']+)',(\d+),(\d+)\]",js)
        self.assertEqual(len(files),13)
        for path,w,h in files:
            with self.subTest(path=path),Image.open(OUTPUT/path) as im:self.assertEqual(im.size,(int(w),int(h)))


if __name__=="__main__":unittest.main()
