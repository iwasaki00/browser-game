import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getDatabase,
  onValue,
  ref,
  set
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const connectionStatus = document.querySelector("#connectionStatus");
const latestMessage = document.querySelector("#latestMessage");
const lastUpdated = document.querySelector("#lastUpdated");

let writeSucceeded = false;
let readSucceeded = false;
let writtenMessage = "";

const formatDisplayTime = (date) =>
  new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(date);

const setStatus = (message, state) => {
  connectionStatus.textContent = message;
  connectionStatus.className = `status ${state}`;
};

const markSuccessIfReady = () => {
  if (writeSucceeded && readSucceeded) {
    setStatus("接続成功", "success");
  }
};

const hasPlaceholderConfig = () =>
  Object.values(firebaseConfig).some((value) => value.startsWith("YOUR_"));

const showError = (error) => {
  setStatus("接続失敗", "error");
  latestMessage.textContent = error.message;
  lastUpdated.textContent = formatDisplayTime(new Date());
};

const startConnectionTest = async () => {
  if (hasPlaceholderConfig()) {
    throw new Error("firebase-config.js に Firebase の設定を入力してください。");
  }

  setStatus("接続確認中", "pending");

  const app = initializeApp(firebaseConfig);
  const database = getDatabase(app);
  const messageRef = ref(database, "test/message");

  onValue(messageRef, (snapshot) => {
    const value = snapshot.val();

    latestMessage.textContent = value ?? "-";
    lastUpdated.textContent = formatDisplayTime(new Date());

    if (value === writtenMessage) {
      readSucceeded = true;
      markSuccessIfReady();
    }
  }, showError);

  writtenMessage = new Date().toISOString();
  await set(messageRef, writtenMessage);
  writeSucceeded = true;
  markSuccessIfReady();
};

startConnectionTest().catch(showError);
