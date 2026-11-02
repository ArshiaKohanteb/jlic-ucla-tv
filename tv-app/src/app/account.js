// Accounts for the sign-up site. Firebase keeps people signed in on their device.
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile,
  sendPasswordResetEmail, setPersistence, browserLocalPersistence,
} from "firebase/auth";
import { ref, get, update } from "firebase/database";
import { app, db } from "../shared/firebase.js";
import { isDemo } from "../shared/store.js";

const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

const DEMO = { uid: "demo", name: "Arshia Kohanteb", email: "demo@preview", counts: true };

export function watchAccount(cb) {
  if (isDemo()) {
    cb(JSON.parse(localStorage.getItem("jlic-app-demo-user") || "null"));
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return cb(null);
    let saved = null;
    try { saved = (await get(ref(db, `users/${user.uid}`))).val(); } catch { /* rules not published yet */ }
    cb({ uid: user.uid, email: user.email, name: saved?.name || user.displayName || "", counts: saved?.counts !== false });
  });
}

function demoIn() {
  localStorage.setItem("jlic-app-demo-user", JSON.stringify(DEMO));
  location.reload();
}

export const signInGoogle = () => (isDemo() ? demoIn() : signInWithPopup(auth, new GoogleAuthProvider()));
export const signInEmail = (email, password) => (isDemo() ? demoIn() : signInWithEmailAndPassword(auth, email.trim(), password));
export async function createEmail(name, email, password) {
  if (isDemo()) return demoIn();
  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(user, { displayName: name.trim() });
  await update(ref(db, `users/${user.uid}`), { name: name.trim(), counts: true });
}
export const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim());

export function saveProfile(user, patch) {
  if (isDemo()) { localStorage.setItem("jlic-app-demo-user", JSON.stringify({ ...user, ...patch })); return Promise.resolve(); }
  return update(ref(db, `users/${user.uid}`), patch);
}

export function leave() {
  if (isDemo()) { localStorage.removeItem("jlic-app-demo-user"); location.reload(); return; }
  return signOut(auth);
}

// "Ariel Kohanteb" becomes "Ariel K." The TV shows these, so full names stay private.
export function shortName(name) {
  const [first, ...rest] = String(name || "").trim().split(/\s+/);
  const last = rest[rest.length - 1];
  return (last ? `${first} ${last[0].toUpperCase()}.` : first || "Someone").slice(0, 40);
}

export function friendlyError(e) {
  const c = e?.code || "";
  if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return "";
  if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found") return "That email or password didn't match.";
  if (c === "auth/email-already-in-use") return "That email already has an account. Sign in instead.";
  if (c === "auth/weak-password") return "Use at least 6 characters.";
  if (c === "auth/invalid-email") return "Check that email address.";
  if (c === "auth/popup-blocked") return "Your browser blocked the Google window. Use email below.";
  if (c === "auth/unauthorized-domain" || c === "auth/operation-not-allowed") return "Google sign-in isn't switched on yet. Use email below.";
  return "That didn't work. Try again.";
}
