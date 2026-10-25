export const VERSION = "0.1.0";

export const RARITIES = {
  common: { label: "COMMON", stars: 1, color: "#8da0aa" },
  rare: { label: "RARE", stars: 2, color: "#48b5ff" },
  epic: { label: "EPIC", stars: 3, color: "#a66bff" },
  legendary: { label: "LEGEND", stars: 4, color: "#ff9d2e" },
  mythic: { label: "MYTHIC", stars: 5, color: "#ff4e8b" }
};

export const ITEMS = [
  { id: "soda-ring", name: "ソーダリング", rarity: "common", weight: 1500, value: 100, icon: "◉", flavor: "しゅわっと光る玩具の指輪。" },
  { id: "pixel-cat", name: "ピクセルねこ", rarity: "common", weight: 1500, value: 110, icon: "▣", flavor: "8bitの夢を見る小さなねこ。" },
  { id: "moon-sticker", name: "月面ステッカー", rarity: "common", weight: 1500, value: 120, icon: "☾", flavor: "どこに貼っても月面仕様。" },
  { id: "neon-key", name: "ネオンキー", rarity: "rare", weight: 1000, value: 220, icon: "◆", flavor: "まだ見ぬ扉の合鍵。" },
  { id: "cloud-bottle", name: "雲の小瓶", rarity: "rare", weight: 1000, value: 240, icon: "☁", flavor: "晴れの日に採れた雲入り。" },
  { id: "golden-dice", name: "黄金ダイス", rarity: "rare", weight: 1000, value: 260, icon: "⚄", flavor: "王になる目だけ少し重い。" },
  { id: "dj-slime", name: "DJスライム", rarity: "epic", weight: 750, value: 480, icon: "♬", flavor: "夜になるとビートを刻む。" },
  { id: "meteor-shard", name: "流星のかけら", rarity: "epic", weight: 750, value: 520, icon: "✦", flavor: "願い事は一回まで。" },
  { id: "dragon-egg", name: "眠り竜の卵", rarity: "legendary", weight: 400, value: 950, icon: "⬡", flavor: "たまに中から寝息が聞こえる。" },
  { id: "king-cape", name: "はじまりの王衣", rarity: "legendary", weight: 400, value: 1050, icon: "♜", flavor: "着る者の背筋が自然と伸びる。" },
  { id: "galaxy-crown", name: "銀河王冠", rarity: "mythic", weight: 100, value: 2400, icon: "♛", flavor: "星々が認めた王のしるし。" },
  { id: "time-capsule", name: "時のカプセル", rarity: "mythic", weight: 100, value: 2800, icon: "∞", flavor: "開けた瞬間が未来になる。" }
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
