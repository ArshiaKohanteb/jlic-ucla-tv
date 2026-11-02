// Accounts for the sign-up site. Firebase keeps people signed in on their device.
import {
  getAuth, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile,
  sendPasswordResetEmail, setPersistence, browserLocalPersistence,
  RecaptchaVerifier, signInWithPhoneNumber, linkWithPhoneNumber,
} from "firebase/auth";
import { ref, get, update } from "firebase/database";
import { app, db } from "../shared/firebase.js";
import { isDemo } from "../shared/store.js";
import { can } from "../admin/access.js";

const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

const DEMO = { uid: "demo", name: "Arshia Kohanteb", email: "demo@preview", counts: true, phone: "", admin: true };

export function watchAccount(cb) {
  if (isDemo()) {
    cb(JSON.parse(localStorage.getItem("jlic-app-demo-user") || "null"));
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return cb(null);
    let saved = null, staff = null;
    try { saved = (await get(ref(db, `users/${user.uid}`))).val(); } catch { /* rules not published yet */ }
    try { staff = (await get(ref(db, `tvAdmins/${user.uid}`))).val(); } catch { /* not staff */ }
    cb({
      uid: user.uid, email: user.email, name: saved?.name || user.displayName || staff?.name || "",
      counts: saved?.counts !== false, phone: saved?.phone || user.phoneNumber || "",
      phoneLogin: !!user.phoneNumber, admin: !!staff && can(staff, "schedule"),
    });
  });
}

function demoIn() {
  localStorage.setItem("jlic-app-demo-user", JSON.stringify(DEMO));
  location.reload();
}

export const signInEmail = (email, password) => (isDemo() ? demoIn() : signInWithEmailAndPassword(auth, email.trim(), password));
export async function createEmail(name, email, password, phone) {
  if (isDemo()) return demoIn();
  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(user, { displayName: name.trim() });
  await update(ref(db, `users/${user.uid}`), { name: name.trim(), phone, counts: true });
}
// Text-message sign-in. Google requires its invisible robot check first.
let robotCheck = null;
const robot = () => (robotCheck ||= new RecaptchaVerifier(auth, "robot-check", { size: "invisible" }));
export function sendCode(phone) {
  if (isDemo()) return Promise.resolve({ confirm: async () => demoIn() });
  return signInWithPhoneNumber(auth, phone, robot());
}
// Lets someone who has an email account also sign in with their phone.
export function linkPhone(phone) {
  if (isDemo()) return Promise.resolve({ confirm: async () => {} });
  return linkWithPhoneNumber(auth.currentUser, phone, robot());
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

// Any way someone types it, stored in one form.
export function cleanPhone(v) {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d[0] === "1") return "+" + d;
  return d.length > 10 ? "+" + d : "";
}

// "Ariel Kohanteb" becomes "Ariel K." The TV shows these, so full names stay private.
export function shortName(name) {
  const [first, ...rest] = String(name || "").trim().split(/\s+/);
  const last = rest[rest.length - 1];
  return (last ? `${first} ${last[0].toUpperCase()}.` : first || "Someone").slice(0, 40);
}

export function friendlyError(e) {
  const c = e?.code || "";
  if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found") return "That email or password didn't match.";
  if (c === "auth/email-already-in-use") return "That email already has an account. Sign in instead.";
  if (c === "auth/weak-password") return "Use at least 6 characters.";
  if (c === "auth/invalid-email") return "Check that email address.";
  if (c === "auth/invalid-verification-code") return "That code didn't match.";
  if (c === "auth/invalid-phone-number") return "Check that phone number.";
  if (c === "auth/too-many-requests") return "Too many tries. Wait a little and try again.";
  if (c === "auth/credential-already-in-use" || c === "auth/provider-already-linked") return "That number is already on another account.";
  if (c === "auth/billing-not-enabled") return "Text sign-in isn't switched on yet. Use email.";
  if (c === "auth/unauthorized-domain" || c === "auth/operation-not-allowed") return "That sign-in isn't switched on yet. Use email.";
  return "That didn't work. Try again.";
}
