# Asset Manifest

## UNIFIED 01 / 0.2.3-C（LAB統合試用）

生成：`py -3 tools/generate_assets.py --art-unified-only` → `assets/art-refresh/unified-01/`。既存のORIGINAL／Study 01／01-Bは上書きしない。全寸法・SHA256・フレームID・147行の対応表は[統合JSON](../assets/art-refresh/unified-01/manifest.json)、状態・アンカー・利用制限は[ART_UNIFICATION.md](ART_UNIFICATION.md)。

| ファイル群（新ルート内） | PNG | 索引セル | 制作・参照 |
| --- | ---: | ---: | --- |
| sprites/ranger, scout, guardian, wing | 4 | 48 | 全4兵科・既存12列、source48×64→24×32world |
| sprites/crawler, spider, needle, beetle, worm, spitter | 6 | 108 | 全6通常敵、6列×3配色 |
| sprites/boss, queen, nest, barrier | 4 | 24 | 両ボス・ネスト・破壊障害物、各6列 |
| far/上記14種 | 14 | 180 | 同サイズ・同アンカーの実験用遠景版 |
| weapons/icons, equipped, projectiles | 3 | 60 | 既存20武器、各1セル。名称・IDはデータから取得 |
| weapons/impacts, special | 2 | 160 | 20武器×各4コマ、実弾・命中・特殊FXに接続 |
| backgrounds/city*, underground* | 8 | 8 | 各3レイヤー＋合成。実ゲームは合成2枚のみ読込 |
| tiles/city, underground | 2 | 128 | 各16種×4差分。M01の8〜15は未配置の装飾候補 |
| effects/acid, wave, nestBreak, bossBreak | 4 | 24 | 4／4／8／8コマ、既存寿命・位置を維持 |
| contact-sheet | 1 | — | 素材一覧。ゲーム画面ではない |
| **合計** | **48** | **740** | 配色・遠景・未使用互換列を含む。740動作という意味ではない |

`manifest.json`は各シートの元アセット、所有者、ミッション、状態、論理寸法、生成元、描画基準点を記録し、20×5件の武器セル対応も明示する。今回の対象に未制作のランタイム画像はない。文字／バー／アイテム／既存小粒子は対象外。ORIGINALを通常初期表示として維持し、統合セットは正式採用しない。

実行時は41アトラスのみを初回遅延読込し、個体ごとに複製しない。ファイル計206,982 bytes、RGBA展開寸法の単純合計16,410,624 bytes（約15.7 MiB）。ブラウザの実メモリ／GPU使用量ではなく概算であり、旧セットのキャッシュやGPUコピーは別途必要。実機測定は未確認。

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

## ART DIRECTION REFRESH / Study 01 — 本番未使用・LAB試用

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

2ポーズは方向性確認用で、完成アニメーションではない。通常ゲームの素材マップには登録しない。0.2.3-AではLABの専用描画アダプターから必要13画像だけを遅延読み込みする。描画サイズ・当たり判定・武器性能は既存のまま。詳細・検証・展開ルールは [ART_DIRECTION.md](ART_DIRECTION.md)。

### 0.2.3-Aの最小補完

`--art-in-game-only` で `in-game/ranger_body.png` / `wing_body.png`（各96×64、48×64セル2コマ、論理24×32）と `anchors.json` を生成。焼き込まれた銃だけを除き、武器表示の二重化を防ぐ。元のStudy 01の22 PNG／マニフェストは変更しない。Studyフォルダ合計は24 PNGとなるが、追加の2 PNGは本番素材ではなくLAB内試用専用。独立プレビューは引き続き元サンプルを使用する。

## STUDY 01-B / 0.2.3-B — 比較試用専用

出力 `assets/art-refresh/study-01-b/`。生成は `py -3 tools/generate_assets.py --art-readability-only`、`tools/art_readability.py`。識別シード24032024、元形状／配置のシード24032023、追加乱数なし。同環境で再生成バイト一致、二値透過、旧assetsのハッシュ不変を検証する。通常公開素材は置換しない。

| パス | PNG数 | 原画セル／配列 | 論理寸法・用途 |
| --- | ---: | --- | --- |
| sprites/ranger.png / wing.png | 2 | 48×64、12列1行＝各12コマ | 24×32、銃なし胴体、待機／歩行3／跳躍／落下／射撃／被弾／死亡／互換ダッシュ／飛行／ホバー |
| sprites/crawler.png / needle.png | 2 | 64×64、4列3行＝各12セル | 32×32、移動2／攻撃／死亡、3つの甲殻配色 |
| sprites/mother_crawler.png | 1 | 192×128、4列1行＝4コマ | 96×64、B-01の移動2／攻撃／死亡 |
| backgrounds/{city,underground}_{far,middle,near}.png | 6 | 640×360、各1 | 320×180、深度・戦闘帯で彩度／明度調整 |
| backgrounds/city.png / underground.png | 2 | 640×360、各1 | 同3層の合成。既存の反復／パララックスに接続 |
| tiles/city.png / underground.png | 2 | 32×32、4列2行＝各8 | 16×16、衝突面の上端だけ明瞭化 |

計15 PNG、76セル相当（うち通常敵配色重複を含む）＋JSONマニフェスト。列順／行数／実寸／SHA256を記録する。武器5種の4 PNGは元Study 01を共用し、新フォルダに重複出力しない。元Study 01の24 PNGと本番23 PNGは維持。素材帳は `reports/art-comparison/study-01-b/asset-catalogue.png`、実画面の証拠とは区別する。
