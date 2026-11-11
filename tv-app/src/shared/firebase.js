import { initializeApp } from "firebase/app";
import { getDatabase, ref, connectDatabaseEmulator } from "firebase/database";

// Paste the web app config from the JLIC UCLA Firebase project (see SETUP.md).
export const firebaseConfig = {
  apiKey: "AIzaSyDC4Rqtm7-sV6QrBoDfUnWwJfUjijpRa4I",
  authDomain: "jlic-ucla-tv.firebaseapp.com",
  databaseURL: "https://jlic-ucla-tv.firebaseio.com",
  projectId: "jlic-ucla-tv",
  storageBucket: "jlic-ucla-tv.firebasestorage.app",
  messagingSenderId: "492455461177",
  appId: "1:492455461177:web:3395a5be6523cd9281a8e8"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Testing on one computer: ?emulator reads and writes the local database emulator
// (see bot/README.md). Only on localhost, so the live site can't be pointed at it.
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has("emulator")) {
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
}

export const TV_PATH = "tv";
export const tvRef = (path = "") => ref(db, path ? `${TV_PATH}/${path}` : TV_PATH);
export const adminsRef = (uid = "") => ref(db, uid ? `tvAdmins/${uid}` : "tvAdmins");
