(function () {
  const key = "ai-legacy-mvp-save";

  const defaults = {
    currentId: window.SCENARIO_START_ID || "common_001",
    endings: {},
    read: {},
    truthUnlocked: false,
    volume: 60
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalize(data) {
    const merged = Object.assign(clone(defaults), data || {});
    merged.endings = Object.assign({}, data && data.endings);
    merged.read = Object.assign({}, data && data.read);
    merged.truthUnlocked = Boolean(merged.truthUnlocked);
    merged.volume = Number.isFinite(Number(merged.volume)) ? Number(merged.volume) : defaults.volume;
    return merged;
  }

  function load() {
    try {
      return normalize(JSON.parse(localStorage.getItem(key)));
    } catch (_error) {
      return clone(defaults);
    }
  }

  function save(data) {
    const normalized = normalize(data);
    localStorage.setItem(key, JSON.stringify(normalized));
    return normalized;
  }

  function clearProgress() {
    localStorage.removeItem(key);
    return clone(defaults);
  }

  function markRead(id) {
    const data = load();
    data.read[id] = true;
    return save(data);
  }

  function markEnding(endingId) {
    const data = load();
    data.endings[endingId] = true;
    data.truthUnlocked = isTruthUnlocked(data.endings);
    return save(data);
  }

  function isTruthUnlocked(endings) {
    return (window.NORMAL_ENDINGS || []).every((id) => endings && endings[id]);
  }

  function saveCurrent(currentId) {
    const data = load();
    data.currentId = currentId;
    data.truthUnlocked = isTruthUnlocked(data.endings);
    return save(data);
  }

  function saveVolume(volume) {
    const data = load();
    data.volume = Number(volume);
    return save(data);
  }

  window.SaveStore = {
    load,
    save,
    clearProgress,
    markRead,
    markEnding,
    saveCurrent,
    saveVolume,
    isTruthUnlocked
  };
})();
