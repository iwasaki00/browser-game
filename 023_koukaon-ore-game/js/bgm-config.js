(function () {
  "use strict";

  const config = window.ORE_CONFIG;
  const bgmDefinitions = {
    shooterBgm: { id: "shooterBgm", label: "シューティングBGM", short: "BGM LOOP", example: "デンデケデン…", max: 8 },
    actionBgm: { id: "actionBgm", label: "アクションBGM", short: "BGM LOOP", example: "タッタカター…", max: 8 },
    puzzleBgm: { id: "puzzleBgm", label: "3マッチBGM", short: "BGM LOOP", example: "ポンポコポン…", max: 8 }
  };

  Object.assign(config.soundCatalog, bgmDefinitions);
  config.soundDefinitions = Object.values(config.soundCatalog);
  for (const [gameId, soundId] of [["shooter", "shooterBgm"], ["action", "actionBgm"], ["puzzle", "puzzleBgm"]]) {
    const definition = config.gameDefinitions[gameId];
    if (!definition.sounds.includes(soundId)) definition.sounds.push(soundId);
    definition.bgm = soundId;
  }
})();
