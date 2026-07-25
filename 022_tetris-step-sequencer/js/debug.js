const SELECTORS = Object.freeze({
  panel: "#debugPanel",
  panelButton: "#debugPanelButton",
  closeButton: "#debugCloseButton",
  pauseButton: "#debugPauseButton",
  stepInput: "#debugStepInput",
  stepValue: "#debugStepValue",
  status: "#debugStatus",
  fps: "#debugFps",
  viewport: "#debugViewport",
  audioState: "#debugAudioState",
});

const CLICK_TARGET_SELECTOR = [
  SELECTORS.panelButton,
  SELECTORS.closeButton,
  SELECTORS.pauseButton,
  "[data-debug-action]",
  "[data-debug-sound]",
].join(",");

const activeControllers = new WeakMap();

function isObject(value) {
  return (
    (typeof value === "object" && value !== null) ||
    typeof value === "function"
  );
}

function closest(target, selector) {
  const element =
    target?.nodeType === 1 ? target : target?.parentElement ?? null;
  return element?.closest?.(selector) ?? null;
}

function setText(element, value, fallback = "--") {
  if (!element) return;
  element.textContent =
    value === null || value === "" ? fallback : String(value);
}

/**
 * Small, dependency-free bridge between the developer panel and the game.
 *
 * DebugController deliberately knows nothing about Tetris internals. The game
 * supplies callbacks and remains the source of truth for paused/game state.
 */
export class DebugController {
  constructor({
    root = typeof document !== "undefined" ? document : null,
    actions = {},
    enabled = false,
  } = {}) {
    this.root = root;
    this.actions = actions ?? {};
    this.enabled = false;
    this.open = false;
    this.paused = false;

    this._elements = Object.create(null);
    this._listeners = [];
    this._lastEmittedStep = null;
    this._lastStepEventType = null;
    this._returnFocusTo = null;
    this._destroyed = false;

    if (isObject(root)) {
      const previousController = activeControllers.get(root);
      if (previousController && previousController !== this) {
        previousController.destroy();
      }
      activeControllers.set(root, this);
    }

    this._prepareAccessibility();
    this._bindEvents();
    this._syncEnabled();
    this.setOpen(false);
    this.setPaused(false);

    const initialStep = this._readStep();
    if (initialStep !== null) this._renderStep(initialStep);
    if (enabled) this.setEnabled(true);
  }

  setEnabled(enabled, { open = false } = {}) {
    if (this._destroyed) return false;

    const nextEnabled = Boolean(enabled);
    const changed = this.enabled !== nextEnabled;
    this.enabled = nextEnabled;
    this._syncEnabled();
    this.setOpen(nextEnabled && Boolean(open));

    if (changed) this._call("enabledChange", nextEnabled);
    return this.enabled;
  }

  setOpen(open) {
    if (this._destroyed) return false;

    this.open = this.enabled && Boolean(open);

    const panel = this._element("panel");
    if (panel) {
      panel.hidden = !this.open;
      panel.classList?.toggle("is-open", this.open);
      panel.setAttribute?.("aria-hidden", String(!this.open));
    }

    const panelButton = this._element("panelButton");
    if (panelButton) {
      panelButton.classList?.toggle("is-active", this.open);
      panelButton.setAttribute?.("aria-expanded", String(this.open));
      panelButton.setAttribute?.(
        "aria-label",
        this.open
          ? "デバッグパネルを閉じる"
          : "デバッグパネルを開く",
      );
    }

    return this.open;
  }

  toggleOpen() {
    return this.setOpen(!this.open);
  }

  setPaused(paused) {
    if (this._destroyed) return false;

    this.paused = Boolean(paused);
    const pauseButton = this._element("pauseButton");
    if (!pauseButton) return this.paused;

    pauseButton.classList?.toggle("is-paused", this.paused);
    pauseButton.setAttribute?.("aria-pressed", String(this.paused));
    pauseButton.setAttribute?.(
      "aria-label",
      this.paused ? "ゲームを再開" : "ゲームを一時停止",
    );
    if (pauseButton.dataset) {
      pauseButton.dataset.debugState = this.paused ? "paused" : "running";
    }

    const label =
      pauseButton.querySelector?.(
        "[data-debug-pause-label], [data-debug-label]",
      ) ?? null;
    const visibleLabel = this.paused ? "▶ 再開" : "Ⅱ 一時停止";

    if (label) {
      label.textContent = visibleLabel;
    } else if (!pauseButton.children?.length) {
      pauseButton.textContent = visibleLabel;
    }

    return this.paused;
  }

