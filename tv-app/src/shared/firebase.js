import { initializeApp } from "firebase/app";
import { getDatabase, ref } from "firebase/database";

// Paste the web app config from the JLIC UCLA Firebase project (see SETUP.md).
export const firebaseConfig = {
  apiKey: "AIzaSyDC4Rqtm7-sV6QrBoDfUnWwJfUjijpRa4I",
  authDomain: "jlic-ucla-tv.firebaseapp.com",
  databaseURL: "https://jlic-ucla-tv-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "jlic-ucla-tv",
  storageBucket: "jlic-ucla-tv.firebasestorage.app",
  messagingSenderId: "492455461177",
  appId: "1:492455461177:web:3395a5be6523cd9281a8e8"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export const TV_PATH = "tv";
export const tvRef = (path = "") => ref(db, path ? `${TV_PATH}/${path}` : TV_PATH);
export const adminsRef = (uid = "") => ref(db, uid ? `tvAdmins/${uid}` : "tvAdmins");
