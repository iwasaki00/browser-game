(function () {
  "use strict";

  const canvas = document.querySelector("#gameCanvas");
  const ctx = canvas.getContext("2d");
  const distanceEl = document.querySelector("#distance");
  const debugButton = document.querySelector("#debugButton");
  const retryButton = document.querySelector("#retryButton");
  const panel = document.querySelector("#debugPanel");
  const parameterRoot = document.querySelector("#parameters");
  const fpsEl = document.querySelector("#fps");
  const trainingButton = document.querySelector("#trainingButton");
  const trainingPanel = document.querySelector("#trainingPanel");
  const trainingNow = document.querySelector("#trainingNow");
  const trainingNext = document.querySelector("#trainingNext");
  const trainingFeedback = document.querySelector("#trainingFeedback");
  const trainingHistory = document.querySelector("#trainingHistory");
  const timingProgress = document.querySelector("#timingProgress");
  const watchDemoButton = document.querySelector("#watchDemo");
  const demoSpeedButton = document.querySelector("#demoSpeed");
  const physics = new QWOPPhysics.RunnerPhysics();
  const phases = QWOPTraining.PHASES;
  const activePointers = new Map();

  let debug = false;
  let cameraX = 0;
  let viewScale = 1;
  let lastTime = performance.now();
  let fps = 60;
  let averageVelocityX = 0;
  const velocitySamples = [];
  const demo = {
    active: false, source: "debug", speed: "normal", phaseIndex: 0,
    phaseElapsed: 0, totalElapsed: 0, cyclesRemaining: Infinity, startX: 0
  };
  const training = {
    active: false, slow: false, phaseIndex: 0, phaseElapsed: 0,
    phaseStarted: false, phaseStartX: physics.bodies.torso.position.x, history: [], feedback: "YOUR TURN"
  };

  const parameterSpec = {
    gravity: ["Gravity", 0.35, 1.2, 0.01, 2],
    groundFriction: ["Ground friction", 0.4, 1.8, 0.01, 2],
    footFriction: ["Foot friction", 0.5, 2.2, 0.01, 2],
    torsoKp: ["Torso Kp", 0.02, 0.5, 0.01, 2],
    torsoKd: ["Torso Kd", 0.01, 0.3, 0.01, 2],
    torsoMaxTorque: ["Torso Max Torque", 0.02, 0.6, 0.01, 2],
    hipKp: ["Hip Kp", 0.2, 8.0, 0.1, 2],
    hipKd: ["Hip Kd", 0.02, 1.0, 0.02, 2],
    kneeKp: ["Knee Kp", 0.5, 12.0, 0.25, 2],
    kneeKd: ["Knee Kd", 0.02, 1.2, 0.02, 2],
    hipMaxTorque: ["Hip Max Torque", 0.2, 8.0, 0.1, 2],
    kneeMaxTorque: ["Knee Max Torque", 0.5, 12.0, 0.25, 2],
    jointLimitStrength: ["Joint Limit Strength", 1, 40, 1, 1],
    balanceKp: ["Balance Kp", 0, 0.005, 0.0001, 4],
    balanceKd: ["Balance Kd", 0, 0.05, 0.001, 3],
    balanceMaxForce: ["Balance Max Force", 0.01, 0.25, 0.01, 2]
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    viewScale = Math.min(1, Math.max(0.66, (rect.height - 8) / 307));
    cameraX = physics.bodies.torso.position.x - (rect.width / viewScale) * 0.38;
  }

  function setInput(key, active) {
    physics.setInput(key, active);
    document.querySelectorAll(`[data-key="${key}"]`).forEach(element => {
      element.classList.toggle("active", active);
      element.setAttribute("aria-pressed", String(active));
    });
  }

  function clearInputs() {
    Object.keys(physics.inputState).forEach(key => setInput(key, false));
  }

  function bindPointerControl(button) {
    const key = button.dataset.key;
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      if (demo.active) return;
      button.setPointerCapture(event.pointerId);
      activePointers.set(event.pointerId, key);
      setInput(key, true);
    });
    const release = event => {
      const releasedKey = activePointers.get(event.pointerId);
      if (!releasedKey) return;
      activePointers.delete(event.pointerId);
      if (![...activePointers.values()].includes(releasedKey)) setInput(releasedKey, false);
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("contextmenu", event => event.preventDefault());
  }

  document.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if (!(key in physics.inputState)) return;
    event.preventDefault();
    if (!demo.active) setInput(key, true);
  });
  document.addEventListener("keyup", event => {
    const key = event.key.toLowerCase();
    if (!(key in physics.inputState)) return;
    event.preventDefault();
    if (!demo.active) setInput(key, false);
  });
  window.addEventListener("blur", () => {
    if (demo.active) stopDemo();
    clearInputs();
    activePointers.clear();
  });
  document.querySelectorAll(".controls [data-key]").forEach(bindPointerControl);

  const diagnosticsEl = document.createElement("pre");
  diagnosticsEl.className = "control-diagnostics";
  const controlTest = document.createElement("section");
  controlTest.className = "control-test";
  controlTest.innerHTML = `<h3>CONTROL TEST</h3><div>${["q", "w", "o", "p"].map(key => `<button type="button" data-key="${key}" aria-pressed="false">${key.toUpperCase()} TEST</button>`).join("")}</div>`;
  controlTest.querySelectorAll("[data-key]").forEach(bindPointerControl);

  const experimentPanel = document.createElement("section");
  experimentPanel.className = "experiment-controls";
  experimentPanel.innerHTML = `
    <h3>STABILITY EXPERIMENTS</h3>
    <label>Dynamic Foot Friction <input class="dynamic-friction" type="checkbox"></label>
    <label>Balance <select class="balance-preset"><option value="1">100%</option><option value=".75">75%</option><option value=".6">60%</option><option value=".5">50%</option><option value=".4">40%</option><option value=".25">25%</option></select></label>
    <label>Ankle Control <select class="ankle-preset"><option value="1">100%</option><option value=".75">75%</option><option value=".5">50%</option><option value=".25">25%</option><option value="0">OFF</option></select></label>
    <label>Arm Swing <select class="arm-swing-preset"><option value="1">100%</option><option value=".75">75%</option><option value=".7">70%</option><option value=".6">60%</option><option value=".5">50%</option><option value=".25">25%</option><option value="0">0%</option></select></label>
    <label>Arm Mass <select class="arm-mass-preset"><option value="light">Light</option><option value="normal" selected>Normal</option><option value="heavy">Heavy</option></select></label>
    <label>Arm Amplitude <select class="arm-amplitude"><option value="20">20°</option><option value="25">25°</option><option value="30">30°</option><option value="35" selected>35°</option><option value="40">40°</option><option value="42">42°</option></select></label>
    <label>Hand Friction <select class="hand-friction"><option value="low">Low</option><option value="normal" selected>Normal</option><option value="high">High</option></select></label>
    <button type="button" class="recovery-test">RECOVERY TEST</button>`;
  experimentPanel.querySelector(".dynamic-friction").addEventListener("change", event => physics.setDynamicFootFriction(event.target.checked));
  experimentPanel.querySelector(".balance-preset").addEventListener("change", event => physics.setBalanceScale(event.target.value));
  experimentPanel.querySelector(".ankle-preset").addEventListener("change", event => physics.setAnkleScale(event.target.value));
  experimentPanel.querySelector(".arm-swing-preset").addEventListener("change", event => physics.setArmSwingScale(event.target.value));
  experimentPanel.querySelector(".arm-mass-preset").addEventListener("change", event => physics.setArmMass(event.target.value));
  experimentPanel.querySelector(".arm-amplitude").addEventListener("change", event => physics.setArmAmplitude(event.target.value));
  experimentPanel.querySelector(".hand-friction").addEventListener("change", event => physics.setHandFriction(event.target.value));
  let recoveryDirection = 1;
  experimentPanel.querySelector(".recovery-test").addEventListener("click", () => {
    physics.applyRecoveryImpulse(recoveryDirection);
    recoveryDirection *= -1;
  });

  const demoPanel = document.createElement("section");
  demoPanel.className = "demo-controls";
  demoPanel.innerHTML = `<h3>FORWARD REFERENCE</h3><p class="demo-status">DEMO: OFF</p><div><button type="button" class="start-demo">DEMO FORWARD</button><button type="button" class="stop-demo" disabled>STOP DEMO</button></div>`;
  const demoStatus = demoPanel.querySelector(".demo-status");
  const startDemoButton = demoPanel.querySelector(".start-demo");
  const stopDemoButton = demoPanel.querySelector(".stop-demo");
  panel.insertBefore(demoPanel, document.querySelector("#resetParameters"));
  panel.insertBefore(experimentPanel, demoPanel);
  panel.insertBefore(diagnosticsEl, experimentPanel);
  panel.insertBefore(controlTest, document.querySelector("#resetParameters"));

  function demoDuration(phase) {
    return phase[demo.speed];
  }

  function applyDemoPhase() {
    clearInputs();
    const phase = phases[demo.phaseIndex];
    phase.keys.forEach(key => setInput(key, true));
    demoStatus.textContent = `DEMO: ${demo.speed.toUpperCase()} / PHASE: ${phase.name}`;
    if (demo.source === "training") {
      training.phaseIndex = demo.phaseIndex;
      training.phaseElapsed = demo.phaseElapsed;
      training.feedback = "WATCH";
      updateTrainingPanel();
    }
  }

  function startDemo(options = {}) {
    clearInputs();
    activePointers.clear();
    demo.active = true;
    demo.source = options.source || "debug";
    demo.speed = options.speed || "normal";
    demo.phaseIndex = 0;
    demo.phaseElapsed = 0;
    demo.totalElapsed = 0;
    demo.cyclesRemaining = options.cycles === undefined ? Infinity : options.cycles;
    demo.startX = physics.bodies.torso.position.x;
    startDemoButton.disabled = true;
    stopDemoButton.disabled = false;
    watchDemoButton.disabled = true;
    applyDemoPhase();
  }

  function stopDemo(clear = true, completed = false) {
    const source = demo.source;
    demo.active = false;
    demo.phaseIndex = 0;
    demo.phaseElapsed = 0;
    startDemoButton.disabled = false;
    stopDemoButton.disabled = true;
    watchDemoButton.disabled = false;
    demoStatus.textContent = "DEMO: OFF";
    if (clear) clearInputs();
    if (source === "training") {
      training.phaseIndex = 0;
      training.phaseElapsed = 0;
      training.phaseStarted = false;
      training.phaseStartX = physics.bodies.torso.position.x;
      training.history = [];
      training.feedback = completed ? "YOUR TURN" : "DEMO STOPPED";
      updateTrainingPanel();
    }
  }

  function updateDemo(delta) {
    if (!demo.active) return;
    demo.phaseElapsed += delta;
    demo.totalElapsed += delta;
    let phase = phases[demo.phaseIndex];
    while (demo.phaseElapsed >= demoDuration(phase)) {
      demo.phaseElapsed -= demoDuration(phase);
      if (demo.phaseIndex === phases.length - 1 && Number.isFinite(demo.cyclesRemaining)) {
        demo.cyclesRemaining -= 1;
        if (demo.cyclesRemaining <= 0) {
          stopDemo(true, true);
          return;
        }
      }
      demo.phaseIndex = (demo.phaseIndex + 1) % phases.length;
      phase = phases[demo.phaseIndex];
      applyDemoPhase();
    }
    if (demo.source === "training") {
      training.phaseElapsed = demo.phaseElapsed;
      updateTrainingPanel();
    }
  }

  startDemoButton.addEventListener("click", () => startDemo());
  stopDemoButton.addEventListener("click", () => stopDemo());
  watchDemoButton.addEventListener("click", () => startDemo({ source: "training", speed: training.slow ? "slow" : "normal", cycles: 3 }));
  demoSpeedButton.addEventListener("click", () => {
    training.slow = !training.slow;
    demoSpeedButton.textContent = training.slow ? "SLOW" : "NORMAL";
    demoSpeedButton.setAttribute("aria-pressed", String(training.slow));
  });

  function feedbackFor(verdict, deltaX) {
    if (averageVelocityX < -0.22) return "REVERSE — TRY THE NEXT CUE";
    if (deltaX > 2 || averageVelocityX > 0.18) return verdict === "MISS" ? "FORWARD" : "GOOD PUSH";
    return verdict;
  }

  function advanceTraining(verdict) {
    const phase = phases[training.phaseIndex];
    const deltaX = physics.bodies.torso.position.x - training.phaseStartX;
    training.feedback = feedbackFor(verdict, deltaX);
    training.history.push({ name: phase.name, verdict });
    training.history = training.history.slice(-8);
    training.phaseIndex = (training.phaseIndex + 1) % phases.length;
    training.phaseElapsed = 0;
    training.phaseStarted = QWOPTraining.pressedKeys(physics.inputState).length > 0;
    training.phaseStartX = physics.bodies.torso.position.x;
  }

  function updateTraining(delta) {
    if (!training.active || demo.active) return;
    const phase = phases[training.phaseIndex];
    const pressed = QWOPTraining.pressedKeys(physics.inputState);
    if (!training.phaseStarted) {
      if (!pressed.length) {
        updateTrainingPanel();
        return;
      }
      training.phaseStarted = true;
    }
    training.phaseElapsed += delta;
    const verdict = QWOPTraining.classifyInput(phase.keys, pressed);
    if (verdict === "GOOD" && training.phaseElapsed >= phase.min) {
      advanceTraining("GOOD");
    } else if (training.phaseElapsed >= phase.max) {
      advanceTraining(verdict);
    }
    updateTrainingPanel();
  }

  function updateGuideHighlights() {
    const keys = training.active ? new Set(phases[training.phaseIndex].keys) : new Set();
    document.querySelectorAll(".controls [data-key]").forEach(button => button.classList.toggle("guide", keys.has(button.dataset.key)));
  }

  function updateTrainingPanel() {
    const phase = phases[training.phaseIndex];
    const next = phases[(training.phaseIndex + 1) % phases.length];
    trainingNow.textContent = phase.name;
    trainingNext.textContent = next.name;
    trainingFeedback.textContent = training.feedback;
    trainingFeedback.className = training.feedback.startsWith("REVERSE") ? "reverse" : "";
    timingProgress.style.width = `${Math.min(100, training.phaseElapsed / phase.max * 100)}%`;
    timingProgress.classList.toggle("ready", training.phaseElapsed >= phase.min);
    trainingHistory.innerHTML = training.history.map(item => `<span class="${item.verdict.toLowerCase()}">${item.name}<b>${item.verdict}</b></span>`).join("");
    updateGuideHighlights();
  }

  trainingButton.addEventListener("click", () => {
    training.active = !training.active;
    if (!training.active && demo.source === "training" && demo.active) stopDemo();
    trainingPanel.hidden = !training.active;
    trainingButton.classList.toggle("active", training.active);
    trainingButton.setAttribute("aria-pressed", String(training.active));
    trainingButton.textContent = training.active ? "TRAINING ON" : "TRAINING";
    training.phaseIndex = 0;
    training.phaseElapsed = 0;
    training.phaseStarted = false;
    training.phaseStartX = physics.bodies.torso.position.x;
    training.history = [];
    training.feedback = "YOUR TURN";
    updateTrainingPanel();
  });

  Object.entries(parameterSpec).forEach(([name, spec]) => {
    const row = document.createElement("div");
    row.className = "parameter";
    row.innerHTML = `<label>${spec[0]}</label><output></output><input type="range" min="${spec[1]}" max="${spec[2]}" step="${spec[3]}">`;
    const input = row.querySelector("input");
    const output = row.querySelector("output");
    input.dataset.parameter = name;
    input.value = physics.params[name];
    input.addEventListener("input", () => {
      physics.setParameter(name, input.value);
      output.value = Number(input.value).toFixed(spec[4]);
    });
    input.dispatchEvent(new Event("input"));
    parameterRoot.append(row);
  });

  function retry() {
    stopDemo();
    clearInputs();
    activePointers.clear();
    physics.reset();
    cameraX = physics.startX - (canvas.clientWidth / viewScale) * 0.38;
    lastTime = performance.now();
    distanceEl.textContent = "0.00 m";
    training.phaseIndex = 0;
    training.phaseElapsed = 0;
    training.phaseStarted = false;
    training.phaseStartX = physics.bodies.torso.position.x;
    training.history = [];
    training.feedback = "YOUR TURN";
    updateTrainingPanel();
  }
  retryButton.addEventListener("click", retry);
  debugButton.addEventListener("click", () => {
    debug = !debug;
    panel.hidden = !debug;
    debugButton.textContent = debug ? "DEBUG ON" : "DEBUG";
    debugButton.setAttribute("aria-pressed", String(debug));
    if (!debug && demo.active && demo.source === "debug") stopDemo();
  });

  document.querySelector("#resetParameters").addEventListener("click", () => {
    physics.resetParameters();
    parameterRoot.querySelectorAll("input").forEach(input => {
      input.value = physics.params[input.dataset.parameter];
      input.dispatchEvent(new Event("input"));
    });
    experimentPanel.querySelector(".dynamic-friction").checked = false;
    experimentPanel.querySelector(".balance-preset").value = "1";
    experimentPanel.querySelector(".ankle-preset").value = "1";
    experimentPanel.querySelector(".arm-swing-preset").value = "1";
    experimentPanel.querySelector(".arm-mass-preset").value = "normal";
    experimentPanel.querySelector(".arm-amplitude").value = "35";
    experimentPanel.querySelector(".hand-friction").value = "normal";
  });

  function bodyPath(body) {
    ctx.beginPath();
    body.vertices.forEach((vertex, index) => index ? ctx.lineTo(vertex.x, vertex.y) : ctx.moveTo(vertex.x, vertex.y));
    ctx.closePath();
  }
  function drawBody(body, fill) {
    bodyPath(body);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#07111f";
    ctx.stroke();
  }
  function drawPartLabel(body, key) {
    const active = physics.inputState[key];
    const guided = training.active && phases[training.phaseIndex].keys.includes(key);
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);
    ctx.beginPath();
    ctx.arc(0, 0, active ? 13 : guided ? 13 : 11, 0, Math.PI * 2);
    ctx.fillStyle = active ? "#fff36b" : guided ? "#63e6e2" : "rgba(7,17,31,.86)";
    ctx.fill();
    ctx.lineWidth = guided ? 4 : 2;
    ctx.strokeStyle = active ? "#07111f" : "#fff";
    ctx.stroke();
    ctx.fillStyle = active || guided ? "#07111f" : "#fff";
    ctx.font = `900 ${active || guided ? 16 : 14}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(key.toUpperCase(), 0, 1);
    ctx.restore();
  }
  function degrees(value) {
    return `${(value / QWOPPhysics.DEG).toFixed(1)}°`;
  }

  function updateDiagnostics() {
    const data = physics.diagnostics();
    const c = data.control;
    const jointLine = (label, joint) => `${label.padEnd(7)} cur ${degrees(joint.current).padStart(7)}  target ${degrees(joint.target).padStart(7)}  torque ${joint.torque.toFixed(4).padStart(7)}`;
    diagnosticsEl.textContent = [
      `Q: ${data.inputState.q ? "ON " : "OFF"}   W: ${data.inputState.w ? "ON " : "OFF"}   O: ${data.inputState.o ? "ON " : "OFF"}   P: ${data.inputState.p ? "ON " : "OFF"}`,
      `TORSO angle ${degrees(c.torso.current)}  angular velocity ${data.torsoAngularVelocity.toFixed(4)}`,
      jointLine("R HIP", c.rightHip), jointLine("L HIP", c.leftHip),
      jointLine("R KNEE", c.rightKnee), jointLine("L KNEE", c.leftKnee),
      jointLine("R SHOULDER", c.rightShoulder), jointLine("L SHOULDER", c.leftShoulder),
      jointLine("R ELBOW", c.rightElbow), jointLine("L ELBOW", c.leftElbow),
      `POSITION x ${data.position.x.toFixed(2)} y ${data.position.y.toFixed(2)}`,
      `VELOCITY x ${data.velocity.x.toFixed(3)} y ${data.velocity.y.toFixed(3)} / AVG ${averageVelocityX.toFixed(3)}`,
      `LEFT FOOT  ${data.feet.left.contact ? "GROUND" : "AIR"} friction ${data.feet.left.friction.toFixed(2)}`,
      `RIGHT FOOT ${data.feet.right.contact ? "GROUND" : "AIR"} friction ${data.feet.right.friction.toFixed(2)}`,
      `LEFT HAND  ${data.hands.left.contact ? "GROUND" : "AIR"} friction ${data.hands.left.friction.toFixed(2)}`,
      `RIGHT HAND ${data.hands.right.contact ? "GROUND" : "AIR"} friction ${data.hands.right.friction.toFixed(2)}`,
      `POSTURE ${data.posture}  balance active ${Math.round(data.experiments.balancePostureFactor * 100)}%`,
      `STABILITY balance ${Math.round(data.experiments.balanceScale * 100)}% ankle ${Math.round(data.experiments.ankleScale * 100)}% dynamic friction ${data.experiments.dynamicFootFriction ? "ON" : "OFF"}`,
      `ARMS swing ${Math.round(data.experiments.armSwingScale * 100)}% amplitude ${data.experiments.armAmplitude}° mass ${data.experiments.armMass.toUpperCase()} active ${Math.round(data.experiments.armControlFactor * 100)}%`,
      `HANDS friction ${data.experiments.handFriction.toUpperCase()}  stride ${data.experiments.smoothedStride.toFixed(3)}`,
      `NECK ${data.neck.connected ? "CONNECTED" : "LOOSE"} gap ${data.neck.distance.toFixed(2)}`,
      `DEMO ${demo.active ? "ON" : "OFF"} phase ${demo.active ? phases[demo.phaseIndex].name : "-"} elapsed ${(demo.totalElapsed / 1000).toFixed(2)}s`,
      `ORIENTATION ${matchMedia("(orientation: portrait)").matches ? "PORTRAIT" : "LANDSCAPE"}`
    ].join("\n");
  }

  function drawDebug() {
    const bodies = physics.bodies;
    ctx.strokeStyle = "#ff2a63";
    ctx.lineWidth = 1;
    Object.values(bodies).forEach(body => { bodyPath(body); ctx.stroke(); });
    const data = physics.diagnostics();
    [["left", bodies.leftFoot], ["right", bodies.rightFoot]].forEach(([side, foot]) => {
      ctx.fillStyle = data.feet[side].contact ? "#63e6e2" : "#ff7068";
      ctx.font = "800 10px monospace";
      ctx.fillText(data.feet[side].contact ? "GROUND" : "AIR", foot.position.x - 20, foot.position.y + 28);
    });
    ctx.strokeStyle = data.neck.connected ? "#63e6e2" : "#ff2a63";
    ctx.beginPath();
    ctx.moveTo(data.neck.torsoAnchor.x, data.neck.torsoAnchor.y);
    ctx.lineTo(data.neck.headAnchor.x, data.neck.headAnchor.y);
    ctx.stroke();
  }

  function draw(width, height) {
    ctx.clearRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#c9f0f2");
    sky.addColorStop(1, "#87ccd7");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(0, height - 489 * viewScale);
    ctx.scale(viewScale, viewScale);
    ctx.translate(-cameraX, 0);
    const left = cameraX - 200;
    const right = cameraX + width / viewScale + 200;
    ctx.fillStyle = "#d9bc79";
    ctx.fillRect(left, 489, right - left, 120);
    ctx.fillStyle = "#263849";
    ctx.fillRect(left, 489, right - left, 8);
    ctx.strokeStyle = "rgba(38,56,73,.22)";
    for (let x = Math.floor(left / 72) * 72; x < right; x += 72) {
      ctx.beginPath(); ctx.moveTo(x, 497); ctx.lineTo(x - 34, 538); ctx.stroke();
    }
    ctx.fillStyle = "#163044";
    ctx.font = "800 11px monospace";
    ctx.fillText("START", physics.startX - 24, 478);
    ctx.fillRect(physics.startX, 459, 3, 30);
    ctx.strokeStyle = "#163044";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(physics.startX + 38, 447);
    ctx.lineTo(physics.startX + 128, 447);
    ctx.lineTo(physics.startX + 116, 439);
    ctx.moveTo(physics.startX + 128, 447);
    ctx.lineTo(physics.startX + 116, 455);
    ctx.stroke();
    ctx.fillText("FORWARD", physics.startX + 51, 435);
    for (let meter = -5; meter < 150; meter += 5) {
      const x = physics.startX + meter * QWOPPhysics.SCALE;
      ctx.fillRect(x, 481, 2, 8);
      if (meter % 10 === 0) ctx.fillText(`${meter}m`, x - 10, 470);
    }
    const b = physics.bodies;
    const armData = physics.diagnostics();
    const drawArm = side => {
      if (side === "left") {
        drawBody(b.leftUpperArm, "#c94958"); drawBody(b.leftForearm, "#df6a62"); drawBody(b.leftHand, "#f3b58d");
      } else {
        drawBody(b.rightUpperArm, "#188d9f"); drawBody(b.rightForearm, "#27b8bf"); drawBody(b.rightHand, "#f3b58d");
      }
    };
    const frontArm = armData.experiments.smoothedStride >= 0 ? "right" : "left";
    const backArm = frontArm === "right" ? "left" : "right";
    drawArm(backArm);
    drawBody(b.leftThigh, "#ef5f63"); drawBody(b.leftShin, "#f18b62"); drawBody(b.leftFoot, "#f5f0df");
    drawBody(b.rightThigh, "#31b9c5"); drawBody(b.rightShin, "#55d5d0"); drawBody(b.rightFoot, "#f5f0df");
    const neck = physics.diagnostics().neck;
    ctx.strokeStyle = "#f3b58d"; ctx.lineWidth = 14; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(neck.torsoAnchor.x, neck.torsoAnchor.y); ctx.lineTo(neck.headAnchor.x, neck.headAnchor.y); ctx.stroke();
    drawBody(b.torso, "#f7cf59");
    drawArm(frontArm);
    ctx.beginPath(); ctx.arc(b.head.position.x, b.head.position.y, b.head.circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#f3b58d"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#07111f"; ctx.stroke();
    ctx.save(); ctx.translate(b.head.position.x, b.head.position.y); ctx.rotate(b.head.angle);
    ctx.fillStyle = "#07111f"; ctx.beginPath(); ctx.arc(8, -5, 2.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    drawPartLabel(b.rightThigh, "q"); drawPartLabel(b.leftThigh, "w");
    drawPartLabel(b.rightShin, "o"); drawPartLabel(b.leftShin, "p");
    if (debug) drawDebug();
    ctx.restore();
  }

  function frame(now) {
    const delta = Math.min(now - lastTime, 100);
    lastTime = now;
    updateDemo(delta);
    updateTraining(delta);
    physics.step(delta);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const desiredCamera = physics.bodies.torso.position.x - (width / viewScale) * 0.38;
    const cameraError = desiredCamera - cameraX;
    if (Math.abs(cameraError) > 80) cameraX += Math.sign(cameraError) * (Math.abs(cameraError) - 80) * 0.025;
    draw(width, height);
    distanceEl.textContent = `${physics.distance.toFixed(2)} m`;
    fps += ((1000 / Math.max(delta, 1)) - fps) * 0.08;
    fpsEl.textContent = `${Math.round(fps)} FPS`;
    velocitySamples.push({ time: now, value: physics.bodies.torso.velocity.x });
    while (velocitySamples.length && velocitySamples[0].time < now - 1000) velocitySamples.shift();
    averageVelocityX = velocitySamples.reduce((sum, sample) => sum + sample.value, 0) / Math.max(velocitySamples.length, 1);
    if (debug) updateDiagnostics();
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", () => { lastTime = performance.now(); });
  resize();
  updateTrainingPanel();
  requestAnimationFrame(frame);
})();
