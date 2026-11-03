# WhatsApp bot

Reads the minyan polls in the WhatsApp group and adds every vote to the sign-ups, live.
The site, dashboard and TV then count WhatsApp votes and site sign-ups together.

- It is a linked device on its **own WhatsApp number**, like WhatsApp Web. WhatsApp doesn't
  allow bots on regular accounts, so that number could be banned one day. Use a spare one,
  never someone's personal number.
- It only reads. It never posts in the group.
- Someone whose WhatsApp number matches their site account counts as that person, so nobody
  is counted twice. Everyone else shows by their WhatsApp name.
- Taking a vote back, or voting No, takes them off the list (only if they signed up through WhatsApp).

## How polls are read

The poll's question says which minyan and day: "Shacharit tomorrow?", "Mincha today at 1:10?",
"Thursday shacharis". With no day it means tomorrow. With no minyan named, it's the only minyan
that day, or it's ignored (so a pizza poll does nothing).

Options can be times ("8:00", "9 AM") or anything else. "No", "Can't", "Maybe" don't count.
Anything else counts as yes. With two or more times, those become the minyan's choices for the
day, exactly like a poll opened from the dashboard.

Polls posted before the bot joined the group aren't seen. Post a fresh one.

## Setup (about 20 minutes, once)

1. **A number.** Get a spare number (a cheap prepaid SIM works; WhatsApp often rejects
   Google Voice). Install WhatsApp on any phone with it, then add that number to the minyan group.
2. **A Firebase key.** Firebase console → `jlic-ucla-tv` → gear → Project settings →
   Service accounts → Generate new private key. Keep the file private: it can change everything.
3. **Rules.** Paste `firebase/database.rules.json` into Realtime Database → Rules → Publish.
4. **Host it on Railway** (about $5 a month, always on):
   - railway.com → New project → Deploy from GitHub repo → `jlic-ucla-tv`.
   - Service → Settings → Root directory: `bot`.
   - Service → Variables:
     - `FIREBASE_SERVICE_ACCOUNT`: the whole contents of the key file from step 2
     - `WA_GROUP`: a word from the group's name (defaults to `minyan`)
     - `WA_PHONE` (optional): the bot's number with country code, for example `13105550123`,
       to also get an 8-letter link code
5. **Link it.** Dashboard → Minyan → Polls → WhatsApp shows a QR code. On the bot's phone:
   WhatsApp → Settings → Linked devices → Link a device, and scan it. The card turns to
   "Reading …" with the group's name.

The login is kept in the database (`/waBot/auth`), so restarts and redeploys stay linked.
If it ever gets unlinked, a new code appears on the dashboard.

## Run it locally

```
cd bot
npm install
FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" npm start
npm test
```
