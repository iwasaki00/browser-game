# Asset Manifest

全素材は `tools/generate_assets.py` が固定シード7319で生成するオリジナルPNG。アンチエイリアスなし、透過RGBA（背景のみRGB）。

| ファイル | フレーム | フレームサイズ | 用途 |
|---|---:|---:|---|
| sprites/player/player.png | 8 | 24×32 | 待機、走行、跳躍、落下、被弾・死亡 |
| sprites/enemies/enemies.png | 16 | 48×48 | 通常敵3種＋中ボス、各4コマ |
| sprites/bosses/mother_crawler.png | 4 | 96×64 | B-01移動・攻撃 |
| sprites/weapons/weapon_icons.png | 8 | 32×32 | 武器選択・HUD |
| sprites/weapons/projectiles.png | 8 | 16×16 | 8武器の弾・火炎・雷 |
| effects/explosion.png | 8 | 32×32 | 爆発・着弾 |
| sprites/ui/items.png | 2 | 32×32 | HP+25、武器箱 |
| tiles/city_tiles.png | 16 | 16×16 | 道路、足場、工業タイル |
| ui/bars.png | 1 | 128×16 | HP系UI素材 |
| backgrounds/city.png | 1 | 320×180 | 多層スクロール市街地 |

合計10 PNG、66フレーム相当。
