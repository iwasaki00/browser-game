import contextlib
import hashlib
import io
from pathlib import Path
import sys
import tempfile
import unittest
from PIL import Image

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from final_defense_assets import ACTORS,EFFECTS,SCENES,ENDINGS,generate


class FinalDefenseAssets(unittest.TestCase):
    def test_reproducible_isolated_dimensions_alpha_and_anchors(self):
        with tempfile.TemporaryDirectory() as first,tempfile.TemporaryDirectory() as second:
            with contextlib.redirect_stdout(io.StringIO()):a,b=generate(Path(first)),generate(Path(second))
            self.assertEqual(a,b);self.assertEqual(len(a['assets']),30)
            self.assertEqual(sum(r['frames'] for r in a['assets']),185)
            self.assertEqual(a['seed'],10001008);self.assertEqual(a['sampling'],'nearest');self.assertEqual(a['sourceScale'],2)
            self.assertEqual([p.name for p in (Path(first)/'assets').iterdir()],['final-defense-01'])
            catalog={r['path']:r for r in a['assets']}
            for rec in a['assets']:
                rel=Path(rec['path']);self.assertFalse(rel.is_absolute());self.assertNotIn('..',rel.parts)
                path=Path(first)/'assets/final-defense-01'/rel
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),rec['sha256'])
                with Image.open(path) as im:
                    self.assertEqual(list(im.size),rec['size'])
                    if rel.parts[0] in ('sprites','far','effects'):
                        self.assertEqual(im.mode,'RGBA');self.assertEqual(im.getpixel((0,0))[3],0)
                        self.assertEqual(set(im.getchannel('A').getdata()),{0,255})
            for scene in (*SCENES,*ENDINGS):self.assertEqual(catalog['backgrounds/'+scene+'.png']['size'],[640,360])
            self.assertEqual(catalog['tiles/final-defense.png']['size'],[256,64])
            for kind,(w,h) in ACTORS.items():
                normal=Path(first)/'assets/final-defense-01/sprites'/(kind+'.png');far=Path(first)/'assets/final-defense-01/far'/(kind+'.png')
                with Image.open(normal) as im,Image.open(far) as fm:
                    self.assertEqual(im.size,(w*16,h*2));self.assertEqual(im.getchannel('A').tobytes(),fm.getchannel('A').tobytes());self.assertNotEqual(im.tobytes(),fm.tobytes())
                self.assertEqual(catalog['sprites/'+kind+'.png']['frames'],8)
                if kind.startswith('overmind'):self.assertEqual(catalog['sprites/'+kind+'.png']['anchor'],{'centerX':0,'topOffset':-24,'coreCenter':[0,32]})
            forms=[catalog['sprites/overmind'+str(i)+'.png']['sha256'] for i in range(1,4)]
            self.assertEqual(len(set(forms)),3)
            for name in EFFECTS:self.assertEqual(catalog['effects/'+name+'.png']['size'],[512,64])


if __name__=='__main__':unittest.main()
