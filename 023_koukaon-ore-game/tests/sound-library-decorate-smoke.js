const fs = require("fs");
const path = require("path");
const vm = require("vm");
const source = fs.readFileSync(path.resolve(__dirname, "../js/SoundLibraryController.js"), "utf8");
const editors = [{ innerHTML: "" }, { innerHTML: "" }];
const rows = ["shot", "explosion"].map((soundId, index) => ({
  dataset: { soundId },
  querySelector() { return editors[index]; },
  appendChild() {}
}));
const elements = new Map();
const element = (selector) => {
  if (!elements.has(selector)) elements.set(selector, {
    textContent: "", value: "", hidden: true, innerHTML: "",
    classList: { toggle() {} },
    addEventListener() {}
  });
  return elements.get(selector);
};
const documentObject = {
  createElement() {
    return {
      innerHTML: "",
      get textContent() { return this.innerHTML; },
      set textContent(value) { this.innerHTML = String(value); }
    };
  },
  querySelector(selector) {
    if (selector === "#soundList") return { querySelectorAll() { return rows; } };
    return element(selector);
  },
  addEventListener() {}
};
const windowObject = {};
vm.runInNewContext(source, { window: windowObject, document: documentObject, console, Date, Math, Set });
const controller = new windowObject.SoundLibraryController({}, {}, {
  defaultGameId: "shooter",
  soundCatalog: {
    shot: { label: "自機ショット" },
    explosion: { label: "爆発" }
  }
});
controller.assets = [{ id: "voice-a", name: "ピュン" }];
controller.assignments = [{ soundKey: "shot", assetIds: ["voice-a"], playMode: "fixed" }];
controller.decorateStudio();
if (!editors[0].innerHTML.includes("ピュン") || !editors[1].innerHTML.includes("初期音")) {
  throw new Error("Studio assignment decoration did not finish for every sound row");
}
controller.renderAssignmentChoices = () => {};
controller.openAssignment("shot");
if (!controller.assignmentDraftIds.has("voice-a")) {
  throw new Error("Opening an assignment must initialize its selected asset IDs");
}
controller.openAssignment("explosion");
if (controller.assignmentDraftIds.size !== 0) {
  throw new Error("Opening an unassigned sound must clear stale selected asset IDs");
}
console.log("Sound library decoration passed: studio refresh and assignment drafts use correctly scoped data.");
