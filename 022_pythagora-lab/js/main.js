(function loadCompleteApplication(global) {
  "use strict";
  const files = [
    "./js/stages-full.js",
    "./js/parts-advanced.js",
    "./js/game-advanced.js",
    "./js/release.js",
    "./js/app-final.js"
  ];
  let index = 0;

  function next() {
    if (index >= files.length) {
      global.PythagoraLab.startApplication();
      return;
    }
    const script = document.createElement("script");
    script.src = files[index++];
    script.async = false;
    script.onload = next;
    script.onerror = () => {
      const fatal = document.getElementById("fatalError");
      if (fatal) fatal.hidden = false;
    };
    document.body.appendChild(script);
  }

  next();
})(window);
