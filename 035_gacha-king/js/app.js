import { GOALS, ITEMS, MACHINE, RARITIES, VERSION, itemById } from "./data.js";
import { createGame } from "./game-state.js";
import { createGachaExperience } from "./experience.js";

const game = createGame();
game.load();
let activeTab = "home";
let crownType = null;
let toastTimer;
let experience;
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
  if (experience?.busy) return;
  experience?.cancelTurn();
  activeTab = tab;
  const machineTab = tab === "home" || tab === "gacha";
  if (machineTab) $(`#${tab}-machine-mount`).append($("#gacha-machine"));
  $("#machine-actions").hidden = !machineTab;
  $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.dataset.screen === tab));
  $$(".tabbar button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
}

function renderGoals(state) {
  const current = { money: game.moneyProgress(), collection: game.collectionCount(), popularity: state.followers };
  const achieved = game.achievements();
  $("#goals").innerHTML = Object.entries(GOALS).map(([key, goal]) => `
    <article class="panel goal ${achieved[key] ? "complete" : ""}">
      <span class="crowns">♛ ${state.crowns[key]}</span><div class="goal-icon">${goal.icon}</div><h3>${goal.name}</h3>
      <p>${key === "money" ? "有効 " : ""}${fmt(current[key])} / ${fmt(goal.target)} ${goal.unit}</p><div class="progress"><i style="width:${Math.min(100, current[key] / goal.target * 100)}%"></i></div>
      ${key === "money" && state.supportReceived ? `<small class="goal-support">支援 ${fmt(state.supportReceived)} Gは判定外</small>` : ""}
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
      <span class="item-art">${imageMarkup(item, item.name, true)}</span><span class="item-tile-copy"><small class="rarity">${rarityText(item)}</small><strong>${item.name}</strong><em>所持 ${counts.get(item.id)}</em></span>
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
    return `<article class="panel item-card market-card" style="${rarityStyle(item)}"><div class="item-art">${imageMarkup(item, item.name, true)}</div><div><span class="rarity">出品中 · ${RARITIES[item.rarity].label}</span><h3>${item.name}</h3><p class="timer">${left ? `あと ${left} 秒` : "まもなく成約"}</p><p>成約価格 ${fmt(listing.price)} G</p></div></article>`;
  }).join("") : `<div class="panel empty"><strong>出品はありません</strong>所持品の詳細画面からフリマへ出品できます。</div>`;
}

function renderPosts(state) {
  $("#post-count").textContent = `${state.posts.length} POSTS`;
  $("#profile-followers").textContent = fmt(state.followers);
  $("#posts").innerHTML = state.posts.length ? state.posts.map((post) => {
    const item = itemById(post.itemId);
    return `<article class="panel post" style="${rarityStyle(item)}"><div class="post-head"><div class="avatar">♛</div><div><strong>@gacha_king</strong><br><span>ROUND ${state.cycle} · ${new Date(post.createdAt).toLocaleDateString("ja-JP")}</span></div></div><div class="post-content"><div class="item-art">${imageMarkup(item, item.name, true)}</div><div><span class="rarity">${RARITIES[item.rarity].label}</span><h3>${item.name}をゲット！</h3><p>#ガチャ王 #${item.name}</p></div></div><div class="post-stats">♡ +${post.followers} new followers</div></article>`;
  }).join("") : `<div class="panel empty"><strong>まだ投稿がありません</strong>所持品の詳細画面から自慢の一品を投稿しよう。</div>`;
}

function renderBook(state) {
  $("#book-progress").textContent = `${state.discovered.length} / ${ITEMS.length} 発見 · 周回後も継承`;
  $("#book-grid").innerHTML = ITEMS.map((item) => {
    const found = state.discovered.includes(item.id);
    return `<div class="book-item ${found ? "" : "locked"}" style="${rarityStyle(item)}"><div class="item-art">${imageMarkup(item, found ? item.name : "未発見アイテム", true)}</div><p>${found ? item.name : "？？？"}</p></div>`;
  }).join("");
}

function render() {
  game.settleListings();
  const state = game.getState();
  $("#coins").textContent = `${fmt(state.coins)} G`;
  $("#followers").textContent = fmt(state.followers);
  $("#cycle").textContent = state.cycle;
  document.body.classList.toggle("reduced-motion", state.settings.reducedMotion);
  $("#motion-toggle").checked = state.settings.reducedMotion;
  $("#mute-toggle").checked = state.settings.muted;
  $("#play-mode").value = state.settings.playMode;
  renderGoals(state);
  renderInventory(state);
  renderListings(state);
  renderPosts(state);
  $("#home-stats").innerHTML = `<span>図鑑 <b>${state.discovered.length}/${ITEMS.length}</b></span><span>♛ <b>${Object.values(state.crowns).reduce((a, b) => a + b, 0)}</b></span><span>${state.stats.draws}回まわした</span>`;
  const rescueNeeded = state.coins < MACHINE.cost && !state.inventory.length && !state.listings.length;
  $("#rescue-button").classList.toggle("hidden", !rescueNeeded);
  $("#funds-help").classList.toggle("hidden", state.coins >= MACHINE.cost || rescueNeeded);
  experience?.sync();
}

