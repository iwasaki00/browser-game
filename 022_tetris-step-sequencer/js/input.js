const ACTION_ALIASES = Object.freeze({
  left: ["left", "moveLeft"],
  right: ["right", "moveRight"],
  down: ["down", "softDrop"],
  "soft-drop": ["softDrop", "down"],
  rotate: ["rotate", "rotateCW", "rotateRight"],
  "rotate-cw": ["rotateCW", "rotate", "rotateRight"],
  "rotate-ccw": ["rotateCCW", "rotateLeft"],
  drop: ["drop", "hardDrop"],
  "hard-drop": ["hardDrop", "drop"],
  hold: ["hold"],
  pause: ["pause", "togglePause"],
  start: ["start"],
  restart: ["restart"],
  options: ["options", "openOptions"],
  "close-options": ["closeOptions"],
});

const REPEATABLE_ACTIONS = new Set(["left", "right", "down"]);

function isEditableTarget(target) {
  if (!target) return false;
  const tagName = target.tagName?.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    tagName === "button"
  );
}

function normalizeAction(action) {
  return String(action ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

/**
 * Keyboard, touch gesture, and on-screen button input.
 *
 * actions may use concise names (`left`, `drop`) or game-oriented aliases
 * (`moveLeft`, `hardDrop`). An optional actions.onAction(name, event) fallback
 * receives any action that has no dedicated callback.
 */
export class InputController {
  constructor({
    root = document,
    surface = null,
    actions = {},
    swipeEnabled = true,
    swipeThreshold = 34,
    tapThreshold = 14,
    buttonSelector = "[data-action]",
  } = {}) {
    this.root = root;
    this.actions = actions;
    this.swipeEnabled = Boolean(swipeEnabled);
    this.swipeThreshold = swipeThreshold;
    this.tapThreshold = tapThreshold;
    this.buttonSelector = buttonSelector;
    this.surface =
      surface ??
      root.querySelector?.("[data-game-surface]") ??
      root.querySelector?.("#game-canvas") ??
      root.querySelector?.("#board-canvas") ??
      null;

    this._listeners = [];
    this._repeatTimers = new Map();
    this._gesture = null;
    this._surfaceTouchAction = this.surface?.style?.touchAction ?? "";
    this._surfaceUserSelect = this.surface?.style?.userSelect ?? "";

    const keyboardTarget =
      root.defaultView ?? root.ownerDocument?.defaultView ?? globalThis;
    this._listen(keyboardTarget, "keydown", (event) =>
      this._handleKeyDown(event),
    );

    for (const button of root.querySelectorAll?.(buttonSelector) ?? []) {
      this._bindActionButton(button);
    }

    if (this.surface) {
      this._listen(
        this.surface,
        "pointerdown",
        (event) => this._handleGestureStart(event),
        { passive: false },
      );
      this._listen(
        this.surface,
        "pointermove",
        (event) => this._handleGestureMove(event),
        { passive: false },
      );
      this._listen(
        this.surface,
        "pointerup",
        (event) => this._handleGestureEnd(event),
        { passive: false },
      );
      this._listen(
        this.surface,
        "pointercancel",
        (event) => this._cancelGesture(event),
        { passive: false },
      );
      this._applyTouchAction();
    }
  }

  setSwipeEnabled(enabled) {
    this.swipeEnabled = Boolean(enabled);
    if (!this.swipeEnabled) this._gesture = null;
    this._applyTouchAction();
  }

  setActions(actions = {}) {
    this.actions = actions;
  }

  destroy() {
    for (const remove of this._listeners.splice(0)) remove();
    for (const pointerId of this._repeatTimers.keys()) {
      this._stopRepeat(pointerId);
    }
    this._gesture = null;

    if (this.surface?.style) {
      this.surface.style.touchAction = this._surfaceTouchAction;
      this.surface.style.userSelect = this._surfaceUserSelect;
    }
  }

  _listen(target, type, handler, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    this._listeners.push(() => target.removeEventListener(type, handler, options));
  }

  _bindActionButton(button) {
    const onPointerDown = (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      const action = normalizeAction(button.dataset.action);
      this._emit(action, event);

      try {
        button.setPointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture can fail when iOS cancels a touch during rotation.
      }

      if (REPEATABLE_ACTIONS.has(action)) {
        this._startRepeat(event.pointerId, action, event);
      }
    };
    const onPointerEnd = (event) => this._stopRepeat(event.pointerId);
    const onClick = (event) => event.preventDefault();

    this._listen(button, "pointerdown", onPointerDown, { passive: false });
    this._listen(button, "pointerup", onPointerEnd);
    this._listen(button, "pointercancel", onPointerEnd);
    this._listen(button, "lostpointercapture", onPointerEnd);
    this._listen(button, "click", onClick);

    if (button.style) {
      button.style.touchAction = "manipulation";
      button.style.webkitTapHighlightColor = "transparent";
    }
  }

  _startRepeat(pointerId, action, sourceEvent) {
    this._stopRepeat(pointerId);
    const state = {
      delay: setTimeout(() => {
        this._emit(action, sourceEvent);
        state.interval = setInterval(
          () => this._emit(action, sourceEvent),
          action === "down" ? 55 : 80,
        );
      }, 260),
      interval: null,
    };
    this._repeatTimers.set(pointerId, state);
  }

  _stopRepeat(pointerId) {
    const state = this._repeatTimers.get(pointerId);
    if (!state) return;
    clearTimeout(state.delay);
    clearInterval(state.interval);
    this._repeatTimers.delete(pointerId);
  }

  _handleKeyDown(event) {
    if (
      event.defaultPrevented ||
      isEditableTarget(event.target) ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    ) {
      return;
    }

    const keyMap = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowDown: "down",
      ArrowUp: "drop",
      Space: "drop",
      KeyC: "hold",
      ShiftLeft: "hold",
      ShiftRight: "hold",
      KeyZ: "rotate-ccw",
      KeyX: "rotate-cw",
      KeyP: "pause",
      Escape: "pause",
      Enter: "start",
      KeyR: "restart",
    };
    const action = keyMap[event.code];
    if (!action) return;

    if (
      event.repeat &&
      !REPEATABLE_ACTIONS.has(action) &&
      action !== "left" &&
      action !== "right"
    ) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    this._emit(action, event);
  }

  _handleGestureStart(event) {
    if (
      !this.swipeEnabled ||
      (event.pointerType === "mouse" && event.button !== 0) ||
      event.target?.closest?.(this.buttonSelector)
    ) {
      return;
    }

    this._gesture = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      startedAt: performance.now(),
    };
    try {
      this.surface.setPointerCapture?.(event.pointerId);
    } catch {
      // A gesture still works without capture while the pointer stays inside.
    }
    event.preventDefault();
  }

  _handleGestureMove(event) {
    if (this._gesture?.pointerId !== event.pointerId) return;
    this._gesture.lastX = event.clientX;
    this._gesture.lastY = event.clientY;
    event.preventDefault();
  }

  _handleGestureEnd(event) {
    const gesture = this._gesture;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    this._gesture = null;
    event.preventDefault();

    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const distance = Math.hypot(dx, dy);
    const duration = performance.now() - gesture.startedAt;

    if (
      distance <= this.tapThreshold &&
      duration <= 420
    ) {
      this._emit("rotate", event);
      return;
    }

    if (distance < this.swipeThreshold) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      const action = dx < 0 ? "left" : "right";
      const moves = Math.min(
        4,
        Math.max(1, Math.round(Math.abs(dx) / this.swipeThreshold)),
      );
      for (let index = 0; index < moves; index += 1) this._emit(action, event);
      return;
    }

    if (dy < 0) {
      this._emit("drop", event);
      return;
    }

    const drops = Math.min(
      5,
      Math.max(1, Math.round(Math.abs(dy) / this.swipeThreshold)),
    );
    for (let index = 0; index < drops; index += 1) this._emit("down", event);
  }

  _cancelGesture(event) {
    if (this._gesture?.pointerId === event.pointerId) this._gesture = null;
  }

  _applyTouchAction() {
    if (!this.surface?.style) return;
    this.surface.style.touchAction = this.swipeEnabled ? "none" : "pan-y";
    this.surface.style.userSelect = "none";
    this.surface.style.webkitUserSelect = "none";
    this.surface.style.webkitTouchCallout = "none";
  }

  _emit(action, event) {
    const aliases = ACTION_ALIASES[action] ?? [action];
    for (const name of aliases) {
      const callback = this.actions?.[name];
      if (typeof callback === "function") {
        return callback(event, action);
      }
    }
    return this.actions?.onAction?.(action, event);
  }
}

export default InputController;