  update(values = {}) {
    if (
      this._destroyed ||
      !values ||
      (typeof values !== "object" && typeof values !== "function")
    ) {
      return;
    }

    const { status, fps, viewport, audioState, step } = values;

    if (status !== undefined) {
      const statusElement = this._element("status");
      setText(statusElement, status);
      if (statusElement?.dataset) {
        statusElement.dataset.state = String(status ?? "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "-");
      }
    }

    if (fps !== undefined) {
      const fpsText =
        typeof fps === "number" && Number.isFinite(fps)
          ? String(Math.round(fps))
          : fps;
      setText(this._element("fps"), fpsText);
    }

    if (viewport !== undefined) {
      setText(this._element("viewport"), this._formatViewport(viewport));
    }

    if (audioState !== undefined) {
      const audioElement = this._element("audioState");
      setText(audioElement, audioState);
      if (audioElement?.dataset) {
        audioElement.dataset.state = String(audioState ?? "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "-");
      }
    }

    if (step !== undefined) {
      const normalizedStep = this._normalizeStep(step);
      if (normalizedStep !== null) this._renderStep(normalizedStep);
    }
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    for (const removeListener of this._listeners.splice(0)) {
      removeListener();
    }

    this.enabled = false;
    this.open = false;
    this._syncEnabled();

    if (
      isObject(this.root) &&
      activeControllers.get(this.root) === this
    ) {
      activeControllers.delete(this.root);
    }

    this._returnFocusTo = null;
  }

  _element(name) {
    const cached = this._elements[name];
    if (cached) return cached;

    const selector = SELECTORS[name];
    if (!selector || !this.root) return null;

    const element = this.root.matches?.(selector)
      ? this.root
      : this.root.querySelector?.(selector) ?? null;
    if (element) this._elements[name] = element;
    return element;
  }

  _prepareAccessibility() {
    const panel = this._element("panel");
    const panelButton = this._element("panelButton");
    const closeButton = this._element("closeButton");
    const pauseButton = this._element("pauseButton");

    if (panel?.id && panelButton) {
      panelButton.setAttribute?.("aria-controls", panel.id);
    }
    panelButton?.setAttribute?.("aria-expanded", "false");

    if (panelButton && !panelButton.getAttribute?.("aria-label")) {
      panelButton.setAttribute?.("aria-label", "デバッグパネルを開く");
    }
    if (closeButton && !closeButton.getAttribute?.("aria-label")) {
      closeButton.setAttribute?.("aria-label", "デバッグパネルを閉じる");
    }

    for (const button of [
      panelButton,
      closeButton,
      pauseButton,
      ...(this.root?.querySelectorAll?.(
        "[data-debug-action], [data-debug-sound]",
      ) ?? []),
    ]) {
      if (
        button?.tagName?.toLowerCase() === "button" &&
        !button.getAttribute?.("type")
      ) {
        button.setAttribute("type", "button");
      }
    }

    for (const soundButton of this.root?.querySelectorAll?.(
      "[data-debug-sound]",
    ) ?? []) {
      if (!soundButton.getAttribute?.("aria-label")) {
        const sound = soundButton.dataset?.debugSound?.trim();
        if (sound) {
          soundButton.setAttribute("aria-label", `${sound} の音を試聴`);
        }
      }
    }
  }

  _bindEvents() {
    this._listen(this.root, "click", (event) => this._handleClick(event));
    this._listen(this.root, "input", (event) =>
      this._handleStepEvent(event),
    );
    this._listen(this.root, "change", (event) =>
      this._handleStepEvent(event),
    );
    this._listen(this.root, "keydown", (event) => {
      if (event.key !== "Escape" || !this.open) return;
      event.preventDefault();
      this.setOpen(false);
      this._restoreLauncherFocus();
    });
  }

  _listen(target, type, listener, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, listener, options);
    this._listeners.push(() =>
      target.removeEventListener(type, listener, options),
    );
  }

  _handleClick(event) {
    const target = closest(event.target, CLICK_TARGET_SELECTOR);
    if (!target || !this._contains(target) || target.disabled) return;

    if (target.matches?.(SELECTORS.panelButton)) {
      event.preventDefault();
      if (!this.enabled) return;

      this._returnFocusTo = target;
      const isOpen = this.toggleOpen();
      if (isOpen) {
        this._focus(this._element("closeButton"));
      }
      return;
    }

    if (target.matches?.(SELECTORS.closeButton)) {
      event.preventDefault();
      this.setOpen(false);
      this._restoreLauncherFocus();
      return;
    }

    if (!this.enabled) return;

    if (target.matches?.(SELECTORS.pauseButton)) {
      event.preventDefault();
      this._call("pause");
      return;
    }

    if (target.matches?.("[data-debug-action]")) {
      const actionName = target.dataset?.debugAction?.trim();
      if (!actionName) return;
      event.preventDefault();
      this._call("action", actionName);
      return;
    }

    if (target.matches?.("[data-debug-sound]")) {
      const soundName = target.dataset?.debugSound?.trim();
      if (!soundName) return;
      event.preventDefault();
      this._call("sound", soundName);
    }
  }

  _handleStepEvent(event) {
    if (!this.enabled) return;

    const input = closest(event.target, SELECTORS.stepInput);
    if (!input || !this._contains(input)) return;

    const step = this._normalizeStep(input.value);
    if (step === null) return;

    this._renderStep(step);
    const isDuplicateCommit =
      event.type === "change" &&
      this._lastStepEventType === "input" &&
      step === this._lastEmittedStep;

    this._lastEmittedStep = step;
    this._lastStepEventType = event.type;
    if (isDuplicateCommit) return;

    this._call("step", step);
  }

  _readStep() {
    const input = this._element("stepInput");
    return input ? this._normalizeStep(input.value) : null;
  }

  _normalizeStep(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;

    const input = this._element("stepInput");
    const rawMin = input?.min;
    const rawMax = input?.max;
    const min = rawMin === "" || rawMin == null ? Number.NaN : Number(rawMin);
    const max = rawMax === "" || rawMax == null ? Number.NaN : Number(rawMax);
    const lowerBound = Number.isFinite(min) ? min : 0;
    const upperBound = Number.isFinite(max) ? max : 15;

    return Math.min(
      upperBound,
      Math.max(lowerBound, Math.round(numericValue)),
    );
  }

  _renderStep(step) {
    const input = this._element("stepInput");
    if (input) {
      input.value = String(step);

      const maximum =
        input.max === "" ? Number.NaN : Number(input.max);
      const totalSteps = Number.isFinite(maximum) ? maximum + 1 : 16;
      input.setAttribute?.(
        "aria-valuetext",
        `${step + 1} / ${totalSteps}`,
      );
    }

    const displayValue = String(step + 1).padStart(2, "0");
    const output = this._element("stepValue");
    if (output) {
      if ("value" in output) output.value = displayValue;
      output.textContent = displayValue;
    }
  }

  _formatViewport(viewport) {
    if (viewport === null || viewport === "") return "--";

    if (Array.isArray(viewport) && viewport.length >= 2) {
      return `${viewport[0]}×${viewport[1]}`;
    }

    if (
      typeof viewport === "object" &&
      viewport !== null &&
      "width" in viewport &&
      "height" in viewport
    ) {
      return `${Math.round(Number(viewport.width))}×${Math.round(
        Number(viewport.height),
      )}`;
    }

    return viewport;
  }

  _syncEnabled() {
    const panelButton = this._element("panelButton");
    if (panelButton) {
      panelButton.hidden = !this.enabled;
      panelButton.setAttribute?.("aria-hidden", String(!this.enabled));
    }

    if (!this.enabled) {
      const panel = this._element("panel");
      if (panel) {
        panel.hidden = true;
        panel.classList?.remove("is-open");
        panel.setAttribute?.("aria-hidden", "true");
      }
      panelButton?.classList?.remove("is-active");
      panelButton?.setAttribute?.("aria-expanded", "false");
    }
  }

  _contains(element) {
    if (!this.root || element === this.root) return true;
    return this.root.contains?.(element) ?? true;
  }

  _call(name, ...args) {
    const callback = this.actions?.[name];
    if (typeof callback !== "function") return undefined;
    return callback.call(this.actions, ...args);
  }

  _restoreLauncherFocus() {
    const target = this._returnFocusTo ?? this._element("panelButton");
    this._returnFocusTo = null;
    this._focus(target);
  }

  _focus(element) {
    if (typeof element?.focus !== "function") return;
    try {
      element.focus({ preventScroll: true });
    } catch {
      element.focus();
    }
  }
}

export default DebugController;
