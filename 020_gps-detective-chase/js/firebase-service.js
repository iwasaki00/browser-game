import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getDatabase, ref, get, set, update, remove, onValue, onDisconnect, runTransaction, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";
const app = initializeApp(firebaseConfig); export const db = getDatabase(app); const auth = getAuth(app);
export const pathRef = p => ref(db, `rooms/gps-detective-chase/${p}`);
export async function authenticate() { if (!auth.currentUser) await signInAnonymously(auth); return auth.currentUser || await new Promise(r => onAuthStateChanged(auth, r)); }
export { get, set, update, remove, onValue, onDisconnect, runTransaction, push, serverTimestamp };
