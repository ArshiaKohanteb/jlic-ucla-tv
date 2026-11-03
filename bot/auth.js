// The WhatsApp login lives in the database (/waBot/auth) instead of on disk, so the
// bot can run on any cloud box and survive restarts without a volume. Clients can't read it.
import { initAuthCreds, BufferJSON, proto } from "@whiskeysockets/baileys";

const enc = (id) => Buffer.from(String(id)).toString("base64url");
const pack = (v) => JSON.stringify(v, BufferJSON.replacer);
const unpack = (s) => (s == null ? null : JSON.parse(s, BufferJSON.reviver));

export async function useDbAuthState(db) {
  const root = db.ref("waBot/auth");
  const creds = unpack((await root.child("creds").get()).val()) || initAuthCreds();
  return {
    state: {
      creds,
      keys: {
        async get(type, ids) {
          const out = {};
          await Promise.all(ids.map(async (id) => {
            let v = unpack((await root.child(`keys/${type}/${enc(id)}`).get()).val());
            if (v && type === "app-state-sync-key") v = proto.Message.AppStateSyncKeyData.fromObject(v);
            out[id] = v;
          }));
          return out;
        },
        async set(data) {
          const patch = {};
          for (const type of Object.keys(data)) {
            for (const id of Object.keys(data[type])) patch[`keys/${type}/${enc(id)}`] = data[type][id] ? pack(data[type][id]) : null;
          }
          if (Object.keys(patch).length) await root.update(patch);
        },
      },
    },
    saveCreds: () => root.child("creds").set(pack(creds)),
    clear: () => root.remove(),
  };
}
