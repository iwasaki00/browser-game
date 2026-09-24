(function () {
  "use strict";

  const canvas = document.querySelector("#gameCanvas");
  const ctx = canvas.getContext("2d");
  const distanceEl = document.querySelector("#distance");
  const raceTimeEl = document.querySelector("#raceTime");
  const bestTimeEl = document.querySelector("#bestTime");
  const bestDistanceEl = document.querySelector("#bestDistance");
  const raceOverlay = document.querySelector("#raceOverlay");
  const raceMessage = document.querySelector("#raceMessage");
  const raceResult = document.querySelector("#raceResult");
  const runAgainButton = document.querySelector("#runAgainButton");
  const recordStatus = document.querySelector("#recordStatus");
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
  const raceTestMode = new URLSearchParams(location.search).has("raceTest")
    && (location.hostname === "127.0.0.1" || location.hostname === "localhost");
  const race = new QWOPRace.RaceController({
    storage: window.localStorage,
    countdown: raceTestMode ? { ready: 10, three: 10, two: 10, one: 10, go: 20 } : undefined
  });
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
  const physicsTest = {
    mode: null, elapsed: 0, startX: 0, velocityIntegral: 0, maxVelocity: 0,
    leftFootTime: 0, rightFootTime: 0, leftLoadIntegral: 0, rightLoadIntegral: 0,
    leftHandTime: 0, rightHandTime: 0, firstContact: "none",
    fallingAt: null, downAt: null, nextFallDirection: 1
  };
  const armFormTest = { active: false, phaseIndex: 0, elapsed: 0, poses: ["LEFT_FRONT", "RIGHT_FRONT", "LEFT_FRONT", "RIGHT_FRONT"] };
  const armConnectionTest = {
    active: false, phaseIndex: 0, elapsed: 0,
    poses: ["NEUTRAL", "LEFT_FRONT", "RIGHT_FRONT", "LEFT_EXTREME", "RIGHT_EXTREME", "FALLING"],
    max: { left: { shoulder: 0, elbow: 0, wrist: 0 }, right: { shoulder: 0, elbow: 0, wrist: 0 } }
  };
  const elbowMatrixTest = {
    active: false, phaseIndex: 0, elapsed: 0, results: [],
    states: [
      { name: "NONE", keys: [] }, { name: "Q", keys: ["q"] }, { name: "W", keys: ["w"] },
      { name: "O", keys: ["o"] }, { name: "P", keys: ["p"] }, { name: "Q+O", keys: ["q", "o"] },
      { name: "Q+P", keys: ["q", "p"] }, { name: "W+O", keys: ["w", "o"] }, { name: "W+P", keys: ["w", "p"] }
    ]
  };
  let jointDots = true;
  let armSkeletonDebug = false;
  let raceWorldOriginX = physics.bodies.torso.position.x;

  const inputLocked = () => !race.inputEnabled || demo.active || armConnectionTest.active || elbowMatrixTest.active || physicsTest.mode === "drift" || (physicsTest.mode === "fall" && physicsTest.downAt === null);

  function invalidateRace(reason) {
    race.invalidate(reason);
  }

  function formatRaceTime(milliseconds) {
    return milliseconds === null ? "--.---" : (milliseconds / 1000).toFixed(3);
  }

  function raceDistance() {
    if (race.state !== QWOPRace.RACE_STATE.RUNNING && race.state !== QWOPRace.RACE_STATE.FINISHED) return 0;
    return (physics.bodies.torso.position.x - raceWorldOriginX) / QWOPPhysics.SCALE;
  }

  function finishRace() {
    clearInputs();
    activePointers.clear();
    if (demo.active) stopDemo();
    setTestButtons(true);
    training.active = false;
    trainingButton.disabled = true;
    trainingPanel.hidden = true;
    trainingButton.classList.remove("active");
    trainingButton.setAttribute("aria-pressed", "false");
    trainingButton.textContent = "TRAINING";
    updateTrainingPanel();
  }

  function updateRaceUI(now) {
    const label = race.countdownLabel(now);
    const finished = race.state === QWOPRace.RACE_STATE.FINISHED;
    raceTimeEl.textContent = formatRaceTime(finished ? race.finalTimeMs : race.elapsedMs);
    bestTimeEl.textContent = formatRaceTime(race.bestTimeMs);
    bestDistanceEl.textContent = `${race.bestDistance.toFixed(2)} m`;
    recordStatus.textContent = race.recordValid ? "VALID RUN" : `DEBUG RUN - ${race.invalidReasons.join(" / ")}`;
    recordStatus.classList.toggle("invalid", !race.recordValid);
    raceMessage.textContent = finished ? "GOAL!" : label;
    if (finished) {
      raceResult.textContent = race.recordValid
        ? `TIME ${formatRaceTime(race.finalTimeMs)} s${race.newBest ? " - NEW BEST!" : ""}`
        : `DEBUG RUN - TIME ${formatRaceTime(race.finalTimeMs)} s - RECORD NOT SAVED`;
    } else {
      raceResult.textContent = "";
    }
    raceOverlay.hidden = !finished && !label;
    runAgainButton.hidden = !finished;
  }

  function updateRace(now, forcedDistance) {
    const event = race.update(now, forcedDistance === undefined ? raceDistance() : forcedDistance);
    if (event.started) {
      raceWorldOriginX = physics.bodies.torso.position.x;
      race.currentDistance = 0;
      race.maxDistance = 0;
      clearInputs();
    }
    if (event.finished) finishRace();
    updateRaceUI(now);
    return event;
  }

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
      if (inputLocked()) return;
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
    if (!inputLocked()) setInput(key, true);
  });
  document.addEventListener("keyup", event => {
    const key = event.key.toLowerCase();
    if (!(key in physics.inputState)) return;
    event.preventDefault();
    if (!inputLocked()) setInput(key, false);
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
    <button type="button" class="recovery-test">RECOVERY TEST</button>
    <label>Joint Dots <input class="joint-dots" type="checkbox" checked></label>
    <label>Arm Skeleton <input class="arm-skeleton-debug" type="checkbox"></label>
    <div class="phase1f-tests"><button type="button" class="drift-test">DRIFT TEST 5s</button><button type="button" class="fall-test">FALL TEST</button><button type="button" class="arm-form-test">ARM FORM TEST</button><button type="button" class="arm-connection-test">ARM CONNECTION TEST</button><button type="button" class="elbow-matrix-test">ELBOW MATRIX TEST</button></div>
    <pre class="physics-test-result">PHASE 1F TESTS: READY</pre>
    <p class="arm-form-status">ARM FORM: READY</p>`;
  experimentPanel.querySelector(".dynamic-friction").addEventListener("change", event => physics.setDynamicFootFriction(event.target.checked));
  experimentPanel.querySelector(".balance-preset").addEventListener("change", event => physics.setBalanceScale(event.target.value));
  experimentPanel.querySelector(".ankle-preset").addEventListener("change", event => physics.setAnkleScale(event.target.value));
  experimentPanel.querySelector(".arm-swing-preset").addEventListener("change", event => physics.setArmSwingScale(event.target.value));
  experimentPanel.querySelector(".arm-mass-preset").addEventListener("change", event => physics.setArmMass(event.target.value));
  experimentPanel.querySelector(".arm-amplitude").addEventListener("change", event => physics.setArmAmplitude(event.target.value));
  experimentPanel.querySelector(".hand-friction").addEventListener("change", event => physics.setHandFriction(event.target.value));
  experimentPanel.querySelector(".joint-dots").addEventListener("change", event => { jointDots = event.target.checked; });
  experimentPanel.querySelector(".arm-skeleton-debug").addEventListener("change", event => { armSkeletonDebug = event.target.checked; });
  let recoveryDirection = 1;
  experimentPanel.querySelector(".recovery-test").addEventListener("click", () => {
    invalidateRace("RECOVERY TEST");
    physics.applyRecoveryImpulse(recoveryDirection);
    recoveryDirection *= -1;
  });
  const driftTestButton = experimentPanel.querySelector(".drift-test");
  const fallTestButton = experimentPanel.querySelector(".fall-test");
  const armFormTestButton = experimentPanel.querySelector(".arm-form-test");
  const armConnectionTestButton = experimentPanel.querySelector(".arm-connection-test");
  const elbowMatrixTestButton = experimentPanel.querySelector(".elbow-matrix-test");
  const armFormStatus = experimentPanel.querySelector(".arm-form-status");
  const physicsTestResult = experimentPanel.querySelector(".physics-test-result");

  function setTestButtons(running) {
    driftTestButton.disabled = running;
    fallTestButton.disabled = running;
    armFormTestButton.disabled = running;
    armConnectionTestButton.disabled = running;
    elbowMatrixTestButton.disabled = running;
    experimentPanel.querySelector(".recovery-test").disabled = running;
    startDemoButton.disabled = running;
    watchDemoButton.disabled = running;
  }

  function resetTestState(mode) {
    invalidateRace(`${mode.toUpperCase()} TEST`);
    stopArmFormTest();
    stopDemo();
    clearInputs();
    activePointers.clear();
    physics.reset();
    physicsTest.mode = mode;
    physicsTest.elapsed = 0;
    physicsTest.startX = physics.bodies.torso.position.x;
    physicsTest.velocityIntegral = 0;
    physicsTest.maxVelocity = 0;
    physicsTest.leftFootTime = 0;
    physicsTest.rightFootTime = 0;
    physicsTest.leftLoadIntegral = 0;
    physicsTest.rightLoadIntegral = 0;
    physicsTest.leftHandTime = 0;
    physicsTest.rightHandTime = 0;
    physicsTest.firstContact = "none";
    physicsTest.fallingAt = null;
    physicsTest.downAt = null;
    cameraX = physics.startX - (canvas.clientWidth / viewScale) * 0.38;
    lastTime = performance.now();
    setTestButtons(true);
  }

  function startDriftTest() {
    resetTestState("drift");
    physicsTestResult.textContent = "DRIFT TEST: RUNNING 0.0 / 5.0s\nInputs and demo are disabled.";
  }

  function startFallTest() {
    resetTestState("fall");
    const direction = physicsTest.nextFallDirection;
    physicsTest.nextFallDirection *= -1;
    physics.applyFallTest(direction);
    physicsTestResult.textContent = `FALL TEST: RUNNING / PUSH ${direction > 0 ? "RIGHT" : "LEFT"}`;
  }

  driftTestButton.addEventListener("click", startDriftTest);
  fallTestButton.addEventListener("click", startFallTest);

  function stopArmFormTest(completed = false) {
    armFormTest.active = false;
    armFormTest.phaseIndex = 0;
    armFormTest.elapsed = 0;
    physics.setArmFormPose(null);
    armFormTestButton.disabled = false;
    armFormTestButton.textContent = "ARM FORM TEST";
    armFormStatus.textContent = completed ? "ARM FORM: COMPLETE" : "ARM FORM: READY";
  }

  function startArmFormTest() {
    if (physicsTest.mode || armConnectionTest.active) return;
    invalidateRace("ARM FORM TEST");
    stopDemo();
    armFormTest.active = true;
    armFormTest.phaseIndex = 0;
    armFormTest.elapsed = 0;
    physics.setArmFormPose(armFormTest.poses[0]);
    armFormTestButton.disabled = true;
    armFormTestButton.textContent = "ARM FORM RUNNING";
    armFormStatus.textContent = "ARM FORM: LEFT FRONT / RIGHT REAR 1 / 4";
  }

  function updateArmFormTest(delta) {
    if (!armFormTest.active) return;
    armFormTest.elapsed += delta;
    if (armFormTest.elapsed < 1800) return;
    armFormTest.elapsed -= 1800;
    armFormTest.phaseIndex += 1;
    if (armFormTest.phaseIndex >= armFormTest.poses.length) {
      stopArmFormTest(true);
      return;
    }
    const pose = armFormTest.poses[armFormTest.phaseIndex];
    physics.setArmFormPose(pose);
    const labels = [
      "LEFT FRONT / RIGHT REAR", "RIGHT FRONT / LEFT REAR",
      "LEFT FRONT HOLD", "RIGHT FRONT HOLD"
    ];
    armFormStatus.textContent = `ARM FORM: ${labels[armFormTest.phaseIndex]} ${armFormTest.phaseIndex + 1} / 4`;
  }

  armFormTestButton.addEventListener("click", startArmFormTest);

  function startArmConnectionTest() {
    if (physicsTest.mode || armFormTest.active) return;
    invalidateRace("ARM CONNECTION TEST");
    stopDemo();
    clearInputs();
    physics.reset();
    armConnectionTest.active = true;
    armConnectionTest.phaseIndex = 0;
    armConnectionTest.elapsed = 0;
    armConnectionTest.max = { left: { shoulder: 0, elbow: 0, wrist: 0 }, right: { shoulder: 0, elbow: 0, wrist: 0 } };
    physics.setArmFormPose("NEUTRAL");
    setTestButtons(true);
    armConnectionTestButton.disabled = true;
    physicsTestResult.textContent = "ARM CONNECTION TEST: NEUTRAL 1 / 6";
  }

  function updateArmConnectionTest(delta) {
    if (!armConnectionTest.active) return;
    const connections = physics.diagnostics().armForm.connections;
    ["left", "right"].forEach(side => {
      ["shoulder", "elbow", "wrist"].forEach(joint => {
        armConnectionTest.max[side][joint] = Math.max(armConnectionTest.max[side][joint], connections[side].gaps[joint]);
      });
    });
    armConnectionTest.elapsed += delta;
    if (armConnectionTest.elapsed < 1500) return;
    armConnectionTest.elapsed -= 1500;
    armConnectionTest.phaseIndex += 1;
    if (armConnectionTest.phaseIndex >= armConnectionTest.poses.length) {
      armConnectionTest.active = false;
      physics.setArmFormPose(null);
      setTestButtons(false);
      const line = side => `${side.toUpperCase()} ARM MAX GAP  shoulder ${armConnectionTest.max[side].shoulder.toFixed(3)}px / elbow ${armConnectionTest.max[side].elbow.toFixed(3)}px / wrist ${armConnectionTest.max[side].wrist.toFixed(3)}px`;
      physicsTestResult.textContent = ["ARM CONNECTION TEST: COMPLETE", line("left"), line("right")].join("\n");
      return;
    }
    const pose = armConnectionTest.poses[armConnectionTest.phaseIndex];
    if (pose === "FALLING") {
      physics.setArmFormPose(null);
      physics.applyFallTest(1);
    } else {
      physics.setArmFormPose(pose);
    }
    physicsTestResult.textContent = `ARM CONNECTION TEST: ${pose.replaceAll("_", " ")} ${armConnectionTest.phaseIndex + 1} / 6`;
  }

  armConnectionTestButton.addEventListener("click", startArmConnectionTest);

  function applyElbowMatrixState() {
    clearInputs();
    physics.reset();
    const test = elbowMatrixTest.states[elbowMatrixTest.phaseIndex];
    test.keys.forEach(key => setInput(key, true));
    physicsTestResult.textContent = `ELBOW MATRIX TEST: ${test.name} ${elbowMatrixTest.phaseIndex + 1} / ${elbowMatrixTest.states.length}`;
  }

  function startElbowMatrixTest() {
    if (physicsTest.mode || armFormTest.active || armConnectionTest.active) return;
    invalidateRace("ELBOW MATRIX TEST");
    stopDemo();
    elbowMatrixTest.active = true;
    elbowMatrixTest.phaseIndex = 0;
    elbowMatrixTest.elapsed = 0;
    elbowMatrixTest.results = [];
    setTestButtons(true);
    elbowMatrixTestButton.disabled = true;
    applyElbowMatrixState();
  }

  function updateElbowMatrixTest(delta) {
    if (!elbowMatrixTest.active) return;
    elbowMatrixTest.elapsed += delta;
    if (elbowMatrixTest.elapsed < 1200) return;
    const data = physics.diagnostics().armForm;
    const test = elbowMatrixTest.states[elbowMatrixTest.phaseIndex];
    elbowMatrixTest.results.push({
      name: test.name,
      left: { role: data.leftRole, human: data.leftElbowHuman, bend: data.leftExpectedSign, correct: data.leftElbowDirection },
      right: { role: data.rightRole, human: data.rightElbowHuman, bend: data.rightExpectedSign, correct: data.rightElbowDirection }
    });
    elbowMatrixTest.phaseIndex += 1;
    elbowMatrixTest.elapsed = 0;
    if (elbowMatrixTest.phaseIndex < elbowMatrixTest.states.length) {
      applyElbowMatrixState();
      return;
    }
    clearInputs();
    elbowMatrixTest.active = false;
    setTestButtons(false);
    const line = result => `${result.name.padEnd(4)} L ${result.left.role} ${result.left.human.toFixed(1)}deg bend ${result.left.bend > 0 ? "+" : "-"} ${result.left.correct} / R ${result.right.role} ${result.right.human.toFixed(1)}deg bend ${result.right.bend > 0 ? "+" : "-"} ${result.right.correct}`;
    physicsTestResult.textContent = ["ELBOW MATRIX TEST: COMPLETE", ...elbowMatrixTest.results.map(line)].join("\n");
  }

  elbowMatrixTestButton.addEventListener("click", startElbowMatrixTest);

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
    if (physicsTest.mode) return;
    invalidateRace(options.source === "training" ? "TRAINING DEMO" : "DEMO FORWARD");
    stopArmFormTest();
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
    stopArmFormTest();
    armConnectionTest.active = false;
    elbowMatrixTest.active = false;
    physics.setArmFormPose(null);
    physicsTest.mode = null;
    setTestButtons(false);
    trainingButton.disabled = false;
    stopDemo();
    clearInputs();
    activePointers.clear();
    physics.reset();
    const now = performance.now();
    race.reset(now);
    race.startCountdown(now);
    raceWorldOriginX = physics.bodies.torso.position.x;
    if (raceTestMode) updateRace(now + race.countdownRunAt());
    cameraX = physics.startX - (canvas.clientWidth / viewScale) * 0.38;
    lastTime = now;
    distanceEl.textContent = "0.00 m";
    training.phaseIndex = 0;
    training.phaseElapsed = 0;
    training.phaseStarted = false;
    training.phaseStartX = physics.bodies.torso.position.x;
    training.history = [];
    training.feedback = "YOUR TURN";
    updateTrainingPanel();
    updateRaceUI(now);
  }
  retryButton.addEventListener("click", retry);
  runAgainButton.addEventListener("click", retry);
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
    const point = value => `(${value.x.toFixed(1)}, ${value.y.toFixed(1)})`;
    const connectionLines = side => {
      const name = side.toUpperCase();
      const connection = data.armForm.connections[side];
      const world = connection.world;
      const gaps = connection.gaps;
      return [
        `${name} ARM SKELETON shoulder ${point(world.shoulderTorsoAnchor)} / upper shoulder ${point(world.upperShoulderEndpoint)}`,
        `${name} ELBOW upper ${point(world.upperElbowEndpoint)} / A ${point(world.elbowConstraintA)} / B ${point(world.elbowConstraintB)} / forearm ${point(world.forearmElbowEndpoint)}`,
        `${name} WRIST forearm ${point(world.forearmWristEndpoint)} / hand ${point(world.handCenter)}`,
        `${name} GAP shoulder ${gaps.shoulder.toFixed(3)}px / upper-A ${gaps.upperToA.toFixed(3)}px / A-B ${gaps.aToB.toFixed(3)}px / B-forearm ${gaps.bToForearm.toFixed(3)}px / elbow ${gaps.elbow.toFixed(3)}px / wrist ${gaps.wrist.toFixed(3)}px`
      ];
    };
    const jointLine = (label, joint) => `${label.padEnd(7)} cur ${degrees(joint.current).padStart(7)}  target ${degrees(joint.target).padStart(7)}  torque ${joint.torque.toFixed(4).padStart(7)}`;
    diagnosticsEl.textContent = [
      `Q: ${data.inputState.q ? "ON " : "OFF"}   W: ${data.inputState.w ? "ON " : "OFF"}   O: ${data.inputState.o ? "ON " : "OFF"}   P: ${data.inputState.p ? "ON " : "OFF"}`,
      `TORSO angle ${degrees(c.torso.current)}  angular velocity ${data.torsoAngularVelocity.toFixed(4)}`,
      jointLine("R HIP", c.rightHip), jointLine("L HIP", c.leftHip),
      jointLine("R KNEE", c.rightKnee), jointLine("L KNEE", c.leftKnee),
      jointLine("R SHOULDER", c.rightShoulder), jointLine("L SHOULDER", c.leftShoulder),
      jointLine("R ELBOW", c.rightElbow), jointLine("L ELBOW", c.leftElbow),
      `ARM ROLE FRONT ${data.armForm.frontArm.toUpperCase()} / REAR ${data.armForm.rearArm.toUpperCase()} / POSE ${data.armForm.pose}`,
      `L SHOULDER HUMAN ${data.armForm.leftShoulderHuman.toFixed(1)}°  R SHOULDER HUMAN ${data.armForm.rightShoulderHuman.toFixed(1)}°`,
      `L ELBOW HUMAN ${data.armForm.leftElbowHuman.toFixed(1)}°  R ELBOW HUMAN ${data.armForm.rightElbowHuman.toFixed(1)}°`,
      `LEFT ARM ROLE ${data.armForm.leftRole} / ELBOW SIGNED ${data.armForm.leftElbowSigned.toFixed(1)}° / ANATOMICAL ${data.armForm.leftAnatomicalSigned.toFixed(1)}° / EXPECTED SIGN ${data.armForm.leftExpectedSign > 0 ? "+" : "-"} / ACTUAL SIGN ${data.armForm.leftActualSign > 0 ? "+" : "-"} / DIRECTION ${data.armForm.leftElbowDirection}`,
      `RIGHT ARM ROLE ${data.armForm.rightRole} / ELBOW SIGNED ${data.armForm.rightElbowSigned.toFixed(1)}° / ANATOMICAL ${data.armForm.rightAnatomicalSigned.toFixed(1)}° / EXPECTED SIGN ${data.armForm.rightExpectedSign > 0 ? "+" : "-"} / ACTUAL SIGN ${data.armForm.rightActualSign > 0 ? "+" : "-"} / DIRECTION ${data.armForm.rightElbowDirection}`,
      `LEFT ELBOW STATE ${data.armForm.leftElbowState} / HUMAN CURRENT ${data.armForm.leftElbowHuman.toFixed(1)}° / HUMAN TARGET ${data.armForm.leftElbowHumanTarget.toFixed(1)}° / PHYSICS CURRENT ${data.armForm.leftElbowSigned.toFixed(1)}° / PHYSICS TARGET ${data.armForm.leftElbowPhysicsTarget.toFixed(1)}° / BEND ${data.armForm.leftExpectedSign > 0 ? "+" : "-"} / ROLE ${data.armForm.leftRole} / PHASE ${data.armForm.phase.toFixed(3)}`,
      `RIGHT ELBOW STATE ${data.armForm.rightElbowState} / HUMAN CURRENT ${data.armForm.rightElbowHuman.toFixed(1)}° / HUMAN TARGET ${data.armForm.rightElbowHumanTarget.toFixed(1)}° / PHYSICS CURRENT ${data.armForm.rightElbowSigned.toFixed(1)}° / PHYSICS TARGET ${data.armForm.rightElbowPhysicsTarget.toFixed(1)}° / BEND ${data.armForm.rightExpectedSign > 0 ? "+" : "-"} / ROLE ${data.armForm.rightRole} / PHASE ${data.armForm.phase.toFixed(3)}`,
      `TARGET TRACE 2s L [${data.armForm.targetTrace.map(sample => sample.left.toFixed(0)).join(" ")}]`,
      `TARGET TRACE 2s R [${data.armForm.targetTrace.map(sample => sample.right.toFixed(0)).join(" ")}]`,
      `L UA SCREEN ${data.armForm.leftUpperArmScreen.toFixed(1)}°  FA SCREEN ${data.armForm.leftForearmScreen.toFixed(1)}°`,
      `R UA SCREEN ${data.armForm.rightUpperArmScreen.toFixed(1)}°  FA SCREEN ${data.armForm.rightForearmScreen.toFixed(1)}°`,
      `L FOREARM SCREEN ${data.armForm.leftForearmScreen.toFixed(1)}°  R FOREARM SCREEN ${data.armForm.rightForearmScreen.toFixed(1)}°`,
      `JOINT DOTS ${jointDots ? "ON" : "OFF"}  ARM SKELETON ${armSkeletonDebug ? "ON" : "OFF"}`,
      ...connectionLines("left"), ...connectionLines("right"),
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

  function updatePhysicsTest(delta) {
    if (!physicsTest.mode) return;
    const dt = delta / 1000;
    const data = physics.diagnostics();
    physicsTest.elapsed += delta;
    if (physicsTest.mode === "drift") {
      physicsTest.velocityIntegral += data.velocity.x * dt;
      physicsTest.maxVelocity = Math.max(physicsTest.maxVelocity, Math.abs(data.velocity.x));
      if (data.feet.left.contact) physicsTest.leftFootTime += dt;
      if (data.feet.right.contact) physicsTest.rightFootTime += dt;
      if (data.feet.left.contact) physicsTest.leftLoadIntegral += physics.bodies.leftFoot.mass * physics.params.gravity * dt;
      if (data.feet.right.contact) physicsTest.rightLoadIntegral += physics.bodies.rightFoot.mass * physics.params.gravity * dt;
      physicsTestResult.textContent = `DRIFT TEST: RUNNING ${(physicsTest.elapsed / 1000).toFixed(1)} / 5.0s\nInputs and demo are disabled.`;
      if (physicsTest.elapsed >= 5000) {
        const endX = data.position.x;
        const duration = physicsTest.elapsed / 1000;
        physicsTestResult.textContent = [
          "DRIFT TEST: COMPLETE",
          `Start X ${(physicsTest.startX / QWOPPhysics.SCALE).toFixed(4)} m`,
          `End X   ${(endX / QWOPPhysics.SCALE).toFixed(4)} m`,
          `Drift Distance ${((endX - physicsTest.startX) / QWOPPhysics.SCALE).toFixed(4)} m`,
          `Avg X velocity ${(physicsTest.velocityIntegral / duration / QWOPPhysics.SCALE).toFixed(4)} m/s`,
          `Max X velocity ${(physicsTest.maxVelocity / QWOPPhysics.SCALE).toFixed(4)} m/s`,
          `Foot ground L ${physicsTest.leftFootTime.toFixed(2)}s / R ${physicsTest.rightFootTime.toFixed(2)}s`,
          `Est. foot load L ${(physicsTest.leftLoadIntegral / duration).toFixed(3)} / R ${(physicsTest.rightLoadIntegral / duration).toFixed(3)}`
        ].join("\n");
        physicsTest.mode = null;
        setTestButtons(false);
      }
      return;
    }

    if (data.hands.left.contact) physicsTest.leftHandTime += dt;
    if (data.hands.right.contact) physicsTest.rightHandTime += dt;
    if (physicsTest.firstContact === "none") {
      const first = Object.entries(data.groundContacts).find(([, contact]) => contact);
      if (first) physicsTest.firstContact = first[0];
    }
    if (data.posture === "FALLING" && physicsTest.fallingAt === null) physicsTest.fallingAt = physicsTest.elapsed;
    if (data.posture === "DOWN" && physicsTest.downAt === null) {
      physicsTest.downAt = physicsTest.elapsed;
      clearInputs();
    }
    const done = physicsTest.elapsed >= 6000 || (physicsTest.downAt !== null && physicsTest.elapsed >= physicsTest.downAt + 1000);
    physicsTestResult.textContent = [
      `FALL TEST: ${done ? "COMPLETE" : "RUNNING"}`,
      `Posture ${data.posture}`,
      `FALLING ${physicsTest.fallingAt === null ? "not reached" : (physicsTest.fallingAt / 1000).toFixed(2) + "s"}`,
      `DOWN ${physicsTest.downAt === null ? "not reached" : (physicsTest.downAt / 1000).toFixed(2) + "s"}`,
      `Hand now L ${data.hands.left.contact ? "GROUND" : "AIR"} / R ${data.hands.right.contact ? "GROUND" : "AIR"}`,
      `Hand contact L ${physicsTest.leftHandTime.toFixed(2)}s / R ${physicsTest.rightHandTime.toFixed(2)}s`,
      `First body contact ${physicsTest.firstContact}`,
      physicsTest.downAt === null ? "Q/W/O/P locked until DOWN" : "Q/W/O/P enabled while DOWN"
    ].join("\n");
    if (done) {
      physicsTest.mode = null;
      setTestButtons(false);
    }
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
    if (armSkeletonDebug) ["left", "right"].forEach(side => {
      const points = data.armForm.points[side];
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = side === "left" ? "#ff335f" : "#00c6d7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(points.shoulder.x, points.shoulder.y);
      ctx.lineTo(points.elbow.x, points.elbow.y);
      ctx.lineTo(points.hand.x, points.hand.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#07111f";
      ctx.font = "800 9px monospace";
      ctx.fillText(`${side === "left" ? "L" : "R"} UA ${data.armForm[`${side}UpperArmScreen`].toFixed(0)}°`, points.elbow.x + 8, points.elbow.y - 8);
      ctx.fillText(`FA ${data.armForm[`${side}ForearmScreen`].toFixed(0)}°`, points.hand.x + 8, points.hand.y);
      ctx.restore();
    });
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
    const courseStartX = raceWorldOriginX;
    const goalX = courseStartX + race.goalDistance * QWOPPhysics.SCALE;
    ctx.fillText("START", courseStartX - 24, 478);
    ctx.fillRect(courseStartX, 459, 3, 30);
    ctx.strokeStyle = "#163044";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(courseStartX + 38, 447);
    ctx.lineTo(courseStartX + 128, 447);
    ctx.lineTo(courseStartX + 116, 439);
    ctx.moveTo(courseStartX + 128, 447);
    ctx.lineTo(courseStartX + 116, 455);
    ctx.stroke();
    ctx.fillText("FORWARD", courseStartX + 51, 435);
    for (let meter = -50; meter <= 100; meter += 5) {
      const x = courseStartX + meter * QWOPPhysics.SCALE;
      ctx.fillRect(x, 481, 2, 8);
      if (meter % 10 === 0) ctx.fillText(`${meter}m`, x - 10, 470);
    }
    ctx.save();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#ff2a63";
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(goalX, 345);
    ctx.lineTo(goalX, 489);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#07111f";
    ctx.fillRect(goalX - 38, 335, 76, 26);
    ctx.fillStyle = "#fff36b";
    ctx.font = "900 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("GOAL 100m", goalX, 353);
    ctx.restore();
    const b = physics.bodies;
    const armData = physics.diagnostics();
    const drawJoint = (point, radius, fill) => {
      ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#07111f"; ctx.stroke();
    };
    const drawVisualHand = (side, hand) => {
      const point = armData.armForm.points[side].hand;
      ctx.beginPath(); ctx.arc(point.x, point.y, hand.circleRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#f3b58d"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#07111f"; ctx.stroke();
    };
    const drawArm = side => {
      if (side === "left") {
        drawBody(b.leftUpperArm, "#c94958"); drawBody(b.leftForearm, "#df6a62");
        if (jointDots) {
          drawJoint(armData.armForm.points.left.shoulder, 5, "#c94958");
          drawJoint(armData.armForm.points.left.elbow, 6, "#df6a62");
        }
        drawVisualHand("left", b.leftHand);
      } else {
        drawBody(b.rightUpperArm, "#188d9f"); drawBody(b.rightForearm, "#27b8bf");
        if (jointDots) {
          drawJoint(armData.armForm.points.right.shoulder, 5, "#188d9f");
          drawJoint(armData.armForm.points.right.elbow, 6, "#27b8bf");
        }
        drawVisualHand("right", b.rightHand);
      }
    };
    const frontArm = armData.armForm.frontArm;
    const backArm = frontArm === "right" ? "left" : "right";
    const frontLeg = frontArm === "right" ? "left" : "right";
    const backLeg = frontLeg === "left" ? "right" : "left";
    const drawLeg = side => {
      if (side === "left") {
        drawBody(b.leftThigh, "#ef5f63"); drawBody(b.leftShin, "#f18b62"); drawBody(b.leftFoot, "#f5f0df");
      } else {
        drawBody(b.rightThigh, "#31b9c5"); drawBody(b.rightShin, "#55d5d0"); drawBody(b.rightFoot, "#f5f0df");
      }
    };
    drawArm(backArm);
    drawLeg(backLeg);
    const neck = physics.diagnostics().neck;
    ctx.strokeStyle = "#f3b58d"; ctx.lineWidth = 14; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(neck.torsoAnchor.x, neck.torsoAnchor.y); ctx.lineTo(neck.headAnchor.x, neck.headAnchor.y); ctx.stroke();
    drawBody(b.torso, "#f7cf59");
    drawLeg(frontLeg);
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
    updateArmFormTest(delta);
    physics.step(delta);
    updateElbowMatrixTest(delta);
    updateArmConnectionTest(delta);
    updatePhysicsTest(delta);
    updateRace(now);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const desiredCamera = physics.bodies.torso.position.x - (width / viewScale) * 0.38;
    const cameraError = desiredCamera - cameraX;
    if (Math.abs(cameraError) > 80) cameraX += Math.sign(cameraError) * (Math.abs(cameraError) - 80) * 0.025;
    draw(width, height);
    distanceEl.textContent = `${race.currentDistance.toFixed(2)} m`;
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
  retry();
  if (raceTestMode) {
    window.__QWOP_RACE_TEST__ = {
      snapshot: () => race.snapshot(),
      forceDistance: distance => updateRace(performance.now(), distance),
      invalidate: reason => invalidateRace(reason || "TEST DEBUG"),
      retry
    };
  }
  requestAnimationFrame(frame);
})();
