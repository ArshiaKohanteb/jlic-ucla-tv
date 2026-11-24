// Shows the bot's WhatsApp link code (QR) right in the terminal, for linking without the
// dashboard. Reads the same status the dashboard does. Ctrl+C closes it; the bot keeps running.
//
//   npm i --no-save qrcode-terminal
//   FIREBASE_SERVICE_ACCOUNT="$(cat ~/firebase-key.json)" node show-qr.js
import { initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import qrt from "qrcode-terminal";

initializeApp({
  credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}")),
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://jlic-ucla-tv.firebaseio.com",
});

getDatabase().ref("waBot/status").on("value", (snap) => {
  const s = snap.val() || {};
  console.clear();
  console.log("Bot:", s.state || "not started", s.groups ? "· " + s.groups.join(", ") : "");
  if (s.qr) {
    qrt.generate(s.qr, { small: true });
    console.log("WhatsApp → Settings → Linked devices → Link a device, and scan. It refreshes every ~20s.");
  }
  if (s.state === "online") console.log("Linked. Press Ctrl+C to close this (the bot keeps running).");
});
