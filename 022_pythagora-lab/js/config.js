(function bootstrapConfig(global) {
  "use strict";

  const P = global.PythagoraLab = global.PythagoraLab || {};
  let idCounter = 0;

  P.VERSION = "1.0.0";
  P.DEBUG = new URLSearchParams(global.location.search).get("debug") === "1";

  P.CONFIG = Object.freeze({
    fixedStep: 1000 / 60,
    maxFrameDelta: 100,
    maxSubSteps: 12,
    dprCap: 2,
    historyLimit: 30,
    snapSize: 10,
    clearDwellMs: 240,
    clearCelebrationMs: 1450,
    chainCooldownMs: 850,
    camera: Object.freeze({ minZoom: 0.72, maxZoom: 2.2 }),
    physics: Object.freeze({
      gravity: Object.freeze({ x: 0, y: 1, scale: 0.001 }),
      positionIterations: 8,
      velocityIterations: 6,
      constraintIterations: 4,
      maxSpeed: 22,
      maxAngularSpeed: 0.42
    })
  });

  P.PART_DEFS = Object.freeze({
    ball: Object.freeze({
      name: "ボール", icon: "●", shape: "circle", width: 38, height: 38,
      color: "#ef5b45", dynamic: true, rotatable: false,
      physics: Object.freeze({ density: 0.00125, friction: 0.024, frictionStatic: 0.1, frictionAir: 0.002, restitution: 0.16 })
    }),
    floor: Object.freeze({
      name: "固定床", icon: "▰", shape: "rect", width: 220, height: 30,
      color: "#9d7651", static: true,
      physics: Object.freeze({ friction: 0.78, restitution: 0.02 })
    }),
    ramp: Object.freeze({
      name: "坂道", icon: "╱", shape: "rect", width: 250, height: 22,
      color: "#2678b9", static: true,
      physics: Object.freeze({ friction: 0.22, restitution: 0.03 })
    }),
    wall: Object.freeze({
      name: "壁", icon: "▮", shape: "rect", width: 28, height: 140,
      color: "#4f9d69", static: true,
      physics: Object.freeze({ friction: 0.45, restitution: 0.1 })
    }),
    domino: Object.freeze({
      name: "ドミノ", icon: "▯", shape: "rect", width: 20, height: 74,
      color: "#f2c14e", dynamic: true,
      physics: Object.freeze({ density: 0.001, friction: 0.58, frictionStatic: 0.8, frictionAir: 0.006, restitution: 0.025 })
    }),
    box: Object.freeze({
      name: "箱", icon: "□", shape: "rect", width: 54, height: 54,
      color: "#df8c43", dynamic: true,
      physics: Object.freeze({ density: 0.0021, friction: 0.48, frictionAir: 0.004, restitution: 0.045 })
    }),
    seesaw: Object.freeze({
      name: "シーソー", icon: "⌁", shape: "seesaw", width: 220, height: 18,
      color: "#7a68a6", dynamic: true,
      physics: Object.freeze({ density: 0.00155, friction: 0.42, frictionAir: 0.018, restitution: 0.08 })
    }),
    spring: Object.freeze({
      name: "バネ", icon: "≋", shape: "spring", width: 72, height: 28,
      color: "#e94c73", static: true,
      physics: Object.freeze({ friction: 0.1, restitution: 0.8, force: 0.052, cooldown: 300 })
    }),
    pendulum: Object.freeze({
      name: "振り子", icon: "⌄", shape: "pendulum", width: 42, height: 42,
      color: "#335c81", dynamic: true,
      physics: Object.freeze({ density: 0.0024, friction: 0.25, frictionAir: 0.008, restitution: 0.1, length: 92 })
    }),
    switch: Object.freeze({
      name: "スイッチ", icon: "●", shape: "switch", width: 62, height: 24,
      color: "#52a76b", static: true,
      physics: Object.freeze({ friction: 0.6, restitution: 0.02 })
    }),
    start: Object.freeze({
      name: "START", icon: "▶", shape: "start", width: 56, height: 56,
      color: "#4f9d69", static: true, rotatable: false
    }),
    goal: Object.freeze({
      name: "GOAL", icon: "⌑", shape: "goal", width: 82, height: 92,
      color: "#ef5b45", static: true, rotatable: false, sensor: true
    })
  });

  P.CHAIN_ACTIVE_TYPES = new Set(["ball", "domino", "box", "seesaw", "spring", "pendulum", "switch", "goal"]);
  P.CHAIN_IGNORED_TYPES = new Set(["floor", "ramp", "wall", "start"]);

  P.SFX_PATHS = Object.freeze({
    roll: null,
    domino: null,
    metal: null,
    wood: null,
    spring: null,
    switch: null,
    goal: null,
    clear: null,
    ui: null
  });

  P.util = Object.freeze({
    clamp(value, min, max) {
      return Math.min(max, Math.max(min, Number(value) || 0));
    },
    deepClone(value) {
      return value == null ? value : JSON.parse(JSON.stringify(value));
    },
    uid(prefix = "part") {
      idCounter += 1;
      return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
    },
    snap(value, size = P.CONFIG.snapSize) {
      return Math.round(value / size) * size;
    },
    radians(degrees) {
      return Number(degrees || 0) * Math.PI / 180;
    },
    degrees(radians) {
      return Number(radians || 0) * 180 / Math.PI;
    },
    normalizeAngle(angle) {
      let value = Number(angle) || 0;
      while (value > Math.PI) value -= Math.PI * 2;
      while (value < -Math.PI) value += Math.PI * 2;
      return value;
    },
    formatTime(seconds) {
      const total = Math.max(0, Math.floor(Number(seconds) || 0));
      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    },
    safeJsonParse(value, fallback) {
      try { return JSON.parse(value); } catch { return fallback; }
    }
  });
})(window);