function showResult(pending, sound = true) {
  const item = itemById(pending.itemId);
  const { isNew, collectionBonus } = pending;
  const state = game.getState();
  const owned = state.inventory.find((entry) => entry.uid === pending.uid);
  const posted = owned?.posted || state.posts.some((post) => post.sourceUid === pending.uid);
  const rarityGain = [0, 3, 10, 24, 55][Object.keys(RARITIES).indexOf(item.rarity)];
  const followers = Math.round(8 + item.value / 40 + rarityGain);
  const dialog = $("#result-dialog");
  dialog.className = `modal result-modal revealed rarity-${item.rarity} ${isNew ? "new-find" : "duplicate-find"}`;
  $("#result-card").hidden = false;
  $("#result-card").innerHTML = `<div style="${rarityStyle(item)}"><div class="result-badges"><span class="result-status ${isNew ? "new" : "owned"}">${isNew ? "NEW · はじめまして！" : "所持済み"}</span>${collectionBonus ? `<span class="collection-bonus">周回初GET +${fmt(collectionBonus)} G</span>` : ""}</div><div class="item-art result-art">${imageMarkup(item, item.name, true)}</div><p class="rarity">${rarityText(item)}</p><h2>${item.name}</h2><p class="result-flavor">${item.flavor}</p><div class="result-facts"><span>図鑑 <b>${state.discovered.length} / ${ITEMS.length}</b></span><span>即売り <b>${fmt(item.value)} G</b></span><span>フリマ <b>${fmt(item.value * 1.45)} G</b></span></div><p class="social-potential">♡ ${RARITIES[item.rarity].stars >= 4 ? "注目まちがいなし！" : "今日のへんてこをシェア"} 投稿で +${followers}人</p><button id="result-again" class="primary big" ${state.coins < MACHINE.cost ? "disabled" : ""}>もう1回回す <span>200 G ↻</span></button><div class="result-actions"><button id="result-sell" ${owned ? "" : "disabled"}>${owned ? `即売り ${fmt(item.value)} G` : "売却済み"}</button><button id="result-post" ${owned && !posted ? "" : "disabled"}>${posted ? "投稿済み ✓" : owned ? "SNS投稿" : "投稿できません"}</button></div><button id="result-keep" class="keep-button">${owned ? "保管して戻る" : "筐体へ戻る"}</button><small class="autosave-note">獲得品は自動保存されました</small></div>`;
  if (!dialog.open) dialog.showModal();
  if (sound) experience?.reward(RARITIES[item.rarity].stars);
  $("#result-again").focus({ preventScroll: true });
}

document.addEventListener("error", (event) => {
  if (event.target.matches?.("img[data-item-image]")) event.target.closest(".item-art")?.classList.add("image-error");
}, true);

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.tab) return showTab(button.dataset.tab);
  if (button.hasAttribute("data-close")) return button.closest("dialog")?.close();
  if (button.hasAttribute("data-skip")) return experience.open({ skip: true });
  if (button.dataset.detail) { renderItemDetail(button.dataset.detail); return $("#item-dialog").showModal(); }
  if (button.id === "result-keep") return experience.finish();
  if (button.id === "result-again") {
    if (!game.getState().pendingDraw?.revealed || !$("#result-dialog").open) return;
    experience.finish();
    return experience.tapTurn();
  }
  if (button.id === "result-sell" || button.id === "result-post") {
    const pending = game.getState().pendingDraw;
    if (!pending?.revealed) return;
    const result = button.id === "result-sell" ? game.quickSell(pending.uid) : game.postItem(pending.uid);
    if (result.ok) showToast(button.id === "result-sell" ? `${fmt(result.amount)} G で即売りしました` : `フォロワー +${result.followers}人！`);
    return showResult(pending, false);
  }
  if (button.id === "draw-button") return experience.tapTurn();
  if (button.id === "dispense-skip") return experience.open({ skip: true });
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
    $("#goals-dialog").close();
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
  if (button.id === "rescue-button") { if (game.rescue().ok) showToast("王様支援 600 G（資金王の判定外）"); return render(); }
  if (button.id === "book-button") { renderBook(game.getState()); return $("#book-dialog").showModal(); }
  if (button.id === "settings-button" || button.id === "mode-button") { experience.cancelTurn(); return $("#settings-dialog").showModal(); }
  if (button.id === "goals-button" || button.hasAttribute("data-open-goals")) { experience.cancelTurn(); return $("#goals-dialog").showModal(); }
});

$("#motion-toggle").addEventListener("change", (event) => game.setReducedMotion(event.target.checked));
$("#mute-toggle").addEventListener("change", (event) => game.setMuted(event.target.checked));
$("#play-mode").addEventListener("change", (event) => game.setPlayMode(event.target.value));
$("#machine-samples").innerHTML = [ITEMS[0], ITEMS[6], ITEMS[11]].map((item) => `<span class="item-art" style="${rarityStyle(item)}">${imageMarkup(item, item.name, true)}</span>`).join("");
$("#rates").innerHTML = MACHINE.rates.map(([id, rate]) => `<div class="rate-row"><b style="color:${RARITIES[id].color}">${RARITIES[id].label}</b><i style="max-width:${rate * 2}px;background:${RARITIES[id].color}"></i><span>${rate}%</span></div>`).join("");
$(".version").textContent = `GACHA KING v${VERSION}`;
experience = createGachaExperience({ game, showResult, notify: showToast });
game.subscribe(render);
setInterval(() => { if (activeTab === "market") render(); else game.settleListings(); }, 1000);
render();
experience.restore();
