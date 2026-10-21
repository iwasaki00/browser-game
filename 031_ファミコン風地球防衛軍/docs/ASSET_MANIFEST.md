# Asset Manifest

全素材は `tools/generate_assets.py` が固定シード7319で生成するオリジナルPNG。アンチエイリアスなし、透過RGBA（背景のみRGB）。

| ファイル | フレーム | フレームサイズ | 用途 |
|---|---:|---:|---|
| sprites/player/player.png | 8 | 24×32 | 待機、走行、跳躍、落下、被弾・死亡 |
| sprites/player/classes.png | 48（12列×4行） | 24×32 | 正式4兵科、全体288×128 |
| sprites/enemies/enemies.png | 16 | 48×48 | 通常敵3種＋中ボス、各4コマ |
| sprites/bosses/mother_crawler.png | 4 | 96×64 | B-01移動・攻撃 |
| sprites/weapons/weapon_icons.png | 8 | 32×32 | 武器選択・HUD |
| sprites/weapons/projectiles.png | 8 | 16×16 | 8武器の弾・火炎・雷 |
| effects/explosion.png | 8 | 32×32 | 爆発・着弾 |
| sprites/ui/items.png | 2 | 32×32 | HP+25、武器箱 |
| tiles/city_tiles.png | 16 | 16×16 | 道路、足場、工業タイル |
| ui/bars.png | 1 | 128×16 | HP系UI素材 |
| backgrounds/city.png | 1 | 320×180 | 多層スクロール市街地 |

合計11 PNG、114フレーム相当。旧player.pngは互換素材として保持。現行のプレイヤーと兵科プレビューはclasses.pngを使用する。

## 兵科アトラス（0.1.8）

- 行0 RANGER：標準ヘルメット・アンテナ・バックパック。
- 行1 SCOUT：薄い装甲、低いヘルメット、スカーフ、後傾アンテナ。
- 行2 GUARDIAN：幅広ヘルメット、大型肩装甲、盾、重いブーツ。
- 行3 WING：双翼フィン、分割クレスト、推進パック、飛行噴射。
- 列0〜11：待機 / 走行1 / 走行2 / 走行3 / 跳躍 / 落下 / 射撃 / 被弾 / 死亡 / ダッシュ / 飛行 / ホバー。固有動作は対応兵科で使用。
- 従来パレット・暗色輪郭・透過RGBA・アンチエイリアスなし。死亡は横倒し、SCOUTダッシュはスカーフ残光、WING飛行・ホバーは異なる噴射長。
- `py -3 tools/generate_assets.py --classes-only` で兵科のみ生成。引数なしの全生成にも含む。クラス生成は乱数を使用せず、既存素材のシード順に影響しない。
