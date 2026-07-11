"use strict";

const INITIAL_SOUNDS = ["se_01.mp3", "se_02.mp3", "se_03.mp3"];
const DB_NAME = "sound-sampler-db";
const STORE_NAME = "sounds";
const elements = {
  startPanel: document.querySelector("#startPanel"), startButton: document.querySelector("#startButton"),
  stopButton: document.querySelector("#stopButton"), addButton: document.querySelector("#addButton"),
  fileInput: document.querySelector("#fileInput"), volume: document.querySelector("#volume"),
  volumeValue: document.querySelector("#volumeValue"), status: document.querySelector("#status"),
  padGrid: document.querySelector("#padGrid"), soundCount: document.querySelector("#soundCount")
};
let audioContext, masterGain, database;
let started = false, nextId = 1;
const sounds = new Map();
const activeSources = new Set();

function setStatus(message, kind = "") {
  elements.status.textContent = message;
  elements.status.className = `status ${kind}`.trim();
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IndexedDBを利用できません"));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storeRequest(mode, operation) {
  return new Promise((resolve, reject) => {
    const request = operation(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const getSavedSounds = () => storeRequest("readonly", (store) => store.getAll());
const removeSavedSound = (id) => storeRequest("readwrite", (store) => store.delete(id));
function saveSound(file) {
  const record = { name: file.name, type: file.type, blob: file, createdAt: Date.now() };
  return storeRequest("readwrite", (store) => store.add(record)).then((id) => ({ ...record, id }));
}

function updateSoundCount() {
  const available = [...sounds.values()].filter((sound) => sound.buffer).length;
  elements.soundCount.textContent = `${available} / ${sounds.size} sounds`;
}

function createPad(sound) {
  const pad = document.createElement("article");
  pad.className = "pad loading";
  pad.dataset.soundKey = sound.key;
  const playButton = document.createElement("button");
  playButton.className = "pad-button";
  playButton.type = "button";
  playButton.disabled = true;
  playButton.setAttribute("aria-label", `${sound.name}を再生`);
  const number = document.createElement("span");
  number.className = "pad-number";
  number.textContent = "LOAD";
  const name = document.createElement("span");
  name.className = "pad-name";
  name.textContent = sound.name;
  name.title = sound.name;
  playButton.append(number, name);
  playButton.addEventListener("pointerdown", (event) => { event.preventDefault(); playSound(sound.key); });
  pad.append(playButton);
  if (!sound.initial) {
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `${sound.name}を削除`);
    deleteButton.addEventListener("click", () => deleteSound(sound.key));
    pad.append(deleteButton);
  }
  elements.padGrid.append(pad);
  Object.assign(sound, { element: pad, playButton, numberElement: number });
  updateSoundCount();
}

function updatePad(sound, state) {
  sound.element.classList.remove("loading", "failed", "ready");
  sound.element.classList.add(state);
  sound.numberElement.textContent = state === "failed" ? "ERROR" : `PAD ${String(sound.order).padStart(2, "0")}`;
  sound.playButton.disabled = state === "failed";
}

async function decodeSound(sound, arrayBuffer) {
  try {
    sound.buffer = await audioContext.decodeAudioData(arrayBuffer);
    updatePad(sound, "ready");
    return true;
  } catch (error) {
    console.warn(`音声をデコードできません: ${sound.name}`, error);
    updatePad(sound, "failed");
    return false;
  } finally { updateSoundCount(); }
}

async function loadInitialSounds() {
  const results = await Promise.all(INITIAL_SOUNDS.map(async (name) => {
    const sound = { key: `initial-${nextId}`, name, initial: true, order: nextId++ };
    sounds.set(sound.key, sound);
    createPad(sound);
    try {
      const response = await fetch(`assets/sounds/${encodeURIComponent(name)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await decodeSound(sound, await response.arrayBuffer());
    } catch (error) {
      console.warn(`初期効果音を読み込めません: ${name}`, error);
      updatePad(sound, "failed"); updateSoundCount(); return false;
    }
  }));
  return results.filter(Boolean).length;
}

async function loadSavedSounds() {
  if (!database) return { loaded: 0, failed: 0 };
  const records = await getSavedSounds();
  let loaded = 0;
  for (const record of records) {
    const sound = { key: `saved-${record.id}`, dbId: record.id, name: record.name, initial: false, order: nextId++ };
    sounds.set(sound.key, sound); createPad(sound);
    if (await decodeSound(sound, await record.blob.arrayBuffer())) loaded++;
  }
  return { loaded, failed: records.length - loaded };
}

async function startSampler() {
  if (started) return;
  elements.startButton.disabled = true; elements.startButton.textContent = "読み込み中…";
  setStatus("効果音を読み込んでいます…");
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("このブラウザはWeb Audio APIに対応していません");
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = Number(elements.volume.value);
    masterGain.connect(audioContext.destination);
    await audioContext.resume();
    try { database = await openDatabase(); } catch (error) { console.warn(error); }
    const [initialLoaded, savedResult] = await Promise.all([loadInitialSounds(), loadSavedSounds()]);
    started = true;
    elements.startPanel.classList.add("ready"); elements.startButton.textContent = "準備完了"; elements.stopButton.disabled = false;
    const failed = INITIAL_SOUNDS.length - initialLoaded + savedResult.failed;
    const loaded = initialLoaded + savedResult.loaded;
    setStatus(`${loaded}件の効果音を読み込みました${failed ? `（${failed}件は読み込み失敗）` : ""}`, failed ? "error" : "success");
  } catch (error) {
    console.error(error); elements.startButton.disabled = false; elements.startButton.textContent = "もう一度試す";
    setStatus(error.message || "サンプラーを開始できませんでした", "error");
  }
}

function playSound(key) {
  const sound = sounds.get(key);
  if (!started || !sound?.buffer) return;
  if (audioContext.state === "suspended") audioContext.resume();
  const source = audioContext.createBufferSource();
  source.buffer = sound.buffer; source.connect(masterGain); activeSources.add(source);
  source.addEventListener("ended", () => activeSources.delete(source), { once: true });
  source.start(0);
  sound.element.classList.add("playing");
  window.setTimeout(() => sound.element?.classList.remove("playing"), 100);
}

function stopAll() {
  for (const source of activeSources) { try { source.stop(); } catch (_) { /* already stopped */ } }
  activeSources.clear();
  if (started) setStatus("再生中の効果音を停止しました", "success");
}

async function addFiles(fileList) {
  if (!started) return setStatus("先に「サンプラー開始」を押してください", "error");
  if (!database) return setStatus("端末への保存を利用できないため、効果音を追加できません", "error");
  let added = 0, failed = 0;
  for (const file of [...fileList]) {
    let record, sound;
    try {
      if (!file.type.startsWith("audio/") && !/\.(mp3|wav|m4a)$/i.test(file.name)) throw new Error("非対応のファイル形式です");
      record = await saveSound(file);
      sound = { key: `saved-${record.id}`, dbId: record.id, name: file.name, initial: false, order: nextId++ };
      sounds.set(sound.key, sound); createPad(sound);
      if (await decodeSound(sound, await file.arrayBuffer())) added++;
      else {
        failed++; await removeSavedSound(record.id);
        sound.element.remove(); sounds.delete(sound.key); updateSoundCount();
      }
    } catch (error) {
      console.warn(`追加できません: ${file.name}`, error);
      if (record) await removeSavedSound(record.id).catch(() => {});
      if (sound) { sound.element.remove(); sounds.delete(sound.key); updateSoundCount(); }
      failed++;
    }
  }
  setStatus(`${added}件を追加しました${failed ? `（${failed}件は追加失敗）` : ""}`, failed ? "error" : "success");
  elements.fileInput.value = "";
}

async function deleteSound(key) {
  const sound = sounds.get(key);
  if (!sound || sound.initial) return;
  try {
    await removeSavedSound(sound.dbId); sound.element.remove(); sounds.delete(key); updateSoundCount();
    setStatus(`「${sound.name}」を削除しました`, "success");
  } catch (error) { console.error(error); setStatus("効果音を削除できませんでした", "error"); }
}

elements.startButton.addEventListener("click", startSampler);
elements.stopButton.addEventListener("click", stopAll);
elements.addButton.addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", () => addFiles(elements.fileInput.files));
elements.volume.addEventListener("input", () => {
  const value = Number(elements.volume.value);
  elements.volumeValue.value = `${Math.round(value * 100)}%`;
  if (masterGain && audioContext) masterGain.gain.setValueAtTime(value, audioContext.currentTime);
});
window.addEventListener("pagehide", stopAll);
