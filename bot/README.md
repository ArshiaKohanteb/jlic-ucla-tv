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

Every poll is sorted into one of four prayers, shown on the site as **Shacharit**, **Mincha**,
**Mincha/Arvit** and **Arvit**, whatever the group calls them:

| Prayer | Understood from |
|---|---|
| Shacharit | shacharit/shacharis, שחרית, morning, "Prayer of the dawn", Hoshana Rabbah; or a poll whose times are all in the morning ("Optimal Tuesday minyan") |
| Mincha | mincha, מנחה, afternoon, "Meal offering", "Grain offering" (Mincha's literal meaning) |
| Mincha/Arvit | "Mincha/Maariv", "mincha maariv", Kabbalat Shabbat ("kabshab"), "4:45 with maariv" |
| Arvit | arvit, maariv, ערבית, מעריב, evening |

Each option counts on its own: in a "Meal offering" poll, "6:25 mincha/maariv" goes to
Mincha/Arvit, and in "Mincha and/or maariv", "Post vigil maariv ~8:45" goes to Arvit. If the
site doesn't have a minyan for that prayer yet, the bot adds one with no regular days, so it
shows on the TV only on days it has a poll.

**Which day:** a day in the question ("Monday", "ב׳ בשבת", "tomorrow", "tonight", "11/25")
wins. With none, it's today if that prayer is still ahead today, otherwise tomorrow.

**Options:** times ("8:00", "1", "333 pm", "12:07 (following chabura)"), or no ("No", "Can't",
"Sorry"). Anything else ("Netz at Dodger Stadium", "Still on vacation") doesn't count. A yes/no
poll with a time in the question ("Mincha 115") counts its yes votes for that time. A time that
can't be right for the prayer ("2am" for Mincha) is flipped to PM, or dropped.

**Not minyan polls** ("Who should make the mincha poll?", a pizza poll) have no time anywhere,
so they're ignored.

Polls posted before the bot joined the group aren't seen. Post a fresh one.

## Setup (about 20 minutes, once)

1. **A number.** Get a spare number (a cheap prepaid SIM works; WhatsApp often rejects
   Google Voice). Install WhatsApp on any phone with it, then add that number to the minyan group.
2. **A Firebase key.** Firebase console → `jlic-ucla-tv` → gear → Project settings →
   Service accounts → Generate new private key. Keep the file private: it can change everything.
3. **Rules.** Paste `firebase/database.rules.json` into Realtime Database → Rules → Publish.
4. **Host it.** Free: a Google Cloud e2-micro server, step by step in [HOSTING-GCP.md](HOSTING-GCP.md).
   Or on Railway (about $5 a month, least setup):
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
