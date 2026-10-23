# Asset Manifest

全素材は `tools/generate_assets.py` が固定シード7319で生成するオリジナルPNG。アンチエイリアスなし、透過RGBA（背景のみRGB）。

| ファイル | フレーム | フレームサイズ | 用途 |
|---|---:|---:|---|
| sprites/player/player.png | 8 | 24×32 | 待機、走行、跳躍、落下、被弾・死亡 |
| sprites/player/classes.png | 48（12列×4行） | 24×32 | 正式4兵科、全体288×128 |
| sprites/enemies/enemies.png | 16 | 48×48 | 通常敵3種＋中ボス、各4コマ |
| sprites/bosses/mother_crawler.png | 4 | 96×64 | B-01移動・攻撃 |
| sprites/weapons/weapon_icons.png | 20 | 32×32 | 武器選択・HUD・設置物、全体640×32 |
| sprites/weapons/projectiles.png | 20 | 16×16 | 弾体、全体320×16 |
| sprites/weapons/equipped.png | 20 | 16×16 | 装備表示用（新武器で使用）、全体320×16 |
| effects/weapon_fx.png | 96（8列×12行） | 32×32 | 新12武器の命中・爆発・特殊効果、全体256×384 |
| effects/explosion.png | 8 | 32×32 | 爆発・着弾 |
| sprites/ui/items.png | 2 | 32×32 | HP+25、武器箱 |
| tiles/city_tiles.png | 16 | 16×16 | 道路、足場、工業タイル |
| ui/bars.png | 1 | 128×16 | HP系UI素材 |
| backgrounds/city.png | 1 | 320×180 | 多層スクロール市街地 |

合計13 PNG、254フレーム相当。旧player.pngは互換素材として保持。現行のプレイヤーと兵科プレビューはclasses.pngを使用する。

## 地下ステージ素材（0.2.2）

`py -3 tools/generate_assets.py --underground-only` で以下10 PNG・計57フレーム相当と `assets/underground.json` を直接生成する。M02専用シード2207319を使用し、既存M01の13 PNGを上書きしない。再生成前後で全PNGのSHA256が一致することを確認済み。全体は23 PNG・311フレーム相当。

| ファイル（assets/以下） | コマ数 | 1コマ | 内容 |
| --- | ---: | --- | --- |
| backgrounds/underground.png | 1 | 320×180 | 地下施設・地下鉄跡・配管・巣穴 |
| tiles/underground_tiles.png | 16 | 16×16 | 金属床・天井・壁・配管・洞窟・破壊障害物3状態 |
| sprites/enemies/tunnel_worm.png | 4 | 32×20 | E-05、うねり・攻撃・被弾 |
| sprites/enemies/ceiling_spitter.png | 4 | 28×24 | E-06、脚・酸液器官 |
| sprites/enemies/spawn_nest.png | 4 | 48×48 | H-01、根・発光する孵化口 |
| sprites/bosses/abyss_queen.png | 4 | 120×96 | B-02、冠状装甲・多脚・腹部コア |
| effects/acid.png | 4 | 16×16 | 酸弾 |
| effects/ground_wave.png | 4 | 32×24 | 地上衝撃波 |
| effects/nest_break.png | 8 | 64×64 | 巣穴爆散 |
| effects/boss_break.png | 8 | 128×96 | ボス段階爆発 |

キャラクター・効果は透過RGBA、背景は不透明、nearest-neighbor。メタデータにはフレーム幅・高さ・列数・コマ数・タイル用途を記録する。外部画像の流用・手動ダウンロードは不要。

## 新12武器（0.2.0）

- 新武器分はアイコン12＋弾体12＋装備表示12＋固有エフェクト96＝132コマ。互換・共用のため旧8武器の装備表示8コマも生成する。PNGは2ファイル拡張・2ファイル追加。
- 既存武器の先頭8列は描画処理・パレットを維持する。以降はB-09 / R-10 / X-11 / P-12 / P-13 / G-14 / F-15 / T-16 / S-17 / M-18 / D-19 / M-20の順。
- アイコンは反射光路、三連ミサイルポッド、連結爆弾、ドリル、プラズマリング、子爆弾ラック、拡幅ノズル、雷撃アンテナ、双銃身、マイン円盤、三脚砲台、流星ポッドで形状を区別する。
- 固有FXの行は新12武器順、列0〜3は命中、列4〜7は爆発・特殊効果。雷雲はT-16の特殊効果を使用。軌跡・落雷線・爆風リングはCanvasのドット状描画と併用する。
- `py -3 tools/generate_assets.py --weapons-only` で再生成。全生成にも含む。外部素材なし、透過RGBA、nearest-neighbor、固定シード7319。新武器描画は乱数を消費しない。

## 兵科アトラス（0.1.8）

- 行0 RANGER：標準ヘルメット・アンテナ・バックパック。
- 行1 SCOUT：薄い装甲、低いヘルメット、スカーフ、後傾アンテナ。
- 行2 GUARDIAN：幅広ヘルメット、大型肩装甲、盾、重いブーツ。
- 行3 WING：双翼フィン、分割クレスト、推進パック、飛行噴射。
- 列0〜11：待機 / 走行1 / 走行2 / 走行3 / 跳躍 / 落下 / 射撃 / 被弾 / 死亡 / ダッシュ / 飛行 / ホバー。固有動作は対応兵科で使用。
- 従来パレット・暗色輪郭・透過RGBA・アンチエイリアスなし。死亡は横倒し、SCOUTダッシュはスカーフ残光、WING飛行・ホバーは異なる噴射長。
- `py -3 tools/generate_assets.py --classes-only` で兵科のみ生成。引数なしの全生成にも含む。クラス生成は乱数を使用せず、既存素材のシード順に影響しない。
