(function () {
  "use strict";

  const STORAGE_KEY = "qwopRunner.difficulty.v1";
  const DEFAULT_DIFFICULTY = "NORMAL";
  const DIFFICULTY_PRESETS = Object.freeze({
    EASY: Object.freeze({
      key: "EASY",
      label: "簡単",
      description: "姿勢補助が強め。操作練習におすすめ",
      balanceScale: 0.90,
      ankleAssist: 1.00,
      neutralAssist: 1.15,
      fallAssist: 1.20,
      armSwing: 0.70,
      armAmplitude: 32,
      handFriction: "normal"
    }),
    NORMAL: Object.freeze({
      key: "NORMAL",
      label: "普通",
      description: "標準的なQWOPバランス",
      balanceScale: 0.52,
      ankleAssist: 0.85,
      neutralAssist: 0.85,
      fallAssist: 0.85,
      armSwing: 0.68,
      armAmplitude: 35,
      handFriction: "normal"
    }),
    HARD: Object.freeze({
      key: "HARD",
      label: "難しい",
      description: "姿勢補助が弱く、バランスを取るのが難しい",
      balanceScale: 0.35,
      ankleAssist: 0.48,
      neutralAssist: 0.57,
      fallAssist: 0.52,
      armSwing: 0.62,
      armAmplitude: 35,
      handFriction: "normal"
    })
  });

  function normalize(value) {
    const key = String(value || "").toUpperCase();
    return key in DIFFICULTY_PRESETS ? key : DEFAULT_DIFFICULTY;
  }

  function load(storage) {
    try { return normalize(storage?.getItem(STORAGE_KEY)); } catch { return DEFAULT_DIFFICULTY; }
  }

  function save(storage, difficulty) {
    const key = normalize(difficulty);
    try { storage?.setItem(STORAGE_KEY, key); } catch {}
    return key;
  }

  function apply(physics, difficulty) {
    const preset = DIFFICULTY_PRESETS[normalize(difficulty)];
    physics.setBalanceScale(preset.balanceScale);
    physics.setAnkleScale(preset.ankleAssist);
    physics.setDifficultyAssists({
      neutralAssist: preset.neutralAssist,
      fallAssist: preset.fallAssist
    });
    physics.setArmSwingScale(preset.armSwing);
    physics.setArmAmplitude(preset.armAmplitude);
    physics.setHandFriction(preset.handFriction);
    return preset;
  }

  const api = { DIFFICULTY_PRESETS, DEFAULT_DIFFICULTY, STORAGE_KEY, normalize, load, save, apply };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.QWOPDifficulty = api;
})();
