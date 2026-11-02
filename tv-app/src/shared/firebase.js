import { initializeApp } from "firebase/app";
import { getDatabase, ref } from "firebase/database";

// Paste the web app config from the JLIC UCLA Firebase project (see SETUP.md).
export const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://PASTE_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID",
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export const TV_PATH = "tv";
export const tvRef = (path = "") => ref(db, path ? `${TV_PATH}/${path}` : TV_PATH);
export const adminsRef = (uid = "") => ref(db, uid ? `tvAdmins/${uid}` : "tvAdmins");
