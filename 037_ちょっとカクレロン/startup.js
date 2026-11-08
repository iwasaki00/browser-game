"use strict";

// Runs before game modules. Never records errors, file names or photo data.
(() => {
  const notice = document.querySelector("#startup-status");
  const input = document.querySelector("#image-input");
  const fail = () => {
    if (document.documentElement.dataset.appReady === "true") return;
    notice.hidden = false;
    notice.textContent = globalThis.location.protocol === "file:"
      ? "アプリを起動できませんでした。HTTP(S)のURLからページを開き直してください。"
      : "アプリを起動できませんでした。ページを再読み込みしてください。改善しない場合は配信ファイルをご確認ください。";
  };
  window.addEventListener("error", fail, true);
  window.addEventListener("unhandledrejection", fail);
  window.addEventListener("load", fail);
  document.querySelectorAll(".image-picker").forEach(label => {
    label.addEventListener("keydown", event => {
      if ((event.key !== "Enter" && event.key !== " ") || event.repeat) return;
      event.preventDefault();
      // Synchronous trusted keyboard activation; no async work before click.
      try { input.click(); }
      catch {
        document.querySelector("#status").textContent = "写真の選択画面を開けませんでした。画像選択をタップして再度お試しください。";
      }
    });
  });
})();
