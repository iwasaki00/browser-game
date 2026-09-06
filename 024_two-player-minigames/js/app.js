(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const elements = {
    menuScreen: byId("menuScreen"), gameScreen: byId("gameScreen"), sumoCard: byId("sumoCard"), tugCard: byId("tugCard"), bombCard: byId("bombCard"), boxingCard: byId("boxingCard"), hockeyCard: byId("hockeyCard"), canvas: byId("gameCanvas"),
    p1Control: byId("p1Control"), p2Control: byId("p2Control"), p1Energy: byId("p1Energy"), p2Energy: byId("p2Energy"),
    p1Score: byId("p1Score"), p2Score: byId("p2Score"), dangerLeft: byId("dangerLeft"), dangerRight: byId("dangerRight"),
    countdown: byId("countdown"), debugPanel: byId("debugPanel"), resultPanel: byId("resultPanel"), resultTitle: byId("resultTitle"),
    resultReason: byId("resultReason"), replayButton: byId("replayButton"), menuButton: byId("menuButton"), backButton: byId("backButton"),
    muteButton: byId("muteButton"), menuMuteButton: byId("menuMuteButton"), testModeButton: byId("testModeButton"), menuTestModeButton: byId("menuTestModeButton"), testSpeedButton: byId("testSpeedButton"),
    controlActions: [byId("p1Action"), byId("p2Action")], energyNames: [byId("p1EnergyName"), byId("p2EnergyName")], centerBadge: byId("centerBadge"),
    jointButtons: [[...document.querySelectorAll('[data-player="0"][data-joint]')], [...document.querySelectorAll('[data-player="1"][data-joint]')]]
  };
  const manager = new window.GameManager(elements);
  elements.sumoCard.addEventListener("click", () => manager.launchSumo());
  elements.tugCard.addEventListener("click", () => manager.launchTugOfWar());
  elements.bombCard.addEventListener("click", () => manager.launchBombPush());
  elements.boxingCard.addEventListener("click", () => manager.launchWobbleBoxing());
  elements.hockeyCard.addEventListener("click", () => manager.launchTableHockey());
  elements.replayButton.addEventListener("click", () => manager.replay());
  elements.menuButton.addEventListener("click", () => manager.showMenu());
  elements.backButton.addEventListener("click", () => manager.showMenu());
  elements.muteButton.addEventListener("click", () => manager.toggleMute());
  elements.menuMuteButton.addEventListener("click", () => manager.toggleMute());
  elements.testModeButton.addEventListener("click", () => manager.toggleTestMode());
  elements.menuTestModeButton.addEventListener("click", () => manager.toggleTestMode());
  elements.testSpeedButton.addEventListener("click", () => manager.cycleTestSpeed());
  document.addEventListener("contextmenu", (event) => { if (!elements.gameScreen.hidden) event.preventDefault(); });
  document.addEventListener("touchmove", (event) => { if (!elements.gameScreen.hidden) event.preventDefault(); }, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (event) => {
    const now = Date.now(); if (now - lastTouchEnd <= 320) event.preventDefault(); lastTouchEnd = now;
  }, { passive: false });
  document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("dblclick", (event) => event.preventDefault(), { passive: false });
})();
