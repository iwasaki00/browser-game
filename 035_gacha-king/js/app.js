import { GOALS, ITEMS, MACHINE, RARITIES, VERSION, itemById } from "./data.js";
import { createGame } from "./game-state.js";

const game = createGame();
game.load();
let activeTab = "home";
let crownType = null;
let toastTimer;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const fmt = (number) => new Intl.NumberFormat("ja-JP").format(Math.round(number));
const rarityStyle = (item) => `--rarity:${RARITIES[item.rarity].color}`;
const rarityText = (item) => `${"★".repeat(RARITIES[item.rarity].stars)} ${RARITIES[item.rarity].label}`;

function imageMarkup(item, alt = item.name, eager = false) {
  return `<img src="${item.image}" alt="${alt}" width="512" height="512" loading="${eager ? "eager" : "lazy"}" decoding="async" data-item-image><span class="image-fallback" aria-hidden="true">${item.icon}</span>`;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function showTab(tab) {
  activeTab = tab;
  $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.dataset.screen === tab));
  $$(".tabbar button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
}

function renderGoals(state) {
  const current = { money: state.coins, collection: game.collectionCount(), popularity: state.followers };
  const achieved = game.achievements();
  $("#goals").innerHTML = Object.entries(GOALS).map(([key, goal]) => `
    <article class="panel goal ${achieved[key] ? "complete" : ""}">
      <span class="crowns">♛ ${state.crowns[key]}</span><div class="goal-icon">${goal.icon}</div><h3>${goal.name}</h3>
      <p>${fmt(current[key])} / ${fmt(goal.target)} ${goal.unit}</p><div class="progress"><i style="width:${Math.min(100, current[key] / goal.target * 100)}%"></i></div>
      ${achieved[key] ? `<button class="claim" data-crown="${key}">達成！</button>` : ""}
    </article>`).join("");
}

function renderInventory(state) {
  if (!state.inventory.length) {
    $("#inventory").innerHTML = `<div class="panel empty"><strong>所持品は空です</strong>ガチャで最初の一品を手に入れよう。</div>`;
    return;
  }
  const counts = new Map();
  state.inventory.forEach((owned) => counts.set(owned.itemId, (counts.get(owned.itemId) || 0) + 1));
  $("#inventory").innerHTML = ITEMS.filter((item) => counts.has(item.id)).map((item) => `
    <button class="panel item-tile" data-detail="${item.id}" style="${rarityStyle(item)}">
      <span class="item-art">${imageMarkup(item)}</span><span class="item-tile-copy"><small class="rarity">${rarityText(item)}</small><strong>${item.name}</strong><em>所持 ${counts.get(item.id)}</em></span>
    </button>`).join("");
}

function renderItemDetail(itemId) {
  const state = game.getState();
  const item = itemById(itemId);
  const owned = state.inventory.filter((entry) => entry.itemId === itemId);
  if (!item || !owned.length) return $("#item-dialog").close();
  const selected = owned[0];
  const postable = owned.find((entry) => !entry.posted);
  $("#item-detail").innerHTML = `
    <div class="detail-art rarity-${item.rarity}" style="${rarityStyle(item)}"><div class="item-art">${imageMarkup(item, item.name, true)}</div></div>
    <div class="detail-heading"><div><p class="rarity">${rarityText(item)}</p><h2>${item.name}</h2></div><span>所持 ${owned.length}</span></div>
    <p class="detail-flavor">${item.flavor}</p>
    <div class="detail-actions"><button data-sell="${selected.uid}"><small>すぐに換金</small>即売り <b>${fmt(item.value)} G</b></button><button data-list="${selected.uid}"><small>8秒で成約</small>フリマ <b>${fmt(item.value * 1.45)} G</b></button></div>
    <button class="primary detail-post" data-post="${postable?.uid || ""}" ${postable ? "" : "disabled"}>${postable ? "このアイテムをSNS投稿" : "所持分はすべて投稿済み"}</button>`;
}

function renderListings(state) {
  const now = Date.now();
  $("#listings").innerHTML = state.listings.length ? state.listings.map((listing) => {
    const item = itemById(listing.itemId);
    const left = Math.max(0, Math.ceil((listing.completesAt - now) / 1000));
    return `<article class="panel item-card market-card" style="${rarityStyle(item)}"><div class="item-art">${imageMarkup(item)}</div><div><span class="rarity">出品中 · ${RARITIES[item.rarity].label}</span><h3>${item.name}</h3><p class="timer">${left ? `あと ${left} 秒` : "まもなく成約"}</p><p>成約価格 ${fmt(listing.price)} G</p></div></article>`;
  }).join("") : `<div class="panel empty"><strong>出品はありません</strong>所持品の詳細画面からフリマへ出品できます。</div>`;
}

function renderPosts(state) {
  $("#post-count").textContent = `${state.posts.length} POSTS`;
  $("#profile-followers").textContent = fmt(state.followers);
  $("#posts").innerHTML = state.posts.length ? state.posts.map((post) => {
    const item = itemById(post.itemId);
    return `<article class="panel post" style="${rarityStyle(item)}"><div class="post-head"><div class="avatar">♛</div><div><strong>@gacha_king</strong><br><span>ROUND ${state.cycle} · ${new Date(post.createdAt).toLocaleDateString("ja-JP")}</span></div></div><div class="post-content"><div class="item-art">${imageMarkup(item)}</div><div><span class="rarity">${RARITIES[item.rarity].label}</span><h3>${item.name}をゲット！</h3><p>#ガチャ王 #${item.name}</p></div></div><div class="post-stats">♡ +${post.followers} new followers</div></article>`;
  }).join("") : `<div class="panel empty"><strong>まだ投稿がありません</strong>所持品の詳細画面から自慢の一品を投稿しよう。</div>`;
}

