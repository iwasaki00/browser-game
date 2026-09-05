(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const elements = {
    menuScreen: byId("menuScreen"), gameScreen: byId("gameScreen"), sumoCard: byId("sumoCard"), tugCard: byId("tugCard"), canvas: byId("gameCanvas"),
    p1Control: byId("p1Control"), p2Control: byId("p2Control"), p1Energy: byId("p1Energy"), p2Energy: byId("p2Energy"),
    p1Score: byId("p1Score"), p2Score: byId("p2Score"), dangerLeft: byId("dangerLeft"), dangerRight: byId("dangerRight"),
    countdown: byId("countdown"), debugPanel: byId("debugPanel"), resultPanel: byId("resultPanel"), resultTitle: byId("resultTitle"),
    resultReason: byId("resultReason"), replayButton: byId("replayButton"), menuButton: byId("menuButton"), backButton: byId("backButton"),
    muteButton: byId("muteButton"), menuMuteButton: byId("menuMuteButton"),
    controlActions: [byId("p1Action"), byId("p2Action")], energyNames: [byId("p1EnergyName"), byId("p2EnergyName")], centerBadge: byId("centerBadge")
  };
  const manager = new window.GameManager(elements);
  elements.sumoCard.addEventListener("click", () => manager.launchSumo());
  elements.tugCard.addEventListener("click", () => manager.launchTugOfWar());
  elements.replayButton.addEventListener("click", () => manager.replay());
  elements.menuButton.addEventListener("click", () => manager.showMenu());
  elements.backButton.addEventListener("click", () => manager.showMenu());
  elements.muteButton.addEventListener("click", () => manager.toggleMute());
  elements.menuMuteButton.addEventListener("click", () => manager.toggleMute());
  document.addEventListener("contextmenu", (event) => { if (!elements.gameScreen.hidden) event.preventDefault(); });
  document.addEventListener("touchmove", (event) => { if (!elements.gameScreen.hidden) event.preventDefault(); }, { passive: false });
})();
