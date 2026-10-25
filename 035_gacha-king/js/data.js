export const VERSION = "0.1.1";
export const ASSET_SERIES = "henteko-vol01";
const ASSET_BASE = `./assets/items/${ASSET_SERIES}/`;

export const RARITIES = {
  common: { label: "COMMON", stars: 1, color: "#8da0aa" },
  rare: { label: "RARE", stars: 2, color: "#48b5ff" },
  epic: { label: "EPIC", stars: 3, color: "#a66bff" },
  legendary: { label: "LEGEND", stars: 4, color: "#ff9d2e" },
  mythic: { label: "MYTHIC", stars: 5, color: "#ff4e8b" }
};

export const ITEMS = [
  { id: "soda-ring", legacyName: "ソーダリング", assetId: "hk01_001", assetRarity: "N", name: "ねむみみ", rarity: "common", weight: 1500, value: 100, icon: "◉", image: `${ASSET_BASE}hk01_001.png`, flavor: "桃色の洋ナシ体型。大きなたれ耳で夢を見るへんてこ生物。" },
  { id: "pixel-cat", legacyName: "ピクセルねこ", assetId: "hk01_002", assetRarity: "N", name: "めだまめ", rarity: "common", weight: 1500, value: 110, icon: "▣", image: `${ASSET_BASE}hk01_002.png`, flavor: "そら豆型の緑の体。大きな一つ目と葉っぱの触角が自慢。" },
  { id: "moon-sticker", legacyName: "月面ステッカー", assetId: "hk01_003", assetRarity: "N", name: "もこつの", rarity: "common", weight: 1500, value: 120, icon: "☾", image: `${ASSET_BASE}hk01_003.png`, flavor: "黄色い丸三角の体に、サンゴ色の一本角ともこもこの裾。" },
  { id: "neon-key", legacyName: "ネオンキー", assetId: "hk01_004", assetRarity: "N", name: "ぷくひれ", rarity: "rare", weight: 1000, value: 220, icon: "◆", image: `${ASSET_BASE}hk01_004.png`, flavor: "水色のしずく体型。丸いヒレでゆったり泳ぐ。" },
  { id: "cloud-bottle", legacyName: "雲の小瓶", assetId: "hk01_005", assetRarity: "N", name: "しっぽろ", rarity: "rare", weight: 1000, value: 240, icon: "☁", image: `${ASSET_BASE}hk01_005.png`, flavor: "薄紫色の丸い体よりも、大きな渦巻きしっぽが目印。" },
  { id: "golden-dice", legacyName: "黄金ダイス", assetId: "hk01_006", assetRarity: "R", name: "かさぷに", rarity: "rare", weight: 1000, value: 260, icon: "⚄", image: `${ASSET_BASE}hk01_006.png`, flavor: "水玉模様の大きな傘と、青緑のひだ襟を持つ雨の生物。" },
  { id: "dj-slime", legacyName: "DJスライム", assetId: "hk01_007", assetRarity: "R", name: "ほしづの", rarity: "epic", weight: 750, value: 480, icon: "♬", image: `${ASSET_BASE}hk01_007.png`, flavor: "星形の先端を持つ、金色の二本角が夜空にきらめく。" },
  { id: "meteor-shard", legacyName: "流星のかけら", assetId: "hk01_008", assetRarity: "R", name: "はなぐち", rarity: "epic", weight: 750, value: 520, icon: "✦", image: `${ASSET_BASE}hk01_008.png`, flavor: "花びらの大きな襟と、すぼめた口がチャームポイント。" },
  { id: "dragon-egg", legacyName: "眠り竜の卵", assetId: "hk01_009", assetRarity: "R", name: "しまうろこ", rarity: "legendary", weight: 400, value: 950, icon: "⬡", image: `${ASSET_BASE}hk01_009.png`, flavor: "太いうろこ帯をまとい、稲妻形の尾をひらめかせる。" },
  { id: "king-cape", legacyName: "はじまりの王衣", assetId: "hk01_010", assetRarity: "SR", name: "つきまんと", rarity: "legendary", weight: 400, value: 1050, icon: "♜", image: `${ASSET_BASE}hk01_010.png`, flavor: "金の三日月角と、縁取りのある紫のマントをまとう。" },
  { id: "galaxy-crown", legacyName: "銀河王冠", assetId: "hk01_011", assetRarity: "SR", name: "にじはね", rarity: "mythic", weight: 100, value: 2400, icon: "♛", image: `${ASSET_BASE}hk01_011.png`, flavor: "桃・黄・水色の三色でできた大きな虹の羽。" },
  { id: "time-capsule", legacyName: "時のカプセル", assetId: "hk01_012", assetRarity: "SSR", name: "おうかんぽよ", rarity: "mythic", weight: 100, value: 2800, icon: "∞", image: `${ASSET_BASE}hk01_012.png`, flavor: "大きな王冠と巻き角を持つ、へんてこ生物たちの王。" }
];

export const MACHINE = {
  id: "first-capsule",
  name: "FIRST CAPSULE",
  cost: 200,
  items: ITEMS.map((item) => item.id),
  rates: [
    ["common", 45], ["rare", 30], ["epic", 15], ["legendary", 8], ["mythic", 2]
  ]
};

export const GOALS = {
  money: { name: "資金王", icon: "¥", target: 3000, unit: "G" },
  collection: { name: "コレクション王", icon: "◇", target: 8, unit: "種" },
  popularity: { name: "人気王", icon: "♡", target: 120, unit: "人" }
};

export const itemById = (id) => ITEMS.find((item) => item.id === id);