function renderBook(state) {
  $("#book-progress").textContent = `${state.discovered.length} / ${ITEMS.length} 発見 · 周回後も継承`;
  $("#book-grid").innerHTML = ITEMS.map((item) => {
    const found = state.discovered.includes(item.id);
    return `<div class="book-item ${found ? "" : "locked"}" style="${rarityStyle(item)}"><div class="item-art">${imageMarkup(item, found ? item.name : "未発見アイテム")}</div><p>${found ? item.name : "？？？"}</p></div>`;
  }).join("");
}

function render() {
  game.settleListings();
  const state = game.getState();
  $("#coins").textContent = `${fmt(state.coins)} G`;
  $("#followers").textContent = fmt(state.followers);
  $("#cycle").textContent = state.cycle;
  $("#draw-button").disabled = state.coins < MACHINE.cost;
  document.body.classList.toggle("reduced-motion", state.settings.reducedMotion);
  $("#motion-toggle").checked = state.settings.reducedMotion;
  renderGoals(state);
  renderInventory(state);
  renderListings(state);
  renderPosts(state);
  renderBook(state);
  $("#home-stats").innerHTML = `<div><strong>${state.discovered.length}/${ITEMS.length}</strong><span>図鑑</span></div><div><strong>${state.stats.draws}</strong><span>ガチャ</span></div><div><strong>${state.stats.sales}</strong><span>売却</span></div><div><strong>${Object.values(state.crowns).reduce((a, b) => a + b, 0)}</strong><span>王冠</span></div>`;
  const rescueNeeded = state.coins < MACHINE.cost && !state.inventory.length && !state.listings.length;
  $("#rescue-button").classList.toggle("hidden", !rescueNeeded);
}

function showResult(item, isNew) {
  const dialog = $("#result-dialog");
  dialog.className = `modal result-modal rarity-${item.rarity}`;
  $("#result-card").innerHTML = `<div style="${rarityStyle(item)}"><span class="result-status ${isNew ? "new" : "owned"}">${isNew ? "NEW" : "所持済み"}</span><div class="item-art result-art">${imageMarkup(item, item.name, true)}</div><p class="rarity">${rarityText(item)}</p><h2>${item.name}</h2><p>${item.flavor}</p><button id="result-continue" class="primary big">所持品を見る <span>GET!</span></button></div>`;
  dialog.showModal();
}

document.addEventListener("error", (event) => {
  if (event.target.matches?.("img[data-item-image]")) event.target.closest(".item-art")?.classList.add("image-error");
}, true);

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.tab) return showTab(button.dataset.tab);
  if (button.hasAttribute("data-close")) return button.closest("dialog")?.close();
  if (button.hasAttribute("data-skip")) return $("#result-dialog").classList.add("skipped");
  if (button.dataset.detail) { renderItemDetail(button.dataset.detail); return $("#item-dialog").showModal(); }
  if (button.id === "result-continue") { $("#result-dialog").close(); return showTab("inventory"); }
  if (button.id === "draw-button") {
    const result = game.draw();
    if (!result.ok) return showToast("コインが足りません");
    showResult(result.item, result.isNew);
    return render();
  }
  if (button.dataset.sell) {
    const dialog = button.closest("dialog");
    const result = game.quickSell(button.dataset.sell);
    if (result.ok) showToast(`${fmt(result.amount)} G で即売りしました`);
    dialog?.close();
    return render();
  }
  if (button.dataset.list) {
    const dialog = button.closest("dialog");
    if (game.listItem(button.dataset.list).ok) showToast("フリマへ出品しました");
    dialog?.close();
    return render();
  }
  if (button.dataset.post) {
    const result = game.postItem(button.dataset.post);
    if (result.ok) showToast(`フォロワーが ${result.followers} 人増えました`);
    else showToast("この所持品は投稿済みです");
    button.closest("dialog")?.close();
    return render();
  }
  if (button.dataset.crown) {
    crownType = button.dataset.crown;
    $("#crown-title").textContent = `${GOALS[crownType].name}の王冠！`;
    return $("#crown-dialog").showModal();
  }
  if (button.id === "crown-confirm" && crownType) {
    const name = GOALS[crownType].name;
    game.claimCrown(crownType);
    crownType = null;
    $("#crown-dialog").close();
    showToast(`${name}を獲得。新しい周回へ！`);
    return showTab("home");
  }
  if (button.id === "rescue-button") { if (game.rescue().ok) showToast("王様ボーナス 600 G！"); return render(); }
  if (button.id === "book-button") return $("#book-dialog").showModal();
  if (button.id === "settings-button") return $("#settings-dialog").showModal();
});

$("#motion-toggle").addEventListener("change", (event) => game.setReducedMotion(event.target.checked));
$("#rates").innerHTML = MACHINE.rates.map(([id, rate]) => `<div class="rate-row"><b style="color:${RARITIES[id].color}">${RARITIES[id].label}</b><i style="max-width:${rate * 2}px;background:${RARITIES[id].color}"></i><span>${rate}%</span></div>`).join("");
$(".version").textContent = `GACHA KING v${VERSION}`;
game.subscribe(render);
setInterval(() => { if (activeTab === "market") render(); else game.settleListings(); }, 1000);
render();
