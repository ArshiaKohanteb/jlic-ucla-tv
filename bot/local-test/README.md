# WhatsApp bot: local test

Runs the bot on one computer against the Firebase database emulator, so nothing touches the
live site or the real group, and no service account key is needed. Use a test WhatsApp number
and a test group (its name must contain "minyan").

## What you need

- Node 20+, with `npm install` already run in `bot/` and `tv-app/`
- Java 17+ for the emulator (any JRE, e.g. a portable Temurin 21 unzipped into `local-test/java/`)

## Steps (run from `bot/local-test`)

1. Copy the rules in (the emulator only reads files inside this folder):
   ```bash
   cp ../../firebase/database.rules.json .
   ```
2. Start the local database and keep it running. Its viewer is at http://127.0.0.1:4000.
   ```bash
   npx firebase-tools@14 emulators:start --only database --project jlic-ucla-tv
   ```
3. Load the sample minyanim (Shacharit 7:00 / 7:30 / 8:00 / 8:30, and Mincha):
   ```bash
   curl -X PUT -H "Authorization: Bearer owner" --data @seed.json "http://127.0.0.1:9000/tv.json?ns=jlic-ucla-tv"
   ```
4. Start the bot from `bot/`:
   ```bash
   FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000 WA_GROUP=minyan npm start
   ```
5. Open `link.html` in a browser. On the bot's phone: WhatsApp → Settings → Linked devices →
   Link a device, and scan the code. (Or set `WA_PHONE=1XXXXXXXXXX` in step 4 and type the
   8-letter code it prints, with "Link with phone number instead".)
6. Build and preview the TV from `tv-app/` (`npx vite build && npm run preview`), then open
   http://localhost:8080/tv/?emulator&hold=minyan. `?emulator` only works on localhost.
7. Post a poll in the test group, e.g. "Shacharit tomorrow?" with a few times, and vote.

Stopping the emulator wipes its data, including the bot's WhatsApp login, so you link again
next time.

## Results (2026-11-10)

- `npm test` in `bot/`: 4 of 4 pass (times, dates, minyan, options and choices).
- The bot as committed crashed on start with `admin.database is not a function`:
  firebase-admin 14 dropped the old `admin.*` API. Fixed in `index.js` with the per-service
  imports (`firebase-admin/app`, `/database`, `/auth`). This affects the Railway deploy too.
- Linked by QR to a test number; status went to `online` and it found the test group.
- A poll "Shacharit Tommorrow?" (misspelled on purpose) with 7:00 / 8:00 / 8:15 / 9:13 was read
  as tomorrow's Shacharit, and its times became that day's choices.
- A vote for 8:15 was saved about 5 seconds later under `signups/<date>/shach/wa_<hash>`, with
  the voter's WhatsApp name and no phone number.
- The TV poll slide showed the voter as "First L." in the 8:15 column, marked as leading with
  "needs 9 more", and the bottom bar switched to Shacharit 8:15 tomorrow.
- Harmless: right after linking, Baileys logs "failed to find key ... to decode mutation"
  (app-state sync) a few times.
- Not tested here: reaching 10 real votes, the dashboard's link screen, and Railway.
