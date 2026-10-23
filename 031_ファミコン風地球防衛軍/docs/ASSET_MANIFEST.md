# Asset Manifest

本番素材は `tools/generate_assets.py` が固定シード7319（M02は2207319）で生成するオリジナルPNG。アンチエイリアスなし、透過RGBA（背景のみRGB）。未採用のアート検討素材は末尾の別枠を参照。

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

## ART DIRECTION REFRESH / Study 01 — 本番未使用

`assets/art-refresh/study-01/`。固定シード24032023、ローカルの整数座標描画で新規制作。`--art-study-only` 専用で、通常生成には含めない。既存PNGは比較用に読み取るだけで上書きしない。

| 相対パス | PNG数 | セル / コマ数 | 論理寸法・内容 |
| --- | ---: | --- | --- |
| sprites/ranger.png / wing.png | 2 | 48×64 / 各2 | 24×32 world、標準兵/双翼のルック |
| sprites/crawler.png / needle.png | 2 | 64×64 / 各2 | 32×32描画枠、地上/飛行 |
| sprites/mother_crawler.png | 1 | 192×128 / 2 | 96×64描画枠、B-01 |
| weapons/icons.png | 1 | 32×32 / 5 | A-01・R-04・H-08・T-06・D-19 |
| weapons/equipped.png | 1 | 32×32 / 5 | 論理16×16の形状見本、アイコン画稿を共用 |
| weapons/projectiles.png | 1 | 32×32 / 5 | 論理16×16、弾体/電撃の見本 |
| weapons/impacts.png | 1 | 64×64 / 20 | 4列×5行、武器ごと4段階の効果 |
| tiles/city.png / underground.png | 2 | 32×32 / 各8 | 論理16×16。4列×2行 |
| backgrounds/{city,underground}_{far,middle,near}.png | 6 | 640×360 / 各1 | 論理320×180、独立3レイヤー |
| backgrounds/city.png / underground.png | 2 | 640×360 / 各1 | 背景の合成版 |
| preview/city_scene.png / underground_scene.png | 2 | 640×360 / 各1 | 配役・地形の静的構図、ミッション図面ではない |
| comparison.png | 1 | 1400×1320 / 1 | 現状/改善案/単色輪郭/背景の一覧 |

素材19 PNG・69コマ相当＋プレビュー3 PNG＝22 PNG・72コマ相当。別に `manifest.json` にセル/論理寸法・ポーズ名・用途・SHA256を記録する。全PNGはRGBA、背景/比較は不透明、スプライト/弾/効果は二値透過。比較一覧の説明文字だけはOSフォントで描画するため、別OSでは文字のピクセルが異なり得る。素材の描画にフォントや外部画像は使わない。

2ポーズは方向性確認用で、完成アニメーションではない。現在のゲームの素材マップには登録しない。描画サイズ・当たり判定・武器性能は既存のまま。詳細・検証・展開ルールは [ART_DIRECTION.md](ART_DIRECTION.md)。
