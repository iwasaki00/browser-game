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
  const physics = new QWOPPhysics.RunnerPhysics();
  const activePointers = new Map();

  let debug = false;
  let cameraX = 0;
  let cameraInitialized = false;
  let viewScale = 1;
  let lastTime = performance.now();
  let fps = 60;
  const demoSequence = QWOPPhysics.DEMO_FORWARD_SEQUENCE;
  const demo = { active: false, phaseIndex: 0, phaseElapsed: 0, totalElapsed: 0, startX: 0 };
  const velocitySamples = [];
  let averageVelocityX = 0;

  const parameterSpec = {
    gravity: ["重力", 0.35, 1.2, 0.01, 2],
    groundFriction: ["地面摩擦", 0.4, 1.8, 0.01, 2],
    footFriction: ["足の摩擦", 0.5, 2.2, 0.01, 2],
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
    cameraInitialized = true;
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
    if (demo.active) return;
    setInput(key, true);
  });

  document.addEventListener("keyup", event => {
    const key = event.key.toLowerCase();
    if (!(key in physics.inputState)) return;
    event.preventDefault();
    if (demo.active) return;
    setInput(key, false);
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
  panel.insertBefore(controlTest, document.querySelector("#resetParameters"));
  panel.insertBefore(diagnosticsEl, controlTest);

  const demoPanel = document.createElement("section");
  demoPanel.className = "demo-controls";
  demoPanel.innerHTML = `<h3>FORWARD REFERENCE</h3><p class="demo-status">DEMO: OFF</p><div><button type="button" class="start-demo">DEMO FORWARD</button><button type="button" class="stop-demo" disabled>STOP DEMO</button></div>`;
  panel.insertBefore(demoPanel, diagnosticsEl);
  const demoStatus = demoPanel.querySelector(".demo-status");
  const startDemoButton = demoPanel.querySelector(".start-demo");
  const stopDemoButton = demoPanel.querySelector(".stop-demo");

  function applyDemoPhase() {
    clearInputs();
    const phase = demoSequence[demo.phaseIndex];
    phase.keys.forEach(key => setInput(key, true));
    demoStatus.textContent = `DEMO: FORWARD  /  PHASE: ${phase.name}`;
  }

  function startDemo() {
    clearInputs();
    activePointers.clear();
    demo.active = true;
    demo.phaseIndex = 0;
    demo.phaseElapsed = 0;
    demo.totalElapsed = 0;
    demo.startX = physics.bodies.torso.position.x;
    startDemoButton.disabled = true;
    stopDemoButton.disabled = false;
    applyDemoPhase();
  }

  function stopDemo(clear = true) {
    demo.active = false;
    demo.phaseIndex = 0;
    demo.phaseElapsed = 0;
    startDemoButton.disabled = false;
    stopDemoButton.disabled = true;
    demoStatus.textContent = "DEMO: OFF";
    if (clear) clearInputs();
  }

  function updateDemo(delta) {
    if (!demo.active) return;
    demo.phaseElapsed += delta;
    demo.totalElapsed += delta;
    let phase = demoSequence[demo.phaseIndex];
    while (demo.phaseElapsed >= phase.duration) {
      demo.phaseElapsed -= phase.duration;
      demo.phaseIndex = (demo.phaseIndex + 1) % demoSequence.length;
      phase = demoSequence[demo.phaseIndex];
      applyDemoPhase();
    }
  }

  startDemoButton.addEventListener("click", startDemo);
  stopDemoButton.addEventListener("click", () => stopDemo());

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
  }

  retryButton.addEventListener("click", retry);
  debugButton.addEventListener("click", () => {
    debug = !debug;
    panel.hidden = !debug;
    debugButton.textContent = debug ? "DEBUG ON" : "DEBUG";
    debugButton.setAttribute("aria-pressed", String(debug));
    if (!debug && demo.active) stopDemo();
  });

  document.querySelector("#resetParameters").addEventListener("click", () => {
    physics.resetParameters();
    parameterRoot.querySelectorAll("input").forEach(input => {
      input.value = physics.params[input.dataset.parameter];
      input.dispatchEvent(new Event("input"));
    });
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
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);
    ctx.beginPath();
    ctx.arc(0, 0, active ? 13 : 11, 0, Math.PI * 2);
    ctx.fillStyle = active ? "#fff36b" : "rgba(7,17,31,.86)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = active ? "#07111f" : "#fff";
    ctx.stroke();
    ctx.fillStyle = active ? "#07111f" : "#fff";
    ctx.font = `900 ${active ? 16 : 14}px monospace`;
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
      `TORSO  angle ${degrees(c.torso.current)}  angular velocity ${data.torsoAngularVelocity.toFixed(4)}`,
      jointLine("R HIP", c.rightHip),
      jointLine("L HIP", c.leftHip),
      jointLine("R KNEE", c.rightKnee),
      jointLine("L KNEE", c.leftKnee),
      `POSITION  x ${data.position.x.toFixed(2)}  y ${data.position.y.toFixed(2)}`,
      `VELOCITY  x ${data.velocity.x.toFixed(3)}  y ${data.velocity.y.toFixed(3)}`
      ,`VELOCITY X AVG (1s) ${averageVelocityX.toFixed(3)}`
      ,`HEAD  x ${data.headPosition.x.toFixed(2)}  y ${data.headPosition.y.toFixed(2)}`
      ,`NECK  ${data.neck.connected ? "CONNECTED" : "LOOSE"}  anchor gap ${data.neck.distance.toFixed(2)}`
      ,`DEMO  ${demo.active ? "ON" : "OFF"}  phase ${demo.active ? demoSequence[demo.phaseIndex].name : "-"}  elapsed ${(demo.totalElapsed / 1000).toFixed(2)}s`
      ,`ORIENTATION  ${matchMedia("(orientation: portrait)").matches ? "PORTRAIT" : "LANDSCAPE"}`
    ].join("\n");
  }

  function drawDebug() {
    const bodies = physics.bodies;
    ctx.strokeStyle = "#ff2a63";
    ctx.lineWidth = 1;
    Object.values(bodies).forEach(body => { bodyPath(body); ctx.stroke(); });
    ctx.fillStyle = "#ff2a63";
    physics.constraints.forEach(constraint => {
      const x = (constraint.bodyA.position.x + constraint.bodyB.position.x) / 2;
      const y = (constraint.bodyA.position.y + constraint.bodyB.position.y) / 2;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    const torso = bodies.torso;
    ctx.fillStyle = "#ffe066";
    ctx.beginPath();
    ctx.arc(torso.position.x, torso.position.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffe066";
    ctx.beginPath();
    ctx.moveTo(torso.position.x, torso.position.y);
    ctx.lineTo(torso.position.x + torso.velocity.x * 18, torso.position.y + torso.velocity.y * 18);
    ctx.stroke();
    const neck = physics.diagnostics().neck;
    ctx.strokeStyle = neck.connected ? "#63e6e2" : "#ff2a63";
    ctx.beginPath();
    ctx.moveTo(neck.torsoAnchor.x, neck.torsoAnchor.y);
    ctx.lineTo(neck.headAnchor.x, neck.headAnchor.y);
    ctx.stroke();
    [neck.torsoAnchor, neck.headAnchor].forEach(anchor => {
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, 4, 0, Math.PI * 2);
      ctx.fill();
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
      ctx.beginPath();
      ctx.moveTo(x, 497);
      ctx.lineTo(x - 34, 538);
      ctx.stroke();
    }

    ctx.fillStyle = "#163044";
    ctx.font = "800 11px monospace";
    ctx.fillText("START", physics.startX - 24, 478);
    ctx.fillRect(physics.startX, 459, 3, 30);
    for (let meter = -5; meter < 150; meter += 5) {
      const x = physics.startX + meter * QWOPPhysics.SCALE;
      ctx.fillRect(x, 481, 2, 8);
      if (meter % 10 === 0) ctx.fillText(`${meter}m`, x - 10, 470);
    }

    const b = physics.bodies;
    drawBody(b.leftThigh, "#ef5f63");
    drawBody(b.leftShin, "#f18b62");
    drawBody(b.leftFoot, "#f5f0df");
    drawBody(b.rightThigh, "#31b9c5");
    drawBody(b.rightShin, "#55d5d0");
    drawBody(b.rightFoot, "#f5f0df");
    const neck = physics.diagnostics().neck;
    ctx.strokeStyle = "#f3b58d";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(neck.torsoAnchor.x, neck.torsoAnchor.y);
    ctx.lineTo(neck.headAnchor.x, neck.headAnchor.y);
    ctx.stroke();
    drawBody(b.torso, "#f7cf59");
    ctx.beginPath();
    ctx.arc(b.head.position.x, b.head.position.y, b.head.circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#f3b58d";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#07111f";
    ctx.stroke();
    ctx.save();
    ctx.translate(b.head.position.x, b.head.position.y);
    ctx.rotate(b.head.angle);
    ctx.fillStyle = "#07111f";
    ctx.beginPath();
    ctx.arc(8, -5, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawPartLabel(b.rightThigh, "q");
    drawPartLabel(b.leftThigh, "w");
    drawPartLabel(b.rightShin, "o");
    drawPartLabel(b.leftShin, "p");

    if (debug) drawDebug();
    ctx.restore();
  }

  function frame(now) {
    const delta = Math.min(now - lastTime, 100);
    lastTime = now;
    updateDemo(delta);
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
  requestAnimationFrame(frame);
})();
